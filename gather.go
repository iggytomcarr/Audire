package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Info is gathered on request from open sources: MusicBrainz finds the album and its
// links (Wikidata/Wikipedia, AllMusic), Wikipedia supplies the album and artist write-ups,
// and MusicBrainz supplies the discography. AllMusic itself blocks non-browser clients,
// so its link is stored for opening in the browser only.

const userAgent = "Audire/0.1 ( https://github.com/iggytomcarr/Audire )"

var httpClient = &http.Client{Timeout: 25 * time.Second}

// MusicBrainz allows one request per second per client
var (
	mbMu   sync.Mutex
	mbLast time.Time
)

func getJSON(rawURL string, v any) error {
	isMB := strings.Contains(rawURL, "musicbrainz.org/")
	for attempt := 0; ; attempt++ {
		if isMB {
			mbMu.Lock()
			if wait := time.Until(mbLast.Add(1100 * time.Millisecond)); wait > 0 {
				time.Sleep(wait)
			}
			mbLast = time.Now()
			mbMu.Unlock()
		}
		req, err := http.NewRequest("GET", rawURL, nil)
		if err != nil {
			return err
		}
		req.Header.Set("User-Agent", userAgent)
		req.Header.Set("Accept", "application/json")
		resp, err := httpClient.Do(req)
		if err != nil {
			return err
		}
		body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
		resp.Body.Close()
		if err != nil {
			return err
		}
		if resp.StatusCode == http.StatusServiceUnavailable && attempt < 3 {
			time.Sleep(2 * time.Second) // rate limited; back off and retry
			continue
		}
		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("%s returned %s", hostOf(rawURL), resp.Status)
		}
		return json.Unmarshal(body, v)
	}
}

func hostOf(rawURL string) string {
	if u, err := url.Parse(rawURL); err == nil {
		return u.Host
	}
	return rawURL
}

// --- MusicBrainz ---

type mbArtistCredit struct {
	Name   string `json:"name"`
	Artist struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"artist"`
}

type mbRelation struct {
	Type string `json:"type"`
	URL  struct {
		Resource string `json:"resource"`
	} `json:"url"`
}

type mbReleaseGroup struct {
	ID               string           `json:"id"`
	Score            int              `json:"score"`
	Title            string           `json:"title"`
	FirstReleaseDate string           `json:"first-release-date"`
	PrimaryType      string           `json:"primary-type"`
	SecondaryTypes   []string         `json:"secondary-types"`
	ArtistCredit     []mbArtistCredit `json:"artist-credit"`
	Genres           []struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	} `json:"genres"`
	Relations []mbRelation `json:"relations"`
}

var reLuceneSpecial = regexp.MustCompile(`([+\-!(){}\[\]^"~*?:\\/&|])`)

func luceneQuote(s string) string {
	return `"` + reLuceneSpecial.ReplaceAllString(s, `\$1`) + `"`
}

// searchReleaseGroup finds the MusicBrainz release group for an album, or "" if unsure
func searchReleaseGroup(artist, album string) (string, error) {
	queries := []string{
		"releasegroup:" + luceneQuote(album) + " AND artist:" + luceneQuote(artist),
		reLuceneSpecial.ReplaceAllString(album+" "+artist, " "),
	}
	if artist == "" || artist == "Unknown Artist" {
		queries = []string{"releasegroup:" + luceneQuote(album)}
	}
	for _, q := range queries {
		var res struct {
			ReleaseGroups []mbReleaseGroup `json:"release-groups"`
		}
		if err := getJSON("https://musicbrainz.org/ws/2/release-group/?fmt=json&limit=5&query="+url.QueryEscape(q), &res); err != nil {
			return "", err
		}
		if len(res.ReleaseGroups) > 0 && res.ReleaseGroups[0].Score >= 85 {
			return res.ReleaseGroups[0].ID, nil
		}
	}
	return "", nil
}

var reMBID = regexp.MustCompile(`([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})`)

// mbIDFromURL pulls the ID out of e.g. https://musicbrainz.org/release-group/<id>
func mbIDFromURL(link, kind string) string {
	if !strings.Contains(link, "/"+kind+"/") {
		return ""
	}
	return reMBID.FindString(link)
}

// wikipediaFromRelations finds an English Wikipedia article via a direct link or Wikidata
func wikipediaFromRelations(rels []mbRelation) string {
	for _, r := range rels {
		if r.Type == "wikipedia" && strings.Contains(r.URL.Resource, "en.wikipedia.org") {
			return r.URL.Resource
		}
	}
	for _, r := range rels {
		if r.Type != "wikidata" {
			continue
		}
		qid := r.URL.Resource[strings.LastIndex(r.URL.Resource, "/")+1:]
		var res struct {
			Entities map[string]struct {
				Sitelinks map[string]struct {
					Title string `json:"title"`
				} `json:"sitelinks"`
			} `json:"entities"`
		}
		if err := getJSON("https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&sitefilter=enwiki&format=json&ids="+url.QueryEscape(qid), &res); err != nil {
			return ""
		}
		if title := res.Entities[qid].Sitelinks["enwiki"].Title; title != "" {
			return "https://en.wikipedia.org/wiki/" + strings.ReplaceAll(title, " ", "_")
		}
	}
	return ""
}

func relation(rels []mbRelation, kind string) string {
	for _, r := range rels {
		if r.Type == kind {
			return r.URL.Resource
		}
	}
	return ""
}

func discography(artistID string) ([]DiscographyEntry, error) {
	var res struct {
		ReleaseGroups []mbReleaseGroup `json:"release-groups"`
	}
	if err := getJSON("https://musicbrainz.org/ws/2/release-group?fmt=json&limit=100&artist="+url.QueryEscape(artistID), &res); err != nil {
		return nil, err
	}
	var out []DiscographyEntry
	for _, rg := range res.ReleaseGroups {
		if rg.PrimaryType != "Album" && rg.PrimaryType != "EP" {
			continue
		}
		kind := rg.PrimaryType
		if len(rg.SecondaryTypes) > 0 {
			kind += " (" + strings.Join(rg.SecondaryTypes, ", ") + ")"
		}
		year := rg.FirstReleaseDate
		if len(year) > 4 {
			year = year[:4]
		}
		out = append(out, DiscographyEntry{
			Title: rg.Title,
			Year:  year,
			Type:  kind,
			URL:   "https://musicbrainz.org/release-group/" + rg.ID,
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Year == "" || out[j].Year == "" {
			return out[j].Year == "" && out[i].Year != ""
		}
		return out[i].Year < out[j].Year
	})
	return out, nil
}

// originalLabel returns the label and catalogue number of the album's earliest
// official release (labels belong to releases, not to the album as a whole)
func originalLabel(releaseGroupID string) (label, catalog string, err error) {
	var res struct {
		Releases []struct {
			Date      string `json:"date"`
			Status    string `json:"status"`
			Country   string `json:"country"`
			LabelInfo []struct {
				CatalogNumber string `json:"catalog-number"`
				Label         *struct {
					Name string `json:"name"`
				} `json:"label"`
			} `json:"label-info"`
		} `json:"releases"`
	}
	if err := getJSON("https://musicbrainz.org/ws/2/release?fmt=json&limit=100&inc=labels&release-group="+url.QueryEscape(releaseGroupID), &res); err != nil {
		return "", "", err
	}
	// A year-only date counts as the end of that year, so the dated original release
	// (e.g. 1997-02-25) beats a digital reissue that only claims "1997"
	sortDate := func(d string) string {
		switch len(d) {
		case 0:
			return "9999"
		case 4:
			return d + "-12-31"
		case 7:
			return d + "-31"
		}
		return d
	}
	hasCatalog := func(i int) bool {
		for _, li := range res.Releases[i].LabelInfo {
			if li.CatalogNumber != "" && li.CatalogNumber != "[none]" {
				return true
			}
		}
		return false
	}
	worldwide := func(i int) bool { c := res.Releases[i].Country; return c == "XW" || c == "XE" }
	sort.SliceStable(res.Releases, func(i, j int) bool {
		a, b := res.Releases[i], res.Releases[j]
		if (a.Status == "Official") != (b.Status == "Official") {
			return a.Status == "Official"
		}
		if da, db := sortDate(a.Date), sortDate(b.Date); da != db {
			return da < db
		}
		if hasCatalog(i) != hasCatalog(j) {
			return hasCatalog(i)
		}
		return !worldwide(i) && worldwide(j)
	})
	for _, r := range res.Releases {
		for _, li := range r.LabelInfo {
			if li.Label != nil && li.Label.Name != "" && li.Label.Name != "[no label]" {
				catalog := li.CatalogNumber
				if catalog == "[none]" {
					catalog = ""
				}
				return li.Label.Name, catalog, nil
			}
		}
	}
	return "", "", nil
}

// --- Wikipedia ---

var reWikiHeading = regexp.MustCompile(`^(={2,})\s*(.+?)\s*={2,}$`)

// Sections that are lists or references rather than prose
var skipWikiSections = map[string]bool{
	"track listing": true, "personnel": true, "references": true, "external links": true, "notes": true,
	"charts": true, "certifications": true, "release history": true, "sources": true, "further reading": true,
	"see also": true, "discography": true, "band members": true, "members": true, "footnotes": true,
	"citations": true, "bibliography": true, "filmography": true, "awards and nominations": true, "credits": true,
	"weekly charts": true, "year-end charts": true, "accolades": true, "videography": true,
}

// wikipediaSections fetches an article as plain-text sections, skipping lists and references
func wikipediaSections(articleURL string) (title string, sections []WikiSection, err error) {
	u, err := url.Parse(articleURL)
	if err != nil || !strings.HasSuffix(u.Host, "wikipedia.org") || !strings.HasPrefix(u.Path, "/wiki/") {
		return "", nil, fmt.Errorf("not a Wikipedia article link: %s", articleURL)
	}
	page := strings.ReplaceAll(strings.TrimPrefix(u.Path, "/wiki/"), "_", " ")
	var res struct {
		Query struct {
			Pages map[string]struct {
				Title   string  `json:"title"`
				Extract string  `json:"extract"`
				Missing *string `json:"missing"`
			} `json:"pages"`
		} `json:"query"`
	}
	api := "https://" + u.Host + "/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&format=json&titles=" + url.QueryEscape(page)
	if err := getJSON(api, &res); err != nil {
		return "", nil, err
	}
	for _, p := range res.Query.Pages {
		if p.Missing != nil {
			return "", nil, fmt.Errorf("Wikipedia has no article called %q", page)
		}
		return p.Title, splitWikiSections(p.Extract), nil
	}
	return "", nil, fmt.Errorf("Wikipedia returned nothing for %q", page)
}

func splitWikiSections(extract string) []WikiSection {
	var sections []WikiSection
	current := WikiSection{Heading: "Overview", Level: 1}
	skipLevel := 0 // while > 0, skip sub-sections of a skipped section
	var buf strings.Builder

	flush := func() {
		current.Text = strings.TrimSpace(buf.String())
		if current.Text != "" && skipLevel == 0 {
			sections = append(sections, current)
		}
		buf.Reset()
	}
	for _, line := range strings.Split(extract, "\n") {
		if m := reWikiHeading.FindStringSubmatch(strings.TrimSpace(line)); m != nil {
			flush()
			level := len(m[1])
			if skipLevel > 0 && level <= skipLevel {
				skipLevel = 0
			}
			current = WikiSection{Heading: m[2], Level: level}
			if skipLevel == 0 && skipWikiSections[strings.ToLower(m[2])] {
				skipLevel = level
			}
			continue
		}
		buf.WriteString(line)
		buf.WriteString("\n")
	}
	flush()
	return sections
}

// --- App methods ---

// albumByID returns a copy of an album in the library and the music folder that contains it
func (a *App) albumByID(id string) (Album, string, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	for _, album := range a.Library.Albums {
		if album.ID == id {
			root := ""
			for _, f := range a.folders {
				if strings.HasPrefix(strings.ToLower(album.Path), strings.ToLower(filepath.Clean(f))) && len(f) > len(root) {
					root = filepath.Clean(f)
				}
			}
			return album, root, nil
		}
	}
	return Album{}, "", fmt.Errorf("album %s is not in the library", id)
}

// rebuildAlbum re-reads one album folder (names, cover and sidecar) and updates the library cache
func (a *App) rebuildAlbum(id string) (Album, error) {
	album, root, err := a.albumByID(id)
	if err != nil {
		return Album{}, err
	}
	g := &albumGroup{dir: album.Path, root: root}
	for _, t := range album.Tracks {
		g.files = append(g.files, t.Path)
	}
	updated := buildAlbum(g)

	a.mu.Lock()
	for i := range a.Library.Albums {
		if a.Library.Albums[i].ID == id {
			a.Library.Albums[i] = updated
		}
	}
	lib := a.Library
	a.mu.Unlock()
	return updated, writeJSON("library.json", lib)
}

// GetAlbumSidecar returns the album's audire.json contents (empty if it has none)
func (a *App) GetAlbumSidecar(albumID string) (*AlbumSidecar, error) {
	album, _, err := a.albumByID(albumID)
	if err != nil {
		return nil, err
	}
	return loadSidecar(album.Path)
}

// SaveAlbumSources stores links the user edited; fields left empty go back to being found automatically
func (a *App) SaveAlbumSources(albumID string, sources AlbumSources) (*AlbumSidecar, error) {
	album, _, err := a.albumByID(albumID)
	if err != nil {
		return nil, err
	}
	sc, err := loadSidecar(album.Path)
	if err != nil {
		return nil, err
	}
	old := sc.Sources
	fields := []struct {
		name     string
		old, new string
	}{
		{"musicbrainz", old.MusicBrainz, sources.MusicBrainz},
		{"musicbrainz_artist", old.MusicBrainzArtist, sources.MusicBrainzArtist},
		{"wikipedia_album", old.WikipediaAlbum, sources.WikipediaAlbum},
		{"wikipedia_artist", old.WikipediaArtist, sources.WikipediaArtist},
		{"allmusic", old.AllMusic, sources.AllMusic},
	}
	edited := map[string]bool{}
	for _, f := range old.Edited {
		edited[f] = true
	}
	for _, f := range fields {
		switch {
		case strings.TrimSpace(f.new) == "":
			delete(edited, f.name)
		case strings.TrimSpace(f.new) != f.old:
			edited[f.name] = true
		}
	}
	sources.Edited = nil
	for _, f := range fields {
		if edited[f.name] {
			sources.Edited = append(sources.Edited, f.name)
		}
	}
	sources.MusicBrainz = strings.TrimSpace(sources.MusicBrainz)
	sources.MusicBrainzArtist = strings.TrimSpace(sources.MusicBrainzArtist)
	sources.WikipediaAlbum = strings.TrimSpace(sources.WikipediaAlbum)
	sources.WikipediaArtist = strings.TrimSpace(sources.WikipediaArtist)
	sources.AllMusic = strings.TrimSpace(sources.AllMusic)
	sc.Sources = sources
	return sc, writeSidecar(album.Path, sc)
}

// AlbumEdit is a metadata change from the album page; track titles are keyed by track path
type AlbumEdit struct {
	Album       string            `json:"album"`
	Artist      string            `json:"artist"`
	Label       string            `json:"label"`
	Shelf       string            `json:"shelf"`
	Year        int               `json:"year"`
	Genres      []string          `json:"genres"`
	TrackTitles map[string]string `json:"track_titles"`
}

// SaveAlbumMetadata writes the user's edits to the album's audire.json and returns the updated album
func (a *App) SaveAlbumMetadata(albumID string, edit AlbumEdit) (Album, error) {
	album, _, err := a.albumByID(albumID)
	if err != nil {
		return Album{}, err
	}
	sc, err := loadSidecar(album.Path)
	if err != nil {
		return Album{}, err
	}
	m := sc.Metadata
	if m == nil {
		m = &AlbumMetadata{}
	}
	m.Album = strings.TrimSpace(edit.Album)
	m.Artist = strings.TrimSpace(edit.Artist)
	m.Label = strings.TrimSpace(edit.Label)
	m.Shelf = strings.TrimSpace(edit.Shelf)
	m.Year = edit.Year
	m.Genres = normaliseGenres(edit.Genres)
	if m.Tracks == nil {
		m.Tracks = map[string]TrackMetadata{}
	}
	for path, title := range edit.TrackTitles {
		key := trackKey(album.Path, path)
		if title = strings.TrimSpace(title); title == "" {
			delete(m.Tracks, key)
		} else {
			m.Tracks[key] = TrackMetadata{Title: title}
		}
	}
	sc.Metadata = m
	if err := writeSidecar(album.Path, sc); err != nil {
		return Album{}, err
	}
	return a.rebuildAlbum(albumID)
}

// GatherAlbumInfo looks the album up on MusicBrainz and Wikipedia, saves the result to
// the album's audire.json and returns it. Links the user edited are used as given.
func (a *App) GatherAlbumInfo(albumID string) (*AlbumSidecar, error) {
	album, _, err := a.albumByID(albumID)
	if err != nil {
		return nil, err
	}
	sc, err := loadSidecar(album.Path)
	if err != nil {
		return nil, err
	}
	progress := func(msg string) {
		if a.ctx != nil {
			wailsruntime.EventsEmit(a.ctx, "gather:progress", albumID, msg)
		}
	}
	src := &sc.Sources
	info := &AlbumInfo{GatheredAt: time.Now().Format(time.RFC3339)}
	note := func(format string, args ...any) { info.Notes = append(info.Notes, fmt.Sprintf(format, args...)) }

	progress("Finding the album on MusicBrainz…")
	rgID := mbIDFromURL(src.MusicBrainz, "release-group")
	if rgID == "" && !src.isEdited("musicbrainz") {
		if rgID, err = searchReleaseGroup(album.Artist, album.Album); err != nil {
			return nil, err
		}
	}
	if rgID == "" {
		note("MusicBrainz didn't find this album. Paste its MusicBrainz or Wikipedia link under Sources and refresh.")
		src.setDerived("musicbrainz", &src.MusicBrainz, "")
	} else {
		var rg mbReleaseGroup
		if err := getJSON("https://musicbrainz.org/ws/2/release-group/"+rgID+"?fmt=json&inc=url-rels+artist-credits+genres", &rg); err != nil {
			return nil, err
		}
		src.setDerived("musicbrainz", &src.MusicBrainz, "https://musicbrainz.org/release-group/"+rg.ID)
		info.Title = rg.Title
		info.FirstReleaseDate = rg.FirstReleaseDate
		sort.SliceStable(rg.Genres, func(i, j int) bool { return rg.Genres[i].Count > rg.Genres[j].Count })
		for i, g := range rg.Genres {
			if i == 4 {
				break
			}
			info.Genres = append(info.Genres, titleCase(g.Name))
		}
		var credits []string
		for _, c := range rg.ArtistCredit {
			credits = append(credits, c.Name)
		}
		info.Artist = strings.Join(credits, ", ")
		if len(rg.ArtistCredit) > 0 {
			src.setDerived("musicbrainz_artist", &src.MusicBrainzArtist, "https://musicbrainz.org/artist/"+rg.ArtistCredit[0].Artist.ID)
		}
		src.setDerived("allmusic", &src.AllMusic, relation(rg.Relations, "allmusic"))
		progress("Finding the record label…")
		if info.Label, info.CatalogNumber, err = originalLabel(rg.ID); err != nil {
			note("Couldn't look up the record label: %v", err)
		}
		progress("Looking for Wikipedia articles…")
		src.setDerived("wikipedia_album", &src.WikipediaAlbum, wikipediaFromRelations(rg.Relations))
	}

	if artistID := mbIDFromURL(src.MusicBrainzArtist, "artist"); artistID != "" {
		var artist struct {
			Relations []mbRelation `json:"relations"`
		}
		if err := getJSON("https://musicbrainz.org/ws/2/artist/"+artistID+"?fmt=json&inc=url-rels", &artist); err == nil {
			src.setDerived("wikipedia_artist", &src.WikipediaArtist, wikipediaFromRelations(artist.Relations))
		}
		progress("Fetching the discography…")
		if info.Discography, err = discography(artistID); err != nil {
			note("Couldn't fetch the discography: %v", err)
		}
	}

	progress("Reading Wikipedia…")
	if src.WikipediaAlbum != "" {
		if info.AlbumArticle, info.AlbumSections, err = wikipediaSections(src.WikipediaAlbum); err != nil {
			note("Album article: %v", err)
		}
	} else {
		note("No Wikipedia article was found for this album.")
	}
	if src.WikipediaArtist != "" {
		if info.ArtistArticle, info.ArtistSections, err = wikipediaSections(src.WikipediaArtist); err != nil {
			note("Artist article: %v", err)
		}
	}

	sc.Info = info
	if err := writeSidecar(album.Path, sc); err != nil {
		return nil, err
	}
	if _, err := a.rebuildAlbum(albumID); err != nil {
		return nil, err
	}
	progress("")
	return sc, nil
}

// titleCase capitalises each word: "hip hop" -> "Hip Hop"
func titleCase(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		r := []rune(w)
		r[0] = unicode.ToUpper(r[0])
		words[i] = string(r)
	}
	return strings.Join(words, " ")
}
