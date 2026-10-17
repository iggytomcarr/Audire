// Colour maps for the spectrogram, as 256-entry RGB lookup tables built from a few stops.

const STOPS = {
    magma: [[0, 0, 4], [59, 15, 112], [140, 41, 129], [222, 73, 104], [254, 159, 109], [252, 253, 191]],
    inferno: [[0, 0, 4], [66, 10, 104], [147, 38, 103], [221, 81, 58], [252, 165, 10], [252, 255, 164]],
    viridis: [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]],
    audire: [[2, 6, 23], [30, 27, 75], [79, 70, 229], [167, 139, 250], [125, 211, 252], [240, 249, 255]],
    grey: [[2, 6, 23], [71, 85, 105], [226, 232, 240]],
};

export const COLORMAPS = [
    { id: "magma", label: "Magma" },
    { id: "inferno", label: "Inferno" },
    { id: "viridis", label: "Viridis" },
    { id: "audire", label: "Audire" },
    { id: "grey", label: "Grey" },
];

const cache = {};

export function colormapLUT(id) {
    if (cache[id]) return cache[id];
    const stops = STOPS[id] || STOPS.magma;
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
        const t = (i / 255) * (stops.length - 1);
        const a = stops[Math.floor(t)];
        const b = stops[Math.min(stops.length - 1, Math.floor(t) + 1)];
        const f = t - Math.floor(t);
        for (let c = 0; c < 3; c++) lut[i * 3 + c] = a[c] + (b[c] - a[c]) * f;
    }
    cache[id] = lut;
    return lut;
}
