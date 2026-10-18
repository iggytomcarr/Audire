// Shared runtime for room objects. RoomView provides one context with the library, play
// counts, theme and actions, and runs a single animation loop that measures the music once
// per frame; objects subscribe with useFrame and animate their own elements directly.
import { createContext, useContext, useEffect, useRef, useState } from "react";

export const RoomContext = createContext(null);
export const useRoom = () => useContext(RoomContext);

// Calls fn(levels, dt) every frame while the room is visible
export function useFrame(fn) {
    const { frames } = useRoom();
    const ref = useRef(fn);
    ref.current = fn;
    useEffect(() => {
        const cb = (levels, dt) => ref.current(levels, dt);
        frames.add(cb);
        return () => frames.delete(cb);
    }, [frames]);
}

// Levels measured from the music each frame (0..1), smoothed for display
export function createLevels() {
    return { bass: 0, mid: 0, treble: 0, left: 0, right: 0, bands: new Float32Array(10) };
}

const BAND_EDGES = [30, 60, 120, 250, 500, 1000, 2000, 4000, 8000, 12000, 18000];

export function measure(analyser, buffers, levels, dt) {
    const { freq, timeL } = buffers;
    analyser.getFloatFrequencyData(freq);
    analyser.getFloatTimeDomainData(timeL);
    const binHz = analyser.context.sampleRate / analyser.fftSize;
    const bandLevel = (lo, hi) => {
        let sum = 0;
        for (let i = Math.max(1, Math.floor(lo / binHz)); i <= Math.min(freq.length - 1, Math.ceil(hi / binHz)); i++) {
            if (Number.isFinite(freq[i])) sum += Math.pow(10, freq[i] / 10);
        }
        const db = sum > 0 ? 10 * Math.log10(sum) : -120;
        return Math.max(0, Math.min(1, (db + 60) / 55));
    };
    const ease = (prev, next, up, down) => prev + (next - prev) * Math.min(1, dt * (next > prev ? up : down));
    for (let b = 0; b < levels.bands.length; b++) {
        const lift = 2.5 * Math.log2(Math.sqrt(BAND_EDGES[b] * BAND_EDGES[b + 1]) / 1000) / 55;
        levels.bands[b] = ease(levels.bands[b], Math.min(1, bandLevel(BAND_EDGES[b], BAND_EDGES[b + 1]) + lift), 20, 5);
    }
    levels.bass = ease(levels.bass, bandLevel(30, 150), 25, 6);
    levels.mid = ease(levels.mid, bandLevel(250, 2000), 20, 5);
    levels.treble = ease(levels.treble, bandLevel(4000, 16000), 20, 5);
    let sum = 0;
    for (let i = 0; i < timeL.length; i++) sum += timeL[i] * timeL[i];
    const rms = Math.sqrt(sum / timeL.length);
    const vu = Math.max(0, Math.min(1, (20 * Math.log10(rms || 1e-6) + 38) / 38));
    levels.left = ease(levels.left, vu, 6, 3);
    levels.right = ease(levels.right, vu * 0.97, 6, 3);
}

// Average colour of each album cover, for record spines; cached for the session
const colourCache = new Map();

function hashColour(id = "") {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `hsl(${h % 360} 45% 42%)`;
}

// Covers are sampled a few at a time, since many may be cloud files that download on first use
const SAMPLE_AT_ONCE = 6;

export function useCoverColours(albums) {
    const [, setVersion] = useState(0);
    useEffect(() => {
        let cancelled = false;
        const queue = albums.filter((a) => a.coverImage && !colourCache.has(`${a.id}:${a.coverImage}`));
        let running = 0, bump = null;
        const pending = new Set();
        const next = () => {
            if (cancelled) return;
            while (running < SAMPLE_AT_ONCE && queue.length) sample(queue.shift());
        };
        const done = () => {
            running--;
            // Repaint in batches rather than once per cover
            if (!bump) bump = setTimeout(() => { bump = null; if (!cancelled) setVersion((v) => v + 1); }, 400);
            next();
        };
        const sample = (a) => {
            const key = `${a.id}:${a.coverImage}`;
            colourCache.set(key, hashColour(a.id));
            pending.add(key);
            running++;
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                try {
                    const c = document.createElement("canvas");
                    c.width = c.height = 8;
                    const g = c.getContext("2d");
                    g.drawImage(img, 0, 0, 8, 8);
                    const d = g.getImageData(0, 0, 8, 8).data;
                    let r = 0, gr = 0, b = 0;
                    for (let i = 0; i < d.length; i += 4) {
                        r += d[i];
                        gr += d[i + 1];
                        b += d[i + 2];
                    }
                    const n = d.length / 4;
                    colourCache.set(key, `rgb(${Math.round(r / n)}, ${Math.round(gr / n)}, ${Math.round(b / n)})`);
                } catch {
                    // keep the fallback colour
                }
                pending.delete(key);
                done();
            };
            img.onerror = () => {
                pending.delete(key);
                done();
            };
            img.src = a.coverImage;
        };
        next();
        return () => {
            cancelled = true;
            clearTimeout(bump);
            // Forget covers still loading so they are sampled next time
            pending.forEach((k) => colourCache.delete(k));
        };
    }, [albums]);
    return (album) => colourCache.get(`${album.id}:${album.coverImage || ""}`) || hashColour(album.id);
}
