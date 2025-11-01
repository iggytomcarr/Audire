package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

//go:embed data/albums.json
var embeddedFS embed.FS

// App struct
type App struct {
	ctx     context.Context
	Library Library
}

// NewApp creates a new App application struct
func NewApp() *App {

	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) LoadEmbeddedAlbums() error {
	data, err := embeddedFS.ReadFile("data/albums.json")
	if err != nil {
		return fmt.Errorf("reading embedded file: %w", err)
	}
	var lib Library
	if err := json.Unmarshal(data, &lib); err != nil {
		return fmt.Errorf("parsing embedded JSON: %w", err)
	}
	a.Library = lib
	return nil
}

func (a *App) SaveMusicFolders(folders []string) error {
	// Create the data directory if it doesn't exist
	dataDir := "data"

	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return fmt.Errorf("creating data directory: %w", err)
	}

	// Marshal folders to JSON with pretty formatting
	jsonData, err := json.MarshalIndent(folders, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling folders to JSON: %w", err)
	}

	filePath := filepath.Join(dataDir, "folders.json")
	if err := os.WriteFile(filePath, jsonData, 0644); err != nil {
		return fmt.Errorf("writing folders to file: %w", err)
	}
	return nil
}

// LoadMusicFolders loads the music folders array from folders.json
func (a *App) LoadMusicFolders() ([]string, error) {
	filePath := filepath.Join("data", "folders.json")

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		// Return empty array if file doesn't exist
		return []string{}, nil
	}

	// Read the file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("reading folders.json file: %w", err)
	}

	// Unmarshal JSON
	var folders []string
	if err := json.Unmarshal(data, &folders); err != nil {
		return nil, fmt.Errorf("parsing folders.json: %w", err)
	}

	return folders, nil
}
