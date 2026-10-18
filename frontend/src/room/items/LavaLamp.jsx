// A lava lamp: slow blobs rising and falling in a glowing glass, merged by a "gooey" filter.
import React from "react";

const BLOBS = [
    { r: 9, dur: 17, values: "150;60;150", x: 34 },
    { r: 7, dur: 23, values: "120;40;120", x: 28 },
    { r: 6, dur: 13, values: "160;90;160", x: 40 },
    { r: 11, dur: 29, values: "168;150;168", x: 34 },
];

function LavaLamp({ item }) {
    const { colour } = item.props;
    const id = `lava-${item.id}`;
    return (
        <svg viewBox="0 0 70 200" className="h-full w-full overflow-visible">
            <defs>
                <filter id={`${id}-goo`}>
                    <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
                    <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
                </filter>
                <clipPath id={`${id}-glass`}>
                    <path d="M 22 176 Q 14 110 24 46 L 46 46 Q 56 110 48 176 Z" />
                </clipPath>
                <radialGradient id={`${id}-glow`}>
                    <stop offset="0" stopColor={colour} stopOpacity="0.45" />
                    <stop offset="1" stopColor={colour} stopOpacity="0" />
                </radialGradient>
            </defs>
            <ellipse cx="35" cy="110" rx="60" ry="90" fill={`url(#${id}-glow)`} />
            <path d="M 22 176 Q 14 110 24 46 L 46 46 Q 56 110 48 176 Z" fill="#2a1430" opacity="0.92" />
            <g clipPath={`url(#${id}-glass)`} filter={`url(#${id}-goo)`}>
                {BLOBS.map((b, i) => (
                    <circle key={i} cx={b.x} cy="150" r={b.r} fill={colour}>
                        <animate attributeName="cy" values={b.values} dur={`${b.dur}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1" />
                    </circle>
                ))}
            </g>
            <path d="M 24 46 L 28 26 L 42 26 L 46 46 Z" fill="#b5b5bb" />
            <path d="M 18 176 L 52 176 L 58 198 L 12 198 Z" fill="#b5b5bb" />
            <path d="M 27 52 Q 22 110 27 168" stroke="#fff" strokeOpacity="0.25" strokeWidth="2" fill="none" />
        </svg>
    );
}

export default {
    type: "lavaLamp",
    label: "Lava lamp",
    size: () => ({ w: 70, h: 200 }),
    defaults: { colour: "#ff6a3d" },
    fields: [{ key: "colour", label: "Colour", type: "colour" }],
    Component: LavaLamp,
};
