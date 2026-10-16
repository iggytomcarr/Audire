// frontend/src/AlbumInfo.jsx
// Gathered album/artist info with its editable source links, shown under the track list.
import React, { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, Loader2, Pencil, RefreshCw, Search, Sparkles } from "lucide-react";
import { GatherAlbumInfo, GetAlbumSidecar, SaveAlbumSources } from "../wailsjs/go/main/App";
import { BrowserOpenURL, EventsOn } from "../wailsjs/runtime/runtime";

const SOURCE_FIELDS = [
    { key: "musicbrainz", label: "MusicBrainz album", search: (a) => `https://musicbrainz.org/search?type=release_group&query=${encodeURIComponent(`${a.title} ${a.artist}`)}` },
    { key: "musicbrainz_artist", label: "MusicBrainz artist", search: (a) => `https://musicbrainz.org/search?type=artist&query=${encodeURIComponent(a.artist)}` },
    { key: "wikipedia_album", label: "Wikipedia album", search: (a) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(`${a.title} ${a.artist} album`)}` },
    { key: "wikipedia_artist", label: "Wikipedia artist", search: (a) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(a.artist)}` },
    { key: "allmusic", label: "AllMusic", search: (a) => `https://www.allmusic.com/search/albums/${encodeURIComponent(`${a.artist} ${a.title}`)}` },
];

function Collapsible({ title, subtitle, defaultOpen = false, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="overflow-hidden rounded-xl border border-slate-800">
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-3 bg-slate-900/60 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-900"
                aria-expanded={open}
            >
                <span className="min-w-0 truncate">
                    {title}
                    {subtitle && <span className="ml-2 font-normal text-slate-400">{subtitle}</span>}
                </span>
                <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
            </button>
            {open && <div className="border-t border-slate-800 px-4 py-3">{children}</div>}
        </div>
    );
}

function Sections({ sections }) {
    return (
        <div className="space-y-4 text-sm leading-relaxed text-slate-300">
            {sections.map((s, i) => (
                <section key={i}>
                    {s.level > 1 && <h4 className={`mb-1 font-semibold text-slate-100 ${s.level > 2 ? "text-xs uppercase tracking-wide" : ""}`}>{s.heading}</h4>}
                    {s.text.split(/\n+/).map((p, j) => (
                        <p key={j} className="mb-2">{p}</p>
                    ))}
                </section>
            ))}
        </div>
    );
}

function WikiLink({ url }) {
    if (!url) return null;
    return (
        <button onClick={() => BrowserOpenURL(url)} className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-300 hover:underline">
            Read on Wikipedia <ExternalLink size={11} />
        </button>
    );
}

export default function AlbumInfo({ album, libraryAlbums, onAlbumUpdated, onOpenAlbum }) {
    const [sidecar, setSidecar] = useState(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState("");
    const [error, setError] = useState(null);
    const [editingSources, setEditingSources] = useState(false);
    const [draft, setDraft] = useState({});
    const [showAllReleases, setShowAllReleases] = useState(false);

    useEffect(() => {
        setSidecar(null);
        setError(null);
        setEditingSources(false);
        GetAlbumSidecar(album.id).then(setSidecar).catch((e) => setError(String(e)));
    }, [album.id]);

    useEffect(() => {
        const off = EventsOn("gather:progress", (id, msg) => id === album.id && setProgress(msg));
        return () => off?.();
    }, [album.id]);

    const info = sidecar?.info;
    const sources = sidecar?.sources || {};

    const gather = async () => {
        setBusy(true);
        setError(null);
        try {
            const result = await GatherAlbumInfo(album.id);
            setSidecar(result);
            onAlbumUpdated?.();
        } catch (e) {
            setError(String(e));
        } finally {
            setBusy(false);
            setProgress("");
        }
    };

    const saveSources = async () => {
        try {
            setSidecar(await SaveAlbumSources(album.id, draft));
            setEditingSources(false);
        } catch (e) {
            setError(String(e));
        }
    };

    // Releases already in the library link straight to their album page
    const inLibrary = (title) => {
        const t = title.toLowerCase();
        return libraryAlbums.find(
            (a) => a.id !== album.id && a.title.toLowerCase() === t && a.artist.toLowerCase() === album.artist.toLowerCase()
        );
    };
    const discography = (info?.discography || []).filter((d) => showAllReleases || d.type === "Album" || d.type === "EP");

    return (
        <div className="space-y-3">
            {/* Gather / refresh */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
                <div className="min-w-0 text-sm">
                    <div className="font-semibold">Album info</div>
                    <div className="text-xs text-slate-400">
                        {busy
                            ? progress || "Gathering…"
                            : info?.gathered_at
                            ? `Gathered ${new Date(info.gathered_at).toLocaleString()} · saved in this album's audire.json`
                            : "Gather details, a write-up and the discography from MusicBrainz and Wikipedia."}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setDraft({ ...sources });
                            setEditingSources((v) => !v);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900"
                        disabled={!sidecar}
                    >
                        <Pencil size={14} /> Sources
                    </button>
                    <button
                        onClick={gather}
                        disabled={busy || !sidecar}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-indigo-400 disabled:opacity-50"
                    >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : info ? <RefreshCw size={14} /> : <Sparkles size={14} />}
                        {info ? "Refresh" : "Gather info"}
                    </button>
                </div>
            </div>

            {error && <div className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">{error}</div>}
            {info?.notes?.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                    {info.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
            )}

            {/* Sources: shown for editing, or as links once gathered */}
            {editingSources ? (
                <div className="space-y-2 rounded-xl border border-slate-800 p-4">
                    <p className="text-xs text-slate-400">
                        Paste a link to fix a wrong match, then Refresh. Leave a field empty to let Audire find it. AllMusic only opens in your browser; it blocks apps from reading it.
                    </p>
                    {SOURCE_FIELDS.map((f) => (
                        <label key={f.key} className="grid grid-cols-[140px_1fr_auto] items-center gap-2 text-sm">
                            <span className="text-slate-400">{f.label}</span>
                            <input
                                value={draft[f.key] || ""}
                                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                                placeholder="Found automatically"
                                className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5 font-mono text-xs outline-none placeholder:font-sans placeholder:text-slate-500 focus:border-indigo-400"
                            />
                            <button onClick={() => BrowserOpenURL(f.search(album))} className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" title={`Search ${f.label.split(" ")[0]} in your browser`}>
                                <Search size={14} />
                            </button>
                        </label>
                    ))}
                    <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => setEditingSources(false)} className="rounded-lg border border-slate-800 px-3 py-1.5 text-sm hover:bg-slate-900">Cancel</button>
                        <button onClick={saveSources} className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-indigo-400">Save links</button>
                    </div>
                </div>
            ) : (
                SOURCE_FIELDS.some((f) => sources[f.key]) && (
                    <div className="flex flex-wrap gap-2">
                        {SOURCE_FIELDS.filter((f) => sources[f.key]).map((f) => (
                            <button
                                key={f.key}
                                onClick={() => BrowserOpenURL(sources[f.key])}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white"
                                title={sources[f.key]}
                            >
                                {f.label}
                                {sources.edited?.includes(f.key) && <span className="text-indigo-300">•</span>}
                                <ExternalLink size={11} />
                            </button>
                        ))}
                    </div>
                )
            )}

            {/* Gathered content */}
            {info?.album_sections?.length > 0 && (
                <Collapsible title="About this album" subtitle={info.album_article} defaultOpen>
                    <Sections sections={info.album_sections} />
                    <WikiLink url={sources.wikipedia_album} />
                </Collapsible>
            )}
            {info?.artist_sections?.length > 0 && (
                <Collapsible title={`About ${info.artist || album.artist}`} subtitle={info.artist_article}>
                    <Sections sections={info.artist_sections} />
                    <WikiLink url={sources.wikipedia_artist} />
                </Collapsible>
            )}
            {info?.discography?.length > 0 && (
                <Collapsible title="Discography" subtitle={`${discography.length} releases`}>
                    <label className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                        <input type="checkbox" checked={showAllReleases} onChange={(e) => setShowAllReleases(e.target.checked)} className="accent-indigo-400" />
                        Include live, compilation and other releases ({info.discography.length})
                    </label>
                    <table className="w-full text-sm">
                        <tbody>
                            {discography.map((d) => {
                                const owned = inLibrary(d.title);
                                const isThis = info.title && d.title.toLowerCase() === info.title.toLowerCase();
                                return (
                                    <tr key={d.url} className="border-t border-slate-800/70">
                                        <td className="w-14 py-1.5 tabular-nums text-slate-400">{d.year || "—"}</td>
                                        <td className={`py-1.5 ${isThis ? "font-semibold text-indigo-300" : ""}`}>
                                            {owned ? (
                                                <button onClick={() => onOpenAlbum(owned.id)} className="text-left hover:underline" title="Open in your library">
                                                    {d.title} <span className="ml-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">In library</span>
                                                </button>
                                            ) : (
                                                d.title
                                            )}
                                        </td>
                                        <td className="py-1.5 text-right text-xs text-slate-500">{d.type}</td>
                                        <td className="w-8 py-1.5 text-right">
                                            <button onClick={() => BrowserOpenURL(d.url)} className="rounded p-1 text-slate-500 hover:text-white" title="Open on MusicBrainz">
                                                <ExternalLink size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Collapsible>
            )}
        </div>
    );
}
