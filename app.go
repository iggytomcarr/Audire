package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
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
	a.StartAudioServer(8765) // Start on port 8765
}

// StartAudioServer starts a local HTTP server to stream audio files
func (a *App) StartAudioServer(port int) error {
	// Create a new ServeMux to avoid conflicts
	mux := http.NewServeMux()

	mux.HandleFunc("/audio/", func(w http.ResponseWriter, r *http.Request) {
		println("Audio request received:", r.URL.Path)

		// Add CORS headers FIRST
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Range, Content-Type, Accept-Encoding")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges")
		w.Header().Set("Accept-Ranges", "bytes")

		// Handle preflight OPTIONS request
		if r.Method == "OPTIONS" {
			println("OPTIONS request handled")
			w.WriteHeader(http.StatusOK)
			return
		}

		// Extract file path from URL (remove "/audio/" prefix)
		filePath := r.URL.Path[7:] // removes "/audio/"
		println("Serving file:", filePath)

		// Security: ensure file exists and is readable
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			println("File not found:", filePath)
			http.NotFound(w, r)
			return
		}

		// Serve the audio file
		http.ServeFile(w, r, filePath)
		println("File served successfully")
	})

	// Start server in background
	go func() {
		addr := "localhost:" + strconv.Itoa(port)
		println("Starting audio server on", addr)
		if err := http.ListenAndServe(addr, mux); err != nil {
			println("Audio server error:", err.Error())
		}
	}()

	return nil
}

// GetAudioStreamURL converts a file path to a streaming URL
func (a *App) GetAudioStreamURL(filePath string, port int) string {
	return "http://localhost:" + strconv.Itoa(port) + "/audio/" + filepath.ToSlash(filePath)
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
