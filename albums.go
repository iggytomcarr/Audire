package main

import (
	"encoding/json"
	"fmt"
	"os"
)

// LoadAlbumsFromFile loads albums.json from disk
func (a *App) LoadAlbumsFromFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("reading %s: %w", path, err)
	}

	var lib Library
	if err := json.Unmarshal(data, &lib); err != nil {
		return fmt.Errorf("parsing JSON: %w", err)
	}

	a.mu.Lock()
	a.Library = lib
	a.mu.Unlock()
	return nil
}

// GetAlbums returns the list of albums for the frontend
func (a *App) GetAlbums() []Album {
	a.mu.RLock()
	defer a.mu.RUnlock()
	if a.Library.Albums == nil {
		return []Album{}
	}
	return a.Library.Albums
}
