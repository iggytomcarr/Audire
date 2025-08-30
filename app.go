package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
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
