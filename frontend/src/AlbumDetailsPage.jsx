// frontend/src/AlbumDetailsPage.jsx
import React, { useMemo, useState } from "react";
import { Play, Pause, Volume2, FolderOpen, Pencil, ImagePlus, Loader2 } from "lucide-react";
import { useAudioPlayer, formatTime } from './AudioPlayerContext';
import { OpenFolder, SaveAlbumMetadata, GetAlbumSidecar } from "../wailsjs/go/main/App";
import AlbumInfo from "./AlbumInfo";
import CoverPicker from "./CoverPicker";
import { SHELF_CATEGORIES, categoryName, genreCategory } from "./room/categories";

const inputClass = "w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-sm outline-none focus:border-indigo-400";

export default function AlbumDetailsPage({ album, onBack, onAlbumUpdated, libraryAlbums, onOpenAlbum }) {

    const { playQueue, currentTrack, isPlaying, togglePlayPause, durations } = useAudioPlayer();
    const [draft, setDraft] = useState(null); // metadata being edited
    const [gathered, setGathered] = useState(null); // MusicBrainz details offered while editing
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState(null);
    const [pickingCover, setPickingCover] = useState(false);

    const tracks = album?.tracks || [];
    const isThisAlbumPlaying = currentTrack?.albumId === album?.id;

    // Durations are learned as tracks load, so the total is shown once every track is known
    const trackSeconds = (track) => {
        if (durations[track.path]) return durations[track.path];
        if (track.duration) {
            const [minutes, seconds] = track.duration.split(':').map(Number);
            return minutes * 60 + seconds;
        }
        return null;
    };

    const totalDuration = useMemo(() => {
        const all = tracks.map(trackSeconds);
        if (!all.length || all.some((s) => s == null)) return null;
        return formatTime(all.reduce((sum, s) => sum + s, 0));
    }, [tracks, durations]);

    if (!album) {
        return (
            <div className="mx-auto w-full max-w-6xl px-4 py-6">
                <div className="text-center text-slate-400">No album selected</div>
            </div>
        );
    }

    const { rawAlbum } = album;
    const formats = [...new Set(tracks.map((t) => t.format).filter(Boolean))].join(", ").toUpperCase();

    const startEditing = () => {
        setEditError(null);
        setDraft({
            album: album.title,
            artist: album.artist,
            label: rawAlbum.label || "",
            shelf: rawAlbum.shelf || "",
            year: album.year || "",
            genres: (rawAlbum.genre || []).join(", "),
            titles: Object.fromEntries(tracks.map((t) => [t.path, t.title])),
        });
        GetAlbumSidecar(album.id).then((sc) => setGathered(sc?.info || null)).catch(() => setGathered(null));
    };

    const fillFromGathered = () =>
        setDraft((d) => ({
            ...d,
            album: gathered.title || d.album,
            artist: gathered.artist || d.artist,
            label: gathered.label || d.label,
            year: gathered.first_release_date ? Number(gathered.first_release_date.slice(0, 4)) : d.year,
            genres: gathered.genres?.length ? gathered.genres.join(", ") : d.genres,
        }));

    const saveEdits = async () => {
        setSaving(true);
        setEditError(null);
        try {
            const changedTitles = Object.fromEntries(
                tracks.filter((t) => draft.titles[t.path] !== t.title).map((t) => [t.path, draft.titles[t.path]])
            );
            await SaveAlbumMetadata(album.id, {
                album: draft.album,
                artist: draft.artist,
                label: draft.label,
                shelf: draft.shelf,
                year: Number(draft.year) || 0,
                genres: draft.genres.split(",").map((g) => g.trim()).filter(Boolean),
                track_titles: changedTitles,
            });
            await onAlbumUpdated();
            setDraft(null);
        } catch (e) {
            setEditError(String(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
            {/* Top row: Back button */}
            <div className="mb-5 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="rounded-lg border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900"
                    aria-label="Go back"
                >
                    ← Back
                </button>
            </div>

            {/* Hero: Cover on left, details on right */}
            <section className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
                <div className="md:sticky md:top-20 md:self-start">
                    <button
                        onClick={() => setPickingCover(true)}
                        className={`group relative block w-full max-w-[220px] aspect-square overflow-hidden rounded-xl border border-slate-800 shadow ${album.coverImage ? "bg-slate-900" : `bg-gradient-to-br ${album.colors}`}`}
                        title="Change cover"
                    >
                        {album.coverImage && (
                            <img src={album.coverImage} alt={`${album.title} cover`} className="h-full w-full object-cover" />
                        )}
                        <span className="absolute inset-0 grid place-items-center bg-slate-950/60 opacity-0 transition group-hover:opacity-100">
                            <span className="flex flex-col items-center gap-1 text-sm font-semibold">
                                <ImagePlus size={22} />
                                Change cover
                            </span>
                        </span>
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        {draft ? (
                            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_90px]">
                                <label className="text-xs text-slate-400">Album<input className={inputClass} value={draft.album} onChange={(e) => setDraft({ ...draft, album: e.target.value })} /></label>
                                <label className="text-xs text-slate-400">Artist<input className={inputClass} value={draft.artist} onChange={(e) => setDraft({ ...draft, artist: e.target.value })} /></label>
                                <label className="text-xs text-slate-400">Label<input className={inputClass} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></label>
                                <label className="text-xs text-slate-400">Year<input className={inputClass} inputMode="numeric" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></label>
                                <label className="text-xs text-slate-400 sm:col-span-3">Genres (comma separated)<input className={inputClass} value={draft.genres} onChange={(e) => setDraft({ ...draft, genres: e.target.value })} /></label>
                                <label className="text-xs text-slate-400">
                                    Shelf
                                    <select className={inputClass} value={draft.shelf} onChange={(e) => setDraft({ ...draft, shelf: e.target.value })}>
                                        <option value="">Automatic ({categoryName(genreCategory({ ...rawAlbum, genre: draft.genres.split(",").map((g) => g.trim()).filter(Boolean) }))})</option>
                                        {SHELF_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </label>
                            </div>
                        ) : (
                            <div className="min-w-0">
                                <h1 className="text-2xl font-bold">{album.title}</h1>
                                <p className="text-slate-300">By {album.artist}</p>
                            </div>
                        )}

                        <div className="flex shrink-0 items-center gap-2">
                            {draft ? (
                                <>
                                    {gathered && (
                                        <button onClick={fillFromGathered} className="rounded-lg border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900" title="Use the album name, artist, year and genres from MusicBrainz">
                                            Fill from MusicBrainz
                                        </button>
                                    )}
                                    <button onClick={() => setDraft(null)} className="rounded-lg border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900">Cancel</button>
                                    <button onClick={saveEdits} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg btn-accent px-4 py-2 text-sm font-semibold disabled:opacity-50">
                                        {saving && <Loader2 size={14} className="animate-spin" />} Save
                                    </button>
                                </>
                            ) : (
                                <>
                                    {rawAlbum.path && (
                                        <button
                                            className="rounded-lg border border-slate-800 p-3 text-slate-300 transition hover:bg-slate-900 hover:text-slate-100"
                                            onClick={() => OpenFolder(rawAlbum.path).catch((err) => console.error("Failed to open folder:", err))}
                                            title="Open in Explorer"
                                            aria-label="Open album folder in Explorer"
                                        >
                                            <FolderOpen size={20} />
                                        </button>
                                    )}
                                    <button
                                        className="rounded-lg border border-slate-800 p-3 text-slate-300 transition hover:bg-slate-900 hover:text-slate-100"
                                        onClick={startEditing}
                                        title="Edit album details (saved to audire.json in the album folder)"
                                        aria-label="Edit album details"
                                    >
                                        <Pencil size={20} />
                                    </button>

                                    {/* Play Album Button */}
                                    <button
                                        className="flex items-center gap-2 whitespace-nowrap rounded-lg btn-accent px-6 py-3 font-semibold transition disabled:opacity-40"
                                        disabled={!tracks.length}
                                        onClick={() => (isThisAlbumPlaying ? togglePlayPause() : playQueue(tracks, 0))}
                                    >
                                        {isThisAlbumPlaying && isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                                        {isThisAlbumPlaying && isPlaying ? "Pause" : isThisAlbumPlaying ? "Resume" : "Play Album"}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    {editError && <div className="text-sm text-rose-400">{editError}</div>}

                    {!draft && (
                        <div className="grid grid-cols-1 gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <div className="text-slate-400">Year</div>
                                <div>{album.year || "Unknown"}</div>
                            </div>
                            <div>
                                <div className="text-slate-400">Tracks</div>
                                <div>{tracks.length}{totalDuration ? ` • ${totalDuration}` : ""}</div>
                            </div>
                            <div>
                                <div className="text-slate-400">Format</div>
                                <div>{formats || "—"}</div>
                            </div>
                            <div>
                                <div className="text-slate-400">Label</div>
                                <div title={rawAlbum.label ? undefined : "Use Gather info below, or edit the album, to add the label"}>
                                    {rawAlbum.label || <span className="text-slate-500">Unknown</span>}
                                    {rawAlbum.label && rawAlbum.catalog_number && <span className="text-slate-500"> · {rawAlbum.catalog_number}</span>}
                                </div>
                            </div>
                            {rawAlbum.genre?.length > 0 && (
                                <div className="lg:col-span-4">
                                    <div className="text-slate-400">Genre</div>
                                    <div>{rawAlbum.genre.join(', ')}</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Track Listing */}
                    {tracks.length > 0 ? (
                        <div className="overflow-hidden rounded-xl border border-slate-800">
                            <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-2 text-sm font-semibold">
                                Track Listing ({tracks.length} tracks)
                            </div>
                            <table className="w-full text-sm">
                                <tbody>
                                {tracks.map((track, i) => {
                                    const isCurrent = currentTrack?.path === track.path;
                                    const seconds = trackSeconds(track);
                                    return draft ? (
                                        <tr key={track.path} className="border-t border-slate-800">
                                            <td className="w-14 px-4 py-1.5 text-right tabular-nums text-slate-400">{i + 1}</td>
                                            <td className="px-2 py-1.5">
                                                <input
                                                    className={inputClass}
                                                    value={draft.titles[track.path]}
                                                    onChange={(e) => setDraft({ ...draft, titles: { ...draft.titles, [track.path]: e.target.value } })}
                                                    aria-label={`Title of track ${i + 1}`}
                                                />
                                            </td>
                                            <td className="w-20 px-4 py-1.5 text-right tabular-nums text-slate-400">{seconds != null ? formatTime(seconds) : "—"}</td>
                                        </tr>
                                    ) : (
                                        <tr
                                            key={track.path}
                                            className={`cursor-pointer border-t border-slate-800 hover:bg-slate-900/50 ${isCurrent ? "bg-indigo-500/10 text-indigo-200" : ""}`}
                                            onClick={() => (isCurrent ? togglePlayPause() : playQueue(tracks, i))}
                                            title={isCurrent ? "Play / pause" : `Play ${track.title}`}
                                        >
                                            <td className="w-14 px-4 py-2 text-right tabular-nums text-slate-400">
                                                {isCurrent && isPlaying ? <Volume2 size={14} className="ml-auto text-indigo-300" /> : i + 1}
                                            </td>
                                            <td className="px-2 py-2">{track.title}</td>
                                            <td className="w-20 px-4 py-2 text-right tabular-nums text-slate-400">{seconds != null ? formatTime(seconds) : "—"}</td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center text-slate-400">
                            No playable tracks in this album
                        </div>
                    )}

                    {rawAlbum.path && (
                        <div className="truncate text-xs text-slate-500" title={rawAlbum.path}>{rawAlbum.path}</div>
                    )}

                    <AlbumInfo album={album} libraryAlbums={libraryAlbums} onAlbumUpdated={onAlbumUpdated} onOpenAlbum={onOpenAlbum} />
                </div>
            </section>

            {pickingCover && <CoverPicker album={album} onClose={() => setPickingCover(false)} onSaved={onAlbumUpdated} />}
        </div>
    );
}
