// A miniature of the Retro mode rack: two backlit VU meters and a ten-band analyser that
// follow the music, in the colours chosen for Retro mode.
import React, { useRef } from "react";
import { useFrame, useRoom } from "../runtime";

function Meter({ needleRef, face, ink }) {
    return (
        <svg viewBox="0 0 100 60" className="h-full w-full">
            <rect x="0" y="0" width="100" height="60" rx="4" fill={face} />
            <path d="M 14 46 A 44 44 0 0 1 86 46" fill="none" stroke={ink} strokeWidth="2" />
            <path d="M 68 32 A 44 44 0 0 1 86 46" fill="none" stroke="#b3261e" strokeWidth="4" />
            <text x="50" y="40" textAnchor="middle" fontSize="11" fontWeight="700" fill={ink}>VU</text>
            <line ref={needleRef} x1="50" y1="64" x2="50" y2="14" stroke="#111" strokeWidth="1.6" style={{ transformOrigin: "50px 64px" }} />
        </svg>
    );
}

function HifiRack() {
    const { retro } = useRoom();
    const needles = [useRef(null), useRef(null)];
    const bars = useRef([]);
    useFrame((levels) => {
        [levels.left, levels.right].forEach((v, i) => {
            needles[i].current?.setAttribute("transform", `rotate(${-48 + v * 96} 50 64)`);
        });
        bars.current.forEach((el, i) => el && (el.style.height = `${8 + levels.bands[i] * 88}%`));
    });
    return (
        <div className="flex h-full w-full flex-col gap-[6%] rounded-[5px] p-[4%]" style={{ background: "linear-gradient(#18181b, #0b0b0d)", boxShadow: "0 14px 22px rgba(0,0,0,0.45)" }}>
            <div className="flex flex-1 gap-[5%]">
                <Meter needleRef={needles[0]} face={retro.lamp.face} ink={retro.lamp.ink} />
                <Meter needleRef={needles[1]} face={retro.lamp.face} ink={retro.lamp.ink} />
            </div>
            <div className="flex h-[38%] items-end gap-[3%] rounded-[3px] bg-black px-[4%] py-[3%]">
                {Array.from({ length: 10 }, (_, i) => (
                    <div
                        key={i}
                        ref={(el) => (bars.current[i] = el)}
                        className="flex-1 rounded-[1px]"
                        style={{
                            height: "8%",
                            background: `repeating-linear-gradient(to top, ${retro.display.on} 0 3px, transparent 3px 5px)`,
                            boxShadow: `0 0 6px ${retro.display.on}88`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

export default {
    type: "hifiRack",
    label: "Hi-fi rack",
    size: () => ({ w: 260, h: 150 }),
    defaults: {},
    fields: [],
    Component: HifiRack,
};
