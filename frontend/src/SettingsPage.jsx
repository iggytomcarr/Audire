// frontend/src/SettingsPage.jsx
import React, { useState } from "react";
import { SelectFolder } from "../wailsjs/go/main/App";

export default function SettingsPage({ folders, onFoldersChange, onRescan, isScanning, scanResult, albumCount, onBack }) {
    const [newPath, setNewPath] = useState("");

    function addFolder(path) {
        let p = path.trim().replace(/^"|"$/g, "").replace(/[\\/]+$/, "");
        if (/^[A-Za-z]:$/.test(p)) p += "\\";
        if (!p) return;
        setNewPath("");
        if (folders.some((f) => f.toLowerCase() === p.toLowerCase())) return;
        onFoldersChange([...folders, p]);
    }

    async function browse() {
        try {
            const path = await SelectFolder();
            if (path) addFolder(path);
        } catch (err) {
            console.error("Folder picker failed:", err);
        }
    }

    const counts = scanResult?.folder_counts || {};

    return (
        <section className="mx-auto w-full max-w-5xl py-6">
            <div className="mb-4 flex items-center justify-between">
                <h1 className="text-xl font-semibold">Settings</h1>
                <button
                    onClick={onBack}
                    className="rounded-lg border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900"
                >
                    ← Back to Library
                </button>
            </div>

            <div className="mb-3 text-sm text-slate-300">
                Configure folders to scan for music. Each folder of tracks becomes an album.
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
                <button
                    onClick={browse}
                    className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-indigo-400"
                >
                    Select Folder
                </button>

                <form
                    className="flex min-w-[300px] flex-1 gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        addFolder(newPath);
                    }}
                >
                    <input
                        type="text"
                        value={newPath}
                        onChange={(e) => setNewPath(e.target.value)}
                        placeholder="…or paste a folder path, e.g. G:\Dropbox\Music"
                        className="flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400"
                    />
                    <button
                        type="submit"
                        disabled={!newPath.trim()}
                        className="rounded-lg border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900 disabled:cursor-not-allowed disabled:text-slate-500"
                    >
                        Add
                    </button>
                </form>

                <button
                    onClick={onRescan}
                    disabled={!folders.length || isScanning}
                    className={`rounded-lg border px-3 py-2 text-sm transition ${
                        !folders.length || isScanning
                            ? "cursor-not-allowed border-slate-800 text-slate-500"
                            : "border-slate-800 hover:bg-slate-900"
                    }`}
                    title="Scan selected folders for music files"
                >
                    {isScanning ? "Scanning…" : "Rescan"}
                </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                    <thead className="bg-slate-900/70">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-300">Folder Path</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-300">Tracks</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-300">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {folders.length === 0 ? (
                        <tr>
                            <td colSpan="3" className="px-3 py-6 text-center text-slate-400">
                                No folders added yet.
                            </td>
                        </tr>
                    ) : (
                        folders.map((p) => (
                            <tr key={p} className="border-t border-slate-800">
                                <td className="px-3 py-2 font-mono">{p}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{isScanning ? "…" : counts[p] ?? "—"}</td>
                                <td className="px-3 py-2 text-right">
                                    <button
                                        onClick={() => onFoldersChange(folders.filter((f) => f !== p))}
                                        className="rounded-lg border border-slate-800 px-2 py-1 text-xs hover:bg-slate-900"
                                    >
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>

            {scanResult && !isScanning && (
                <div className="mt-4 space-y-1 text-sm text-slate-300">
                    {scanResult.albums && (
                        <p>
                            Found {albumCount} albums ({scanResult.track_count} tracks).
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
        </section>
    );
}
