// frontend/src/SettingsPage.jsx
import React, { useState } from "react";

export default function SettingsPage({ folders, setFolders, onBack }) {
    const [newPath, setNewPath] = useState("");
    const fileInputId = "dir-picker";

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
        files.forEach((f) => {
            const wrp = f.webkitRelativePath || "";
            const root = wrp.split("/")[0];
            if (root) roots.add(root);
        });
        const toAdd = Array.from(roots).filter((r) => !folders.includes(r));
        if (toAdd.length) setFolders([...folders, ...toAdd]);
        e.target.value = "";
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
                    placeholder="Enter folder path (e.g., C:\\Music or /Users/me/Music)"
                    className="min-w-[300px] flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400"
                />
                <button
                    onClick={() => addFolder(newPath)}
                    className="rounded-lg border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900"
                >
                    Add Path
                </button>

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
                    Browse Folder…
                </label>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                    <thead className="bg-slate-900/70">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-300">Folder Path</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-300">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {folders.length === 0 ? (
                        <tr>
                            <td colSpan="2" className="px-3 py-6 text-center text-slate-400">
                                No folders added yet.
                            </td>
                        </tr>
                    ) : (
                        folders.map((p) => (
                            <tr key={p} className="border-t border-slate-800">
                                <td className="px-3 py-2 font-mono">{p}</td>
                                <td className="px-3 py-2 text-right">
                                    <button
                                        onClick={() => setFolders(folders.filter((f) => f !== p))}
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