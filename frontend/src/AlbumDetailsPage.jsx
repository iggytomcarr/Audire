// frontend/src/AlbumDetailsPage.jsx
import React, { useMemo } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { useAudioPlayer, formatTime } from './AudioPlayerContext';

export default function AlbumDetailsPage({ album, onBack }) {

    const { playQueue, currentTrack, isPlaying, togglePlayPause, durations } = useAudioPlayer();

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
                    <div className={`w-full max-w-[220px] aspect-square overflow-hidden rounded-xl border border-slate-800 shadow ${album.coverImage ? "bg-slate-900" : `bg-gradient-to-br ${album.colors}`}`}>
                        {album.coverImage && (
                            <img src={album.coverImage} alt={`${album.title} cover`} className="h-full w-full object-cover" />
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-bold">{album.title}</h1>
                            <p className="text-slate-300">By {album.artist}</p>
                        </div>

                        {/* Play Album Button */}
                        <button
                            className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-indigo-500 px-6 py-3 font-semibold text-slate-950 shadow-lg transition hover:bg-indigo-400 disabled:opacity-40"
                            disabled={!tracks.length}
                            onClick={() => (isThisAlbumPlaying ? togglePlayPause() : playQueue(tracks, 0))}
                        >
                            {isThisAlbumPlaying && isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                            {isThisAlbumPlaying && isPlaying ? "Pause" : isThisAlbumPlaying ? "Resume" : "Play Album"}
                        </button>
                    </div>

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
                        {rawAlbum.label && (
                            <div>
                                <div className="text-slate-400">Label</div>
                                <div>{rawAlbum.label}</div>
                            </div>
                        )}
                        {rawAlbum.genre?.length > 0 && (
                            <div className="lg:col-span-4">
                                <div className="text-slate-400">Genre</div>
                                <div>{rawAlbum.genre.join(', ')}</div>
                            </div>
                        )}
                    </div>

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
                                    return (
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
                </div>
            </section>
        </div>
    );
}
