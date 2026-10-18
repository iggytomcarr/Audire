package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Each album folder can hold an audire.json sidecar, much like Jellyfin's .nfo files:
// a plain, readable file with the user's metadata edits, the links info was gathered
// from, the gathered info itself and where the cover came from. Audio files are never
// modified.
const sidecarName = "audire.json"

// AlbumSidecar is the content of an album folder's audire.json
type AlbumSidecar struct {
	Version  int            `json:"version"`
	Metadata *AlbumMetadata `json:"metadata,omitempty"`
	Sources  AlbumSources   `json:"sources"`
	Info     *AlbumInfo     `json:"info,omitempty"`
	Cover    *CoverRecord   `json:"cover,omitempty"`
}

// AlbumMetadata holds the user's edits, which override names parsed from folders
type AlbumMetadata struct {
	Album  string                   `json:"album,omitempty"`
	Artist string                   `json:"artist,omitempty"`
	Label  string                   `json:"label,omitempty"`
	Shelf  string                   `json:"shelf,omitempty"` // Room view shelf chosen by the user
	Year   int                      `json:"year,omitempty"`
	Genres []string                 `json:"genres,omitempty"`
	Tracks map[string]TrackMetadata `json:"tracks,omitempty"` // keyed by file path relative to the album folder
}

// TrackMetadata holds the user's edits for one track
type TrackMetadata struct {
	Title string `json:"title,omitempty"`
}

// AlbumSources are the pages info is gathered from. Links the user edited are kept
// on refresh; the others are re-derived from MusicBrainz.
type AlbumSources struct {
	MusicBrainz       string   `json:"musicbrainz,omitempty"`
	MusicBrainzArtist string   `json:"musicbrainz_artist,omitempty"`
	WikipediaAlbum    string   `json:"wikipedia_album,omitempty"`
	WikipediaArtist   string   `json:"wikipedia_artist,omitempty"`
	AllMusic          string   `json:"allmusic,omitempty"`
	Edited            []string `json:"edited,omitempty"`
}

// AlbumInfo is everything gathered about an album and its artist
type AlbumInfo struct {
	Title            string             `json:"title,omitempty"`
	Artist           string             `json:"artist,omitempty"`
	FirstReleaseDate string             `json:"first_release_date,omitempty"`
	Label            string             `json:"label,omitempty"`
	CatalogNumber    string             `json:"catalog_number,omitempty"`
	Genres           []string           `json:"genres,omitempty"`
	AlbumArticle     string             `json:"album_article,omitempty"`
	AlbumSections    []WikiSection      `json:"album_sections,omitempty"`
	ArtistArticle    string             `json:"artist_article,omitempty"`
	ArtistSections   []WikiSection      `json:"artist_sections,omitempty"`
	Discography      []DiscographyEntry `json:"discography,omitempty"`
	Notes            []string           `json:"notes,omitempty"`
	GatheredAt       string             `json:"gathered_at,omitempty"`
}

// WikiSection is one section of a Wikipedia article as plain text
type WikiSection struct {
	Heading string `json:"heading"`
	Level   int    `json:"level"`
	Text    string `json:"text"`
}

// DiscographyEntry is one release in an artist's discography
type DiscographyEntry struct {
	Title string `json:"title"`
	Year  string `json:"year,omitempty"`
	Type  string `json:"type,omitempty"`
	URL   string `json:"url,omitempty"`
}

// CoverRecord notes where the saved cover image came from
type CoverRecord struct {
	File    string `json:"file"`
	Source  string `json:"source,omitempty"`
	URL     string `json:"url,omitempty"`
	SavedAt string `json:"saved_at"`
}

func readSidecar(dir string) (*AlbumSidecar, error) {
	data, err := os.ReadFile(filepath.Join(dir, sidecarName))
	if err != nil {
		return nil, err
	}
	var sc AlbumSidecar
	if err := json.Unmarshal(data, &sc); err != nil {
		return nil, fmt.Errorf("parsing %s: %w", filepath.Join(dir, sidecarName), err)
	}
	return &sc, nil
}

// loadSidecar returns the folder's sidecar, or an empty one if it has none yet
func loadSidecar(dir string) (*AlbumSidecar, error) {
	sc, err := readSidecar(dir)
	if os.IsNotExist(err) {
		return &AlbumSidecar{Version: 1}, nil
	}
	return sc, err
}

// writeSidecar saves audire.json via a temp file so a crash never leaves it half-written
func writeSidecar(dir string, sc *AlbumSidecar) error {
	sc.Version = 1
	data, err := json.MarshalIndent(sc, "", "  ")
	if err != nil {
		return err
	}
	path := filepath.Join(dir, sidecarName)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return fmt.Errorf("writing %s: %w", path, err)
	}
	return os.Rename(tmp, path)
}

// applySidecar layers gathered info and then the user's edits over the names parsed from folders
func applySidecar(album *Album, sc *AlbumSidecar) {
	if info := sc.Info; info != nil {
		if len(info.FirstReleaseDate) >= 4 {
			if y, err := strconv.Atoi(info.FirstReleaseDate[:4]); err == nil {
				album.Year = y
			}
		}
		if len(info.Genres) > 0 {
			album.Genre = info.Genres
		}
		album.Label = info.Label
		album.CatalogNumber = info.CatalogNumber
	}
	m := sc.Metadata
	if m == nil {
		return
	}
	if m.Album != "" {
		album.Album = m.Album
	}
	if m.Artist != "" {
		album.Artist = m.Artist
	}
	album.Shelf = m.Shelf
	if m.Label != "" && m.Label != album.Label {
		album.Label = m.Label
		album.CatalogNumber = ""
	}
	if m.Year > 0 {
		album.Year = m.Year
	}
	if m.Genres != nil {
		album.Genre = m.Genres
	}
	for i, t := range album.Tracks {
		if edit, ok := m.Tracks[trackKey(album.Path, t.Path)]; ok && edit.Title != "" {
			album.Tracks[i].Title = edit.Title
		}
	}
}

// trackKey is a track's path relative to its album folder, with forward slashes
func trackKey(albumDir, trackPath string) string {
	rel, err := filepath.Rel(albumDir, trackPath)
	if err != nil {
		rel = filepath.Base(trackPath)
	}
	return filepath.ToSlash(rel)
}

func (s *AlbumSources) isEdited(field string) bool {
	for _, f := range s.Edited {
		if f == field {
			return true
		}
	}
	return false
}

// setDerived fills a link found automatically, unless the user has set it themselves
func (s *AlbumSources) setDerived(field string, target *string, value string) {
	if !s.isEdited(field) {
		*target = value
	}
}

func normaliseGenres(genres []string) []string {
	out := []string{}
	for _, g := range genres {
		if g = strings.TrimSpace(g); g != "" {
			out = append(out, g)
		}
	}
	return out
}
