// Retro mode colours: any picked colour becomes a backlit VU face and a fluorescent display.
// Lightness is set per role (not taken from the pick) so a dark pick still reads as a lamp.

export const PALETTE = [
    { name: "Amber", hex: "#f2c06b" },
    { name: "Warm white", hex: "#ffe7c2" },
    { name: "Orange", hex: "#ff9a3d" },
    { name: "Red", hex: "#ff6b5a" },
    { name: "Pink", hex: "#ff8fd0" },
    { name: "Violet", hex: "#b79cff" },
    { name: "Blue", hex: "#5ea8ff" },
    { name: "Ice", hex: "#a9d2ff" },
    { name: "Cyan", hex: "#8ff6ff" },
    { name: "Teal", hex: "#5ff2c8" },
    { name: "Green", hex: "#8dffa8" },
    { name: "Lime", hex: "#d4ff6b" },
];

export const BUILT_IN_PRESETS = [
    { id: "classic", name: "Classic", lamp: "#f2c06b", display: "#8ff6ff", builtIn: true },
    { id: "midnight", name: "Midnight", lamp: "#5ea8ff", display: "#8dffa8", builtIn: true },
    { id: "all-amber", name: "All amber", lamp: "#ffb347", display: "#ffb347", builtIn: true },
    { id: "arctic", name: "Arctic", lamp: "#a9d2ff", display: "#a9d2ff", builtIn: true },
];

// Earlier versions stored named colours
const LEGACY = { amber: "#f2c06b", blue: "#5ea8ff", cyan: "#8ff6ff", green: "#8dffa8" };

export function normaliseHex(value, fallback) {
    if (LEGACY[value]) return LEGACY[value];
    return /^#[0-9a-f]{6}$/i.test(value || "") ? value.toLowerCase() : fallback;
}

function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
}

const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;

// A backlit VU meter face: brighter in the middle, darker at the edges, dark ink in the same hue
export function lampColours(hex) {
    const [h, s] = hexToHsl(hex);
    return {
        face: hsl(h, s * 0.85, 0.68),
        centre: hsl(h, s * 0.75, 0.85),
        edge: hsl(h, s * 0.9, 0.42),
        ink: hsl(h, Math.min(s, 0.6), 0.12),
    };
}

// A fluorescent display: bright lit segments, faint unlit ones and a mid tone for labels
export function displayColours(hex) {
    const [h, s] = hexToHsl(hex);
    return {
        on: hsl(h, Math.max(s, 0.55), 0.76),
        off: hsl(h, s * 0.45, 0.12),
        dim: hsl(h, s * 0.55, 0.42),
    };
}
