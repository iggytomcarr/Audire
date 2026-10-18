package main

// Track is one song
type Track struct {
	Title    string `json:"title"`
	Duration string `json:"duration"`
	Path     string `json:"path,omitempty"`
	Format   string `json:"format,omitempty"`
}

// Album groups tracks together
type Album struct {
	ID            string   `json:"id,omitempty"`
	Artist        string   `json:"artist"`
	Album         string   `json:"album"`
	Year          int      `json:"year,omitempty"`
	ReleaseDate   string   `json:"release_date"`
	Label         string   `json:"label"`
	CatalogNumber string   `json:"catalog_number,omitempty"`
	Genre         []string `json:"genre"`
	Tracks        []Track  `json:"tracks"`
	CoverImage    string   `json:"cover_image,omitempty"`
	CoverVersion  int64    `json:"cover_version,omitempty"`
	Path          string   `json:"path,omitempty"`
}

// Library is a collection of albums
type Library struct {
	Albums []Album `json:"albums"`
}

// VisualSettings remembers the Play view's visualiser choices
type VisualSettings struct {
	Preset        string        `json:"preset"`
	Favorites     []string      `json:"favorites"`
	Cycle         bool          `json:"cycle"`
	FavoritesOnly bool          `json:"favorites_only"`
	Speed         float64       `json:"speed"`  // 0.25–1: how fast visuals animate
	Soften        float64       `json:"soften"` // 0–1: how much frames blend to calm flashing
	Dim           float64       `json:"dim"`    // 0–1: how much brightness and colour are muted
	AdjustOpen    bool          `json:"adjust_open"`
	Mode          string        `json:"mode"`          // "milkdrop", "meters" or "retro"
	MeterModules  []string      `json:"meter_modules"` // meters shown in Meters mode; nil means all
	Colormap      string        `json:"colormap"`      // spectrogram colour map
	RetroLamp     string        `json:"retro_lamp"`    // Retro mode VU lamp colour (hex)
	RetroDisplay  string        `json:"retro_display"` // Retro mode fluorescent display colour (hex)
	RetroLink     bool          `json:"retro_link"`    // one colour for every meter
	RetroPreset   string        `json:"retro_preset"`  // id of the chosen preset, built in or the user's
	RetroPresets  []RetroPreset `json:"retro_presets"` // the user's saved presets
}

// RetroPreset is a named Retro mode colour scheme saved by the user
type RetroPreset struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Lamp    string `json:"lamp"`
	Display string `json:"display"`
}

// ScanResult summarises a scan of the music folders
type ScanResult struct {
	Albums       []Album        `json:"albums"`
	TrackCount   int            `json:"track_count"`
	Skipped      int            `json:"skipped"`
	SkippedExts  []string       `json:"skipped_exts"`
	FolderCounts map[string]int `json:"folder_counts"`
	Errors       []string       `json:"errors"`
}
