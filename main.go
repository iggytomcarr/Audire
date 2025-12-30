package main

import (
	"embed"
	"net/http"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "Audire",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
			Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Check if this is an audio file request
				if len(r.URL.Path) > 7 && r.URL.Path[:7] == "/audio/" {
					filePath := r.URL.Path[7:] // Remove "/audio/" prefix
					println("Serving audio file:", filePath)

					// Open the file
					file, err := os.Open(filePath)
					if err != nil {
						println("Error opening file:", err.Error())
						http.NotFound(w, r)
						return
					}
					defer file.Close()

					// Get file info for size
					fileInfo, err := file.Stat()
					if err != nil {
						http.Error(w, "Cannot stat file", http.StatusInternalServerError)
						return
					}

					// Set CORS headers
					w.Header().Set("Access-Control-Allow-Origin", "*")
					w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
					w.Header().Set("Accept-Ranges", "bytes")
					w.Header().Set("Content-Type", "audio/flac")

					// Handle OPTIONS
					if r.Method == "OPTIONS" {
						w.WriteHeader(http.StatusOK)
						return
					}

					// Serve the file with range support
					http.ServeContent(w, r, fileInfo.Name(), fileInfo.ModTime(), file)
					println("Audio file served successfully")
					return
				}

				// For non-audio requests, return nil to use default asset handler
				w.WriteHeader(http.StatusNotFound)
			}),
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
