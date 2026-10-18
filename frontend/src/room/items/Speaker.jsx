// A floor-standing speaker whose woofer pumps with the bass.
import React, { useRef } from "react";
import { useFrame, useRoom } from "../runtime";

const FINISHES = {
    walnut: { body: "linear-gradient(90deg, #5a3b22, #7a5233 50%, #5a3b22)", baffle: "#1b1714" },
    black: { body: "linear-gradient(90deg, #141414, #232323 50%, #141414)", baffle: "#0b0b0b" },
    oak: { body: "linear-gradient(90deg, #b68a56, #d2a872 50%, #b68a56)", baffle: "#24201b" },
};

function Driver({ size, coneRef }) {
    return (
        <div className="relative rounded-full" style={{ width: size, height: size, background: "radial-gradient(circle, #3a3a3a, #0d0d0d 70%)", boxShadow: "0 0 0 3px #8e8e8e, inset 0 0 8px #000" }}>
            <div ref={coneRef} className="absolute inset-[22%] rounded-full" style={{ background: "radial-gradient(circle at 40% 35%, #5a5a5a, #161616 70%)" }} />
        </div>
    );
}

function Speaker({ item }) {
    const finish = FINISHES[item.props.finish] || FINISHES.walnut;
    const woofer = useRef(null);
    const tweeter = useRef(null);
    useFrame((levels) => {
        if (woofer.current) woofer.current.style.transform = `scale(${1 + levels.bass * 0.12})`;
        if (tweeter.current) tweeter.current.style.transform = `scale(${1 + levels.treble * 0.08})`;
    });
    return (
        <div className="flex h-full w-full flex-col items-center justify-around rounded-[4px] p-[10%]" style={{ background: finish.body, boxShadow: "0 18px 26px rgba(0,0,0,0.45)" }}>
            <div className="flex w-full flex-1 flex-col items-center justify-around rounded-[3px] py-[12%]" style={{ background: finish.baffle }}>
                <Driver size={34} coneRef={tweeter} />
                <Driver size={78} coneRef={woofer} />
                <div className="h-3 w-8 rounded-full bg-black/80" />
            </div>
        </div>
    );
}

export default {
    type: "speaker",
    label: "Speaker",
    size: () => ({ w: 130, h: 300 }),
    defaults: { finish: "walnut" },
    fields: [
        {
            key: "finish",
            label: "Finish",
            type: "select",
            options: [
                { value: "walnut", label: "Walnut" },
                { value: "black", label: "Black" },
                { value: "oak", label: "Oak" },
            ],
        },
    ],
    Component: Speaker,
};
