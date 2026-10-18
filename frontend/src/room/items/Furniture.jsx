// Furniture and decor: a sideboard for the turntable and rack, a lounge chair, a rug and a plant.
import React from "react";
import { useRoom } from "../runtime";

function Sideboard() {
    const { theme } = useRoom();
    return (
        <div className="flex h-full w-full flex-col rounded-[4px]" style={{ background: theme.wood, boxShadow: "0 18px 26px rgba(0,0,0,0.4), inset 0 3px 0 rgba(255,255,255,0.08)" }}>
            <div className="grid flex-1 grid-cols-3 gap-[2%] p-[3%]">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-[2px]" style={{ background: "rgba(0,0,0,0.22)", boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.25)" }} />
                ))}
            </div>
            <div className="flex justify-between px-[6%]">
                <div className="h-3 w-2 rounded-b bg-black/60" />
                <div className="h-3 w-2 rounded-b bg-black/60" />
            </div>
        </div>
    );
}

function Armchair({ item }) {
    const { colour } = item.props;
    return (
        <svg viewBox="0 0 300 260" className="h-full w-full overflow-visible">
            <ellipse cx="150" cy="248" rx="120" ry="10" fill="rgba(0,0,0,0.3)" />
            <path d="M 70 40 Q 60 20 90 18 L 190 22 Q 214 24 208 52 L 196 150 L 84 150 Z" fill={colour} />
            <path d="M 70 40 Q 60 20 90 18 L 190 22 Q 214 24 208 52 L 196 150 L 84 150 Z" fill="rgba(0,0,0,0.18)" transform="translate(6 4)" style={{ mixBlendMode: "multiply" }} />
            <path d="M 50 150 Q 46 120 80 118 L 230 118 Q 262 120 258 150 L 252 186 Q 250 196 236 196 L 66 196 Q 54 196 52 186 Z" fill={colour} />
            <path d="M 40 130 Q 30 128 30 142 L 34 192 L 62 192 L 64 140 Q 60 128 40 130 Z" fill="#2a1d14" />
            <path d="M 268 130 Q 278 128 278 142 L 274 192 L 246 192 L 244 140 Q 248 128 268 130 Z" fill="#2a1d14" />
            <rect x="140" y="196" width="20" height="30" fill="#2a2a2a" />
            <path d="M 150 226 L 90 246 M 150 226 L 210 246 M 150 226 L 150 250" stroke="#2a2a2a" strokeWidth="8" strokeLinecap="round" />
        </svg>
    );
}

function Rug({ item }) {
    const { colour, pattern } = item.props;
    const id = `rug-${item.id}`;
    return (
        <svg viewBox="0 0 760 140" className="h-full w-full overflow-visible" preserveAspectRatio="none">
            <defs>
                <pattern id={id} width="40" height="20" patternUnits="userSpaceOnUse">
                    {pattern === "stripes" ? (
                        <rect width="20" height="20" fill="rgba(255,255,255,0.14)" />
                    ) : (
                        <path d="M 0 10 L 10 0 L 20 10 L 10 20 Z M 20 10 L 30 0 L 40 10 L 30 20 Z" fill="rgba(255,240,210,0.18)" />
                    )}
                </pattern>
            </defs>
            {pattern === "round" ? (
                <ellipse cx="380" cy="70" rx="370" ry="66" fill={colour} stroke="rgba(255,240,210,0.4)" strokeWidth="6" />
            ) : (
                <>
                    <path d="M 70 6 L 690 6 L 754 134 L 6 134 Z" fill={colour} />
                    <path d="M 70 6 L 690 6 L 754 134 L 6 134 Z" fill={`url(#${id})`} />
                    <path d="M 96 22 L 664 22 L 712 118 L 48 118 Z" fill="none" stroke="rgba(255,240,210,0.35)" strokeWidth="4" />
                </>
            )}
        </svg>
    );
}

function Plant() {
    return (
        <svg viewBox="0 0 140 260" className="h-full w-full overflow-visible">
            {[[-24, 150], [-10, 175], [4, 190], [16, 165], [28, 140], [-34, 120], [36, 110]].map(([lean, h], i) => (
                <path key={i} d={`M ${70 + i * 2 - 6} 196 Q ${70 + lean * 0.6} ${196 - h * 0.6} ${70 + lean} ${196 - h} Q ${74 + lean * 0.5} ${196 - h * 0.5} ${78 + i * 2 - 6} 196 Z`} fill={i % 2 ? "#3f7d3a" : "#5c9e4a"} stroke="#d6e98a" strokeWidth="1.2" strokeOpacity="0.6" />
            ))}
            <path d="M 34 192 L 106 192 L 98 254 L 42 254 Z" fill="#b5653a" />
            <rect x="30" y="186" width="80" height="12" rx="3" fill="#c97546" />
        </svg>
    );
}

export const SideboardItem = { type: "sideboard", label: "Sideboard", size: () => ({ w: 460, h: 160 }), defaults: {}, fields: [], Component: Sideboard };

export const ArmchairItem = {
    type: "armchair",
    label: "Lounge chair",
    size: () => ({ w: 300, h: 260 }),
    defaults: { colour: "#8a5a32" },
    fields: [{ key: "colour", label: "Leather", type: "colour" }],
    Component: Armchair,
};

export const RugItem = {
    type: "rug",
    label: "Rug",
    size: () => ({ w: 760, h: 140 }),
    defaults: { colour: "#7a2e2a", pattern: "persian" },
    fields: [
        { key: "colour", label: "Colour", type: "colour" },
        {
            key: "pattern",
            label: "Pattern",
            type: "select",
            options: [
                { value: "persian", label: "Persian" },
                { value: "stripes", label: "Stripes" },
                { value: "round", label: "Round" },
            ],
        },
    ],
    Component: Rug,
};

export const PlantItem = { type: "plant", label: "Plant", size: () => ({ w: 140, h: 260 }), defaults: {}, fields: [], Component: Plant };
