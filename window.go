package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// The window's size, position and maximised state are saved on close and restored on
// launch, separately for each screen setup (e.g. laptop alone vs docked to a monitor).

// WindowState is where the window was for one screen setup
type WindowState struct {
	Width     int  `json:"width"`  // DPI-independent size, as Wails reports it
	Height    int  `json:"height"` //
	X         int  `json:"x"`      // top-left corner in screen pixels
	Y         int  `json:"y"`      //
	Maximised bool `json:"maximised"`
}

type windowFile struct {
	Last    *WindowState           `json:"last,omitempty"`
	Screens map[string]WindowState `json:"screens"`
}

const minWindowWidth, minWindowHeight = 640, 480

func loadWindowFile() windowFile {
	wf := windowFile{Screens: map[string]WindowState{}}
	if data, err := os.ReadFile(filepath.Join(configDir(), "window.json")); err == nil {
		_ = json.Unmarshal(data, &wf)
	}
	if wf.Screens == nil {
		wf.Screens = map[string]WindowState{}
	}
	return wf
}

// initialWindowSize is the size to create the window at, before the screen setup is known
func initialWindowSize() (width, height int, maximised bool) {
	if last := loadWindowFile().Last; last != nil && last.Width >= minWindowWidth && last.Height >= minWindowHeight {
		return last.Width, last.Height, last.Maximised
	}
	return 1024, 768, false
}

// screenKey identifies the current screen setup by its monitors' resolutions
func screenKey(ctx context.Context) string {
	screens, err := wailsruntime.ScreenGetAll(ctx)
	if err != nil || len(screens) == 0 {
		return "unknown"
	}
	var parts []string
	for _, s := range screens {
		primary := ""
		if s.IsPrimary {
			primary = "*"
		}
		parts = append(parts, fmt.Sprintf("%dx%d%s", s.PhysicalSize.Width, s.PhysicalSize.Height, primary))
	}
	sort.Strings(parts)
	return strings.Join(parts, "+")
}

// restoreWindow puts the window back where it was for this screen setup, then shows it
func (a *App) restoreWindow(ctx context.Context) {
	a.mu.Lock()
	done := a.windowRestored
	a.windowRestored = true
	a.mu.Unlock()
	if done {
		return // the frontend reloaded (e.g. in wails dev); leave the window where it is
	}
	defer a.showWindow(ctx)

	state, ok := loadWindowFile().Screens[screenKey(ctx)]
	if !ok || state.Width < minWindowWidth || state.Height < minWindowHeight {
		wailsruntime.WindowCenter(ctx)
		return
	}
	wailsruntime.WindowSetSize(ctx, state.Width, state.Height)
	// Only move it back if that spot is still on a connected monitor
	if pointOnAMonitor(state.X+60, state.Y+15) {
		// Wails positions relative to the current monitor's work area; the window starts on the primary one
		left, top := primaryWorkAreaOrigin()
		wailsruntime.WindowSetPosition(ctx, state.X-left, state.Y-top)
	} else {
		wailsruntime.WindowCenter(ctx)
	}
	if state.Maximised {
		wailsruntime.WindowMaximise(ctx)
	}
}

func (a *App) showWindow(ctx context.Context) {
	a.mu.Lock()
	shown := a.windowShown
	a.windowShown = true
	a.mu.Unlock()
	if !shown {
		wailsruntime.WindowShow(ctx)
	}
}

// showWindowEventually makes sure the window appears even if the page never finishes loading
func (a *App) showWindowEventually(ctx context.Context) {
	go func() {
		time.Sleep(5 * time.Second)
		a.showWindow(ctx)
	}()
}

// saveWindowState records the window's size and position for this screen setup
func (a *App) saveWindowState(ctx context.Context) {
	if wailsruntime.WindowIsMinimised(ctx) {
		return // minimised windows report an off-screen position
	}
	wf := loadWindowFile()
	key := screenKey(ctx)
	state := wf.Screens[key]
	state.Maximised = wailsruntime.WindowIsMaximised(ctx)
	if !state.Maximised {
		// Keep the un-maximised size and position so restoring from maximised still works
		state.Width, state.Height = wailsruntime.WindowGetSize(ctx)
		state.X, state.Y = wailsruntime.WindowGetPosition(ctx)
	}
	if state.Width < minWindowWidth || state.Height < minWindowHeight {
		state.Width, state.Height, _ = initialWindowSize()
	}
	wf.Screens[key] = state
	wf.Last = &state
	if err := writeJSON("window.json", wf); err != nil {
		println("Could not save window position:", err.Error())
	}
}

// beforeClose saves the window state; returning false lets the app close
func (a *App) beforeClose(ctx context.Context) bool {
	a.saveWindowState(ctx)
	return false
}
