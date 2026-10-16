package main

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
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

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
