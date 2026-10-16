package main

import (
	"crypto/sha1"
	"encoding/hex"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode"
)

// The scanner builds the library purely from folder and file names. It never
// opens audio files, so cloud placeholders (e.g. Dropbox online-only files)
// are not downloaded until a track is actually played.

// audioTypes are the formats the WebView2/Chromium audio element can play.
var audioTypes = map[string]string{
	".mp3":  "audio/mpeg",
	".flac": "audio/flac",
	".wav":  "audio/wav",
	".m4a":  "audio/mp4",
	".aac":  "audio/aac",
	".ogg":  "audio/ogg",
	".oga":  "audio/ogg",
	".opus": "audio/ogg",
	".webm": "audio/webm",
}

// unsupportedAudio are audio formats we recognise but cannot play.
var unsupportedAudio = map[string]bool{
	".wma": true, ".aiff": true, ".aif": true, ".ape": true, ".wv": true, ".alac": true,
}

var imageTypes = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".webp": "image/webp",
	".gif":  "image/gif",
	".bmp":  "image/bmp",
}

var (
	reBrackets      = regexp.MustCompile(`\[[^\]]*\]|\{[^}]*\}`)
	reHashTag       = regexp.MustCompile(`\s#.*$`)
	reNoiseTokens   = regexp.MustCompile(`(?i)\b(flac|mp3|\d+\s*kbps|v0|v2|\d+\s*-?bit(\s*-?\s*\d+(\.\d+)?\s*khz)?)\b`)
	reYearSeparator = regexp.MustCompile(`\s+\(((?:19|20)\d{2})\)\s+(\w)`)
	reParens        = regexp.MustCompile(`\(([^()]*)\)`)
	reParenNoise    = regexp.MustCompile(`(?i)^\s*((?:19|20)\d{2}\s*,?\s*)?(.*\b(remaster(ed)?|reissue|rm|lp|vinyl|180g|deluxe|web|edition)\b.*|\d+\s*cds?|(cd|disc|disk)\s*\d+|\d+(\.\d+)?|(?:19|20)\d{2}|)\s*$`)
	reLeadingYear   = regexp.MustCompile(`^((?:19|20)\d{2})\s*[-.]?\s+`)
	reYear          = regexp.MustCompile(`\b((?:19[5-9]|20[0-4])\d)\b`)
	reDashSplit     = regexp.MustCompile(`\s+-\s+`)
	reYearsOnly     = regexp.MustCompile(`^[\d,\s]+$`)
	reCollection    = regexp.MustCompile(`(?i)\s+(vinyl pack|discography)$`)
	reDiscFolder    = regexp.MustCompile(`(?i)^(cd|disc|disk)\s*\d+$`)
	reTrackNumber   = regexp.MustCompile(`^(\d-\d{1,3}|[A-Da-d]?\d{1,3})([\s._-]+)(.+)$`)
	reSpaces        = regexp.MustCompile(`\s+`)
)

// genericFolders never name an artist.
var genericFolders = map[string]bool{
	"music": true, "cover": true, "covers": true, "scans": true, "art": true, "artwork": true,
}

// coverFolders are sub-folders that commonly hold album art.
var coverFolders = map[string]bool{
	"cover": true, "covers": true, "scans": true, "art": true, "artwork": true, "images": true, "[art]": true,
}

type albumGroup struct {
	dir   string
	root  string
	files []string
}

// ScanFolders walks the given folders and groups playable audio files into albums.
func ScanFolders(folders []string) ScanResult {
	res := ScanResult{FolderCounts: map[string]int{}}
	groups := map[string]*albumGroup{}
	seen := map[string]bool{}
	skippedExts := map[string]bool{}

	for _, root := range folders {
		root = filepath.Clean(root)
		count := 0
		err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				res.Errors = append(res.Errors, err.Error())
				if d != nil && d.IsDir() {
					return fs.SkipDir
				}
				return nil
			}
			if d.IsDir() {
				if path != root && strings.HasPrefix(d.Name(), ".") {
					return fs.SkipDir
				}
				return nil
			}
			ext := strings.ToLower(filepath.Ext(path))
			if unsupportedAudio[ext] {
				res.Skipped++
				skippedExts[ext] = true
				return nil
			}
			if _, ok := audioTypes[ext]; !ok {
				return nil
			}
			count++
			key := strings.ToLower(path)
			if seen[key] {
				return nil
			}
			seen[key] = true

			albumDir := filepath.Dir(path)
			if albumDir != root && reDiscFolder.MatchString(filepath.Base(albumDir)) {
				albumDir = filepath.Dir(albumDir)
			}
			g := groups[strings.ToLower(albumDir)]
			if g == nil {
				g = &albumGroup{dir: albumDir, root: root}
				groups[strings.ToLower(albumDir)] = g
			}
			g.files = append(g.files, path)
			return nil
		})
		if err != nil {
			res.Errors = append(res.Errors, err.Error())
		}
		res.FolderCounts[root] = count
	}

	for _, g := range groups {
		album := buildAlbum(g)
		res.TrackCount += len(album.Tracks)
		res.Albums = append(res.Albums, album)
	}
	sort.Slice(res.Albums, func(i, j int) bool {
		a, b := res.Albums[i], res.Albums[j]
		if !strings.EqualFold(a.Artist, b.Artist) {
			return naturalLess(a.Artist, b.Artist)
		}
		if a.Year != b.Year {
			return a.Year < b.Year
		}
		return naturalLess(a.Album, b.Album)
	})
	for ext := range skippedExts {
		res.SkippedExts = append(res.SkippedExts, ext)
	}
	sort.Strings(res.SkippedExts)
	return res
}

func buildAlbum(g *albumGroup) Album {
	sort.Slice(g.files, func(i, j int) bool {
		return naturalLess(relSortKey(g.dir, g.files[i]), relSortKey(g.dir, g.files[j]))
	})

	// Titles are cleaned per folder so disc sub-folders get their own common prefix.
	byDir := map[string][]string{}
	for _, f := range g.files {
		byDir[filepath.Dir(f)] = append(byDir[filepath.Dir(f)], f)
	}
	titles := map[string]string{}
	var prefixArtist string
	for _, files := range byDir {
		names := make([]string, len(files))
		for i, f := range files {
			names[i] = normaliseUnderscores(strings.TrimSuffix(filepath.Base(f), filepath.Ext(f)))
		}
		for i, t := range trackTitles(names) {
			titles[files[i]] = t
		}
		if prefixArtist == "" {
			prefixArtist = commonArtistPrefix(names)
		}
	}

	var artist, title string
	var year int
	if g.dir == g.root {
		title = filepath.Base(g.root)
	} else {
		artist, title, year = parseFolderName(filepath.Base(g.dir))
		// In "Sacaea/Jan 2003 - Mar 2003" the dash is part of the album name
		if parent := ancestorArtist(g.dir, g.root); parent != "" && artist != "" && !strings.EqualFold(artist, parent) {
			artist, title = parent, artist+" - "+title
		}
	}
	if artist == "" {
		artist = prefixArtist
	}
	if artist == "" {
		artist = ancestorArtist(g.dir, g.root)
	}
	if artist == "" {
		artist = "Unknown Artist"
	}
	if title == "" {
		title = filepath.Base(g.dir)
	}

	album := Album{
		ID:         albumID(g.dir),
		Artist:     artist,
		Album:      title,
		Year:       year,
		Genre:      []string{},
		Path:       g.dir,
		CoverImage: findCover(g.dir, g.root),
	}
	for _, f := range g.files {
		album.Tracks = append(album.Tracks, Track{
			Title:  titles[f],
			Path:   f,
			Format: strings.TrimPrefix(strings.ToLower(filepath.Ext(f)), "."),
		})
	}
	if album.CoverImage != "" {
		// Lets the UI refresh a cover that was replaced under the same file name
		if info, err := os.Stat(album.CoverImage); err == nil {
			album.CoverVersion = info.ModTime().Unix()
		}
	}
	// The audire.json sidecar is the only file the scanner reads
	if sc, err := readSidecar(g.dir); err == nil {
		applySidecar(&album, sc)
	}
	return album
}

func relSortKey(base, path string) string {
	if rel, err := filepath.Rel(base, path); err == nil {
		return rel
	}
	return path
}

func albumID(dir string) string {
	sum := sha1.Sum([]byte(strings.ToLower(dir)))
	return hex.EncodeToString(sum[:])[:12]
}

// parseFolderName extracts artist, album title and year from names such as
// "(2021) Alice Coltrane - Kirtan-Turiya Sings (1982, Reissue ) [FLAC]".
func parseFolderName(name string) (artist, album string, year int) {
	if m := reYear.FindStringSubmatch(name); m != nil {
		year, _ = strconv.Atoi(m[1])
	}
	s := normaliseUnderscores(name)
	s = reBrackets.ReplaceAllString(s, " ")
	s = reHashTag.ReplaceAllString(s, "")
	s = strings.Map(func(r rune) rune {
		if unicode.Is(unicode.So, r) || r == '️' {
			return -1
		}
		return r
	}, s)
	s = reNoiseTokens.ReplaceAllString(s, " ")
	s = reYearSeparator.ReplaceAllString(s, " - $2")
	s = reParens.ReplaceAllStringFunc(s, func(p string) string {
		if reParenNoise.MatchString(p[1 : len(p)-1]) {
			return " "
		}
		return p
	})
	s = cleanSpaces(s)
	s = reLeadingYear.ReplaceAllString(s, "")

	var parts []string
	for _, p := range reDashSplit.Split(s, -1) {
		p = strings.Trim(cleanSpaces(p), " -.,")
		if p == "" || reYearsOnly.MatchString(p) {
			continue
		}
		parts = append(parts, p)
	}
	switch {
	case len(parts) >= 2:
		return parts[0], strings.Join(parts[1:], " - "), year
	case len(parts) == 1:
		return "", parts[0], year
	}
	return "", "", year
}

// ancestorArtist names the artist after the nearest meaningful parent folder,
// e.g. "Lorn/Ask The Dust" -> "Lorn".
func ancestorArtist(dir, root string) string {
	for p := filepath.Dir(dir); len(p) > len(root) && strings.HasPrefix(strings.ToLower(p), strings.ToLower(root)); p = filepath.Dir(p) {
		base := filepath.Base(p)
		if genericFolders[strings.ToLower(base)] || reDiscFolder.MatchString(base) {
			continue
		}
		artist, album, _ := parseFolderName(base)
		if artist == "" {
			artist = album
		}
		if artist = reCollection.ReplaceAllString(artist, ""); artist != "" {
			return artist
		}
	}
	return ""
}

// commonArtistPrefix returns "The Tuss" when every file is named "The Tuss - ...".
func commonArtistPrefix(names []string) string {
	if len(names) < 2 {
		return ""
	}
	first := ""
	for i, n := range names {
		parts := reDashSplit.Split(n, 2)
		if len(parts) < 2 {
			return ""
		}
		if i == 0 {
			first = parts[0]
		} else if parts[0] != first {
			return ""
		}
	}
	if !strings.ContainsFunc(first, unicode.IsLetter) {
		return ""
	}
	return strings.TrimSpace(first)
}

// trackTitles strips shared prefixes ("Skee Mask - Shred - ") and leading
// track numbers ("01 - ", "A1 ", "1-2 - ") from file names.
func trackTitles(names []string) []string {
	prefix := ""
	if len(names) >= 2 {
		prefix = names[0]
		for _, n := range names[1:] {
			prefix = commonPrefix(prefix, n)
		}
		if i := strings.LastIndex(prefix, "-"); i >= 0 {
			prefix = prefix[:i+1]
			for _, n := range names {
				if strings.TrimSpace(strings.TrimPrefix(n, prefix)) == "" {
					prefix = ""
					break
				}
			}
		} else {
			prefix = ""
		}
		if !strings.ContainsFunc(prefix, unicode.IsLetter) {
			prefix = ""
		}
	}

	titles := make([]string, len(names))
	for i, n := range names {
		t := strings.TrimSpace(strings.TrimPrefix(n, prefix))
		for pass := 0; pass < 2; pass++ {
			m := reTrackNumber.FindStringSubmatch(t)
			if m == nil {
				break
			}
			sep, rest := m[2], m[3]
			if !strings.ContainsAny(sep, " \t") && unicode.IsDigit([]rune(rest)[0]) {
				break
			}
			t = rest
		}
		t = strings.Trim(cleanSpaces(t), " -.")
		if t == "" {
			t = n
		}
		titles[i] = t
	}
	return titles
}

// findCover looks for artwork next to the tracks, in an art sub-folder, or one
// level up. It only lists directories, never opening files.
func findCover(dir, root string) string {
	if best := bestImage(dir); best != "" {
		return best
	}
	if entries, err := os.ReadDir(dir); err == nil {
		for _, e := range entries {
			if e.IsDir() && coverFolders[strings.ToLower(e.Name())] {
				if best := bestImage(filepath.Join(dir, e.Name())); best != "" {
					return best
				}
			}
		}
	}
	if parent := filepath.Dir(dir); dir != root && len(parent) > len(root) {
		return findCover(parent, root)
	}
	return ""
}

func bestImage(dir string) string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return ""
	}
	best, bestScore := "", -1
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if _, ok := imageTypes[strings.ToLower(filepath.Ext(e.Name()))]; !ok {
			continue
		}
		name := strings.ToLower(e.Name())
		score := 1
		switch base := strings.TrimSuffix(name, filepath.Ext(name)); {
		case base == "cover" || base == "folder":
			score = 4 // e.g. a cover saved from the cover picker
		case strings.Contains(name, "back"), strings.Contains(name, "inlay"), strings.Contains(name, "tray"), strings.Contains(name, "cd"):
			score = 0
		case strings.Contains(name, "cover"), strings.Contains(name, "folder"), strings.Contains(name, "front"):
			score = 3
		case strings.Contains(name, "album"):
			score = 2
		}
		if score > bestScore {
			best, bestScore = filepath.Join(dir, e.Name()), score
		}
	}
	return best
}

func normaliseUnderscores(s string) string {
	if strings.Count(s, "_") > strings.Count(s, " ") {
		s = strings.ReplaceAll(s, "_", " ")
	}
	return cleanSpaces(s)
}

func cleanSpaces(s string) string {
	return strings.TrimSpace(reSpaces.ReplaceAllString(s, " "))
}

func commonPrefix(a, b string) string {
	ar, br := []rune(a), []rune(b)
	i := 0
	for i < len(ar) && i < len(br) && ar[i] == br[i] {
		i++
	}
	return string(ar[:i])
}

// naturalLess compares strings case-insensitively with numbers ordered by value,
// so "2 - x" sorts before "10 - y".
func naturalLess(a, b string) bool {
	ar, br := []rune(strings.ToLower(a)), []rune(strings.ToLower(b))
	i, j := 0, 0
	for i < len(ar) && j < len(br) {
		if unicode.IsDigit(ar[i]) && unicode.IsDigit(br[j]) {
			si := i
			for i < len(ar) && unicode.IsDigit(ar[i]) {
				i++
			}
			sj := j
			for j < len(br) && unicode.IsDigit(br[j]) {
				j++
			}
			na := strings.TrimLeft(string(ar[si:i]), "0")
			nb := strings.TrimLeft(string(br[sj:j]), "0")
			if len(na) != len(nb) {
				return len(na) < len(nb)
			}
			if na != nb {
				return na < nb
			}
			continue
		}
		if ar[i] != br[j] {
			return ar[i] < br[j]
		}
		i++
		j++
	}
	return len(ar)-i < len(br)-j
}
