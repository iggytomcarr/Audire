package main

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

// newTestLibrary creates a music folder with one album and an App that has scanned it
func newTestLibrary(t *testing.T) (*App, Album) {
	t.Helper()
	configDirOverride = t.TempDir()
	t.Cleanup(func() { configDirOverride = "" })

	root := t.TempDir()
	dir := filepath.Join(root, "Elliott Smith - Either Or (1997)")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"01 - Speed Trials.flac", "02 - Alameda.flac", "cover.jpg"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	a := &App{folders: []string{root}}
	if _, err := a.ScanLibrary(); err != nil {
		t.Fatal(err)
	}
	return a, a.GetAlbums()[0]
}

func TestSaveAlbumMetadataWritesSidecarAndSurvivesRescan(t *testing.T) {
	a, album := newTestLibrary(t)

	updated, err := a.SaveAlbumMetadata(album.ID, AlbumEdit{
		Album:       "Either/Or",
		Artist:      "Elliott Smith",
		Year:        1997,
		Genres:      []string{" Indie Folk ", ""},
		TrackTitles: map[string]string{album.Tracks[0].Path: "Speed Trials (edited)"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Album != "Either/Or" || updated.Tracks[0].Title != "Speed Trials (edited)" || len(updated.Genre) != 1 || updated.Genre[0] != "Indie Folk" {
		t.Fatalf("edits not applied: %+v", updated)
	}

	sc, err := readSidecar(album.Path)
	if err != nil {
		t.Fatalf("audire.json not written: %v", err)
	}
	if sc.Metadata.Tracks["01 - Speed Trials.flac"].Title != "Speed Trials (edited)" {
		t.Fatalf("track edit should be keyed by file name: %+v", sc.Metadata.Tracks)
	}

	// A full rescan picks the edits up from disk
	res, _ := a.ScanLibrary()
	if got := res.Albums[0]; got.Album != "Either/Or" || got.Tracks[0].Title != "Speed Trials (edited)" {
		t.Fatalf("rescan lost edits: %+v", got)
	}
}

func TestSaveAlbumSourcesTracksEditedLinks(t *testing.T) {
	a, album := newTestLibrary(t)

	sc, err := a.SaveAlbumSources(album.ID, AlbumSources{AllMusic: " https://www.allmusic.com/album/mw0000092082 "})
	if err != nil {
		t.Fatal(err)
	}
	if !sc.Sources.isEdited("allmusic") || sc.Sources.AllMusic != "https://www.allmusic.com/album/mw0000092082" {
		t.Fatalf("edited link not recorded: %+v", sc.Sources)
	}
	sc, _ = a.SaveAlbumSources(album.ID, AlbumSources{})
	if sc.Sources.isEdited("allmusic") {
		t.Fatal("clearing a link should hand it back to automatic lookup")
	}
}

func TestSaveCoverKeepsPreviousCover(t *testing.T) {
	a, album := newTestLibrary(t)

	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	img.Set(1, 1, color.White)
	var buf bytes.Buffer
	png.Encode(&buf, img)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write(buf.Bytes()) }))
	defer srv.Close()

	updated, err := a.SaveCover(album.ID, srv.URL+"/art.png", "Test")
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(updated.CoverImage) != "cover.png" {
		t.Fatalf("new cover should be used, got %s", updated.CoverImage)
	}
	if _, err := os.Stat(filepath.Join(album.Path, "cover (previous).jpg")); err != nil {
		t.Fatal("old cover should be kept as cover (previous).jpg")
	}
	if _, err := os.Stat(filepath.Join(album.Path, "cover.jpg")); !os.IsNotExist(err) {
		t.Fatal("only one cover.* file should remain")
	}
	if sc, _ := readSidecar(album.Path); sc == nil || sc.Cover == nil || sc.Cover.File != "cover.png" {
		t.Fatal("cover source should be recorded in audire.json")
	}

	text := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("<html>nope</html>")) }))
	defer text.Close()
	if _, err := a.SaveCover(album.ID, text.URL, "Test"); err == nil {
		t.Fatal("non-image downloads must be rejected")
	}
}

func TestSplitWikiSectionsSkipsLists(t *testing.T) {
	extract := "Intro text.\n\n== Background ==\nSome history.\n\n== Track listing ==\n1. Song\n\n=== Side one ===\nmore list\n\n== Reception ==\nGood reviews."
	got := splitWikiSections(extract)
	var headings []string
	for _, s := range got {
		headings = append(headings, s.Heading)
	}
	want := []string{"Overview", "Background", "Reception"}
	if len(headings) != len(want) {
		t.Fatalf("got %v, want %v", headings, want)
	}
	for i := range want {
		if headings[i] != want[i] {
			t.Fatalf("got %v, want %v", headings, want)
		}
	}
}
