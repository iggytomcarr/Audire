package main

// Track is one song
type Track struct {
	Title    string `json:"title"`
	Duration string `json:"duration"`
}

// Album groups tracks together
type Album struct {
	Artist      string   `json:"artist"`
	Album       string   `json:"album"`
	ReleaseDate string   `json:"release_date"`
	Label       string   `json:"label"`
	Genre       []string `json:"genre"`
	Tracks      []Track  `json:"tracks"`
}

// Library is a collection of albums
type Library struct {
	Albums []Album `json:"albums"`
}
