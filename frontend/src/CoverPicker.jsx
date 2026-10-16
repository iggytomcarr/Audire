// frontend/src/CoverPicker.jsx
// Pick album art from online sources (or paste a link) and save it into the album folder.
import React, { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { FindCoverCandidates, SaveCover } from "../wailsjs/go/main/App";
import { BrowserOpenURL } from "../wailsjs/runtime/runtime";

export default function CoverPicker({ album, onClose, onSaved }) {
    const [candidates, setCandidates] = useState(null);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null); // { url, source }
    const [pasted, setPasted] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        FindCoverCandidates(album.id)
            .then((c) => setCandidates(c || []))
            .catch((e) => {
                setCandidates([]);
                setError(String(e));
            });
    }, [album.id]);

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const choice = pasted.trim() ? { url: pasted.trim(), source: "Pasted link" } : selected;

    const save = async () => {
        if (!choice) return;
        setSaving(true);
        setError(null);
        try {
            await SaveCover(album.id, choice.url, choice.source);
            onSaved();
            onClose();
        } catch (e) {
            setError(String(e));
        } finally {
            setSaving(false);
        }
    };

    const googleImages = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${album.artist} ${album.title} album cover`)}`;

    return (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                    <div className="min-w-0">
                        <h2 className="font-semibold">Choose a cover</h2>
                        <p className="truncate text-xs text-slate-400">{album.artist} — {album.title} · saved as cover.jpg in the album folder</p>
                    </div>
                    <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {candidates === null ? (
                        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                            <Loader2 size={16} className="animate-spin" /> Searching Cover Art Archive, Apple Music and Deezer…
                        </div>
                    ) : candidates.length === 0 ? (
                        <p className="py-10 text-center text-sm text-slate-400">No covers found. Paste an image link below.</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                            {candidates.map((c) => {
                                const isSelected = !pasted.trim() && selected?.url === c.url;
                                return (
                                    <button
                                        key={c.url}
                                        onClick={() => {
                                            setPasted("");
                                            setSelected({ url: c.url, source: c.source });
                                        }}
                                        className={`group relative overflow-hidden rounded-xl border-2 text-left transition ${isSelected ? "border-indigo-400 shadow-[0_0_0_4px_rgba(99,102,241,0.25)]" : "border-transparent hover:border-slate-600"}`}
                                    >
                                        <img src={c.thumb} alt="" loading="lazy" className="aspect-square w-full bg-slate-900 object-cover" />
                                        {isSelected && (
                                            <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full btn-accent">
                                                <Check size={14} strokeWidth={3} />
                                            </span>
                                        )}
                                        <div className="px-1 py-1.5">
                                            <div className="truncate text-xs text-slate-200" title={c.label}>{c.label}</div>
                                            <div className="text-[11px] text-slate-500">{c.source}{c.size ? ` · ${c.size}` : ""}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="space-y-2 border-t border-slate-800 px-5 py-3">
                    {error && <div className="text-sm text-rose-400">{error}</div>}
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            value={pasted}
                            onChange={(e) => setPasted(e.target.value)}
                            placeholder="…or paste an image link (right-click an image › Copy image address)"
                            className="min-w-[260px] flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-400"
                        />
                        <button onClick={() => BrowserOpenURL(googleImages)} className="inline-flex items-center gap-1 rounded-lg border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900">
                            Google Images <ExternalLink size={12} />
                        </button>
                        <button
                            onClick={save}
                            disabled={!choice || saving}
                            className="inline-flex items-center gap-1.5 rounded-lg btn-accent px-4 py-2 text-sm font-semibold disabled:opacity-40"
                        >
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            Save cover
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
