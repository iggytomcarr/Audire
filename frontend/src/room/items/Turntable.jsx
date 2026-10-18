// A turntable that spins at 33⅓ while music plays, with the playing album's cover as the
// record label and the tonearm swinging onto the record.
import React from "react";
import { useRoom } from "../runtime";

// Geometry in the item's own 300 × 110 space
const RECORD = { left: 24, size: 192, cy: 60, squash: 0.4 };
const PIVOT = { x: 270, y: 26 };
const ARM = 80;
const REST_DEG = 108.7; // arm direction at rest, beside the platter
const PLAY_SWING = 46.5; // swing that puts the stylus on the record

function Turntable({ item }) {
    const { playingAlbum, isPlaying } = useRoom();
    const silver = item.props.finish === "silver";
    const end = { x: PIVOT.x + ARM * Math.cos((REST_DEG * Math.PI) / 180), y: PIVOT.y + ARM * Math.sin((REST_DEG * Math.PI) / 180) };
    return (
        <div className="relative h-full w-full">
            {/* Plinth */}
            <div
                className="absolute inset-x-0 bottom-0 top-[24%] rounded-[6px]"
                style={{ background: silver ? "linear-gradient(#e2e2e6, #a3a3a9)" : "linear-gradient(#2e2e31, #121214)", boxShadow: "0 12px 18px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,255,255,0.12)" }}
            >
                <div className="absolute bottom-[12%] left-[4%] h-2 w-2 rounded-full" style={{ background: isPlaying ? "#4ade80" : "#7f1d1d" }} />
            </div>
            {/* Platter and record, squashed to look like they are seen from above at an angle */}
            <div
                className="absolute"
                style={{ left: RECORD.left, top: RECORD.cy - RECORD.size / 2, width: RECORD.size, height: RECORD.size, transform: `scaleY(${RECORD.squash})` }}
            >
                <div className="absolute inset-0 rounded-full" style={{ background: "#3a3a3d", boxShadow: "0 6px 0 #1a1a1c" }} />
                <div
                    className="absolute inset-[3%] rounded-full"
                    style={{
                        background: "repeating-radial-gradient(circle, #0c0c0c 0 2px, #1b1b1b 2px 3px)",
                        animation: "room-spin 1.8s linear infinite",
                        animationPlayState: isPlaying ? "running" : "paused",
                    }}
                >
                    <div className="absolute inset-[33%] overflow-hidden rounded-full ring-2 ring-black/60">
                        {playingAlbum?.coverImage ? (
                            <img src={playingAlbum.coverImage} alt="" className="h-full w-full object-cover" draggable={false} />
                        ) : (
                            <div className="h-full w-full" style={{ background: "#c2410c" }} />
                        )}
                    </div>
                    <div className="absolute left-1/2 top-1/2 h-[4%] w-[4%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-300" />
                </div>
            </div>
            {/* Tonearm */}
            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 300 110" preserveAspectRatio="none">
                <circle cx={PIVOT.x} cy={PIVOT.y} r="9" fill="#9a9aa0" />
                <g style={{ transform: `rotate(${isPlaying ? PLAY_SWING : 0}deg)`, transformOrigin: `${PIVOT.x}px ${PIVOT.y}px`, transition: "transform 1.2s ease-in-out" }}>
                    <line x1={PIVOT.x} y1={PIVOT.y} x2={end.x} y2={end.y} stroke="#c9c9cf" strokeWidth="4" strokeLinecap="round" />
                    <rect x={end.x - 7} y={end.y - 4} width="14" height="8" rx="2" fill="#2a2a2a" transform={`rotate(${REST_DEG - 90} ${end.x} ${end.y})`} />
                </g>
            </svg>
        </div>
    );
}

export default {
    type: "turntable",
    label: "Turntable",
    size: () => ({ w: 300, h: 110 }),
    defaults: { finish: "black" },
    fields: [{ key: "finish", label: "Finish", type: "select", options: [{ value: "black", label: "Black" }, { value: "silver", label: "Silver" }] }],
    Component: Turntable,
};
