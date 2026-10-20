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

func TestDiscographyCollections(t *testing.T) {
	root := `G:\Music`
	cases := []struct {
		dir, file, artist, album string
	}{
		{`G:\Music\Black Sabbath - Discography 1968-2007 Mp3 320kbps\1 Studio\1972 Vol.4 @320`, `01 Wheels Of Confusion.mp3`, "Black Sabbath", "Vol.4"},
		{`G:\Music\Black Sabbath - Discography 1968-2007 Mp3 320kbps\2 Live\1980 Live at Last @320`, `01 Tomorrow's Dream.mp3`, "Black Sabbath", "Live at Last"},
		{`G:\Music\Black Sabbath - Discography 1968-2007 Mp3 320kbps\5 Other albums and Bootlegs\1987 Black Sabbath (Tony Martin) - Black Moon (Demo) @320`, `01 Black Moon.mp3`, "Black Sabbath", "Black Moon (Demo)"},
		{`G:\Music\Kraftwerk Studio albums (1970-2003) [FLAC]\1974 Autobahn`, `01 Autobahn.flac`, "Kraftwerk", "Autobahn"},
		{`G:\Music\Brian Eno Albums (1973 - 2020) [FLAC]\1978 Ambient 1 Music for Airports`, `01 1-1.flac`, "Brian Eno", "Ambient 1 Music for Airports"},
		{`G:\Music\Richard D. James as Aphex Twin (Albums 1992 - 2019) [FLAC]\1992 Selected Ambient Works 85-92`, `01 Xtal.flac`, "Aphex Twin", "Selected Ambient Works 85-92"},
		{`G:\Music\Deftones Discography 1993-2020 [FLAC] vtwin88cube\2000 White Pony`, `01 Feiticeira.flac`, "Deftones", "White Pony"},
		{`G:\Music\Burial (FLAC)\Singles & EP\(2011) Street Halo [HDB013]`, `01 Street Halo.flac`, "Burial", "Street Halo"},
		{`G:\Music\Brian Eno Albums (1973 - 2020) [FLAC]\(1974) Lady June & Brian Eno - Lady June's Linguistic Leprosy`, `01 Some Day.flac`, "Brian Eno", "Lady June's Linguistic Leprosy"},
	}
	for _, name := range []string{"2008 - Disc 1", "CD2"} {
		if !reDiscFolder.MatchString(name) {
			t.Errorf("%q should count as a disc folder", name)
		}
	}
	for _, c := range cases {
		a := buildAlbum(&albumGroup{dir: c.dir, root: root, files: []string{c.dir + `\` + c.file}})
		if a.Artist != c.artist || a.Album != c.album {
			t.Errorf("%s: got %q / %q; want %q / %q", c.dir, a.Artist, a.Album, c.artist, c.album)
		}
	}

	// Disc folders with a description are merged into their album
	dir := `G:\Music\Black Sabbath - Discography 1968-2007 Mp3 320kbps\1 Studio\1970 Black Sabbath (Deluxe Expanded Edition) @320`
	if !reDiscFolder.MatchString("CD1 ORIGINAL ALBUM") {
		t.Error("CD1 ORIGINAL ALBUM should count as a disc folder")
	}
	a := buildAlbum(&albumGroup{dir: dir, root: root, files: []string{dir + `\CD1 ORIGINAL ALBUM\01 Black Sabbath.mp3`}})
	if a.Artist != "Black Sabbath" || a.Album != "Black Sabbath" {
		t.Errorf("deluxe edition: got %q / %q", a.Artist, a.Album)
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
