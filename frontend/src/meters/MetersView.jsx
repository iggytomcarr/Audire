// frontend/src/meters/MetersView.jsx
// Meters mode for the Play tab: a dashboard of audio meters inspired by MiniMeters
// (spectrogram, waveform, loudness, stereometer, VU, oscilloscope and spectrum).
import React, { useEffect, useRef, useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useAudioPlayer } from "../AudioPlayerContext";
import { analyse, createMeterState, createTaps, resetLoudness } from "./analysis";
import { RENDERERS } from "./modules";
import { COLORMAPS, colormapLUT } from "./colormaps";

export const METER_MODULES = [
    { id: "spectrogram", label: "Spectrogram" },
    { id: "spectrum", label: "Spectrum" },
    { id: "waveform", label: "Waveform" },
    { id: "loudness", label: "Loudness" },
    { id: "stereometer", label: "Stereometer" },
    { id: "vu", label: "VU" },
    { id: "oscilloscope", label: "Oscilloscope" },
];

// Rows of the dashboard, with each module's share of its row
const LAYOUT = [
    { grow: 4, modules: [["spectrogram", 3], ["spectrum", 2]] },
    { grow: 2, modules: [["waveform", 1]] },
    { grow: 3.4, modules: [["loudness", 1.25], ["stereometer", 1], ["vu", 1.3], ["oscilloscope", 1.6]] },
];

export default function MetersView({ active, settings, update, bottomInset, toolbar }) {
    const { getAudioGraph, isPlaying, currentTrack } = useAudioPlayer();
    const canvases = useRef({});
    const moduleState = useRef({});
    const meterState = useRef(createMeterState());
    const hover = useRef(null);
    const env = useRef({});
    const [menuOpen, setMenuOpen] = useState(false);

    const enabled = settings.meter_modules;
    const colormap = settings.colormap;
    env.current.running = isPlaying;
    env.current.lut = colormapLUT(colormap);

    // Integrated loudness is per track
    useEffect(() => resetLoudness(meterState.current), [currentTrack?.path]);

    // Size each canvas to its box in device pixels; clearing a module's state redraws it fresh
    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            for (const entry of entries) {
                const canvas = entry.target;
                const w = Math.max(1, Math.round(entry.contentRect.width * dpr));
                const h = Math.max(1, Math.round(entry.contentRect.height * dpr));
                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w;
                    canvas.height = h;
                    moduleState.current[canvas.dataset.module] = {};
                }
            }
        });
        Object.values(canvases.current).forEach((c) => c && observer.observe(c));
        return () => observer.disconnect();
    }, [enabled.join(","), active]);

    // A changed colour map repaints the spectrogram from scratch
    useEffect(() => {
        moduleState.current.spectrogram = {};
    }, [colormap]);

    useEffect(() => {
        if (!active) return;
        const { audioContext, sourceNode } = getAudioGraph();
        if (!sourceNode) return;
        const taps = createTaps(audioContext, sourceNode);
        env.current.taps = taps;
        env.current.st = meterState.current;

        let raf;
        let last = performance.now();
        const loop = (now) => {
            raf = requestAnimationFrame(loop);
            const dt = Math.min(Math.max((now - last) / 1000, 1 / 240), 0.25);
            last = now;
            taps.read();
            analyse(taps, meterState.current, now / 1000, dt);
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            for (const id of enabled) {
                const canvas = canvases.current[id];
                if (!canvas || canvas.width < 2) continue;
                const mod = moduleState.current[id] || (moduleState.current[id] = {});
                env.current.hover = id === "spectrum" ? hover.current : null;
                RENDERERS[id](canvas.getContext("2d"), canvas.width, canvas.height, dpr, env.current, mod);
            }
        };
        raf = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(raf);
            taps.disconnect();
        };
    }, [active, enabled.join(",")]);

    const toggleModule = (id) => {
        const next = enabled.includes(id) ? enabled.filter((m) => m !== id) : METER_MODULES.map((m) => m.id).filter((m) => m === id || enabled.includes(m));
        update({ meter_modules: next });
    };

    const rows = LAYOUT.map((row) => ({ ...row, modules: row.modules.filter(([id]) => enabled.includes(id)) })).filter((r) => r.modules.length);

    return (
        <div className="absolute inset-x-0 top-0 flex flex-col gap-2 px-4 pt-[72px]" style={{ bottom: bottomInset + 8 }}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-sm">
                    {currentTrack ? (
                        <>
                            <span className="font-semibold">{currentTrack.title}</span>
                            <span className="text-slate-400"> — {currentTrack.artist} · {currentTrack.album}</span>
                        </>
                    ) : (
                        <span className="text-slate-400">Nothing playing</span>
                    )}
                </div>
                <div className="relative flex shrink-0 items-center gap-2">
                    <button
                        onClick={() => resetLoudness(meterState.current)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 px-3 py-1 text-[11px] font-semibold text-slate-300 hover:border-slate-500 hover:text-white"
                        title="Reset integrated loudness and peaks"
                    >
                        <RotateCcw size={11} /> Reset
                    </button>
                    <button
                        onClick={() => setMenuOpen((o) => !o)}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold ${menuOpen ? "border-indigo-300/70 bg-indigo-500/30 text-white" : "border-slate-700/70 text-slate-300 hover:border-slate-500 hover:text-white"}`}
                        aria-expanded={menuOpen}
                    >
                        <SlidersHorizontal size={11} /> Meters
                    </button>
                    {toolbar}
                    {menuOpen && (
                        <div className="absolute right-0 top-9 z-20 w-64 rounded-xl border border-slate-700/60 bg-slate-950/95 p-3 text-sm shadow-2xl backdrop-blur">
                            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Modules</div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {METER_MODULES.map((m) => (
                                    <label key={m.id} className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
                                        <input type="checkbox" checked={enabled.includes(m.id)} onChange={() => toggleModule(m.id)} className="accent-indigo-400" />
                                        {m.label}
                                    </label>
                                ))}
                            </div>
                            <div className="mb-2 mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Spectrogram colours</div>
                            <div className="flex flex-wrap gap-1.5">
                                {COLORMAPS.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => update({ colormap: c.id })}
                                        className={`rounded-md px-2 py-1 text-xs ${colormap === c.id ? "bg-indigo-500/30 text-indigo-200" : "text-slate-300 hover:bg-slate-800"}`}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="grid flex-1 place-items-center text-sm text-slate-400">All meters are switched off. Turn some on from Meters.</div>
            ) : (
                rows.map((row, ri) => (
                    <div key={ri} className="flex min-h-0 gap-2" style={{ flex: `${row.grow} 1 0` }}>
                        {row.modules.map(([id, share]) => (
                            <div key={id} className="relative min-w-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950" style={{ flex: `${share} 1 0` }}>
                                <canvas
                                    ref={(el) => (canvases.current[id] = el)}
                                    data-module={id}
                                    className="absolute inset-0 h-full w-full"
                                    onMouseMove={id === "spectrum" ? (e) => (hover.current = { x: e.nativeEvent.offsetX }) : undefined}
                                    onMouseLeave={id === "spectrum" ? () => (hover.current = null) : undefined}
                                />
                                <span className="pointer-events-none absolute left-2 top-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                                    {METER_MODULES.find((m) => m.id === id).label}
                                </span>
                            </div>
                        ))}
                    </div>
                ))
            )}
        </div>
    );
}
