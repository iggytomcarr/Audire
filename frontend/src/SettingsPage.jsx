// frontend/src/SettingsPage.jsx
import React, { useState } from "react";

export default function SettingsPage({ folders, setFolders, onBack }) {
    const [newPath, setNewPath] = useState("");
    const fileInputId = "dir-picker";
    const [counts, setCounts] = useState({});
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null);

    function addFolder(path) {
        const p = path.trim();
        if (!p) return;
        if (folders.includes(p)) return;
        setFolders([...folders, p]);
        setNewPath("");
    }

    function onBrowseChange(e) {
        const files = Array.from(e.target.files || []);
        const roots = new Set();

        // Count only audio files per selected root folder
        const audioExts = new Set([".mp3", ".flac", ".wav", ".m4a", ".ogg", ".aac", ".alac", ".aiff", ".wma"]);
        const perRootCounts = {};


        files.forEach((f) => {
            const wrp = f.webkitRelativePath || "";
            const root = wrp.split("/")[0];
            if (!root) return;
            roots.add(root);

            const ext = (f.name?.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
            if (audioExts.has(ext)) {
                perRootCounts[root] = (perRootCounts[root] || 0) + 1;
            }
        });

        const toAdd = Array.from(roots).filter((r) => !folders.includes(r));
        if (toAdd.length) {
            setFolders([...folders, ...toAdd]);
        }

        // Update counts for any roots we just processed (overwrite with latest counts)
        if (Object.keys(perRootCounts).length) {
            setCounts((prev) => {
                const next = { ...prev };
                for (const [root, cnt] of Object.entries(perRootCounts)) {
                    next[root] = cnt;
                }
                return next;
            });
        }

        e.target.value = "";
    }


    async function handleScan() {
        if (!folders.length || isScanning) return;
        setIsScanning(true);
        setScanResult(null);
        try {
            const files = await Scan(folders);
            setScanResult({ ok: true, count: files?.length || 0 });
        } catch (err) {
            setScanResult({ ok: false, message: String(err) });
        } finally {
            setIsScanning(false);
        }
    }

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
                Configure folders to scan for music. These are stored locally on your device.
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
                <input
                    type="text"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="Use the Select Folder button to select a folder containing music files"
                    className="min-w-[300px] flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400"
                />


                <input
                    id={fileInputId}
                    type="file"
                    webkitdirectory="true"
                    directory="true"
                    multiple
                    className="hidden"
                    onChange={onBrowseChange}
                />
                <label
                    htmlFor={fileInputId}
                    className="cursor-pointer rounded-lg border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900"
                >
                    Select Folder
                </label>

                <button
                    onClick={handleScan}
                    disabled={!folders.length || isScanning}
                    className={`rounded-lg border px-3 py-2 text-sm transition ${
                        !folders.length || isScanning
                            ? "cursor-not-allowed border-slate-800 text-slate-500"
                            : "border-slate-800 hover:bg-slate-900"
                    }`}
                    title="Scan selected folders for music files"
                >
                    {isScanning ? "Scanning…" : "Scan"}
                </button>


            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                    <thead className="bg-slate-900/70">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-300">Folder Path</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-300">Files</th>
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
                                <td className="px-3 py-2 text-right tabular-nums">{counts[p] ?? 0}</td>
                                <td className="px-3 py-2 text-right">
                                    <button
                                        onClick={() => {
                                            setFolders(folders.filter((f) => f !== p));
                                            setCounts((prev) => {
                                                const next = { ...prev };
                                                delete next[p];
                                                return next;
                                            });
                                        }}
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

        </section>
    );
}