// frontend/src/PlayPage.jsx
// Full-window MilkDrop visualiser (via Butterchurn) with the now-playing track overlaid,
// laid out like the Play view in Arturia Pigments.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, Repeat, ListMusic, X, Search, SlidersHorizontal } from "lucide-react";
import { useAudioPlayer } from "./AudioPlayerContext";
import { LoadVisualSettings, SaveVisualSettings } from "../wailsjs/go/main/App";
import MetersView, { METER_MODULES } from "./meters/MetersView";
import RetroView from "./retro/RetroView";

const CYCLE_SECONDS = 30;
const MAX_FPS = 60;
const MIN_FPS = 30;
const BLEND_SECONDS = 2.7;

// Butterchurn's preset packs: the classic MilkDrop community presets, converted for WebGL
const PRESET_PACKS = [
    () => import("butterchurn-presets/lib/butterchurnPresets.min.js"),
    () => import("butterchurn-presets/lib/butterchurnPresetsExtra.min.js"),
    () => import("butterchurn-presets/lib/butterchurnPresetsExtra2.min.js"),
    () => import("butterchurn-presets/lib/butterchurnPresetsMD1.min.js"),
];

// Preset names look like "Flexi, martin + geiss - dedicated to the sherwin maxawow"
function splitPresetName(name) {
    const i = name.indexOf(" - ");
    return i > 0 ? { author: name.slice(0, i), title: name.slice(i + 3) } : { author: "", title: name };
}

export default function PlayPage({ active, playingAlbum, onOpenLibrary, bottomInset = 76 }) {
    const { currentTrack, previous, next, hasNext, getAudioGraph } = useAudioPlayer();
    const canvasRef = useRef(null);
    const softCanvasRef = useRef(null); // shows blended frames when Soften is on
    const motionRef = useRef({ speed: 1, soften: 0 });
    const vizRef = useRef(null);
    const presetsRef = useRef({});
    const loadedPresetRef = useRef(null);
    const [presetNames, setPresetNames] = useState([]);
    const [settings, setSettings] = useState(null); // { preset, favorites, cycle, favorites_only }
    const [error, setError] = useState(null);
    const [browseOpen, setBrowseOpen] = useState(false);
    const [browseQuery, setBrowseQuery] = useState("");
    const [browseTab, setBrowseTab] = useState("all");

    // Set up Butterchurn once; the page stays mounted and just stops rendering when hidden
    useEffect(() => {
        let cancelled = false;
        let resizeObserver;
        const canvas = canvasRef.current;

        const pixelSize = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            return [Math.max(1, Math.round(rect.width * dpr)), Math.max(1, Math.round(rect.height * dpr))];
        };

        (async () => {
            const [{ default: butterchurn }, saved, ...packs] = await Promise.all([
                import("butterchurn"),
                LoadVisualSettings().catch(() => ({ preset: "", favorites: [], cycle: true, favorites_only: false })),
                ...PRESET_PACKS.map((load) => load()),
            ]);
            if (cancelled) return;

            const { audioContext, sourceNode } = getAudioGraph();
            const [width, height] = pixelSize();
            canvas.width = width;
            canvas.height = height;
            softCanvasRef.current.width = width;
            softCanvasRef.current.height = height;
            const viz = butterchurn.createVisualizer(audioContext, canvas, { width, height, pixelRatio: 1, textureRatio: 1 });
            viz.connectAudio(sourceNode);
            vizRef.current = viz;

            resizeObserver = new ResizeObserver(() => {
                const [w, h] = pixelSize();
                if (w === canvas.width && h === canvas.height) return;
                canvas.width = w;
                canvas.height = h;
                softCanvasRef.current.width = w;
                softCanvasRef.current.height = h;
                viz.setRendererSize(w, h);
            });
            resizeObserver.observe(canvas);

            const presets = Object.assign({}, ...packs.map((p) => (p.default || p).getPresets()));
            presetsRef.current = presets;
            const names = Object.keys(presets).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
            setPresetNames(names);
            setSettings({
                cycle: saved.cycle,
                favorites_only: saved.favorites_only,
                speed: saved.speed || 1,
                soften: saved.soften || 0,
                dim: saved.dim || 0,
                adjust_open: !!saved.adjust_open,
                mode: ["meters", "retro"].includes(saved.mode) ? saved.mode : "milkdrop",
                retro_lamp: saved.retro_lamp === "blue" ? "blue" : "amber",
                retro_display: saved.retro_display === "green" ? "green" : "cyan",
                meter_modules: saved.meter_modules ?? METER_MODULES.map((m) => m.id),
                colormap: saved.colormap || "magma",
                favorites: (saved.favorites || []).filter((f) => presets[f]),
                preset: presets[saved.preset] ? saved.preset : names[Math.floor(Math.random() * names.length)],
            });
        })().catch((err) => {
            console.error("Visualiser failed to start:", err);
            setError("The visualiser needs WebGL 2, which isn't available here.");
        });

        return () => {
            cancelled = true;
            resizeObserver?.disconnect();
            if (vizRef.current) {
                try {
                    vizRef.current.disconnectAudio(getAudioGraph().sourceNode);
                } catch {
                    // already disconnected
                }
                vizRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        motionRef.current = { speed: settings?.speed ?? 1, soften: settings?.soften ?? 0 };
    }, [settings?.speed, settings?.soften]);

    // Render only while the Play tab is showing.
    // Speed slows the visual two ways: presets' clocks advance by elapsed time, so that is
    // scaled down; many presets also move a fixed amount per frame, so fewer frames are drawn
    // (capped at 60fps, which also stops high-refresh screens running visuals too fast).
    // Soften blends each frame into the last ones, which smooths out strobing.
    // MilkDrop only renders in Visuals mode; Meters and Retro draw their own canvases
    const meters = settings?.mode === "meters" || settings?.mode === "retro";

    useEffect(() => {
        if (!active || meters) return;
        let raf;
        let last = performance.now();
        let pending = 0;
        const loop = (now) => {
            raf = requestAnimationFrame(loop);
            const viz = vizRef.current;
            if (!viz) return;
            const { speed, soften } = motionRef.current;
            pending += Math.min((now - last) / 1000, 0.1);
            last = now;
            const fps = Math.max(MIN_FPS, Math.min(MAX_FPS, MAX_FPS * speed));
            if (pending < 1 / fps - 0.002) return;
            viz.render({ elapsedTime: Math.max(pending * speed, 0.001) });
            pending = 0;
            if (soften > 0) {
                const soft = softCanvasRef.current;
                const ctx = soft.getContext("2d");
                ctx.globalAlpha = 1 - soften * 0.85;
                ctx.drawImage(canvasRef.current, 0, 0, soft.width, soft.height);
            }
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [active, meters]);

    // Load the chosen preset and remember settings on disk
    useEffect(() => {
        if (!settings) return;
        if (vizRef.current && settings.preset !== loadedPresetRef.current) {
            vizRef.current.loadPreset(presetsRef.current[settings.preset], loadedPresetRef.current ? BLEND_SECONDS : 0);
            loadedPresetRef.current = settings.preset;
        }
        // Wait for slider drags to settle before writing to disk
        const id = setTimeout(() => SaveVisualSettings(settings).catch((err) => console.error("Failed to save visual settings:", err)), 400);
        return () => clearTimeout(id);
    }, [settings]);

    const update = (changes) => setSettings((s) => (s ? { ...s, ...changes } : s));
    const favorites = settings?.favorites || [];
    const isFavorite = (name) => favorites.includes(name);
    const toggleFavorite = (name) =>
        update({ favorites: isFavorite(name) ? favorites.filter((f) => f !== name) : [...favorites, name] });

    // Next / previous / cycle stay within favourites when that's switched on
    const playlist = settings?.favorites_only && favorites.length ? presetNames.filter(isFavorite) : presetNames;

    const stepPreset = (delta) => {
        if (!playlist.length) return;
        const i = playlist.indexOf(settings.preset);
        update({ preset: playlist[i < 0 ? 0 : (i + delta + playlist.length) % playlist.length] });
    };

    useEffect(() => {
        if (!settings?.cycle || !active || playlist.length < 2) return;
        const id = setInterval(() => {
            setSettings((s) => {
                let pick = s.preset;
                while (pick === s.preset) pick = playlist[Math.floor(Math.random() * playlist.length)];
                return { ...s, preset: pick };
            });
        }, CYCLE_SECONDS * 1000);
        return () => clearInterval(id);
    }, [settings?.cycle, active, playlist.length, settings?.favorites_only]);

    const browseList = useMemo(() => {
        const q = browseQuery.trim().toLowerCase();
        return presetNames.filter(
            (n) => (browseTab === "all" || favorites.includes(n)) && (!q || n.toLowerCase().includes(q))
        );
    }, [presetNames, browseTab, browseQuery, favorites]);

    const preset = settings?.preset ? splitPresetName(settings.preset) : null;
    const currentIsFavorite = settings?.preset && isFavorite(settings.preset);

    const controls = [
        { label: "Previous", icon: <ChevronLeft size={18} />, onClick: () => stepPreset(-1), title: "Previous visual" },
        { label: "Next", icon: <ChevronRight size={18} />, onClick: () => stepPreset(1), title: "Next visual" },
        {
            label: "Favourite",
            icon: <Heart size={16} fill={currentIsFavorite ? "currentColor" : "none"} />,
            onClick: () => settings?.preset && toggleFavorite(settings.preset),
            on: currentIsFavorite,
            title: currentIsFavorite ? "Remove from favourites" : "Add to favourites",
        },
        {
            label: "Cycle",
            icon: <Repeat size={16} />,
            onClick: () => update({ cycle: !settings?.cycle }),
            on: settings?.cycle,
            title: `Change visual every ${CYCLE_SECONDS}s`,
        },
    ];

    const chip = (on) =>
        `rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
            on ? "border-indigo-300/70 bg-indigo-500/60 text-white" : "border-slate-500/50 bg-slate-950/40 text-slate-200 hover:border-slate-300"
        }`;

    // Switch between the MilkDrop visuals and the meters dashboard
    const modeSwitch = settings && (
        <div className="flex rounded-full border border-slate-700/70 bg-slate-950/60 p-0.5 text-[11px] font-bold uppercase tracking-[0.14em] backdrop-blur">
            {[
                ["milkdrop", "Visuals"],
                ["meters", "Meters"],
                ["retro", "Retro"],
            ].map(([id, label]) => (
                <button
                    key={id}
                    onClick={() => update({ mode: id })}
                    aria-pressed={settings.mode === id}
                    className={`rounded-full px-3 py-1 transition ${settings.mode === id ? "bg-indigo-500/30 text-indigo-200" : "text-slate-400 hover:text-white"}`}
                >
                    {label}
                </button>
            ))}
        </div>
    );

    return (
        <section className={`fixed inset-0 bg-slate-950 ${active ? "" : "hidden"}`} aria-label="Play">
            {/* Dim lowers brightness and saturation without changing how it reacts to the music */}
            <div className={`absolute inset-0 ${meters ? "hidden" : ""}`} style={{ filter: settings?.dim ? `brightness(${1 - settings.dim * 0.6}) saturate(${1 - settings.dim * 0.6})` : undefined }}>
                <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full ${settings?.soften ? "opacity-0" : ""}`} />
                <canvas ref={softCanvasRef} className={`absolute inset-0 h-full w-full ${settings?.soften ? "" : "hidden"}`} />
            </div>
            {settings?.mode === "meters" && <MetersView active={active} settings={settings} update={update} bottomInset={bottomInset} toolbar={modeSwitch} />}
            {settings?.mode === "retro" && <RetroView active={active} settings={settings} update={update} bottomInset={bottomInset} toolbar={modeSwitch} />}
            {!meters && <>
            {settings && <div className="absolute right-6 top-[76px] z-10">{modeSwitch}</div>}
            {/* Soften the edges so the overlay text stays readable over bright presets */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/60 via-transparent to-slate-950/40" />

            <div className="relative mx-auto flex h-full max-w-7xl justify-between gap-8 overflow-y-auto px-8 pt-20 [align-items:safe_center] md:px-16" style={{ paddingBottom: bottomInset + 24 }}>
                {/* Now playing */}
                <div className="min-w-0 max-w-2xl [text-shadow:0_2px_12px_rgba(2,6,23,0.8)]">
                    <span className="inline-block max-w-full truncate rounded-lg btn-accent px-3 py-1 text-sm font-semibold [text-shadow:none]">
                        {playingAlbum?.title || "Audire"}
                    </span>
                    <h1 className="mt-4 line-clamp-2 pb-2 text-5xl font-extrabold leading-[1.15] tracking-tight md:text-6xl">
                        {currentTrack?.title || "Nothing playing"}
                    </h1>
                    <p className="mt-2 truncate text-lg text-slate-300">
                        {currentTrack
                            ? [currentTrack.artist, playingAlbum?.year, playingAlbum?.rawAlbum?.label].filter(Boolean).join(" • ")
                            : "Pick an album in the Library to get started"}
                    </p>
                    <div className="mt-4 flex gap-2">
                        {currentTrack ? (
                            <>
                                <button
                                    onClick={previous}
                                    className="grid h-9 w-9 place-items-center rounded-md border border-slate-500/60 bg-slate-950/40 transition hover:border-slate-300 hover:bg-slate-900/60"
                                    title="Previous track"
                                    aria-label="Previous track"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <button
                                    onClick={next}
                                    disabled={!hasNext}
                                    className="grid h-9 w-9 place-items-center rounded-md border border-slate-500/60 bg-slate-950/40 transition hover:border-slate-300 hover:bg-slate-900/60 disabled:opacity-40"
                                    title="Next track"
                                    aria-label="Next track"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={onOpenLibrary}
                                className="rounded-lg border border-slate-500/60 bg-slate-950/40 px-4 py-2 text-sm font-medium hover:bg-slate-900/60"
                            >
                                Open Library
                            </button>
                        )}
                    </div>
                </div>

                {/* Visual controls */}
                <div className={`w-60 shrink-0 ${browseOpen ? "invisible" : "hidden md:block"}`}>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                        {controls.map((c) => (
                            <button key={c.label} onClick={c.onClick} className="group flex flex-col items-center gap-2" title={c.title}>
                                <span
                                    className={`grid h-20 w-20 place-items-center rounded-full border transition ${
                                        c.on
                                            ? "border-indigo-300/70 bg-indigo-500/70 text-white shadow-[0_0_24px_rgba(99,102,241,0.5)]"
                                            : "border-slate-500/40 bg-slate-950/40 text-indigo-200 group-hover:border-indigo-300/70 group-hover:bg-slate-900/60"
                                    }`}
                                >
                                    {c.icon}
                                </span>
                                <span className="text-sm font-semibold [text-shadow:0_2px_8px_rgba(2,6,23,0.9)]">{c.label}</span>
                            </button>
                        ))}
                    </div>
                    <div className="mt-6 text-center [text-shadow:0_2px_8px_rgba(2,6,23,0.9)]" title={settings?.preset}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Visual</div>
                        <div className="mt-1 line-clamp-2 text-xs text-slate-200">{error || preset?.title || "Loading…"}</div>
                        {preset?.author && <div className="truncate text-[11px] text-slate-400">{preset.author}</div>}
                    </div>
                    <div className="mt-3 flex justify-center gap-2">
                        <button onClick={() => setBrowseOpen(true)} className={chip(false)} disabled={!settings}>
                            <span className="inline-flex items-center gap-1"><ListMusic size={12} /> Browse</span>
                        </button>
                        <button
                            onClick={() => update({ favorites_only: !settings?.favorites_only })}
                            className={chip(settings?.favorites_only)}
                            disabled={!settings}
                            title={favorites.length ? "Next, previous and cycle use only your favourites" : "Heart some visuals first"}
                        >
                            <span className="inline-flex items-center gap-1"><Heart size={11} fill="currentColor" /> Only ({favorites.length})</span>
                        </button>
                        <button
                            onClick={() => update({ adjust_open: !settings?.adjust_open })}
                            className={chip(settings?.adjust_open)}
                            disabled={!settings}
                            title="Speed, soften and dim"
                            aria-expanded={!!settings?.adjust_open}
                        >
                            <span className="inline-flex items-center gap-1"><SlidersHorizontal size={11} /> Adjust</span>
                        </button>
                    </div>

                    {/* Calming controls, shown from the Adjust button */}
                    {settings?.adjust_open && <div className="mt-4 space-y-2 rounded-xl border border-slate-700/50 bg-slate-950/50 px-3 py-2.5 backdrop-blur-sm">
                        {[
                            { key: "speed", label: "Speed", min: 0.25, max: 1, fallback: 1, show: (v) => `${Math.round(v * 100)}%`, title: "Slow the visual down" },
                            { key: "soften", label: "Soften", min: 0, max: 1, fallback: 0, show: (v) => (v ? `${Math.round(v * 100)}%` : "Off"), title: "Blend frames together to smooth out flashing" },
                            { key: "dim", label: "Dim", min: 0, max: 1, fallback: 0, show: (v) => (v ? `${Math.round(v * 100)}%` : "Off"), title: "Lower brightness and mute the colours" },
                        ].map((c) => {
                            const value = settings?.[c.key] ?? c.fallback;
                            return (
                                <label key={c.key} className="grid grid-cols-[52px_1fr_36px] items-center gap-2 text-[11px] font-semibold" title={c.title}>
                                    <span className="text-slate-300">{c.label}</span>
                                    <input
                                        type="range"
                                        min={c.min}
                                        max={c.max}
                                        step="0.05"
                                        value={value}
                                        disabled={!settings}
                                        onChange={(e) => update({ [c.key]: Number(e.target.value) })}
                                        className="w-full accent-indigo-400"
                                        aria-label={c.label}
                                    />
                                    <span className="text-right tabular-nums text-slate-400">{c.show(value)}</span>
                                </label>
                            );
                        })}
                    </div>}
                </div>
            </div>

            {/* Visual browser */}
            {browseOpen && (
                <aside style={{ bottom: bottomInset + 16 }} className="absolute right-4 top-20 flex w-[380px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/85 shadow-2xl backdrop-blur">
                    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                        <div className="flex gap-1">
                            {[
                                ["all", `All (${presetNames.length})`],
                                ["favorites", `Favourites (${favorites.length})`],
                            ].map(([id, label]) => (
                                <button
                                    key={id}
                                    onClick={() => setBrowseTab(id)}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${browseTab === id ? "bg-indigo-500/20 text-indigo-300" : "text-slate-300 hover:text-white"}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setBrowseOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close visual browser">
                            <X size={16} />
                        </button>
                    </div>
                    <label className="relative mx-4 my-3 block">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="search"
                            value={browseQuery}
                            onChange={(e) => setBrowseQuery(e.target.value)}
                            placeholder="Search visuals…"
                            className="w-full rounded-lg border border-slate-800 bg-slate-900/80 py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-400"
                        />
                    </label>
                    <ul className="flex-1 overflow-y-auto px-2 pb-2">
                        {browseList.length === 0 && (
                            <li className="px-3 py-6 text-center text-sm text-slate-400">
                                {browseTab === "favorites" && !favorites.length ? "Tap the heart on a visual to save it here." : "No visuals match."}
                            </li>
                        )}
                        {browseList.map((name) => {
                            const { title, author } = splitPresetName(name);
                            const current = name === settings?.preset;
                            const fav = isFavorite(name);
                            return (
                                <li key={name} className={`flex items-center gap-2 rounded-lg px-2 ${current ? "bg-indigo-500/15" : "hover:bg-slate-800/60"}`}>
                                    <button
                                        onClick={() => toggleFavorite(name)}
                                        className={`shrink-0 rounded p-1.5 transition ${fav ? "text-rose-400" : "text-slate-600 hover:text-slate-300"}`}
                                        title={fav ? "Remove from favourites" : "Add to favourites"}
                                        aria-label={fav ? `Remove ${title} from favourites` : `Add ${title} to favourites`}
                                    >
                                        <Heart size={14} fill={fav ? "currentColor" : "none"} />
                                    </button>
                                    <button onClick={() => update({ preset: name })} className="min-w-0 flex-1 py-1.5 text-left" title={name}>
                                        <div className={`truncate text-sm ${current ? "text-indigo-200" : "text-slate-100"}`}>{title}</div>
                                        {author && <div className="truncate text-[11px] text-slate-500">{author}</div>}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </aside>
            )}
            </>}
        </section>
    );
}
