// Audio taps and per-frame measurements for Meters mode.
// Everything is tapped from the pre-volume source, so the meters show the music itself
// regardless of the volume slider.

export const MIN_HZ = 20;
export const MAX_HZ = 20000;

const LUFS_OFFSET = -0.691; // ITU-R BS.1770
const ABSOLUTE_GATE = -70;

const toDb = (power) => (power > 0 ? 10 * Math.log10(power) : -Infinity);

export function createTaps(audioContext, source) {
    const analyser = (fftSize) => new AnalyserNode(audioContext, { fftSize, smoothingTimeConstant: 0, minDecibels: -140, maxDecibels: 0 });

    // Spectrum / spectrogram
    const fft = analyser(8192);
    // Stereo time-domain signal for the waveform, scope, stereometer, VU and peaks
    const split = audioContext.createChannelSplitter(2);
    const left = analyser(4096);
    const right = analyser(4096);
    // K-weighted copy for loudness (BS.1770: high-pass ~38 Hz, then a +4 dB shelf above ~1.7 kHz)
    const highPass = new BiquadFilterNode(audioContext, { type: "highpass", frequency: 38.13, Q: 0.5 });
    const shelf = new BiquadFilterNode(audioContext, { type: "highshelf", frequency: 1681.97, gain: 4 });
    const kSplit = audioContext.createChannelSplitter(2);
    const kLeft = analyser(4096);
    const kRight = analyser(4096);

    source.connect(fft);
    source.connect(split);
    split.connect(left, 0);
    split.connect(right, 1);
    source.connect(highPass);
    highPass.connect(shelf);
    shelf.connect(kSplit);
    kSplit.connect(kLeft, 0);
    kSplit.connect(kRight, 1);

    const taps = {
        sampleRate: audioContext.sampleRate,
        binHz: audioContext.sampleRate / fft.fftSize,
        spectrum: new Float32Array(fft.frequencyBinCount),
        l: new Float32Array(left.fftSize),
        r: new Float32Array(right.fftSize),
        kl: new Float32Array(kLeft.fftSize),
        kr: new Float32Array(kRight.fftSize),
        read() {
            fft.getFloatFrequencyData(taps.spectrum);
            left.getFloatTimeDomainData(taps.l);
            right.getFloatTimeDomainData(taps.r);
            kLeft.getFloatTimeDomainData(taps.kl);
            kRight.getFloatTimeDomainData(taps.kr);
            // Mono files only fill the first channel; treat them as dual mono
            if (isSilent(taps.r) && !isSilent(taps.l)) {
                taps.r.set(taps.l);
                taps.kr.set(taps.kl);
            }
        },
        disconnect() {
            for (const node of [fft, split, highPass]) {
                try {
                    source.disconnect(node);
                } catch {
                    // already disconnected
                }
            }
        },
    };
    return taps;
}

function isSilent(buf) {
    for (let i = 0; i < buf.length; i += 16) if (buf[i] !== 0) return false;
    return true;
}

export function createMeterState() {
    return {
        vuPower: [0, 0],
        peak: [-Infinity, -Infinity],
        peakHold: [-Infinity, -Infinity],
        peakHoldAge: [0, 0],
        corr: 0,
        bands: { low: 0, mid: 0, high: 0 },
        frame: null,
        loud: newLoudness(),
    };
}

function newLoudness() {
    return { history: [], blocks: [], lastBlock: 0, momentary: -Infinity, shortTerm: -Infinity, integrated: -Infinity, sumPower: 0 };
}

export function resetLoudness(st) {
    st.loud = newLoudness();
}

// analyse measures the samples that arrived since the last frame (approximately: the
// newest dt seconds of each analyser's window) and updates the meters' running state.
export function analyse(taps, st, now, dt) {
    const len = taps.l.length;
    const n = Math.max(64, Math.min(len, Math.round(taps.sampleRate * dt)));
    const from = len - n;

    let pl = 0, pr = 0, sl = 0, sr = 0, slr = 0, kl = 0, kr = 0;
    for (let i = from; i < len; i++) {
        const a = taps.l[i], b = taps.r[i];
        const aa = Math.abs(a), bb = Math.abs(b);
        if (aa > pl) pl = aa;
        if (bb > pr) pr = bb;
        sl += a * a;
        sr += b * b;
        slr += a * b;
        kl += taps.kl[i] * taps.kl[i];
        kr += taps.kr[i] * taps.kr[i];
    }
    const msL = sl / n, msR = sr / n;
    st.frame = { from, n, peakL: pl, peakR: pr, msL, msR };

    // VU: about 300 ms integration
    const kVu = 1 - Math.exp(-dt / 0.3);
    st.vuPower[0] += (msL - st.vuPower[0]) * kVu;
    st.vuPower[1] += (msR - st.vuPower[1]) * kVu;

    // Sample peaks: instant attack, hold for a second, then fall 20 dB/s
    [pl, pr].forEach((p, ch) => {
        const db = 20 * Math.log10(p || 1e-9);
        st.peak[ch] = Math.max(db, (st.peak[ch] === -Infinity ? db : st.peak[ch]) - 20 * dt);
        if (db >= st.peakHold[ch]) {
            st.peakHold[ch] = db;
            st.peakHoldAge[ch] = 0;
        } else if ((st.peakHoldAge[ch] += dt) > 1.5) {
            st.peakHold[ch] -= 20 * dt;
        }
    });

    // Stereo correlation, smoothed
    const denom = Math.sqrt(sl * sr);
    const corr = denom > 1e-12 ? slr / denom : 0;
    st.corr += (corr - st.corr) * (1 - Math.exp(-dt / 0.25));

    // Energy in low / mid / high bands, used to colour the waveform
    const band = (lo, hi) => {
        let sum = 0;
        const a = Math.max(1, Math.floor(lo / taps.binHz)), b = Math.min(taps.spectrum.length - 1, Math.ceil(hi / taps.binHz));
        for (let i = a; i <= b; i++) sum += Math.pow(10, taps.spectrum[i] / 10);
        return sum;
    };
    st.bands = { low: band(20, 250), mid: band(250, 4000), high: band(4000, 20000) };

    updateLoudness(st.loud, (kl + kr) / n, now, dt);
}

function updateLoudness(loud, power, now, dt) {
    loud.history.push({ t: now, power, dt });
    while (loud.history.length && now - loud.history[0].t > 3) loud.history.shift();

    const average = (seconds) => {
        let sum = 0, weight = 0;
        for (let i = loud.history.length - 1; i >= 0; i--) {
            const h = loud.history[i];
            if (now - h.t > seconds) break;
            sum += h.power * h.dt;
            weight += h.dt;
        }
        return weight > 0 ? sum / weight : 0;
    };
    const momentaryPower = average(0.4);
    loud.momentary = toDb(momentaryPower) + LUFS_OFFSET;
    loud.shortTerm = toDb(average(3)) + LUFS_OFFSET;

    // Integrated loudness: 400 ms blocks every 100 ms, gated at -70 LUFS and then 10 LU below the average
    if (now - loud.lastBlock >= 0.1) {
        loud.lastBlock = now;
        if (loud.momentary > ABSOLUTE_GATE) {
            loud.blocks.push(momentaryPower);
            loud.sumPower += momentaryPower;
        }
        if (loud.blocks.length) {
            const relativeGate = toDb(loud.sumPower / loud.blocks.length) + LUFS_OFFSET - 10;
            const gatePower = Math.pow(10, (relativeGate - LUFS_OFFSET) / 10);
            let sum = 0, count = 0;
            for (const p of loud.blocks) {
                if (p > gatePower) {
                    sum += p;
                    count++;
                }
            }
            loud.integrated = count ? toDb(sum / count) + LUFS_OFFSET : -Infinity;
        }
    }
}

// Frequency ↔ note name, for the spectrum readout
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export function noteName(freq) {
    if (!(freq > 0)) return "";
    const midi = 12 * Math.log2(freq / 440) + 69;
    const nearest = Math.round(midi);
    const cents = Math.round((midi - nearest) * 100);
    return `${NOTES[((nearest % 12) + 12) % 12]}${Math.floor(nearest / 12) - 1} ${cents >= 0 ? "+" : "−"} ${Math.abs(cents)} cents`;
}

export const fmtDb = (db, digits = 1) => (Number.isFinite(db) && db > -200 ? db.toFixed(digits) : "-∞");
