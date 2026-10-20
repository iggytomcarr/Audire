package main

import (
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// CoverCandidate is an image the cover picker can offer
type CoverCandidate struct {
	URL    string `json:"url"`
	Thumb  string `json:"thumb"`
	Source string `json:"source"`
	Label  string `json:"label"`
	Size   string `json:"size,omitempty"`
}

// FindCoverCandidates searches Cover Art Archive, iTunes and Deezer for album art
func (a *App) FindCoverCandidates(albumID string) ([]CoverCandidate, error) {
	album, _, err := a.albumByID(albumID)
	if err != nil {
		return nil, err
	}
	artist := album.Artist
	if artist == "Unknown Artist" {
		artist = ""
	}
	var out []CoverCandidate
	var errs []string

	// Cover Art Archive, when the album has been matched on MusicBrainz
	if sc, err := loadSidecar(album.Path); err == nil {
		if id := mbIDFromURL(sc.Sources.MusicBrainz, "release-group"); id != "" {
			var res struct {
				Images []struct {
					Front      bool              `json:"front"`
					Image      string            `json:"image"`
					Thumbnails map[string]string `json:"thumbnails"`
				} `json:"images"`
			}
			if err := getJSON("https://coverartarchive.org/release-group/"+id, &res); err == nil {
				for _, img := range res.Images {
					if !img.Front {
						continue
					}
					full := firstNonEmpty(img.Thumbnails["1200"], img.Image)
					out = append(out, CoverCandidate{URL: full, Thumb: firstNonEmpty(img.Thumbnails["500"], img.Thumbnails["small"], full), Source: "Cover Art Archive", Label: album.Album})
				}
			}
		}
	}

	// iTunes artwork can be requested at any size up to the original
	var itunes struct {
		Results []struct {
			CollectionName string `json:"collectionName"`
			ArtistName     string `json:"artistName"`
			ArtworkURL100  string `json:"artworkUrl100"`
		} `json:"results"`
	}
	if err := getJSON("https://itunes.apple.com/search?entity=album&limit=12&term="+url.QueryEscape(strings.TrimSpace(artist+" "+album.Album)), &itunes); err != nil {
		errs = append(errs, err.Error())
	}
	for _, r := range itunes.Results {
		if r.ArtworkURL100 == "" {
			continue
		}
		out = append(out, CoverCandidate{
			URL:    strings.Replace(r.ArtworkURL100, "100x100bb", "1400x1400bb", 1),
			Thumb:  strings.Replace(r.ArtworkURL100, "100x100bb", "300x300bb", 1),
			Source: "Apple Music",
			Label:  r.ArtistName + " – " + r.CollectionName,
			Size:   "1400×1400",
		})
	}

	var deezer struct {
		Data []struct {
			Title    string `json:"title"`
			CoverXL  string `json:"cover_xl"`
			CoverBig string `json:"cover_big"`
			Artist   struct {
				Name string `json:"name"`
			} `json:"artist"`
		} `json:"data"`
	}
	if err := getJSON("https://api.deezer.com/search/album?limit=12&q="+url.QueryEscape(strings.TrimSpace(artist+" "+album.Album)), &deezer); err != nil {
		errs = append(errs, err.Error())
	}
	for _, d := range deezer.Data {
		if d.CoverXL == "" {
			continue
		}
		out = append(out, CoverCandidate{URL: d.CoverXL, Thumb: firstNonEmpty(d.CoverBig, d.CoverXL), Source: "Deezer", Label: d.Artist.Name + " – " + d.Title, Size: "1000×1000"})
	}

	if len(out) == 0 && len(errs) > 0 {
		return nil, fmt.Errorf("cover search failed: %s", strings.Join(errs, "; "))
	}
	return out, nil
}

// SaveCover downloads an image into the album folder as cover.<ext>, keeping any
// previous cover as "cover (previous).<ext>", and returns the updated album
func (a *App) SaveCover(albumID, imageURL, source string) (Album, error) {
	album, _, err := a.albumByID(albumID)
	if err != nil {
		return Album{}, err
	}
	if !a.inMusicFolder(album.Path) {
		return Album{}, fmt.Errorf("%s is not in a music folder", album.Path)
	}
	u, err := url.Parse(strings.TrimSpace(imageURL))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return Album{}, fmt.Errorf("that doesn't look like an image link")
	}

	req, err := http.NewRequest("GET", u.String(), nil)
	if err != nil {
		return Album{}, err
	}
	req.Header.Set("User-Agent", userAgent)
	resp, err := httpClient.Do(req)
	if err != nil {
		return Album{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Album{}, fmt.Errorf("download failed: %s", resp.Status)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 30<<20))
	if err != nil {
		return Album{}, err
	}
	ext := map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}[http.DetectContentType(data)]
	if ext == "" {
		return Album{}, fmt.Errorf("that link isn't a JPEG, PNG, WebP or GIF image")
	}

	// Move any existing cover.* aside so the new one is the only "cover" file
	entries, _ := os.ReadDir(album.Path)
	for _, e := range entries {
		name := e.Name()
		old := filepath.Ext(name)
		if e.IsDir() || !strings.EqualFold(strings.TrimSuffix(name, old), "cover") {
			continue
		}
		backup := filepath.Join(album.Path, "cover (previous)"+strings.ToLower(old))
		_ = os.Remove(backup)
		if err := os.Rename(filepath.Join(album.Path, name), backup); err != nil {
			return Album{}, fmt.Errorf("couldn't move the old cover aside: %w", err)
		}
	}
	dest := filepath.Join(album.Path, "cover"+ext)
	if err := os.WriteFile(dest, data, 0644); err != nil {
		return Album{}, err
	}

	if sc, err := loadSidecar(album.Path); err == nil {
		sc.Cover = &CoverRecord{File: filepath.Base(dest), Source: source, URL: u.String(), SavedAt: time.Now().Format(time.RFC3339)}
		_ = writeSidecar(album.Path, sc)
	}
	return a.rebuildAlbum(albumID)
}

// A cover smaller than this on its short side looks soft on the album page and in the room
const minCoverSide = 600

// coverProblem says what is wrong with an album's cover image, or "" if it looks fine:
// missing, too small, or not square (usually a scan of the whole gatefold or booklet)
func coverProblem(path string) string {
	if path == "" {
		return "no cover"
	}
	f, err := os.Open(path)
	if err != nil {
		return "unreadable"
	}
	defer f.Close()
	cfg, _, err := image.DecodeConfig(f)
	if err != nil {
		// WebP and other formats Go can't measure are left alone
		return ""
	}
	w, h := cfg.Width, cfg.Height
	switch {
	case min(w, h) < minCoverSide:
		return fmt.Sprintf("small (%d×%d)", w, h)
	case float64(max(w, h))/float64(min(w, h)) > 1.12:
		return fmt.Sprintf("not square (%d×%d)", w, h)
	}
	return ""
}

// betterCover picks the best replacement cover for an album: a square image of at least
// minCoverSide pixels whose listing matches the album, preferring Apple Music (original
// artwork at up to 3000 px), then Cover Art Archive (only offered for a verified
// MusicBrainz match), then Deezer. It returns false when nothing suitable turns up.
func (a *App) betterCover(albumID string) (CoverCandidate, bool, error) {
	album, _, err := a.albumByID(albumID)
	if err != nil {
		return CoverCandidate{}, false, err
	}
	candidates, err := a.FindCoverCandidates(albumID)
	if err != nil {
		return CoverCandidate{}, false, err
	}
	rank := map[string]int{"Apple Music": 0, "Cover Art Archive": 1, "Deezer": 2}
	sort.SliceStable(candidates, func(i, j int) bool { return rank[candidates[i].Source] < rank[candidates[j].Source] })
	for _, c := range candidates {
		if c.Source != "Cover Art Archive" {
			artist, title, _ := strings.Cut(c.Label, " – ")
			if !matchesAlbum(title, artist, album.Artist, album.Album) {
				continue
			}
		}
		if c.Source == "Apple Music" {
			c.URL = strings.Replace(c.URL, "1400x1400bb", "3000x3000bb", 1)
		}
		w, h, err := remoteImageSize(c.URL)
		if err != nil || min(w, h) < minCoverSide || float64(max(w, h))/float64(min(w, h)) > 1.05 {
			continue
		}
		c.Size = fmt.Sprintf("%d×%d", w, h)
		return c, true, nil
	}
	return CoverCandidate{}, false, nil
}

// remoteImageSize reads just enough of an image to learn its dimensions
func remoteImageSize(imageURL string) (int, int, error) {
	req, err := http.NewRequest("GET", imageURL, nil)
	if err != nil {
		return 0, 0, err
	}
	req.Header.Set("User-Agent", userAgent)
	resp, err := httpClient.Do(req)
	if err != nil {
		return 0, 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, 0, fmt.Errorf("%s", resp.Status)
	}
	cfg, _, err := image.DecodeConfig(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return 0, 0, err
	}
	return cfg.Width, cfg.Height, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
