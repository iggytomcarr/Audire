// /frontend/src/App.jsx
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { SkipBack, Play, Pause, SkipForward, Volume2, Loader2, LayoutGrid, List, Settings } from "lucide-react";
import logo from "./assets/images/audire_menu_logo.png";

import AlbumDetailsPage from "./AlbumDetailsPage";
import SettingsPage from "./SettingsPage";
import PlayPage from "./PlayPage";
import { useAudioPlayer, formatTime } from "./AudioPlayerContext";
import { GetAlbums, LoadMusicFolders, SaveMusicFolders, ScanLibrary } from "../wailsjs/go/main/App";

const GRADIENTS = [
    "from-slate-700 to-slate-900",
    "from-emerald-700 to-teal-900",
    "from-violet-600 to-violet-900",
    "from-blue-900 to-slate-950",
    "from-blue-600 to-blue-900",
    "from-rose-700 to-rose-900",
    "from-amber-700 to-amber-900",
    "from-green-700 to-emerald-900",
    "from-slate-600 to-slate-900",
    "from-sky-600 to-sky-900"
];

export default function App() {
    const [query, setQuery] = useState("");
    const [view, setView] = useState("library"); // "library" | "album" | "settings" | "play"
    const [layout, setLayout] = useState("grid"); // library layout: "grid" | "compact"
    const [playVisited, setPlayVisited] = useState(false);
    useEffect(() => {
        if (view === "play") setPlayVisited(true);
    }, [view]);
    const [loadedAlbums, setLoadedAlbums] = useState([]);
    const [folders, setFolders] = useState([]);
    const [selectedAlbumId, setSelectedAlbumId] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null);

    const player = useAudioPlayer();
    const { currentTrack, isPlaying, isLoading, currentTime, duration, error, volume, setVolume, playQueue, togglePlayPause, next, previous, seek, coverURL, hasNext } = player;

    const rescan = useCallback(async () => {
        setIsScanning(true);
        try {
            const result = await ScanLibrary();
            setLoadedAlbums(result.albums || []);
            setScanResult(result);
        } catch (err) {
            console.error("Failed to scan library:", err);
            setScanResult({ errors: [String(err)] });
        } finally {
            setIsScanning(false);
        }
    }, []);

    // Show the cached library straight away, then rescan to pick up new music.
    // Scanning only lists folders, so online-only cloud files are not downloaded.
    useEffect(() => {
        const init = async () => {
            try {
                const [savedFolders, cachedAlbums] = await Promise.all([LoadMusicFolders(), GetAlbums()]);
                setFolders(savedFolders || []);
                setLoadedAlbums(cachedAlbums || []);
                if (savedFolders?.length) {
                    await rescan();
                } else {
                    setView("settings");
                }
            } catch (error) {
                console.error("Failed to load library:", error);
            }
        };
        init();
    }, [rescan]);

    // Re-read the library after an album's metadata, info or cover changes
    const refreshAlbums = useCallback(async () => {
        try {
            setLoadedAlbums((await GetAlbums()) || []);
        } catch (err) {
            console.error("Failed to refresh albums:", err);
        }
    }, []);

    const updateFolders = async (nextFolders) => {
        setFolders(nextFolders);
        try {
            await SaveMusicFolders(nextFolders);
        } catch (error) {
            console.error("Failed to save music folders:", error);
        }
        await rescan();
    };

    // Convert backend albums to display format
    const albums = useMemo(() => {
        return loadedAlbums.map((album, index) => {
            const id = album.id || String(index + 1);
            const title = album.album || "Unknown Album";
            const artist = album.artist || "Unknown Artist";
            return {
                id,
                title,
                artist,
                year: album.year || (album.release_date ? Number(album.release_date.slice(0, 4)) : ""),
                coverImage: album.cover_image ? `${coverURL(album.cover_image)}&v=${album.cover_version || 0}` : null,
                tracks: (album.tracks || [])
                    .filter((t) => t.path)
                    .map((t) => ({ ...t, artist, album: title, albumId: id, cover: album.cover_image })),
                rawAlbum: album, // Keep reference to original album data
                colors: GRADIENTS[index % GRADIENTS.length]
            };
        });
    }, [loadedAlbums, coverURL]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return albums;
        return albums.filter(
            (a) =>
                a.title.toLowerCase().includes(q) ||
                a.artist.toLowerCase().includes(q) ||
                String(a.year).includes(q) ||
                a.tracks.some((t) => t.title.toLowerCase().includes(q))
        );
    }, [albums, query]);

    const selectedAlbum = albums.find((a) => a.id === selectedAlbumId);
    const playingAlbum = currentTrack ? albums.find((a) => a.id === currentTrack.albumId) : null;

    // Remember where you were in the library (overview or an album, and how far down)
    // so coming back from Play or Settings returns to the same place
    const lastLibraryView = useRef("library");
    const scrollPositions = useRef({});
    const pageKey = (v, albumId = selectedAlbumId) => (v === "album" ? `album:${albumId}` : v);

    const navigate = (next, { albumId = selectedAlbumId, exact = false } = {}) => {
        if (view === "library" || view === "album") {
            lastLibraryView.current = view;
            scrollPositions.current[pageKey(view)] = window.scrollY;
        }
        if (next === "library" && !exact && (view === "play" || view === "settings")) {
            next = lastLibraryView.current;
        }
        setSelectedAlbumId(albumId);
        setView(next);
        const top = scrollPositions.current[pageKey(next, albumId)] || 0;
        requestAnimationFrame(() => window.scrollTo(0, top));
    };

    // Function to handle album clicks
    const handleAlbumClick = (album) => {
        delete scrollPositions.current[pageKey("album", album.id)];
        navigate("album", { albumId: album.id });
    };

    const playAlbum = (e, album) => {
        e.stopPropagation();
        if (album.tracks.length) playQueue(album.tracks, 0);
    };

    const subtitle = (a) => [a.artist, a.year].filter(Boolean).join(" • ");

    return (
        <div id="App" className="min-h-dvh bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
            {/* Top Bar */}
            <header className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur">
                <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-3">
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                        <img src={logo} alt="logo" className="h-8 w-auto rounded-lg shadow" />
                        {/*<div className="text-lg font-semibold tracking-wide">Audire Music Player</div>*/}
                    </div>

                    {/* Search */}
                    <div className="flex items-center">
                        <label className="relative w-full" aria-label="Search library">
                            <input
                                type="search"
                                placeholder="Search albums, artists, tracks…"
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    if (view !== "library") navigate("library", { exact: true });
                                }}
                                className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 outline-none placeholder:text-slate-400 focus:border-indigo-400"
                            />
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-start gap-1 sm:justify-end">
                        {/* Mode tabs, in the style of Pigments' PLAY / SYNTH tabs */}
                        {[
                            { id: "play", label: "Play", active: view === "play" },
                            { id: "library", label: "Library", active: view === "library" || view === "album" },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => navigate(tab.id)}
                                aria-pressed={tab.active}
                                className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] transition ${
                                    tab.active ? "bg-indigo-500/20 text-indigo-300" : "text-slate-300 hover:text-white"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}

                        {view === "library" && (
                            <div className="ml-2 flex rounded-lg border border-slate-800">
                                {[
                                    { id: "grid", icon: <LayoutGrid size={16} />, title: "Grid view" },
                                    { id: "compact", icon: <List size={16} />, title: "List view" },
                                ].map((l) => (
                                    <button
                                        key={l.id}
                                        onClick={() => setLayout(l.id)}
                                        aria-pressed={layout === l.id}
                                        className={`p-2 transition first:rounded-l-lg last:rounded-r-lg ${
                                            layout === l.id ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-100"
                                        }`}
                                        title={l.title}
                                    >
                                        {l.icon}
                                    </button>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => navigate("settings")}
                            aria-pressed={view === "settings"}
                            className={`ml-2 rounded-lg p-2 transition hover:bg-slate-900 ${
                                view === "settings" ? "text-indigo-300" : "text-slate-300 hover:text-white"
                            }`}
                            title="Settings"
                            aria-label="Open Settings"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Play mode: mounted on first visit, then kept alive so the visual carries on where it left off */}
            {(playVisited || view === "play") && (
                <PlayPage
                    active={view === "play"}
                    playingAlbum={playingAlbum}
                    onOpenLibrary={() => navigate("library")}
                />
            )}

            {/* Content */}
            <main className={`mx-auto w-full max-w-7xl px-4 pb-28 pt-4 ${view === "play" ? "hidden" : ""}`}>
                {view === "settings" ? (
                    <SettingsPage
                        folders={folders}
                        onFoldersChange={updateFolders}
                        onRescan={rescan}
                        isScanning={isScanning}
                        scanResult={scanResult}
                        albumCount={albums.length}
                        onBack={() => navigate("library")}
                    />
                ) : view === "album" && selectedAlbum ? (
                    <AlbumDetailsPage
                        album={selectedAlbum}
                        onBack={() => navigate("library")}
                        onAlbumUpdated={refreshAlbums}
                        libraryAlbums={albums}
                        onOpenAlbum={(id) => handleAlbumClick({ id })}
                    />
                ) : albums.length === 0 ? (
                    <div className="mx-auto max-w-md py-24 text-center">
                        {isScanning ? (
                            <p className="text-slate-300">Scanning your music folders…</p>
                        ) : (
                            <>
                                <p className="mb-4 text-slate-300">Your library is empty. Add a music folder to get started.</p>
                                <button
                                    onClick={() => navigate("settings")}
                                    className="rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-slate-950 hover:bg-indigo-400"
                                >
                                    Add music folder
                                </button>
                            </>
                        )}
                    </div>
                ) : filtered.length === 0 ? (
                    <p className="py-24 text-center text-slate-400">Nothing matches "{query}".</p>
                ) : layout === "grid" ? (
                    <section aria-label="Albums grid" className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {filtered.map((a) => (
                            <article
                                key={a.id}
                                tabIndex={0}
                                className="group cursor-pointer outline-none"
                                onClick={() => handleAlbumClick(a)}
                                onKeyDown={(e) => e.key === "Enter" && handleAlbumClick(a)}
                            >
                                <div
                                    className={`relative aspect-square overflow-hidden rounded-2xl ${a.coverImage ? 'bg-slate-900' : `bg-gradient-to-br ${a.colors}`} shadow-lg ring-1 ring-slate-900/40 transition-transform group-hover:scale-105`}
                                    aria-label={`${a.title} by ${a.artist}`}
                                >
                                    {a.coverImage && (
                                        <img
                                            src={a.coverImage}
                                            alt={`${a.title} cover`}
                                            loading="lazy"
                                            className="h-full w-full object-cover"
                                            onError={(e) => (e.currentTarget.style.display = "none")}
                                        />
                                    )}
                                    <button
                                        className={`absolute bottom-2 right-2 inline-grid h-10 w-10 place-items-center rounded-full bg-slate-950/80 text-slate-100 shadow transition group-hover:opacity-100 ${
                                            playingAlbum?.id === a.id ? "opacity-100" : "opacity-0"
                                        }`}
                                        title={`Play ${a.title}`}
                                        onClick={(e) => playAlbum(e, a)}
                                    >
                                        <Play size={18} fill="currentColor" />
                                    </button>
                                </div>
                                <div className="mt-2">
                                    <h3 className={`truncate text-sm font-semibold ${playingAlbum?.id === a.id ? "text-indigo-300" : ""}`}>{a.title}</h3>
                                    <p className="truncate text-xs text-slate-400">{subtitle(a)}</p>
                                </div>
                            </article>
                        ))}
                    </section>
                ) : (
                    <section aria-label="Albums list" className="grid gap-2">
                        {filtered.map((a) => (
                            <div
                                key={a.id}
                                tabIndex={0}
                                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-2 outline-none cursor-pointer hover:bg-slate-800/50 transition"
                                onClick={() => handleAlbumClick(a)}
                                onKeyDown={(e) => e.key === "Enter" && handleAlbumClick(a)}
                            >
                                <div className={`relative h-12 w-12 overflow-hidden rounded-lg ${a.coverImage ? 'bg-slate-900' : `bg-gradient-to-br ${a.colors}`} ring-1 ring-slate-900/40`}>
                                    {a.coverImage && (
                                        <img
                                            src={a.coverImage}
                                            alt={`${a.title} cover`}
                                            loading="lazy"
                                            className="h-full w-full object-cover"
                                            onError={(e) => (e.currentTarget.style.display = "none")}
                                        />
                                    )}
                                </div>
                                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                                    <div className={`truncate font-medium ${playingAlbum?.id === a.id ? "text-indigo-300" : ""}`}>{a.title}</div>
                                    <div className="truncate text-slate-400">{a.artist}</div>
                                    <div className="text-right text-slate-400">{a.year || ""}</div>
                                </div>
                                <div className="ml-2 inline-flex gap-2">
                                    <button
                                        className="rounded-lg border border-slate-800 px-3 py-1 text-xs hover:bg-slate-900"
                                        onClick={(e) => playAlbum(e, a)}
                                    >
                                        Play
                                    </button>
                                </div>
                            </div>
                        ))}
                    </section>
                )}
            </main>

            {/* Footer Player */}
            <footer className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/80 backdrop-blur">
                <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-3 px-4 py-3 md:grid-cols-3">
                    <div
                        className={`flex min-w-0 items-center gap-3 ${playingAlbum ? "cursor-pointer" : ""}`}
                        onClick={() => playingAlbum && handleAlbumClick(playingAlbum)}
                    >
                        <div className={`h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-800 ${playingAlbum && !playingAlbum.coverImage ? `bg-gradient-to-br ${playingAlbum.colors}` : "bg-slate-900"}`}>
                            {playingAlbum?.coverImage && (
                                <img src={playingAlbum.coverImage} alt="" className="h-full w-full object-cover" />
                            )}
                        </div>
                        <div className="min-w-0">
                            {currentTrack ? (
                                <>
                                    <div className="truncate text-sm font-medium">{currentTrack.title}</div>
                                    <div className={`truncate text-xs ${error ? "text-rose-400" : "text-slate-400"}`}>
                                        {error || (isLoading ? "Loading… (cloud files download on first play)" : `${currentTrack.artist} — ${currentTrack.album}`)}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="truncate text-sm font-medium">Nothing playing</div>
                                    <div className="truncate text-xs text-slate-400">Select an album to start</div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-center gap-2">
                        <button
                            onClick={previous}
                            disabled={!currentTrack}
                            className="rounded-lg border border-slate-800 px-3 py-2 transition hover:bg-slate-800 disabled:opacity-40"
                            title="Previous"
                        >
                            <SkipBack size={20} />
                        </button>
                        <button
                            onClick={togglePlayPause}
                            disabled={!currentTrack}
                            className="rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-slate-950 shadow transition hover:bg-indigo-400 disabled:opacity-40"
                            title={isPlaying ? "Pause" : "Play"}
                        >
                            {isLoading && !isPlaying ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : isPlaying ? (
                                <Pause size={20} fill="currentColor" />
                            ) : (
                                <Play size={20} fill="currentColor" />
                            )}
                        </button>
                        <button
                            onClick={next}
                            disabled={!hasNext}
                            className="rounded-lg border border-slate-800 px-3 py-2 transition hover:bg-slate-800 disabled:opacity-40"
                            title="Next"
                        >
                            <SkipForward size={20} />
                        </button>
                    </div>
                    <div className="flex items-center gap-3 md:justify-end">
                        <span className="w-10 text-right text-xs tabular-nums text-slate-400">{formatTime(currentTime)}</span>
                        <input
                            type="range"
                            min="0"
                            max={duration || 0}
                            step="0.1"
                            value={Math.min(currentTime, duration || 0)}
                            onChange={(e) => seek(Number(e.target.value))}
                            disabled={!duration}
                            className="w-full accent-indigo-400 md:w-48"
                            aria-label="Seek"
                        />
                        <span className="w-10 text-xs tabular-nums text-slate-400">{formatTime(duration)}</span>
                        <Volume2 size={16} className="shrink-0 text-slate-400" />
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => setVolume(Number(e.target.value))}
                            className="w-20 accent-indigo-400"
                            aria-label="Volume"
                        />
                    </div>
                </div>
            </footer>
        </div>
    );
}
