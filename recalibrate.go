package main

import (
	"os"
	"path/filepath"
	"strings"
)

// RecalibrateReport says what RecalibrateLibrary found and changed
type RecalibrateReport struct {
	Albums       int      `json:"albums"`
	Mismatched   []string `json:"mismatched"`    // albums whose gathered info was for a different record
	StaleRemoved []string `json:"stale_removed"` // leftover sidecars in disc folders that were deleted
	Regathering  int      `json:"regathering"`   // albums queued for a fresh gather
}

// RecalibrateLibrary rescans with the current name parsing, drops gathered info that does not
// match its album (a wrong MusicBrainz match), removes leftover sidecars from disc folders that
// are now part of their album, and re-gathers info in the background for every album without it.
// The user's own edits, chosen links and covers are kept.
func (a *App) RecalibrateLibrary() (RecalibrateReport, error) {
	report := RecalibrateReport{Mismatched: []string{}, StaleRemoved: []string{}}
	result, err := a.ScanLibrary()
	if err != nil {
		return report, err
	}
	report.Albums = len(result.Albums)

	var todo []Album
	for _, album := range result.Albums {
		report.StaleRemoved = append(report.StaleRemoved, removeStaleDiscSidecars(album.Path)...)

		sc, err := readSidecar(album.Path)
		if err != nil {
			todo = append(todo, album)
			continue
		}
		switch {
		case sc.Info == nil || sc.Info.Title == "":
			// Never gathered, or MusicBrainz found nothing under the old names
			todo = append(todo, album)
		case !sc.Sources.isEdited("musicbrainz") && (!matchesAlbum(sc.Info.Title, sc.Info.Artist, album.Artist, album.Album) || yearFarOff(album.Path, sc.Info)):
			report.Mismatched = append(report.Mismatched, album.Artist+" — "+album.Album+" (was "+sc.Info.Artist+" — "+sc.Info.Title+")")
			clearGathered(sc)
			if err := writeSidecar(album.Path, sc); err != nil {
				return report, err
			}
			todo = append(todo, album)
		}
	}

	// Rescan again so the library no longer shows the dropped genres
	if len(report.Mismatched) > 0 || len(report.StaleRemoved) > 0 {
		if _, err := a.ScanLibrary(); err != nil {
			return report, err
		}
	}
	report.Regathering = len(todo)
	if len(todo) > 0 {
		if err := a.startGatherRun(todo); err != nil {
			return report, err
		}
	}
	return report, nil
}

// yearFarOff flags a match released long after the year in the folder name, which usually
// means a namesake (another band's album of the same name). Reissues are the other way
// round (folder year later than the original), so only a later match counts.
func yearFarOff(albumDir string, info *AlbumInfo) bool {
	_, _, year := parseFolderName(filepath.Base(albumDir))
	y := yearOf(info.FirstReleaseDate)
	return year > 0 && y > 0 && y-year > 2
}

// clearGathered forgets gathered info and the links found automatically, keeping links the
// user set, their edits and the cover record
func clearGathered(sc *AlbumSidecar) {
	sc.Info = nil
	src := &sc.Sources
	src.setDerived("musicbrainz", &src.MusicBrainz, "")
	src.setDerived("musicbrainz_artist", &src.MusicBrainzArtist, "")
	src.setDerived("wikipedia_album", &src.WikipediaAlbum, "")
	src.setDerived("wikipedia_artist", &src.WikipediaArtist, "")
	src.setDerived("allmusic", &src.AllMusic, "")
}

// removeStaleDiscSidecars deletes audire.json files left in disc sub-folders (which earlier
// versions treated as albums of their own) unless they hold the user's edits or a cover record
func removeStaleDiscSidecars(albumDir string) []string {
	var removed []string
	entries, err := os.ReadDir(albumDir)
	if err != nil {
		return nil
	}
	for _, e := range entries {
		if !e.IsDir() || !(reDiscFolder.MatchString(e.Name()) || strings.EqualFold(e.Name(), "music")) {
			continue
		}
		dir := filepath.Join(albumDir, e.Name())
		sc, err := readSidecar(dir)
		if err != nil || sc.Metadata != nil || sc.Cover != nil {
			continue
		}
		if os.Remove(filepath.Join(dir, sidecarName)) == nil {
			removed = append(removed, dir)
		}
	}
	return removed
}
