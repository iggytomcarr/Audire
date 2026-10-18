// frontend/src/retro/RetroView.jsx
// Retro mode for the Play tab: a 1980s black-glass hi-fi rack. A power amp with backlit
// needle VU meters (after the Technics SE-A3), a 14-band fluorescent spectrum analyser
// (after the Sansui SE-88) and a cassette deck display with the track, time and levels.
// Model names on the units are invented; no real brand marks are used.
import React, { useEffect, useMemo, useRef } from "react";
import { useAudioPlayer } from "../AudioPlayerContext";
import { analyse, createMeterState, createTaps } from "../meters/analysis";
import { displayColours, lampColours } from "./colours";
import ThemeMenu from "./ThemeMenu";

// The rack is drawn in this design space and scaled to fit the window
const DW = 1000, DH = 770;

// 2/3-octave analyser bands
const BANDS = [31.5, 50, 80, 125, 200, 315, 500, 800, 1250, 2000, 3150, 5000, 8000, 12500];
const BAND_LABELS = ["31", "50", "80", "125", "200", "315", "500", "800", "1.2k", "2k", "3.1k", "5k", "8k", "12k"];
const SEGMENTS = 22;
// Band power (dB) shown from empty to full, after a gentle treble lift (dB per octave
// around 1 kHz) so the top bands move as much as the bass, as on the original units
const BAND_FLOOR = -62, BAND_CEIL = -4, TILT = 2.5;

const AMBER_LED = "#ffb347", RED_LED = "#ff5a3c";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Needle position follows signal voltage, so the scale bunches up at the low end like a real meter
const vuPos = (vu) => {
    const a = (v) => Math.pow(10, v / 20);
    return (a(clamp(vu, -22, 4)) - a(-20)) / (a(3) - a(-20));
};

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function text(ctx, str, x, y, size, colour, align = "left", weight = 400) {
    ctx.font = `${weight} ${size}px ui-monospace, 'Cascadia Mono', Consolas, monospace`;
    ctx.fillStyle = colour;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
}

// A black-glass faceplate with rack ears and a faint gloss
function unit(ctx, x, y, w, h, brand, caption) {
    roundRect(ctx, x, y, w, h, 5);
    ctx.fillStyle = "#111114";
    ctx.fill();
    ctx.fillStyle = "#1d1d22";
    ctx.fillRect(x + 3, y + 3, w - 6, 3);
    const gloss = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
    gloss.addColorStop(0, "rgba(255,255,255,0.05)");
    gloss.addColorStop(0.45, "rgba(255,255,255,0.015)");
    gloss.addColorStop(0.46, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(x, y, w, h);
    for (const ex of [x + 12, x + w - 12]) {
        ctx.fillStyle = "#8f8f97";
        ctx.beginPath();
        ctx.arc(ex, y + 16, 3.5, 0, Math.PI * 2);
        ctx.arc(ex, y + h - 16, 3.5, 0, Math.PI * 2);
        ctx.fill();
    }
    text(ctx, brand, x + 30, y + 26, 15, "#e4e4e7", "left", 600);
    text(ctx, caption, x + w - 30, y + 26, 11, "#71717a", "right");
}

function vuMeter(ctx, x, y, w, h, needle, channel, peakLit, lamp) {
    const L = lamp;
    roundRect(ctx, x - 5, y - 5, w + 10, h + 10, 7);
    ctx.fillStyle = "#050506";
    ctx.fill();
    // Backlit face: brighter in the middle like an incandescent lamp behind it
    const face = ctx.createRadialGradient(x + w / 2, y + h * 0.75, h * 0.1, x + w / 2, y + h * 0.6, w * 0.75);
    face.addColorStop(0, L.centre);
    face.addColorStop(0.55, L.face);
    face.addColorStop(1, L.edge);
    roundRect(ctx, x, y, w, h, 4);
    ctx.fillStyle = face;
    ctx.fill();

    const cx = x + w / 2, cy = y + h * 1.12, r = h * 0.92;
    const angle = (p) => -Math.PI / 2 - 0.82 + p * 1.64;
    ctx.lineWidth = 2;
    ctx.strokeStyle = L.ink;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.8, angle(0), angle(vuPos(0)));
    ctx.stroke();
    ctx.strokeStyle = "#b3261e";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.8, angle(vuPos(0)), angle(1));
    ctx.stroke();
    for (const m of [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3]) {
        const a = angle(vuPos(m));
        const cos = Math.cos(a), sin = Math.sin(a);
        ctx.strokeStyle = m > 0 ? "#b3261e" : L.ink;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx + cos * r * 0.8, cy + sin * r * 0.8);
        ctx.lineTo(cx + cos * r * 0.89, cy + sin * r * 0.89);
        ctx.stroke();
        text(ctx, String(Math.abs(m)), cx + cos * r * 0.97, cy + sin * r * 0.97 + 4, 12, m > 0 ? "#b3261e" : L.ink, "center", 600);
    }
    text(ctx, "VU", cx, y + h * 0.66, 17, L.ink, "center", 700);
    text(ctx, channel, x + 12, y + h - 12, 11, L.ink, "left", 600);

    // Needle
    const a = angle(needle);
    ctx.strokeStyle = "#141414";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
    ctx.stroke();
    // Shadow of the glass edge across the bottom of the face
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(x, y + h * 0.8, w, h * 0.2);

    // Peak lamp
    ctx.fillStyle = peakLit ? RED_LED : "#3a1210";
    ctx.beginPath();
    ctx.arc(x + w - 14, y + 14, 5, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, "PEAK", x + w - 24, y + 18, 9, L.ink, "right", 600);
}

export default function RetroView({ active, settings, update, bottomInset, toolbar }) {
    const { getAudioGraph, currentTrack, currentTime, queueIndex, isPlaying } = useAudioPlayer();
    const canvasRef = useRef(null);
    const live = useRef({});
    const lamp = useMemo(() => lampColours(settings.retro_lamp), [settings.retro_lamp]);
    const display = useMemo(() => displayColours(settings.retro_display), [settings.retro_display]);
    live.current = { currentTrack, currentTime, queueIndex, isPlaying, lamp, display };

    useEffect(() => {
        if (!active) return;
        const { audioContext, sourceNode } = getAudioGraph();
        if (!sourceNode) return;
        const taps = createTaps(audioContext, sourceNode);
        const st = createMeterState();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const glow = document.createElement("canvas");
        const gctx = glow.getContext("2d");

        // Band edges halfway (geometrically) between neighbouring centres
        const edges = BANDS.map((f, i) => [
            i === 0 ? f / 1.26 : Math.sqrt(f * BANDS[i - 1]),
            i === BANDS.length - 1 ? f * 1.26 : Math.sqrt(f * BANDS[i + 1]),
        ]);
        const level = new Float32Array(BANDS.length);
        const peak = new Float32Array(BANDS.length);
        const peakAge = new Float32Array(BANDS.length);
        const needle = [0, 0];
        let scrollPos = 0;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
            const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
            // The glow layer is new each time the loop starts, so check it as well as the canvas
            if (canvas.width !== w || canvas.height !== h || glow.width !== w || glow.height !== h) {
                canvas.width = glow.width = w;
                canvas.height = glow.height = h;
            }
        };
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);
        resize();

        let raf;
        let last = performance.now();
        const loop = (now) => {
            raf = requestAnimationFrame(loop);
            const dt = Math.min(Math.max((now - last) / 1000, 1 / 240), 0.25);
            last = now;
            taps.read();
            analyse(taps, st, now / 1000, dt);
            const { currentTrack, currentTime, queueIndex, isPlaying, lamp, display } = live.current;
            const V = display;

            // Band levels: power in each band, quick to rise, slower to fall, with held peaks
            for (let i = 0; i < BANDS.length; i++) {
                let sum = 0;
                const a = Math.max(1, Math.floor(edges[i][0] / taps.binHz));
                const b = Math.min(taps.spectrum.length - 1, Math.ceil(edges[i][1] / taps.binHz));
                for (let k = a; k <= b; k++) {
                    const db = taps.spectrum[k];
                    if (Number.isFinite(db)) sum += Math.pow(10, db / 10);
                }
                const db = sum > 0 ? 10 * Math.log10(sum) + TILT * Math.log2(BANDS[i] / 1000) : -200;
                const target = clamp((db - BAND_FLOOR) / (BAND_CEIL - BAND_FLOOR), 0, 1);
                level[i] = target > level[i] ? level[i] + (target - level[i]) * 0.6 : Math.max(target, level[i] - 1.8 * dt);
                if (level[i] >= peak[i]) {
                    peak[i] = level[i];
                    peakAge[i] = 0;
                } else if ((peakAge[i] += dt) > 0.9) {
                    peak[i] = Math.max(0, peak[i] - 0.7 * dt);
                }
            }
            // VU needles: 0 VU = -18 dBFS, with a little mechanical smoothing
            for (let ch = 0; ch < 2; ch++) {
                const p = st.vuPower[ch];
                const vu = (p > 0 ? 10 * Math.log10(p) : -60) + 18;
                needle[ch] += (vuPos(vu) - needle[ch]) * Math.min(1, dt * 12);
            }

            // Fit the rack to the canvas
            const scale = Math.min(canvas.width / DW, canvas.height / DH);
            const ox = (canvas.width - DW * scale) / 2, oy = (canvas.height - DH * scale) / 2;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = "#020617";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            gctx.setTransform(1, 0, 0, 1, 0, 0);
            gctx.clearRect(0, 0, glow.width, glow.height);
            ctx.setTransform(scale, 0, 0, scale, ox, oy);
            gctx.setTransform(scale, 0, 0, scale, ox, oy);

            const pad = 12, uw = DW - pad * 2;
            const ampH = 262, eqH = 300, deckH = DH - ampH - eqH - pad * 4;
            let y = pad;

            // --- Power amplifier ---
            unit(ctx, pad, y, uw, ampH, "AUDIRE  SE-A86", "STEREO POWER AMPLIFIER");
            const meterW = (uw - 120) / 2;
            const peakDb = [st.peak[0], st.peak[1]];
            vuMeter(ctx, pad + 40, y + 48, meterW, ampH - 82, needle[0], "LEFT", peakDb[0] > -1, lamp);
            vuMeter(ctx, pad + 80 + meterW, y + 48, meterW, ampH - 82, needle[1], "RIGHT", peakDb[1] > -1, lamp);
            // Power lamp
            gctx.fillStyle = isPlaying ? "#4ade80" : "#f59e0b";
            gctx.beginPath();
            gctx.arc(pad + uw / 2, y + ampH - 18, 4, 0, Math.PI * 2);
            gctx.fill();
            text(ctx, "POWER", pad + uw / 2 + 10, y + ampH - 14, 10, "#71717a");
            y += ampH + pad;

            // --- Spectrum analyser ---
            unit(ctx, pad, y, uw, eqH, "AUDIRE  SE-88A", "GRAPHIC EQUALISER · SPECTRUM ANALYSER");
            const gx = pad + 66, gy = y + 44, gw = uw - 220, gh = eqH - 92;
            ctx.fillStyle = "#030305";
            ctx.fillRect(gx - 14, gy - 8, gw + 28, gh + 40);
            const bw = gw / BANDS.length, segH = gh / SEGMENTS;
            for (let i = 0; i < BANDS.length; i++) {
                const lit = Math.round(level[i] * SEGMENTS);
                const pk = Math.min(SEGMENTS - 1, Math.round(peak[i] * SEGMENTS) - 1);
                for (let s = 0; s < SEGMENTS; s++) {
                    const sx = gx + i * bw + 4, sy = gy + gh - (s + 1) * segH + 1.5;
                    if (s < lit || (s === pk && pk > 0)) {
                        gctx.fillStyle = s >= SEGMENTS - 3 ? AMBER_LED : V.on;
                        gctx.fillRect(sx, sy, bw - 8, segH - 3);
                    } else {
                        ctx.fillStyle = V.off;
                        ctx.fillRect(sx, sy, bw - 8, segH - 3);
                    }
                }
                text(gctx, BAND_LABELS[i], gx + i * bw + bw / 2, gy + gh + 20, 12, V.dim, "center");
            }
            [0, -10, -20, -30, -40, -50].forEach((d, k) => text(ctx, String(d), gx - 20, gy + 6 + (k * gh) / 5.4, 11, "#71717a", "right"));
            text(ctx, "dB", gx - 20, gy + gh + 20, 10, "#52525b", "right");
            const ix = pad + uw - 120;
            [
                ["PEAK HOLD", true],
                ["ANALYSER", true],
                ["L + R", true],
                ["EQ", false],
            ].forEach(([name, on], k) => {
                const ly = gy + 10 + k * 34;
                (on ? gctx : ctx).fillStyle = on ? "#ff8a3d" : "#3a2010";
                (on ? gctx : ctx).fillRect(ix, ly - 8, 10, 10);
                text(on ? gctx : ctx, name, ix + 18, ly + 1, 11, on ? "#ffb27a" : "#5a3a28");
            });
            y += eqH + pad;

            // --- Cassette deck display ---
            unit(ctx, pad, y, uw, deckH, "AUDIRE  RS-B86", "STEREO CASSETTE DECK");
            const dx = pad + 40, dy = y + 40, dw = uw - 80, dh = deckH - 54;
            ctx.fillStyle = "#030305";
            ctx.fillRect(dx, dy, dw, dh);
            const trackNo = currentTrack ? String(queueIndex + 1).padStart(2, "0") : "--";
            text(gctx, trackNo, dx + 18, dy + 38, 32, V.on, "left", 600);
            text(gctx, "TRACK", dx + 18, dy + 54, 9, V.dim);

            // Scrolling title, a character at a time like a dot-matrix display
            const title = currentTrack
                ? `${currentTrack.title}  —  ${currentTrack.artist}  —  ${currentTrack.album}      `.toUpperCase()
                : "NO TAPE      ";
            const visible = 40;
            if (isPlaying && title.length > visible) scrollPos += dt * 5;
            const offset = title.length > visible ? Math.floor(scrollPos) % title.length : 0;
            text(gctx, (title + title).slice(offset, offset + visible), dx + 96, dy + 32, 18, V.on);

            const secs = Math.floor(currentTime || 0);
            text(gctx, `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`, dx + dw - 18, dy + 38, 28, V.on, "right", 600);

            // Level ladders (peak dBFS, -40 to 0)
            const mx = dx + 112, mw = dw - 260, segs = 44;
            ["L", "R"].forEach((name, ch) => {
                const ly = dy + 46 + ch * 15;
                text(gctx, name, mx - 14, ly + 8, 11, V.dim);
                const lit = Math.round(clamp((peakDb[ch] + 40) / 40, 0, 1) * segs);
                for (let s = 0; s < segs; s++) {
                    const sx = mx + s * (mw / segs);
                    const hot = s >= segs - 4;
                    if (s < lit) {
                        gctx.fillStyle = hot ? RED_LED : V.on;
                        gctx.fillRect(sx, ly, mw / segs - 2.5, 9);
                    } else {
                        ctx.fillStyle = hot ? "#3a1410" : V.off;
                        ctx.fillRect(sx, ly, mw / segs - 2.5, 9);
                    }
                }
            });

            // Glow: lit elements are drawn once blurred underneath, then crisp on top
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 0.75;
            ctx.filter = `blur(${Math.max(2, 7 * scale)}px)`;
            ctx.drawImage(glow, 0, 0);
            ctx.restore();
            ctx.drawImage(glow, 0, 0);
        };
        raf = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
            taps.disconnect();
        };
    }, [active]);

    return (
        <div className="absolute inset-x-0 top-0 flex flex-col gap-2 px-4 pt-[72px]" style={{ bottom: bottomInset + 8 }}>
            <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] font-semibold">
                <ThemeMenu settings={settings} update={update} />
                <div className="ml-2">{toolbar}</div>
            </div>
            <canvas ref={canvasRef} className="min-h-0 w-full flex-1" />
        </div>
    );
}
