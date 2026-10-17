// Canvas renderers for each meter. Each draw(ctx, w, h, dpr, env, mod) paints one frame;
// `mod` is that module's own state, cleared whenever its canvas is resized.
import { MIN_HZ, MAX_HZ, fmtDb, noteName } from "./analysis";

const BG = "#020617";
const GRID = "rgba(148, 163, 184, 0.12)";
const LABEL = "rgba(148, 163, 184, 0.75)";
const FONT = (dpr, size = 10) => `${Math.round(size * dpr)}px 'Plus Jakarta Sans Variable', system-ui, sans-serif`;

const logX = (f, w) => (Math.log(f / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ)) * w;
const xToHz = (x, w) => MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, x / w);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Peak dB of the FFT bins that fall between two frequencies, interpolating when the range
// is narrower than one bin (at the low end of a log axis)
function binRange(spectrum, binHz, f0, f1) {
    const b0 = f0 / binHz, b1 = f1 / binHz;
    if (b1 - b0 < 1) {
        const b = (b0 + b1) / 2, i = Math.floor(b), t = b - i;
        return spectrum[i] * (1 - t) + spectrum[Math.min(spectrum.length - 1, i + 1)] * t;
    }
    let max = -Infinity;
    for (let i = Math.floor(b0); i <= Math.min(spectrum.length - 1, Math.ceil(b1)); i++) if (spectrum[i] > max) max = spectrum[i];
    return max;
}

// Display gain that slowly adapts so quiet music still fills the scope and stereometer
// (the numeric meters are never scaled)
function autoGain(mod, peak) {
    mod.level = Math.max(peak, (mod.level ?? peak) * 0.985);
    const target = clamp(0.8 / Math.max(mod.level, 1e-3), 1, 12);
    mod.gain = (mod.gain ?? target) + (target - (mod.gain ?? target)) * 0.05;
    return mod.gain;
}

// Amplitude (0..1) to a 0..1 height; the square root keeps quiet passages visible
// without flattening the dynamics of loud ones
const ampHeight = (amp) => clamp(Math.sqrt(amp), 0, 1);

// Scrolls a canvas left by `step` device pixels
function scroll(ctx, w, h, step) {
    ctx.drawImage(ctx.canvas, step, 0, w - step, h, 0, 0, w - step, h);
}

export function spectrogram(ctx, w, h, dpr, env, mod) {
    const { taps, running, lut } = env;
    if (!mod.rows) {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, w, h);
        mod.rows = [];
        for (let y = 0; y < h; y++) {
            const f0 = MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, 1 - (y + 1) / h);
            const f1 = MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, 1 - y / h);
            mod.rows.push({ f0, f1, tilt: 3 * Math.log2(Math.sqrt(f0 * f1) / 1000) });
        }
    }
    if (!running) return;
    const step = Math.max(1, Math.round(dpr));
    if (!mod.column || mod.column.width !== step) mod.column = ctx.createImageData(step, h);
    scroll(ctx, w, h, step);
    const data = mod.column.data;
    for (let y = 0; y < h; y++) {
        const row = mod.rows[y];
        const db = binRange(taps.spectrum, taps.binHz, row.f0, row.f1) + row.tilt;
        const i = Math.round(clamp((db + 110) / 85, 0, 1) * 255) * 3;
        for (let x = 0; x < step; x++) {
            const p = (y * step + x) * 4;
            data[p] = lut[i];
            data[p + 1] = lut[i + 1];
            data[p + 2] = lut[i + 2];
            data[p + 3] = 255;
        }
    }
    ctx.putImageData(mod.column, w - step, 0);
}

export function waveform(ctx, w, h, dpr, env, mod) {
    const { taps, st, running } = env;
    if (!mod.ready) {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, w, h);
        mod.ready = true;
    }
    if (!running || !st.frame) return;
    const step = Math.max(1, Math.round(dpr));
    scroll(ctx, w, h, step);
    ctx.fillStyle = BG;
    ctx.fillRect(w - step, 0, step, h);

    // Peak and RMS of the newest samples (mid channel)
    let peak = 0, sum = 0;
    for (let i = st.frame.from; i < taps.l.length; i++) {
        const m = (taps.l[i] + taps.r[i]) / 2;
        peak = Math.max(peak, Math.abs(m));
        sum += m * m;
    }
    const rms = Math.sqrt(sum / st.frame.n);

    // Colour by where the energy is: lows warm orange, mids violet, highs sky blue
    const { low, mid, high } = st.bands;
    const total = low + mid + high || 1;
    const mix = (a, b, c) => Math.round((low * a + mid * b + high * c) / total);
    const colour = `rgb(${mix(251, 167, 125)}, ${mix(146, 139, 211)}, ${mix(60, 250, 252)})`;

    const mid0 = h / 2;
    const ph = ampHeight(peak), rh = ampHeight(rms);
    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(w - step, mid0 - ph * mid0 * 0.95, step, Math.max(1, ph * h * 0.95));
    ctx.globalAlpha = 1;
    ctx.fillRect(w - step, mid0 - rh * mid0 * 0.95, step, Math.max(1, rh * h * 0.95));
}

// Vertical bar meter used by the loudness module
function bar(ctx, x, y, bw, bh, value, min, max, fill, hold) {
    ctx.fillStyle = "rgba(30, 41, 59, 0.7)";
    ctx.fillRect(x, y, bw, bh);
    const t = clamp((value - min) / (max - min), 0, 1);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y + bh * (1 - t), bw, bh * t);
    if (hold !== undefined && Number.isFinite(hold)) {
        const th = clamp((hold - min) / (max - min), 0, 1);
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(x, y + bh * (1 - th), bw, Math.max(1, bw * 0.08));
    }
}

export function loudness(ctx, w, h, dpr, env) {
    const { st } = env;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
    const top = 26 * dpr, bottom = h - 18 * dpr, bh = bottom - top;
    const bw = Math.max(6 * dpr, Math.min(16 * dpr, w * 0.06));
    const gap = bw * 0.45;
    let x = 30 * dpr;

    // dB scale
    ctx.font = FONT(dpr, 9);
    ctx.fillStyle = LABEL;
    ctx.textAlign = "right";
    for (let db = 0; db >= -60; db -= 12) {
        const y = top + bh * (-db / 60);
        ctx.fillText(String(db), x - 6 * dpr, y + 3 * dpr);
        ctx.fillStyle = GRID;
        ctx.fillRect(x - 3 * dpr, y, w - x, 1);
        ctx.fillStyle = LABEL;
    }

    const peakFill = ctx.createLinearGradient(0, top, 0, bottom);
    peakFill.addColorStop(0, "#f87171");
    peakFill.addColorStop(0.1, "#facc15");
    peakFill.addColorStop(0.3, "#4ade80");
    peakFill.addColorStop(1, "#15803d");
    const loudFill = ctx.createLinearGradient(0, top, 0, bottom);
    loudFill.addColorStop(0, "#c4b5fd");
    loudFill.addColorStop(1, "#4f46e5");

    const meters = [
        { label: "L", value: st.peak[0], hold: st.peakHold[0], fill: peakFill },
        { label: "R", value: st.peak[1], hold: st.peakHold[1], fill: peakFill },
        { label: "M", value: st.loud.momentary, fill: loudFill },
        { label: "S", value: st.loud.shortTerm, fill: loudFill },
    ];
    ctx.textAlign = "center";
    meters.forEach((m, i) => {
        if (i === 2) x += gap * 2;
        bar(ctx, x, top, bw, bh, m.value, -60, 0, m.fill, m.hold);
        ctx.fillStyle = LABEL;
        ctx.fillText(m.label, x + bw / 2, h - 5 * dpr);
        x += bw + gap;
    });

    // Readouts
    const tx = x + 14 * dpr;
    if (tx < w - 60 * dpr) {
        ctx.textAlign = "left";
        const rows = [
            ["Momentary", st.loud.momentary, "LUFS"],
            ["Short-term", st.loud.shortTerm, "LUFS"],
            ["Integrated", st.loud.integrated, "LUFS"],
            ["Peak", Math.max(st.peakHold[0], st.peakHold[1]), "dBFS"],
        ];
        const lineH = Math.min(bh / rows.length, 40 * dpr);
        rows.forEach(([label, value, unit], i) => {
            const y = top + i * lineH;
            ctx.fillStyle = LABEL;
            ctx.font = FONT(dpr, 9);
            ctx.fillText(label.toUpperCase(), tx, y + 9 * dpr);
            ctx.fillStyle = i === 2 ? "#c4b5fd" : "#e2e8f0";
            ctx.font = `600 ${FONT(dpr, 16)}`;
            ctx.fillText(fmtDb(value), tx, y + 27 * dpr);
            const vw = ctx.measureText(fmtDb(value)).width;
            ctx.fillStyle = LABEL;
            ctx.font = FONT(dpr, 9);
            ctx.fillText(unit, tx + vw + 4 * dpr, y + 27 * dpr);
        });
    }
}

export function stereometer(ctx, w, h, dpr, env, mod) {
    const { taps, st } = env;
    // Fade the previous frames for a phosphor-like trail
    ctx.fillStyle = "rgba(2, 6, 23, 0.32)";
    ctx.fillRect(0, 0, w, h);

    const barH = 22 * dpr;
    const cx = w / 2, cy = (h - barH) / 2 + 8 * dpr;
    const r = Math.min(w, h - barH - 16 * dpr) * 0.46;

    // Guides: the diamond of full-scale L/R, plus mid and side axes
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
    ctx.stroke();
    ctx.font = FONT(dpr, 9);
    ctx.fillStyle = LABEL;
    ctx.textAlign = "center";
    ctx.fillText("L", cx - r * 0.55, cy - r * 0.55);
    ctx.fillText("R", cx + r * 0.55, cy - r * 0.55);

    if (st.frame) {
        const gain = autoGain(mod, Math.max(st.frame.peakL, st.frame.peakR)) * 0.85;
        ctx.fillStyle = "rgba(199, 210, 254, 0.6)";
        const s = Math.max(1, 1.4 * dpr);
        const step = Math.max(1, Math.floor(taps.l.length / 1400));
        for (let i = 0; i < taps.l.length; i += step) {
            const l = taps.l[i], rr = taps.r[i];
            const x = cx + ((l - rr) / Math.SQRT2) * r * gain;
            const y = cy - ((l + rr) / Math.SQRT2) * r * gain;
            ctx.fillRect(x, y, s, s);
        }
    }

    // Correlation meter: -1 (out of phase) to +1 (mono)
    const bx = w * 0.1, bw = w * 0.8, by = h - barH + 4 * dpr, bh = 6 * dpr;
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(bx, by, bw, bh);
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, "#f87171");
    grad.addColorStop(0.5, "#facc15");
    grad.addColorStop(1, "#4ade80");
    const px = bx + ((st.corr + 1) / 2) * bw;
    ctx.fillStyle = grad;
    ctx.fillRect(Math.min(px, bx + bw / 2), by, Math.abs(px - (bx + bw / 2)), bh);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(px - dpr, by - 2 * dpr, 2 * dpr, bh + 4 * dpr);
    ctx.fillStyle = LABEL;
    ctx.textAlign = "left";
    ctx.fillText("−1", bx, h - 2 * dpr);
    ctx.textAlign = "right";
    ctx.fillText("+1", bx + bw, h - 2 * dpr);
    ctx.textAlign = "center";
    ctx.fillText(`Correlation ${st.corr >= 0 ? "+" : ""}${st.corr.toFixed(2)}`, cx, h - 2 * dpr);
}

// VU dial: positions follow signal voltage, so the scale bunches up at the low end like a real meter
const VU_MARKS = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3];
const vuPos = (vu) => {
    const a = (v) => Math.pow(10, v / 20);
    return (a(clamp(vu, -24, 4)) - a(-20)) / (a(3) - a(-20));
};

export function vu(ctx, w, h, dpr, env, mod) {
    const { st } = env;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2, pivotY = h * 0.98;
    const r = Math.min(w * 0.52, h * 0.82);
    const span = (100 * Math.PI) / 180; // ±50°
    const angle = (p) => -Math.PI / 2 - span / 2 + p * span;

    // Scale arc, red above 0 VU
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = "rgba(226, 232, 240, 0.55)";
    ctx.beginPath();
    ctx.arc(cx, pivotY, r, angle(0), angle(vuPos(0)));
    ctx.stroke();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 4 * dpr;
    ctx.beginPath();
    ctx.arc(cx, pivotY, r, angle(vuPos(0)), angle(1));
    ctx.stroke();

    ctx.font = FONT(dpr, 10);
    ctx.textAlign = "center";
    VU_MARKS.forEach((m) => {
        const a = angle(vuPos(m));
        const cos = Math.cos(a), sin = Math.sin(a);
        ctx.strokeStyle = m > 0 ? "#ef4444" : "rgba(226, 232, 240, 0.7)";
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(cx + cos * r, pivotY + sin * r);
        ctx.lineTo(cx + cos * (r + 8 * dpr), pivotY + sin * (r + 8 * dpr));
        ctx.stroke();
        ctx.fillStyle = m > 0 ? "#f87171" : "#e2e8f0";
        ctx.fillText(String(Math.abs(m)), cx + cos * (r + 18 * dpr), pivotY + sin * (r + 18 * dpr) + 3 * dpr);
    });
    ctx.fillStyle = LABEL;
    ctx.font = `600 ${FONT(dpr, 12)}`;
    ctx.fillText("VU", cx, pivotY - r * 0.42);

    // Needle with a little mechanical smoothing on top of the 300 ms VU integration
    const power = (st.vuPower[0] + st.vuPower[1]) / 2;
    const vuValue = (power > 0 ? 10 * Math.log10(power) : -60) + 18; // 0 VU = -18 dBFS
    const target = vuPos(vuValue);
    mod.needle = mod.needle === undefined ? target : mod.needle + (target - mod.needle) * 0.35;
    const a = angle(mod.needle);
    ctx.strokeStyle = "#fb923c";
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(cx, pivotY);
    ctx.lineTo(cx + Math.cos(a) * (r + 4 * dpr), pivotY + Math.sin(a) * (r + 4 * dpr));
    ctx.stroke();

    // RMS of each channel in dBFS
    ctx.font = FONT(dpr, 10);
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText(fmtDb(10 * Math.log10(st.vuPower[0] || 1e-12)), 8 * dpr, h - 6 * dpr);
    ctx.textAlign = "right";
    ctx.fillText(fmtDb(10 * Math.log10(st.vuPower[1] || 1e-12)), w - 8 * dpr, h - 6 * dpr);
}

export function oscilloscope(ctx, w, h, dpr, env, mod) {
    const { taps, st } = env;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = GRID;
    ctx.fillRect(0, h / 2, w, 1);

    // Trigger on a rising zero crossing so the trace stands still for steady tones
    const len = taps.l.length, view = 1024;
    const mid = (i) => (taps.l[i] + taps.r[i]) / 2;
    let start = len - view;
    for (let i = len - view; i > len - view - 2048 && i > 1; i--) {
        if (mid(i - 1) < 0 && mid(i) >= 0) {
            start = i;
            break;
        }
    }
    const gain = st.frame ? autoGain(mod, Math.max(st.frame.peakL, st.frame.peakR)) : 1;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#818cf8");
    grad.addColorStop(1, "#7dd3fc");
    const trace = (width, alpha) => {
        ctx.strokeStyle = grad;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let j = 0; j < view; j++) {
            const x = (j / (view - 1)) * w;
            const y = h / 2 - mid(start + j) * gain * h * 0.45;
            j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
    };
    trace(4 * dpr, 0.18); // glow
    trace(1.4 * dpr, 1);
    ctx.globalAlpha = 1;
}

const SPECTRUM_MIN = -108, SPECTRUM_MAX = 0, TILT = 4.5;

export function spectrum(ctx, w, h, dpr, env, mod) {
    const { taps, hover } = env;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    const cols = Math.max(64, Math.round(w / (2 * dpr)));
    if (!mod.smooth || mod.smooth.length !== cols) {
        mod.smooth = new Float32Array(cols).fill(SPECTRUM_MIN);
        mod.peak = new Float32Array(cols).fill(SPECTRUM_MIN);
    }
    const yOf = (db) => h - clamp((db - SPECTRUM_MIN) / (SPECTRUM_MAX - SPECTRUM_MIN), 0, 1) * h;

    // Grid
    ctx.font = FONT(dpr, 9);
    ctx.fillStyle = LABEL;
    ctx.textAlign = "left";
    for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
        const x = logX(f, w);
        ctx.fillStyle = GRID;
        ctx.fillRect(x, 0, 1, h);
        ctx.fillStyle = LABEL;
        ctx.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x + 3 * dpr, h - 4 * dpr);
    }
    for (let db = SPECTRUM_MAX - 12; db > SPECTRUM_MIN; db -= 12) {
        const y = yOf(db);
        ctx.fillStyle = GRID;
        ctx.fillRect(0, y, w, 1);
        ctx.fillStyle = LABEL;
        ctx.fillText(String(db), 3 * dpr, y - 3 * dpr);
    }

    // Measure each column (log frequency, +4.5 dB/octave tilt around 1 kHz), then smooth:
    // quick to rise, slow to fall, with peaks that hold before decaying
    const pts = [];
    for (let c = 0; c < cols; c++) {
        const f0 = xToHz((c / cols) * w, w), f1 = xToHz(((c + 1) / cols) * w, w);
        // Silence reads as -Infinity, which would stick in the smoothing, so floor it
        const raw = binRange(taps.spectrum, taps.binHz, f0, f1) + TILT * Math.log2(Math.sqrt(f0 * f1) / 1000);
        const db = Number.isFinite(raw) ? Math.max(raw, SPECTRUM_MIN - 12) : SPECTRUM_MIN - 12;
        const s = Number.isFinite(mod.smooth[c]) ? mod.smooth[c] : db;
        mod.smooth[c] = db > s ? s + (db - s) * 0.6 : s + (db - s) * 0.12;
        mod.peak[c] = Math.max(mod.smooth[c], Number.isFinite(mod.peak[c]) ? mod.peak[c] - 0.25 : db);
        pts.push([((c + 0.5) / cols) * w, yOf(mod.smooth[c])]);
    }

    const fill = ctx.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, "rgba(129, 140, 248, 0.45)");
    fill.addColorStop(1, "rgba(129, 140, 248, 0.02)");
    ctx.beginPath();
    ctx.moveTo(0, h);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.3 * dpr;
    ctx.stroke();

    ctx.beginPath();
    for (let c = 0; c < cols; c++) {
        const x = ((c + 0.5) / cols) * w, y = yOf(mod.peak[c]);
        c ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = "rgba(196, 181, 253, 0.45)";
    ctx.lineWidth = dpr;
    ctx.stroke();

    // Hover readout: level, frequency and the nearest note
    if (hover) {
        const hx = hover.x * dpr;
        const c = clamp(Math.floor((hx / w) * cols), 0, cols - 1);
        const freq = xToHz(hx, w);
        ctx.fillStyle = "rgba(226, 232, 240, 0.4)";
        ctx.fillRect(hx, 0, 1, h);
        const text = `${fmtDb(mod.smooth[c], 2)} dB  |  ${freq < 1000 ? freq.toFixed(1) : (freq / 1000).toFixed(2) + "k"} Hz  |  ${noteName(freq)}`;
        ctx.font = FONT(dpr, 11);
        const tw = ctx.measureText(text).width + 14 * dpr;
        const bx = clamp(hx - tw / 2, 4 * dpr, w - tw - 4 * dpr);
        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        ctx.fillRect(bx, 8 * dpr, tw, 20 * dpr);
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "left";
        ctx.fillText(text, bx + 7 * dpr, 22 * dpr);
    }
}

export const RENDERERS = { spectrogram, waveform, loudness, stereometer, vu, oscilloscope, spectrum };
