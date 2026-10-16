package main

import (
	"reflect"
	"testing"
)

func TestParseFolderName(t *testing.T) {
	cases := []struct {
		name, artist, album string
		year                int
	}{
		{"(2021) Alice Coltrane - Kirtan-Turiya Sings (1982, Reissue ) [FLAC]", "Alice Coltrane", "Kirtan-Turiya Sings", 2021},
		{"A Guy Called Gerald - 1995 - Black Secret Technology (2012 RM)", "A Guy Called Gerald", "Black Secret Technology", 1995},
		{"Cannibal Ox (2001) The Cold Vein [EAC FLAC,CUE][A.C.U.M.]", "Cannibal Ox", "The Cold Vein", 2001},
		{"Skee Mask - Resort (2024) [24Bit-44.1kHz] FLAC [PMEDIA] ⭐️", "Skee Mask", "Resort", 2024},
		{"Skee Mask - Compro - 2018 (320 kbps)", "Skee Mask", "Compro", 2018},
		{"Leyland Kirby - Breaks My Heart Each Time (2014) [V0]", "Leyland Kirby", "Breaks My Heart Each Time", 2014},
		{"1998 - XO (180g) (24.96)", "", "XO", 1998},
		{"2013 Lorn - Debris EP", "Lorn", "Debris EP", 2013},
		{"Vangelis - 1994, 2007 - Blade Runner Trilogy, 25th Anniversary (3 CD)", "Vangelis", "Blade Runner Trilogy, 25th Anniversary", 1994},
		{"Paris, Texas [Original Motion Picture Soundtrack]", "", "Paris, Texas", 0},
		{"Imaginarium_(disc_1__The_Neverhood)_(Disc_1)", "", "Imaginarium (disc 1 The Neverhood)", 0},
	}
	for _, c := range cases {
		artist, album, year := parseFolderName(c.name)
		if artist != c.artist || album != c.album || year != c.year {
			t.Errorf("parseFolderName(%q) = %q, %q, %d; want %q, %q, %d", c.name, artist, album, year, c.artist, c.album, c.year)
		}
	}
}

func TestTrackTitles(t *testing.T) {
	cases := []struct {
		names, want []string
	}{
		{[]string{"01 - Land of Broken Dreams", "02 - Hang On"}, []string{"Land of Broken Dreams", "Hang On"}},
		{[]string{"Cannibal Ox-01-Iron Galaxy", "Cannibal Ox-02-Ox Out The Cage"}, []string{"Iron Galaxy", "Ox Out The Cage"}},
		{[]string{"Skee Mask - ITLP02 - Shred - 01 Everest", "Skee Mask - ITLP02 - Shred - 02 HAL Conv."}, []string{"Everest", "HAL Conv"}},
		{[]string{"1-1 - Empire (Lorn Remix)", "1-2 - Come Back (Lorn Remix)"}, []string{"Empire (Lorn Remix)", "Come Back (Lorn Remix)"}},
		{[]string{"A1 Coast To Coast", "B1 Let's Get Lost"}, []string{"Coast To Coast", "Let's Get Lost"}},
		{[]string{"01.-World In My Eyes", "02.-Sweetest Perfection"}, []string{"World In My Eyes", "Sweetest Perfection"}},
		{[]string{"1 - 01 Juggernaught", "10 - Arbiter I"}, []string{"Juggernaught", "Arbiter I"}},
		{[]string{"10-11-2009 2", "Arabian Folklore 7"}, []string{"10-11-2009 2", "Arabian Folklore 7"}},
		{[]string{"Love Song", "Love Me"}, []string{"Love Song", "Love Me"}},
	}
	for _, c := range cases {
		if got := trackTitles(c.names); !reflect.DeepEqual(got, c.want) {
			t.Errorf("trackTitles(%q) = %q; want %q", c.names, got, c.want)
		}
	}
}

func TestBuildAlbumNested(t *testing.T) {
	root := `G:\Music`
	cases := []struct{ dir, artist, album string }{
		{`G:\Music\My Music\Sacaea\Jan 2003 - Mar 2003`, "Sacaea", "Jan 2003 - Mar 2003"},
		{`G:\Music\Lorn\2013 Lorn - Debris EP`, "Lorn", "Debris EP"},
		{`G:\Music\Lorn\Ask The Dust`, "Lorn", "Ask The Dust"},
		{`G:\Music\Silent Hill OST\Silent Hill 4 Soundtrack`, "Silent Hill OST", "Silent Hill 4 Soundtrack"},
	}
	for _, c := range cases {
		a := buildAlbum(&albumGroup{dir: c.dir, root: root, files: []string{c.dir + `\01 - One.mp3`, c.dir + `\02 - Two.mp3`}})
		if a.Artist != c.artist || a.Album != c.album {
			t.Errorf("buildAlbum(%q) = %q / %q; want %q / %q", c.dir, a.Artist, a.Album, c.artist, c.album)
		}
	}
}

func TestNaturalLess(t *testing.T) {
	if !naturalLess("2 - On The Ice", "10 - Treats") || naturalLess("10 - Treats", "2 - On The Ice") {
		t.Error("numbers should sort by value")
	}
	if !naturalLess("A2 Talking", "B1 Angel") {
		t.Error("vinyl sides should sort A before B")
	}
}
