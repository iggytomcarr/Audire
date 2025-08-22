// frontend/src/AlbumDetailsPage.jsx
import React from "react";
import cover from "./assets/images/mbid-38385642-1a00-4b08-9f41-f0545470263e-42465904052_thumb500.jpg";

export default function AlbumDetailsPage({ onBack }) {
    const tracks = [
        "My Mind Is A Mountain",
        "Locked Club",
        "Ecdysis",
        "Infinite Source",
        "Souvenir",
        "Cxz",
        "I Think About You All The Time",
        "Milk Of The Madonna",
        "Cut Hands",
        "~Metal Dream",
        "Departing The Body",
    ];

    // Simple mocked discography timeline thumbnails (use your own images or placeholders)
    const timeline = [
        { title: "Saturday Night Wrist", year: 2006 },
        { title: "Diamond Eyes", year: 2010 },
        { title: "Koi No Yokan", year: 2012 },
        { title: "Gore", year: 2016 },
        { title: "Ohms", year: 2020 },
        { title: "Private Music", year: 2025, highlight: true },
    ];

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
            {/* Top row: Back + Title */}
            <div className="mb-5 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="rounded-lg border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900"
                    aria-label="Go back"
                >
                    ← Back
                </button>
                <div className="text-right text-sm text-slate-400">
                    See Full Discography →
                </div>
            </div>

            {/* Hero: Cover on left, details on right */}
            <section className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
                <div className="md:sticky md:top-20">
                    <img
                        src={cover}
                        alt="Private Music album cover"
                        className="w-full max-w-[220px] rounded-xl border border-slate-800 shadow"
                    />
                </div>

                <div className="space-y-4">
                    <div>
                        <h1 className="text-2xl font-bold">Private Music</h1>
                        <p className="text-slate-300">By Deftones</p>
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                            <div className="text-slate-400">Release Date</div>
                            <div>August 22, 2025</div>
                        </div>
                        <div>
                            <div className="text-slate-400">Duration</div>
                            <div>42:22</div>
                        </div>
                        <div>
                            <div className="text-slate-400">Genre</div>
                            <div>Pop/Rock</div>
                        </div>
                        <div className="lg:col-span-2">
                            <div className="text-slate-400">Styles</div>
                            <div>Alternative Metal, Alternative/Indie Rock, Alternative Pop/Rock</div>
                        </div>
                    </div>

                    {/* Track Listing */}
                    <div className="overflow-hidden rounded-xl border border-slate-800">
                        <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-2 text-sm font-semibold">
                            Track Listing
                        </div>
                        <table className="w-full text-sm">
                            <tbody>
                            {tracks.map((name, i) => (
                                <tr key={name} className="border-t border-slate-800">
                                    <td className="w-14 px-4 py-2 text-right tabular-nums text-slate-400">{i + 1}</td>
                                    <td className="px-2 py-2">{name}</td>
                                    <td className="w-20 px-4 py-2 text-right text-slate-400">—</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Description */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-200">
                        <p>
                            Private Music (stylized in all lowercase) is the tenth studio album by American alternative metal band
                            Deftones. It was released on August 22, 2025, through Reprise and Warner Records. It was preceded by two
                            singles, "My Mind Is a Mountain" and "Milk of the Madonna". The album was produced by Nick Raskulinecz,
                            who previously worked on the band's albums Diamond Eyes (2010) and Koi No Yokan (2012).
                        </p>
                        <p className="mt-3">
                            In addition to group members Stephen Carpenter, Abe Cunningham, Frank Delgado and Chino Moreno,
                            Deftones' touring bassist Fred Sablan appears on the album, making it the first since former bassist
                            Sergio Vega's departure in 2021. The band's first studio album since 2020's Ohms, Private Music marks the
                            longest release gap between two Deftones albums.
                        </p>
                    </div>

                    {/* Discography Timeline */}
                    <div>
                        <div className="mb-3 text-lg font-semibold">Discography Timeline</div>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
                            {timeline.map((a) => (
                                <div key={`${a.title}-${a.year}`} className="group">
                                    <div className={`aspect-square w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 ${a.highlight ? "ring-2 ring-indigo-400" : ""}`} />
                                    <div className={`mt-2 text-xs ${a.highlight ? "font-semibold" : ""}`}>
                                        <div className="truncate">{a.title}</div>
                                        <div className="text-slate-400">({a.year})</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}