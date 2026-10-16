# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Audire is a minimalist desktop music player built with Wails v2, combining a Go backend with a React/Vite frontend. The application provides a modern UI for managing and playing music libraries with metadata support.

**Tech Stack:**
- Backend: Go 1.23 with Wails v2.11.0
- Frontend: React 18 with Vite 3, Tailwind CSS 3/4
- Desktop Framework: Wails (uses WebView2 on Windows)

## Development Commands

### Running the Application
```bash
# Development mode with hot reload
wails dev

# Build production executable
wails build

# Check system dependencies
wails doctor
```

### Frontend Development
```bash
cd frontend

# Install dependencies
npm install

# Run Vite dev server (standalone, without Wails)
npm run dev

# Build frontend for production
npm run build
```

### Go Commands
```bash
# Run tests
go test ./...

# Update dependencies
go mod tidy

# Generate Wails bindings (run after changing exported Go methods)
wails dev
```

## Architecture

### Backend (Go)

**Main Entry Point:** `main.go`
- Initializes Wails runtime with window configuration
- Embeds frontend build (`frontend/dist`) using Go embed
- Creates and binds the App struct for frontend-backend communication

**App Structure:** `app.go`
- `App` struct holds application context, music library, folders and media server URL (guarded by a mutex)
- `startup()`: Saves context, loads saved folders and the cached library, starts the media server
- `ScanLibrary()`: Rebuilds the library from the saved folders and caches it to `library.json`
- `GetAlbums()`: Returns library albums to frontend
- `GetMediaBaseURL()`: Base URL of the local media server
- `SelectFolder()`: Native folder picker (Wails runtime dialog)
- `OpenFolder()`: Opens an album folder in Explorer/Finder (only paths inside the music folders)
- `SaveMusicFolders()` / `LoadMusicFolders()`: Persist music folder paths to `folders.json`
- `LoadVisualSettings()` / `SaveVisualSettings()`: Persist the Play view's visual, favourites, cycle and
  speed/soften/dim options to `visuals.json`

**Window State:** `window.go` (+ `window_windows.go` helpers)
- The window starts hidden; on DOM ready its size, position and maximised state are restored for the
  current screen setup (keyed by monitor resolutions), then it is shown; saved again in `OnBeforeClose`
- Wails reports positions in absolute screen pixels but sets them relative to the current monitor's work
  area, so restoring subtracts the primary work-area origin; positions no longer on a monitor are centred
- `LoadEmbeddedAlbums()`: Loads the sample album data from embedded `data/albums.json` (no longer used by the UI)

**Library Scanner:** `library.go`
- Walks the music folders and turns each folder of audio files into an album (disc sub-folders like `CD 1` are merged)
- Artist/album/year/track titles are parsed from folder and file names; it never opens audio files,
  so cloud placeholders (Dropbox online-only files) are not downloaded by a scan
- The only file it reads is each album's `audire.json` sidecar, whose gathered info and user edits are layered
  over the parsed names (user edits win)
- Finds cover art by file name (`cover.*`/`folder.*` first, then `cover`/`front` in the name, art sub-folders,
  or the parent folder)
- Skips formats WebView2 cannot play (WMA, AIFF, APE, ...) and reports them in `ScanResult`
- Name parsing is covered by `library_test.go` (`go test ./...`)

**Album Sidecar:** `sidecar.go`
- `audire.json` in each album folder (Jellyfin-style, plain JSON so it is easy to inspect): `metadata` (user edits
  to album/artist/year/genres and track titles keyed by file name), `sources` (MusicBrainz/Wikipedia/AllMusic links;
  `edited` lists links the user set by hand), `info` (gathered write-ups and discography), `cover` (where cover.* came from)
- Audio files are never modified
- `SaveAlbumMetadata()`, `SaveAlbumSources()`, `GetAlbumSidecar()` (in `gather.go`) read and write it

**Info Gathering:** `gather.go`
- `GatherAlbumInfo()` runs only when the user clicks Gather/Refresh, then saves to `audire.json`
- MusicBrainz finds the release group (rate limited to 1 request/second), its links (Wikidata → Wikipedia, AllMusic)
  and the artist's discography; Wikipedia provides album and artist articles as plain-text sections
- The record label and catalogue number come from the earliest official release in the release group
  (year-only dates count as the end of the year so dated originals beat digital reissues)
- AllMusic blocks non-browser clients (Cloudflare), so its link is stored and opened in the browser only;
  do not try to scrape it
- Links the user edited are used as given on refresh; the rest are re-derived from MusicBrainz
- Progress is sent to the UI with the `gather:progress` event

**Covers:** `covers.go`
- `FindCoverCandidates()` searches Cover Art Archive (when matched on MusicBrainz), Apple Music (iTunes Search API)
  and Deezer
- `SaveCover()` downloads the chosen image (must be JPEG/PNG/WebP/GIF), renames any existing `cover.*` to
  `cover (previous).*` and writes `cover.<ext>` into the album folder

**Media Server:** `media.go`
- Loopback-only HTTP server on a random port serving `/audio?path=` and `/cover?path=`
- Only serves files inside the configured music folders with an allowed extension; supports range requests
- Sends CORS headers because the frontend routes audio through the Web Audio API (`crossOrigin="anonymous"`)

**Data Models:** `models.go`
- `Track`: Individual song with title, file path and format (duration is learned by the player)
- `Album`: Collection of tracks with metadata (id, artist, album name, year, cover image path, folder path)
- `Library`: Top-level container for album collection
- `ScanResult`: Albums plus per-folder track counts, skipped files and errors from a scan

**Album Operations:** `albums.go`
- Contains file I/O operations for album data
- Handles JSON serialization/deserialization

**Data Storage:**
- `%AppData%\Audire\folders.json`: Music folder paths (falls back to legacy `data/folders.json` if missing)
- `%AppData%\Audire\library.json`: Cached scan so the library shows instantly on startup
- `%AppData%\Audire\visuals.json`: Current visualiser preset, favourite presets and cycle/speed/soften/dim options
- `%AppData%\Audire\window.json`: Window size, position and maximised state per screen setup
- `<album folder>\audire.json`: Per-album edits, source links and gathered info (see Album Sidecar)
- `<album folder>\cover.<ext>`: Cover chosen in the cover picker
- `data/albums.json`: Embedded sample album metadata (included in binary at build time)

### Frontend (React)

**Entry Point:** `frontend/src/main.jsx`
- Mounts root React component

**Main Component:** `frontend/src/App.jsx`
- Manages application state (view mode, search query, loaded albums, music folders, scan state)
- On mount shows the cached library, then rescans; opens Settings when no folders are configured
- Header tabs PLAY / LIBRARY (styled after Arturia Pigments), a grid/list toggle in Library, and a settings icon
- Views: `library` (grid or list layout), `album`, `settings`, `play`
- Handles search/filtering across albums, artists, years and track titles
- Passes the player bar's height to pages so content is never hidden behind it

**Player Bar:** `frontend/src/PlayerBar.jsx`
- Fixed bar in every view: now playing, previous/play/next, seek and volume
- Drag its top edge up to expand into a large now-playing panel with an "Up next" queue; double-click
  the handle to toggle; the height is remembered (localStorage)

**Settings:** `frontend/src/SettingsPage.jsx`
- "Music Locations" list (styled after Bitwig's Locations settings): each saved folder with track count,
  rescan and remove icons, plus an "Add Location" button that opens the native picker (`SelectFolder`)
- Changes are saved through `SaveMusicFolders` and trigger a rescan in App.jsx
- Shows skipped files and scan errors

**Album Details:** `frontend/src/AlbumDetailsPage.jsx`
- Displays album cover, metadata and track listing
- Play the album or click a track to play from there; highlights the current track
- Shows durations as they are learned from playback
- Edit mode (pencil): album/artist/year/genres and track titles, saved to `audire.json`; "Fill from MusicBrainz"
  copies gathered details into the form
- Clicking the cover opens `CoverPicker.jsx`; `AlbumInfo.jsx` below the tracks has Gather/Refresh, editable source
  links and collapsible album write-up, artist bio and discography (releases in the library link to their page)

**Play View:** `frontend/src/PlayPage.jsx`
- Full-window MilkDrop visualiser using Butterchurn (MIT WebGL port of MilkDrop 2) and the
  butterchurn-presets packs (~395 presets), loaded lazily the first time the tab opens
- Stays mounted after the first visit and only renders while the tab is visible
- Overlay: now-playing track with track arrows; previous/next/favourite/cycle controls; a browser panel
  to search presets and heart favourites; "favourites only" limits next/previous/cycle to favourites
- Adjust panel (hidden until opened): Speed (scales the elapsed time passed to `render()` and lowers the
  frame rate, capped at 60fps), Soften (blends frames on a 2D canvas to calm strobing) and Dim (CSS
  brightness/saturation); all saved in `visuals.json`
- Note: the Winamp source repo's MilkDrop/AVS code is Win32/DirectX and under the Winamp Collaborative
  License (no distribution of modifications), so it is not used here

**Audio Player:** `frontend/src/AudioPlayerContext.jsx`
- Single `<audio>` element routed through Web Audio (gain + analyser nodes)
- `getAudioGraph()` returns the AudioContext and the pre-volume source node for the visualiser
- Queue with next/previous, auto-advance, skip-on-error, volume and seek
- Space toggles play/pause; hardware media keys work via the Media Session API

**Styling:**
- Tailwind CSS for all styling
- Font: Plus Jakarta Sans (Google font, bundled via `@fontsource-variable/plus-jakarta-sans`, works offline)
- Custom dark theme (slate color palette)
- Configuration: `frontend/tailwind.config.js`
- `.btn-accent` (in `index.css`) is the glossy indigo→violet gradient used for primary buttons and pills;
  use it instead of a flat `bg-indigo-500`

**Logo:** `frontend/src/AudireLogo.jsx`
- The header wordmark as inline SVG, animated with GSAP: the waveform breathes when idle and follows the
  music (its own analyser on the pre-volume source: bass drives the tall bar, mids the side bars, treble
  the dots) while playing; the waveform gradient rotates and a shimmer crosses the name every few seconds
- Uses `gsap.matchMedia` so nothing animates when the system asks for reduced motion
- `quickTo` only drives single properties, so scale is set as separate `scaleX`/`scaleY`

**Wails Integration:**
- Frontend imports Go methods from `frontend/wailsjs/go/main/App.js`
- These bindings are auto-generated by Wails during `wails dev` or `wails build`
- Never edit files in `frontend/wailsjs/` manually - they're regenerated

### Frontend-Backend Communication

The frontend calls Go methods directly via auto-generated bindings:

```javascript
import { GetAlbums, SaveMusicFolders, LoadMusicFolders, ScanLibrary } from "../wailsjs/go/main/App";

// Call Go methods as promises
await SaveMusicFolders(["G:\\Music"]);
const result = await ScanLibrary();
const albums = await GetAlbums();
const folders = await LoadMusicFolders();
```

Go methods must be:
1. Exported (capitalized method names)
2. Attached to the `App` struct
3. The struct must be bound in `main.go` via the `Bind` option

After modifying exported Go methods, run `wails dev` to regenerate bindings.

## Project Structure

```
Audire/
├── main.go              # Wails entry point
├── app.go               # Main application struct
├── models.go            # Data models
├── albums.go            # Album operations
├── library.go           # Folder scanner (name-based, no file reads)
├── media.go             # Local media server for audio and cover art
├── sidecar.go           # audire.json per-album sidecar (edits, sources, gathered info)
├── gather.go            # MusicBrainz/Wikipedia info gathering and metadata edits
├── covers.go            # Cover search and saving into album folders
├── window.go            # Remember window size/position per screen setup
├── go.mod               # Go dependencies
├── wails.json           # Wails configuration
├── data/
│   └── albums.json      # Embedded album data
├── build/               # Platform-specific build files
│   ├── windows/         # Windows manifest, icon, installer config
│   └── darwin/          # macOS plist files
└── frontend/
    ├── package.json     # Node dependencies
    ├── vite.config.js   # Vite configuration
    ├── tailwind.config.js
    ├── wailsjs/         # Auto-generated Go bindings (DO NOT EDIT)
    └── src/
        ├── main.jsx     # React entry point
        ├── App.jsx      # Main app component
        ├── SettingsPage.jsx
        ├── AlbumDetailsPage.jsx
        ├── PlayPage.jsx
        ├── PlayerBar.jsx
        ├── AudireLogo.jsx
        ├── AlbumInfo.jsx
        ├── CoverPicker.jsx
        └── AboutPage.jsx
```

## Important Notes

### Wails-Specific Patterns

1. **Go Struct Methods**: All Go methods exposed to frontend must be on the bound struct (`App`)
2. **Context Usage**: The `App.ctx` field stores the Wails runtime context, required for calling Wails runtime APIs
3. **Embedded Assets**: Frontend build is embedded at compile time via `//go:embed all:frontend/dist`
4. **Bindings Regeneration**: Any change to exported Go methods requires running `wails dev` to update JS bindings

### Development Workflow

1. Start with `wails dev` for full hot-reload experience
2. Frontend changes auto-reload via Vite
3. Backend (Go) changes require app restart
4. Browser dev server runs at `http://localhost:34115` for debugging
5. Test bindings by calling Go methods from browser console

### Common Tasks

**Adding a new Go method exposed to frontend:**
1. Add method to `App` struct in `app.go` (or relevant file)
2. Ensure method is exported (starts with capital letter)
3. Run `wails dev` - bindings auto-generate in `frontend/wailsjs/`
4. Import and call from React components

**Modifying data models:**
1. Update structs in `models.go`
2. Ensure JSON tags are correct for serialization
3. Update corresponding frontend TypeScript/JSDoc types if needed

**Adding new pages/views:**
1. Create new component in `frontend/src/`
2. Add view state value to `view` state in `App.jsx` (e.g., "grid", "compact", "settings", "album")
3. Add navigation buttons in header and conditional rendering in main content area

## Future Development Areas

1. **Tag reading**: Metadata comes from folder/file names. Reading tags (and durations) for files that are
   already local would improve names, but must avoid hydrating cloud placeholder files
2. **Unsupported formats**: WMA/AIFF/APE are skipped because WebView2 cannot decode them
