// /frontend/src/App.jsx
import { useMemo, useState } from "react";
import logo from "./assets/images/logo-universal.png";
import { Greet } from "../wailsjs/go/main/App";

export default function App() {
    const [resultText, setResultText] = useState("Please enter your name below 👇");
    const [name, setName] = useState("");
    const [query, setQuery] = useState("");
    const [view, setView] = useState("grid"); // grid | compact

    const albums = useMemo(
        () => [
            { id: "1", title: "Midnight Drive", artist: "Neon Rivers", year: 2022, emoji: "🌌", colors: "from-slate-700 to-slate-900" },
            { id: "2", title: "Analog Heart", artist: "Tape & Valve", year: 2019, emoji: "💚", colors: "from-emerald-700 to-teal-900" },
            { id: "3", title: "Sunset Lines", artist: "Pacific Dreams", year: 2024, emoji: "🌇", colors: "from-violet-600 to-violet-900" },
            { id: "4", title: "Room Tone", artist: "Lo-Fi Study", year: 2021, emoji: "📚", colors: "from-blue-900 to-slate-950" },
            { id: "5", title: "Crystal Waves", artist: "Bitrate", year: 2020, emoji: "💎", colors: "from-blue-600 to-blue-900" },
            { id: "6", title: "Afterlight", artist: "Night Arcade", year: 2023, emoji: "🌙", colors: "from-rose-700 to-rose-900" },
            { id: "7", title: "Golden Hour", artist: "Aurora", year: 2018, emoji: "🌅", colors: "from-amber-700 to-amber-900" },
            { id: "8", title: "Deep Fields", artist: "Parallax", year: 2025, emoji: "🛰️", colors: "from-green-700 to-emerald-900" },
            { id: "9", title: "Nocturne", artist: "Cadence", year: 2017, emoji: "🎼", colors: "from-slate-600 to-slate-900" },
            { id: "10", title: "Glass City", artist: "Vectors", year: 2020, emoji: "🏙️", colors: "from-sky-600 to-sky-900" },
        ],
        []
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return albums;
        return albums.filter(
            (a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q) || String(a.year).includes(q)
        );
    }, [albums, query]);

    function greet() {
        Greet(name).then((r) => setResultText(r));
    }

    return (
        <div id="App" className="min-h-dvh bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
            {/* Top Bar */}
            <header className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur">
                <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-3">
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                        <img src={logo} alt="logo" className="h-8 w-8 rounded-lg shadow" />
                        <div className="text-lg font-semibold tracking-wide">Harmonia</div>
                    </div>

                    {/* Search */}
                    <div className="flex items-center">
                        <label className="relative w-full" aria-label="Search library">
                            <input
                                type="search"
                                placeholder="Search albums, artists, years…"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 outline-none placeholder:text-slate-400 focus:border-indigo-400"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">⌘K</span>
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-start gap-2 sm:justify-end">
                        <button
                            onClick={() => setView("grid")}
                            aria-pressed={view === "grid"}
                            className={`rounded-lg border px-3 py-2 text-sm transition hover:bg-slate-900 ${
                                view === "grid" ? "border-indigo-400 bg-slate-900" : "border-slate-800"
                            }`}
                            title="Grid view"
                        >
                            Grid
                        </button>
                        <button
                            onClick={() => setView("compact")}
                            aria-pressed={view === "compact"}
                            className={`rounded-lg border px-3 py-2 text-sm transition hover:bg-slate-900 ${
                                view === "compact" ? "border-indigo-400 bg-slate-900" : "border-slate-800"
                            }`}
                            title="Compact view"
                        >
                            List
                        </button>
                    </div>
                </div>
            </header>

            {/* Greeting Strip (Wails demo) */}
            <section className="mx-auto max-w-7xl px-4 py-4">
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-sm text-slate-300">{resultText}</div>
                    <div className="ml-auto flex items-center gap-2">
                        <input
                            id="name"
                            name="input"
                            autoComplete="off"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-48 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-400"
                            placeholder="Your name"
                            type="text"
                        />
                        <button onClick={greet} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow transition hover:bg-indigo-400">
                            Greet
                        </button>
                    </div>
                </div>
            </section>

            {/* Content */}
            <main className="mx-auto w-full max-w-7xl px-4 pb-24">
                {view === "grid" ? (
                    <section aria-label="Albums grid" className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {filtered.map((a) => (
                            <article key={a.id} tabIndex={0} className="group outline-none">
                                <div
                                    className={`relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br ${a.colors} shadow-lg ring-1 ring-slate-900/40`}
                                    aria-label={`${a.title} by ${a.artist}`}
                                >
                                    <span className="absolute left-2 top-2 text-xl drop-shadow">{a.emoji}</span>
                                    <button
                                        className="absolute bottom-2 right-2 inline-grid h-10 w-10 place-items-center rounded-full bg-slate-950/80 text-slate-100 opacity-0 shadow transition group-hover:opacity-100"
                                        title={`Play ${a.title}`}
                                    >
                                        ►
                                    </button>
                                </div>
                                <div className="mt-2">
                                    <h3 className="truncate text-sm font-semibold">{a.title}</h3>
                                    <p className="truncate text-xs text-slate-400">{a.artist} • {a.year}</p>
                                </div>
                            </article>
                        ))}
                    </section>
                ) : (
                    <section aria-label="Albums list" className="grid gap-2">
                        {filtered.map((a) => (
                            <div key={a.id} tabIndex={0} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-2 outline-none">
                                <div className={`relative h-12 w-12 overflow-hidden rounded-lg bg-gradient-to-br ${a.colors} ring-1 ring-slate-900/40`}>
                                    <span className="absolute left-1.5 top-1.5 text-base drop-shadow">{a.emoji}</span>
                                </div>
                                <div className="grid grid-cols-[1.2fr_1fr_auto] items-center gap-2 text-sm">
                                    <div className="truncate font-medium">{a.title}</div>
                                    <div className="truncate text-slate-400">{a.artist}</div>
                                    <div className="text-right text-slate-400">{a.year}</div>
                                </div>
                                <div className="ml-2 inline-flex gap-2">
                                    <button className="rounded-lg border border-slate-800 px-3 py-1 text-xs hover:bg-slate-900">Play</button>
                                    <button className="rounded-lg border border-slate-800 px-3 py-1 text-xs hover:bg-slate-900">⋯</button>
                                </div>
                            </div>
                        ))}
                    </section>
                )}
            </main>

            {/* Footer Player */}
            <footer className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/80 backdrop-blur">
                <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-3 px-4 py-3 md:grid-cols-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg border border-slate-800 bg-slate-900" />
                        <div className="min-w-0">
                            <div className="truncate text-sm font-medium">Nothing playing</div>
                            <div className="truncate text-xs text-slate-400">Select an album to start</div>
                        </div>
                    </div>
                    <div className="flex justify-center gap-2">
                        <button className="rounded-lg border border-slate-800 px-3 py-2">⏮</button>
                        <button className="rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-slate-950 shadow hover:bg-indigo-400">⏯</button>
                        <button className="rounded-lg border border-slate-800 px-3 py-2">⏭</button>
                    </div>
                    <div className="flex items-center gap-3 md:justify-end">
                        <span className="text-xs text-slate-400">0:00</span>
                        <input type="range" min="0" max="100" defaultValue={0} className="w-full accent-indigo-400 md:w-64" aria-label="Seek" />
                        <span className="text-xs text-slate-400">0:00</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
