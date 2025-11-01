// frontend/src/AlbumDetailsPage.jsx
import React, { useMemo } from "react";
//import cover from "./assets/images/mbid-38385642-1a00-4b08-9f41-f0545470263e-42465904052_thumb500.jpg";

export default function AlbumDetailsPage({ album, onBack }) {

// Calculate total duration of all tracks
    const totalDuration = useMemo(() => {
        if (!album?.rawAlbum?.tracks?.length) return "0:00";

        let totalSeconds = 0;
        album.rawAlbum.tracks.forEach(track => {
            if (track.duration) {
                const [minutes, seconds] = track.duration.split(':').map(Number);
                totalSeconds += (minutes * 60) + seconds;
            }
        });

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const remainingSeconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, [album]);

    // Format release date
    const formattedDate = useMemo(() => {
        if (!album?.rawAlbum?.release_date) return "Unknown";
        const date = new Date(album.rawAlbum.release_date);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }, [album]);

    if (!album) {
        return (
            <div className="mx-auto w-full max-w-6xl px-4 py-6">
                <div className="text-center text-slate-400">No album selected</div>
            </div>
        );
    }

    const { rawAlbum } = album;


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
                <div className="md:sticky md:top-20">
                    {/* Using gradient placeholder since we don't have actual album covers */}
                    <div className={`w-full max-w-[220px] aspect-square rounded-xl border border-slate-800 shadow bg-gradient-to-br ${album.colors}`} />
                </div>

                <div className="space-y-4">
                    <div>
                        <h1 className="text-2xl font-bold">{rawAlbum.album || "Unknown Album"}</h1>
                        <p className="text-slate-300">By {rawAlbum.artist || "Unknown Artist"}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                            <div className="text-slate-400">Release Date</div>
                            <div>{formattedDate}</div>
                        </div>
                        <div>
                            <div className="text-slate-400">Duration</div>
                            <div>{totalDuration}</div>
                        </div>
                        <div>
                            <div className="text-slate-400">Label</div>
                            <div>{rawAlbum.label || "Unknown Label"}</div>
                        </div>
                        <div className="lg:col-span-3">
                            <div className="text-slate-400">Genre</div>
                            <div>{rawAlbum.genre?.join(', ') || "Unknown Genre"}</div>
                        </div>
                    </div>

                    {/* Track Listing */}
                    {rawAlbum.tracks && rawAlbum.tracks.length > 0 ? (
                        <div className="overflow-hidden rounded-xl border border-slate-800">
                            <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-2 text-sm font-semibold">
                                Track Listing ({rawAlbum.tracks.length} tracks)
                            </div>
                            <table className="w-full text-sm">
                                <tbody>
                                {rawAlbum.tracks.map((track, i) => (
                                    <tr key={`${track.title}-${i}`} className="border-t border-slate-800 hover:bg-slate-900/30">
                                        <td className="w-14 px-4 py-2 text-right tabular-nums text-slate-400">{i + 1}</td>
                                        <td className="px-2 py-2">{track.title}</td>
                                        <td className="w-20 px-4 py-2 text-right text-slate-400">{track.duration || "—"}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center text-slate-400">
                            No track information available
                        </div>
                    )}

                    {/* Album Description/Info */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-200">
                        <p>
                            <strong>{rawAlbum.album || "This Album"}</strong> by <strong>{rawAlbum.artist || "Unknown Artist"}</strong> was released {formattedDate.toLowerCase()} on {rawAlbum.label || "Unknown Label"}.
                            {rawAlbum.genre && rawAlbum.genre.length > 0 && (
                                <> This {rawAlbum.genre.join(', ')} album contains {rawAlbum.tracks?.length || 0} tracks.</>
                            )}
                        </p>
                        {rawAlbum.tracks && rawAlbum.tracks.length > 0 && (
                            <p className="mt-3">
                                The album runs for a total duration of {totalDuration}, featuring tracks such as "{rawAlbum.tracks[0]?.title}"
                                {rawAlbum.tracks.length > 1 && rawAlbum.tracks[1] && (
                                    <> and "{rawAlbum.tracks[1].title}"</>
                                )}
                                {rawAlbum.tracks.length > 2 && <> among others</>}.
                            </p>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}