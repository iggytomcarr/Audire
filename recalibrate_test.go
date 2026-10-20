package main

import (
	"image"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestMatchesAlbum(t *testing.T) {
	cases := []struct {
		mbTitle, mbArtist, artist, album string
		want                             bool
	}{
		{"320", "Fuck My Corpse Forever", "Black Sabbath", "Vol.4", false},
		{"320", "Fuck My Corpse Forever", "1 Studio", "Vol.4 @320", false},
		{"The Original Black Sabbath", "Black Sabbath", "Black Sabbath", "Black Sabbath", true},
		{"Black Sabbath Vol. 4", "Black Sabbath", "Black Sabbath", "Vol.4", true},
		{"Ambient 1: Music for Airports", "Brian Eno", "Brian Eno", "Ambient 1-Music for Airports", true},
		{"The Bends", "Radiohead", "Radiohead", "The Bends", true},
		{"The Bends", "Radiohead", "Deftones", "The Bends", false},
		{"Evening Star", "Fripp & Eno", "Brian Eno", "Evening Star", true},
		{"Selected Ambient Works 85–92", "Aphex Twin", "Aphex Twin", "Selected Ambient Works 85-92", true},
		{"Paris, Texas", "Ry Cooder", "Unknown Artist", "Paris, Texas", true},
		{"La Fête sauvage", "Vangelis", "Vangelis", "La fete sauvage (Original Motion Picture Soundtrack)", true},
		{"Nativity in Black II: A Tribute to Black Sabbath", "Various Artists", "Black Sabbath", "Nativity In Black II - A Tribute To Black Sabbath", true},
		{"Brian Eno", "Brian Eno", "Brian Eno", "Discreet Music", false},
		{"Live at Hammersmith Odeon", "Japan", "Black Sabbath", "Live At Hammersmith Odeon", false},
		{"Black Sabbath", "Jazz Sabbath", "Black Sabbath", "Nativity In Black - A Tribute To Black Sabbath", false},
		{"Music Music Music", "John Barrowman", "Unknown Artist", "Music", false},
		{"Evening Star", "Fripp, Eno", "Brian Eno", "Evening Star", true},
		{"Evening Star", "Fripp & Robert Fripp & Eno & Brian Eno", "Brian Eno", "Evening Star", true},
		{"Black Sabbath Vol. 4", "Black Sabbath / Black Sabbath", "Black Sabbath", "Vol.4", true},
		{"Antarctica: Music From Koreyoshi Kurahara’s Film", "Vangelis", "Vangelis", "Antarctica", true},
		{"Heaven and Hell in Hartford", "Black Sabbath", "Black Sabbath", "Heaven And Hell In Hartford - Live at Civic Center, Hartford, CT, Aug. 10th", true},
		{"Another Green World", "Eno", "Brian Eno", "Another Green World", true},
		{"Ventolin E.P", "Aphex Twin", "Aphex Twin", "Ventolin (EP)", true},
		{"January 07003: Bell Studies for the Clock of the Long Now", "Brian Eno", "Brian Eno", "The Long Now", false},
		{"Music for Programming 04: Com Truise", "Com Truise", "Com Truise", "Com Truise", false},
	}
	for _, c := range cases {
		if got := matchesAlbum(c.mbTitle, c.mbArtist, c.artist, c.album); got != c.want {
			t.Errorf("matchesAlbum(%q, %q, %q, %q) = %v, want %v", c.mbTitle, c.mbArtist, c.artist, c.album, got, c.want)
		}
	}
}

func TestClearGatheredKeepsUserChoices(t *testing.T) {
	sc := &AlbumSidecar{
		Metadata: &AlbumMetadata{Shelf: "metal"},
		Sources: AlbumSources{
			MusicBrainz:     "https://musicbrainz.org/release-group/wrong",
			WikipediaArtist: "https://en.wikipedia.org/wiki/Black_Sabbath",
			Edited:          []string{"wikipedia_artist"},
		},
		Info:  &AlbumInfo{Title: "320", Genres: []string{"Electronic"}},
		Cover: &CoverRecord{Source: "Deezer"},
	}
	clearGathered(sc)
	if sc.Info != nil || sc.Sources.MusicBrainz != "" {
		t.Fatal("gathered info and derived links should be cleared")
	}
	if sc.Sources.WikipediaArtist == "" || sc.Metadata == nil || sc.Cover == nil {
		t.Fatal("the user's link, edits and cover record must be kept")
	}
}

func TestRemoveStaleDiscSidecars(t *testing.T) {
	album := t.TempDir()
	stale := filepath.Join(album, "CD1 ORIGINAL ALBUM")
	edited := filepath.Join(album, "CD2")
	for _, d := range []string{stale, edited} {
		if err := os.MkdirAll(d, 0755); err != nil {
			t.Fatal(err)
		}
	}
	writeSidecar(stale, &AlbumSidecar{Info: &AlbumInfo{Title: "The Original Black Sabbath"}})
	writeSidecar(edited, &AlbumSidecar{Metadata: &AlbumMetadata{Album: "Mine"}})

	removed := removeStaleDiscSidecars(album)
	if len(removed) != 1 || removed[0] != stale {
		t.Fatalf("removed %v", removed)
	}
	if _, err := os.Stat(filepath.Join(edited, sidecarName)); err != nil {
		t.Fatal("a sidecar with the user's edits must be kept")
	}
}

func TestCoverProblem(t *testing.T) {
	dir := t.TempDir()
	write := func(name string, w, h int) string {
		path := filepath.Join(dir, name)
		f, err := os.Create(path)
		if err != nil {
			t.Fatal(err)
		}
		defer f.Close()
		if err := png.Encode(f, image.NewGray(image.Rect(0, 0, w, h))); err != nil {
			t.Fatal(err)
		}
		return path
	}
	cases := []struct {
		path string
		bad  bool
	}{
		{"", true},
		{write("good.png", 1000, 1000), false},
		{write("small.png", 300, 300), true},
		{write("gatefold.png", 1600, 800), true},
		{write("nearly.png", 1000, 960), false},
	}
	for _, c := range cases {
		if got := coverProblem(c.path); (got != "") != c.bad {
			t.Errorf("coverProblem(%q) = %q", c.path, got)
		}
	}
}

func TestYearFarOff(t *testing.T) {
	cases := []struct {
		dir, date string
		want      bool
	}{
		{`G:\Music\Burial (FLAC)\Albums\(2006) Burial [HDBCD001]`, "2016-04-07", true},
		{`G:\Music\(2021) Alice Coltrane - Kirtan-Turiya Sings (1982, Reissue ) [FLAC]`, "1982", false},
		{`G:\Music\Lorn\Ask The Dust`, "2012", false},
		{`G:\Music\Sleep - 2003 - Dopesmoker [flac]`, "2003-04-01", false},
	}
	for _, c := range cases {
		if got := yearFarOff(c.dir, &AlbumInfo{FirstReleaseDate: c.date}); got != c.want {
			t.Errorf("yearFarOff(%q, %q) = %v", c.dir, c.date, got)
		}
	}
}
