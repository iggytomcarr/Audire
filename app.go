package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed data/albums.json
var embeddedFS embed.FS

// App struct
type App struct {
	ctx          context.Context
	mu           sync.RWMutex
	Library      Library
	folders      []string
	mediaBaseURL string
}

// NewApp creates a new App application struct
func NewApp() *App {

	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	if folders, err := a.LoadMusicFolders(); err == nil {
		a.folders = folders
	}
	if data, err := os.ReadFile(filepath.Join(configDir(), "library.json")); err == nil {
		var lib Library
		if json.Unmarshal(data, &lib) == nil {
			a.Library = lib
		}
	}
	if err := a.startMediaServer(); err != nil {
		println("Could not start media server:", err.Error())
	}
}

// configDirOverride redirects settings to another folder (used by tests)
var configDirOverride string

// configDir is where settings and the scanned library are stored,
// e.g. %AppData%\Audire on Windows.
func configDir() string {
	if configDirOverride != "" {
		return configDirOverride
	}
	if dir, err := os.UserConfigDir(); err == nil {
		return filepath.Join(dir, "Audire")
	}
	return "data"
}

// GetMediaBaseURL returns the address of the local server that streams audio and cover art
func (a *App) GetMediaBaseURL() string {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.mediaBaseURL
}

// SelectFolder opens a native folder picker and returns the chosen path ("" if cancelled)
func (a *App) SelectFolder() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Choose a music folder",
	})
}

// OpenFolder shows a folder from the music library in the system file manager
func (a *App) OpenFolder(path string) error {
	path = filepath.Clean(path)
	if !a.inMusicFolder(path) {
		return fmt.Errorf("%s is not in a music folder", path)
	}
	var cmd *exec.Cmd
	switch goruntime.GOOS {
	case "windows":
		cmd = exec.Command("explorer.exe", path)
	case "darwin":
		cmd = exec.Command("open", path)
	default:
		cmd = exec.Command("xdg-open", path)
	}
	return cmd.Start()
}

// ScanLibrary rebuilds the library from the saved music folders and caches it to disk
func (a *App) ScanLibrary() (ScanResult, error) {
	a.mu.RLock()
	folders := append([]string(nil), a.folders...)
	a.mu.RUnlock()

	result := ScanFolders(folders)
	if result.Albums == nil {
		result.Albums = []Album{}
	}

	a.mu.Lock()
	a.Library = Library{Albums: result.Albums}
	a.mu.Unlock()

	if err := writeJSON("library.json", Library{Albums: result.Albums}); err != nil {
		return result, err
	}
	return result, nil
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
	a.mu.Lock()
	a.Library = lib
	a.mu.Unlock()
	return nil
}

func (a *App) SaveMusicFolders(folders []string) error {
	cleaned := []string{}
	for _, f := range folders {
		if f != "" {
			cleaned = append(cleaned, filepath.Clean(f))
		}
	}
	a.mu.Lock()
	a.folders = cleaned
	a.mu.Unlock()

	return writeJSON("folders.json", cleaned)
}

// LoadMusicFolders loads the music folders array from folders.json
func (a *App) LoadMusicFolders() ([]string, error) {
	filePath := filepath.Join(configDir(), "folders.json")

	// Fall back to the old project-relative location used by earlier versions
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		filePath = filepath.Join("data", "folders.json")
	}

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
	if folders == nil {
		folders = []string{}
	}

	return folders, nil
}

// LoadVisualSettings returns the saved visualiser preset, favourites and cycle options
func (a *App) LoadVisualSettings() VisualSettings {
	settings := VisualSettings{Cycle: true, Favorites: []string{}}
	if data, err := os.ReadFile(filepath.Join(configDir(), "visuals.json")); err == nil {
		_ = json.Unmarshal(data, &settings)
	}
	if settings.Favorites == nil {
		settings.Favorites = []string{}
	}
	return settings
}

// SaveVisualSettings stores the visualiser preset, favourites and cycle options
func (a *App) SaveVisualSettings(settings VisualSettings) error {
	return writeJSON("visuals.json", settings)
}

// writeJSON saves v as pretty-printed JSON in the config directory
func writeJSON(name string, v any) error {
	dir := configDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("creating config directory: %w", err)
	}
	jsonData, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling %s: %w", name, err)
	}
	if err := os.WriteFile(filepath.Join(dir, name), jsonData, 0644); err != nil {
		return fmt.Errorf("writing %s: %w", name, err)
	}
	return nil
}
