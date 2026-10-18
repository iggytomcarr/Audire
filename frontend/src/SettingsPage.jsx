// frontend/src/SettingsPage.jsx
import React, { useEffect, useState } from "react";
import { Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { CancelGatherAll, GatherAllAlbumInfo, GatherAllStatus, SelectFolder } from "../wailsjs/go/main/App";
import { EventsOn } from "../wailsjs/runtime/runtime";

// Gathers info for every album in the background so the Room view can shelve them by genre
function GatherAll({ albumCount, onLibraryChanged }) {
    const [status, setStatus] = useState(null);
    const [refreshAll, setRefreshAll] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        GatherAllStatus().then(setStatus).catch(() => {});
        const off = EventsOn("gatherall:progress", (s) => {
            setStatus(s);
            if (!s.running) onLibraryChanged?.();
        });
        return () => off?.();
    }, []);

    const start = async () => {
        setError(null);
        try {
            await GatherAllAlbumInfo(!refreshAll);
        } catch (e) {
            setError(String(e));
        }
    };

    const running = status?.running;
    const pct = status?.total ? Math.round((status.done / status.total) * 100) : 0;
    return (
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
            <div>
                <h2 className="text-sm font-semibold">Album info</h2>
                <p className="mt-1 text-xs text-slate-400">
                    Gather details, genres and labels for every album from MusicBrainz and Wikipedia. The listening room uses the genres to put albums on the right shelves.
                </p>
            </div>
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                {running ? (
                    <>
                        <div className="flex items-center justify-between text-sm">
                            <span className="min-w-0 truncate text-slate-300">{status.current || "Starting…"}</span>
                            <span className="shrink-0 tabular-nums text-slate-400">{status.done} / {status.total}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                            <div className="btn-accent h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <button onClick={() => CancelGatherAll()} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800">Stop after this album</button>
                    </>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-3">
                            <button onClick={start} className="btn-accent inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold">
                                <Sparkles size={14} /> Gather info for all albums
                            </button>
                            <label className="flex items-center gap-2 text-xs text-slate-300">
                                <input type="checkbox" checked={refreshAll} onChange={(e) => setRefreshAll(e.target.checked)} className="accent-indigo-400" />
                                Also refresh albums that already have info
                            </label>
                        </div>
                        <p className="text-xs text-slate-500">
                            MusicBrainz allows one request a second, so this takes about 5 seconds an album ({albumCount} albums). You can keep listening while it runs.
                        </p>
                        {status?.total > 0 && (
                            <p className="text-xs text-slate-400">
                                Last run: {status.done} of {status.total} albums{status.errors?.length ? `, ${status.errors.length} couldn't be found` : ""}.
                            </p>
                        )}
                    </>
                )}
                {error && <p className="text-xs text-rose-400">{error}</p>}
                {status?.errors?.length > 0 && !running && (
                    <details className="text-xs text-slate-400">
                        <summary className="cursor-pointer">Albums that couldn't be gathered</summary>
                        <ul className="mt-1 list-disc pl-5">{status.errors.slice(0, 20).map((e) => <li key={e}>{e}</li>)}</ul>
                    </details>
                )}
            </div>
        </div>
    );
}

export default function SettingsPage({ folders, onFoldersChange, onRescan, isScanning, scanResult, albumCount, onLibraryChanged, onBack }) {

    async function addLocation() {
        try {
            const path = await SelectFolder();
            if (!path || folders.some((f) => f.toLowerCase() === path.toLowerCase())) return;
            onFoldersChange([...folders, path]);
        } catch (err) {
            console.error("Folder picker failed:", err);
        }
    }

    const counts = scanResult?.folder_counts || {};

    return (
        <section className="mx-auto w-full max-w-5xl py-6">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-xl font-semibold">Settings</h1>
                <button
                    onClick={onBack}
                    className="rounded-lg border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900"
                >
                    ← Back to Library
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                <div>
                    <h2 className="text-sm font-semibold">Music Locations</h2>
                    <p className="mt-1 text-xs text-slate-400">
                        Folders Audire scans for music. They are saved and scanned again each time Audire starts.
                    </p>
                </div>

                <div>
                    <div className="overflow-hidden rounded-xl border border-slate-800">
                        {folders.length === 0 && (
                            <div className="px-3 py-4 text-center text-sm text-slate-400">No locations added yet.</div>
                        )}
                        {folders.map((p) => (
                            <div key={p} className="flex items-center gap-3 border-b border-slate-800 bg-slate-900/40 px-3 py-2 text-sm">
                                <span className="min-w-0 flex-1 truncate font-mono" title={p}>{p}</span>
                                <span className="shrink-0 tabular-nums text-xs text-slate-400">
                                    {isScanning ? "scanning…" : counts[p] != null ? `${counts[p]} tracks` : ""}
                                </span>
                                <button
                                    onClick={onRescan}
                                    disabled={isScanning}
                                    className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-indigo-300 disabled:opacity-60"
                                    title="Rescan"
                                    aria-label={`Rescan ${p}`}
                                >
                                    <RefreshCw size={14} className={isScanning ? "animate-spin" : ""} />
                                </button>
                                <button
                                    onClick={() => onFoldersChange(folders.filter((f) => f !== p))}
                                    className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"
                                    title="Remove location"
                                    aria-label={`Remove ${p}`}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={addLocation}
                            className="flex w-full items-center justify-center gap-1.5 bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                        >
                            <Plus size={16} />
                            Add Location
                        </button>
                    </div>

                    {scanResult && !isScanning && (
                        <div className="mt-3 space-y-1 text-xs text-slate-400">
                            {scanResult.albums && (
                                <p>
                                    {albumCount} albums, {scanResult.track_count} tracks.
                                </p>
                            )}
                            {scanResult.skipped > 0 && (
                                <p className="text-amber-300">
                                    Skipped {scanResult.skipped} files in formats the player can't play ({scanResult.skipped_exts?.join(", ")}).
                                </p>
                            )}
                            {scanResult.errors?.length > 0 && (
                                <ul className="list-disc pl-5 text-rose-400">
                                    {scanResult.errors.slice(0, 5).map((e) => (
                                        <li key={e}>{e}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-8">
                <GatherAll albumCount={albumCount} onLibraryChanged={onLibraryChanged} />
            </div>
        </section>
    );
}
