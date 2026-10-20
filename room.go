package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Support for the Room view in the library: play counts (so shelves can show favourites
// face-out), the user's rooms, and gathering info for every album so they can be shelved
// by genre.

// AlbumStats counts how often an album has been listened to
type AlbumStats struct {
	Plays      int    `json:"plays"`
	LastPlayed string `json:"last_played,omitempty"`
}

type playStats struct {
	Albums map[string]AlbumStats `json:"albums"`
}

var (
	statsMu     sync.Mutex
	statsLoaded *playStats
)

func loadStats() *playStats {
	if statsLoaded != nil {
		return statsLoaded
	}
	s := &playStats{Albums: map[string]AlbumStats{}}
	if data, err := os.ReadFile(filepath.Join(configDir(), "stats.json")); err == nil {
		_ = json.Unmarshal(data, s)
	}
	if s.Albums == nil {
		s.Albums = map[string]AlbumStats{}
	}
	statsLoaded = s
	return s
}

// RecordPlay counts one listen of an album (the frontend calls it once a track has played a while)
func (a *App) RecordPlay(albumID string) error {
	if albumID == "" {
		return nil
	}
	statsMu.Lock()
	defer statsMu.Unlock()
	s := loadStats()
	st := s.Albums[albumID]
	st.Plays++
	st.LastPlayed = time.Now().Format(time.RFC3339)
	s.Albums[albumID] = st
	return writeJSON("stats.json", s)
}

// GetPlayStats returns play counts keyed by album id
func (a *App) GetPlayStats() map[string]AlbumStats {
	statsMu.Lock()
	defer statsMu.Unlock()
	out := map[string]AlbumStats{}
	for id, st := range loadStats().Albums {
		out[id] = st
	}
	return out
}

// LoadRooms returns the saved rooms as JSON ("" when there are none yet). The room format
// belongs to the frontend so new kinds of room objects need no backend changes.
func (a *App) LoadRooms() (string, error) {
	data, err := os.ReadFile(filepath.Join(configDir(), "rooms.json"))
	if os.IsNotExist(err) {
		return "", nil
	}
	return string(data), err
}

// SaveRooms stores the rooms JSON
func (a *App) SaveRooms(data string) error {
	if !json.Valid([]byte(data)) {
		return fmt.Errorf("rooms data is not valid JSON")
	}
	dir := configDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "rooms.json"), []byte(data), 0644)
}

// GatherAllProgress is sent to the frontend while every album's info is gathered
type GatherAllProgress struct {
	Done    int      `json:"done"`
	Total   int      `json:"total"`
	Current string   `json:"current"`
	Running bool     `json:"running"`
	Errors  []string `json:"errors"`
}

var (
	gatherAllMu     sync.Mutex
	gatherAllCancel chan struct{}
	gatherAllState  GatherAllProgress
)

// GatherAllAlbumInfo gathers info for every album in the background, skipping albums that
// already have it when onlyMissing is set. Progress arrives as "gatherall:progress" events.
func (a *App) GatherAllAlbumInfo(onlyMissing bool) error {
	var todo []Album
	for _, album := range a.GetAlbums() {
		if onlyMissing {
			if sc, err := readSidecar(album.Path); err == nil && sc.Info != nil {
				continue
			}
		}
		todo = append(todo, album)
	}
	return a.startGatherRun(todo)
}

// startGatherRun gathers info for the given albums in the background
func (a *App) startGatherRun(todo []Album) error {
	gatherAllMu.Lock()
	if gatherAllState.Running {
		gatherAllMu.Unlock()
		return fmt.Errorf("already gathering")
	}
	cancel := make(chan struct{})
	gatherAllCancel = cancel
	gatherAllState = GatherAllProgress{Total: len(todo), Running: true, Errors: []string{}}
	gatherAllMu.Unlock()

	emit := func() {
		gatherAllMu.Lock()
		state := gatherAllState
		gatherAllMu.Unlock()
		if a.ctx != nil {
			wailsruntime.EventsEmit(a.ctx, "gatherall:progress", state)
		}
	}
	go func() {
		defer func() {
			gatherAllMu.Lock()
			gatherAllState.Running = false
			gatherAllState.Current = ""
			gatherAllMu.Unlock()
			emit()
		}()
		for i, album := range todo {
			select {
			case <-cancel:
				return
			default:
			}
			gatherAllMu.Lock()
			gatherAllState.Current = album.Artist + " — " + album.Album
			gatherAllMu.Unlock()
			emit()
			if _, err := a.GatherAlbumInfo(album.ID); err != nil {
				gatherAllMu.Lock()
				gatherAllState.Errors = append(gatherAllState.Errors, fmt.Sprintf("%s: %v", album.Album, err))
				gatherAllMu.Unlock()
			}
			gatherAllMu.Lock()
			gatherAllState.Done = i + 1
			gatherAllMu.Unlock()
		}
	}()
	return nil
}

// CancelGatherAll stops a running GatherAllAlbumInfo after the current album
func (a *App) CancelGatherAll() {
	gatherAllMu.Lock()
	defer gatherAllMu.Unlock()
	if gatherAllState.Running && gatherAllCancel != nil {
		close(gatherAllCancel)
		gatherAllCancel = nil
	}
}

// GatherAllStatus reports the current or last gather-all run
func (a *App) GatherAllStatus() GatherAllProgress {
	gatherAllMu.Lock()
	defer gatherAllMu.Unlock()
	return gatherAllState
}
