package main

import (
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// startMediaServer serves audio and cover art from the configured music folders
// over a loopback-only HTTP server on a random free port. A real HTTP server
// (rather than the Wails asset handler) gives the <audio> element proper
// streaming and range requests for large FLAC files.
func (a *App) startMediaServer() error {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/audio", a.serveMedia(audioTypes))
	mux.HandleFunc("/cover", a.serveMedia(imageTypes))

	a.mu.Lock()
	a.mediaBaseURL = "http://" + ln.Addr().String()
	a.mu.Unlock()

	go func() {
		if err := http.Serve(ln, mux); err != nil {
			println("Media server error:", err.Error())
		}
	}()
	return nil
}

// serveMedia serves ?path=<file> when the file has an allowed extension and
// lives inside one of the user's music folders.
func (a *App) serveMedia(types map[string]string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// The page uses crossOrigin="anonymous" so the audio can feed the Web Audio graph.
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges")
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Range")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		path := filepath.Clean(r.URL.Query().Get("path"))
		contentType, ok := types[strings.ToLower(filepath.Ext(path))]
		if !ok || !a.inMusicFolder(path) {
			http.NotFound(w, r)
			return
		}
		file, err := os.Open(path)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer file.Close()
		info, err := file.Stat()
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}

		w.Header().Set("Content-Type", contentType)
		http.ServeContent(w, r, "", info.ModTime(), file)
	}
}

func (a *App) inMusicFolder(path string) bool {
	if !filepath.IsAbs(path) {
		return false
	}
	a.mu.RLock()
	defer a.mu.RUnlock()
	lower := strings.ToLower(path)
	for _, folder := range a.folders {
		rel, err := filepath.Rel(strings.ToLower(filepath.Clean(folder)), lower)
		if err != nil || filepath.IsAbs(rel) || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			continue
		}
		return true
	}
	return false
}
