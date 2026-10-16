// frontend/src/SettingsPage.jsx
import React from "react";
import { Plus, RefreshCw, X } from "lucide-react";
import { SelectFolder } from "../wailsjs/go/main/App";

export default function SettingsPage({ folders, onFoldersChange, onRescan, isScanning, scanResult, albumCount, onBack }) {

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
        </section>
    );
}
