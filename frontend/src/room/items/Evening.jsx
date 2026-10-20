// Evening decor: a window onto a dusk or night sky over the city, whose stars twinkle with
// the treble, and an arc floor lamp whose warm pool of light breathes gently with the bass.
import React, { useRef } from "react";
import { useFrame, useRoom } from "../runtime";

const SKIES = {
    dusk: ["#1c1d4b", "#5b3570", "#c9607a", "#f6a26b"],
    night: ["#05081a", "#0d1433", "#1a2752", "#2b3a6b"],
};

// Fixed star positions so every window looks the same each time it is drawn
const STARS = Array.from({ length: 34 }, (_, i) => ({
    x: (i * 67 + 13) % 340 + 10,
    y: (i * 41 + 7) % 150 + 8,
    r: i % 5 === 0 ? 1.6 : 1,
}));

// A distant skyline: [x, width, height]
const TOWERS = [
    [0, 40, 70], [38, 26, 104], [62, 44, 58], [104, 22, 132], [124, 50, 84], [172, 30, 112],
    [200, 46, 66], [244, 24, 146], [266, 40, 90], [304, 30, 120], [332, 28, 72],
];

function Window({ item }) {
    const { theme } = useRoom();
    const { sky, curtains, curtainColour } = item.props;
    const stars = useRef(null);
    const twinkle = useRef(0);
    useFrame((levels, dt) => {
        if (!stars.current) return;
        twinkle.current += dt;
        const lift = 0.45 + levels.treble * 0.55;
        stars.current.childNodes.forEach((s, i) => {
            s.setAttribute("opacity", (lift * (0.6 + 0.4 * Math.sin(twinkle.current * (1.3 + (i % 4) * 0.4) + i))).toFixed(2));
        });
    });
    const colours = SKIES[sky] || SKIES.dusk;
    const id = `win-${item.id}`;
    return (
        <svg viewBox="0 0 360 300" className="h-full w-full overflow-visible">
            <defs>
                <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
                    {colours.map((c, i) => <stop key={i} offset={i / (colours.length - 1)} stopColor={c} />)}
                </linearGradient>
                <clipPath id={`${id}-pane`}>
                    <rect x="14" y="14" width="332" height="262" />
                </clipPath>
            </defs>
            {/* Light from outside spilling onto the wall */}
            <rect x="-20" y="-10" width="400" height="320" rx="20" fill={colours[3]} opacity="0.08" />
            <rect x="0" y="0" width="360" height="290" rx="4" fill={theme.wood} />
            <g clipPath={`url(#${id}-pane)`}>
                <rect x="14" y="14" width="332" height="262" fill={`url(#${id}-sky)`} />
                <g ref={stars}>
                    {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff7e0" opacity="0.6" />)}
                </g>
                <circle cx="282" cy="62" r="18" fill="#fff2cc" opacity={sky === "night" ? 0.95 : 0.7} />
                <circle cx="289" cy="56" r="16" fill={colours[sky === "night" ? 0 : 1]} opacity={sky === "night" ? 0.9 : 0} />
                {TOWERS.map(([x, w, h], i) => (
                    <g key={i}>
                        <rect x={14 + x} y={276 - h} width={w} height={h} fill="#0b0b18" />
                        {Array.from({ length: Math.floor(h / 18) }, (_, r) =>
                            (i + r) % 3 !== 0 ? <rect key={r} x={14 + x + 6} y={276 - h + 8 + r * 18} width={w - 12 > 6 ? 5 : 3} height="5" fill="#ffd27a" opacity={0.35 + ((i * 7 + r) % 5) / 10} /> : null
                        )}
                    </g>
                ))}
            </g>
            {/* Glazing bars and sill */}
            <rect x="176" y="14" width="8" height="262" fill={theme.wood} />
            <rect x="14" y="140" width="332" height="7" fill={theme.wood} />
            <rect x="-12" y="284" width="384" height="14" rx="3" fill={theme.wood} />
            <rect x="-12" y="284" width="384" height="4" fill="rgba(255,255,255,0.1)" />
            {curtains && (
                <>
                    <path d="M -34 -14 L 50 -14 Q 34 150 56 296 L -34 296 Z" fill={curtainColour} />
                    <path d="M 394 -14 L 310 -14 Q 326 150 304 296 L 394 296 Z" fill={curtainColour} />
                    <path d="M -6 -14 Q 4 150 -4 296 M 22 -14 Q 14 150 26 296 M 366 -14 Q 356 150 364 296 M 338 -14 Q 346 150 334 296" stroke="rgba(0,0,0,0.25)" strokeWidth="5" fill="none" />
                    <rect x="-44" y="-22" width="448" height="9" rx="4" fill="#1c1410" />
                </>
            )}
        </svg>
    );
}

function FloorLamp({ item }) {
    const { colour, finish } = item.props;
    const glow = useRef(null);
    useFrame((levels) => {
        if (glow.current) glow.current.setAttribute("opacity", (0.7 + levels.bass * 0.3).toFixed(2));
    });
    const metal = finish === "black" ? "#1d1d20" : "#b8914a";
    const id = `lamp-${item.id}`;
    return (
        <svg viewBox="0 0 260 420" className="h-full w-full overflow-visible">
            <defs>
                <radialGradient id={`${id}-pool`} cx="0.5" cy="0" r="1">
                    <stop offset="0" stopColor={colour} stopOpacity="0.55" />
                    <stop offset="0.6" stopColor={colour} stopOpacity="0.12" />
                    <stop offset="1" stopColor={colour} stopOpacity="0" />
                </radialGradient>
            </defs>
            <g ref={glow} opacity="0.8">
                <path d="M 196 112 L 120 420 L 290 420 L 228 112 Z" fill={`url(#${id}-pool)`} />
                <ellipse cx="212" cy="104" rx="70" ry="40" fill={colour} opacity="0.18" />
            </g>
            <path d="M 46 402 Q 30 60 212 70" stroke={metal} strokeWidth="6" fill="none" strokeLinecap="round" />
            <path d="M 180 74 Q 212 40 244 74 Z" fill={metal} />
            <ellipse cx="212" cy="76" rx="32" ry="6" fill={colour} opacity="0.9" />
            <ellipse cx="46" cy="406" rx="40" ry="10" fill={metal} />
            <ellipse cx="46" cy="403" rx="40" ry="6" fill="rgba(255,255,255,0.12)" />
        </svg>
    );
}

export const WindowItem = {
    type: "window",
    label: "Window",
    size: () => ({ w: 360, h: 300 }),
    defaults: { sky: "dusk", curtains: true, curtainColour: "#5a2235" },
    fields: [
        { key: "sky", label: "Sky", type: "select", options: [{ value: "dusk", label: "Dusk" }, { value: "night", label: "Night" }] },
        { key: "curtains", label: "Curtains", type: "toggle" },
        { key: "curtainColour", label: "Curtain colour", type: "colour", show: (p) => p.curtains },
    ],
    Component: Window,
};

export const FloorLampItem = {
    type: "floorLamp",
    label: "Floor lamp",
    size: () => ({ w: 260, h: 420 }),
    defaults: { colour: "#ffb866", finish: "brass" },
    fields: [
        { key: "colour", label: "Light", type: "colour" },
        { key: "finish", label: "Finish", type: "select", options: [{ value: "brass", label: "Brass" }, { value: "black", label: "Black" }] },
    ],
    Component: FloorLamp,
};
