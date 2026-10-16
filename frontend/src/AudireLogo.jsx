// frontend/src/AudireLogo.jsx
// The Audire wordmark as SVG, animated with GSAP: the waveform breathes when idle and
// dances to the music while playing, with a drifting gradient and an occasional shimmer
// across the name. Animation is skipped when the system asks for reduced motion.
import React, { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { useAudioPlayer } from "./AudioPlayerContext";

// Frequency bands (FFT bin ranges at fftSize 256) that drive each waveform shape, left to right
const BANDS = [
    [40, 80], // dot: treble
    [12, 30], // bar: mids
    [1, 4], // tall bar: bass
    [5, 11], // bar: low mids
    [40, 80], // dot: treble
];

export default function AudireLogo({ className = "" }) {
    const { isPlaying, getAudioGraph } = useAudioPlayer();
    const root = useRef(null);
    const shapes = useRef([]);
    const anim = useRef({ reduced: true });

    useLayoutEffect(() => {
        const mm = gsap.matchMedia();
        mm.add("(prefers-reduced-motion: no-preference)", () => {
            const [dotL, bar1, tall, bar2, dotR] = shapes.current;
            const bars = [bar1, tall, bar2];
            const dots = [dotL, dotR];
            gsap.set([...bars, ...dots], { transformOrigin: "50% 50%" });

            // Idle: bars breathe outwards from the centre, dots pulse
            const idle = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut", duration: 1.1 } });
            idle.to(tall, { scaleY: 0.62 }, 0)
                .to([bar1, bar2], { scaleY: 1.18, stagger: 0.15 }, 0.2)
                .to(dots, { scale: 1.35, stagger: 0.15 }, 0.35);

            // The waveform gradient slowly turns; a highlight sweeps across the name now and then
            gsap.to("#audire-wave-gradient", { attr: { gradientTransform: "rotate(360 86 86)" }, duration: 9, ease: "none", repeat: -1 });
            gsap.fromTo(
                "#audire-text-gradient",
                { attr: { x1: -420, x2: -120 } },
                { attr: { x1: 680, x2: 980 }, duration: 2.4, ease: "power2.inOut", repeat: -1, repeatDelay: 6, delay: 1.5 }
            );

            anim.current = { reduced: false, idle };
            return () => {
                anim.current = { reduced: true };
            };
        });
        return () => mm.revert();
    }, []);

    // While playing, read the music's frequency bands every frame and size the shapes from them
    useEffect(() => {
        const a = anim.current;
        if (a.reduced || !isPlaying) return;
        const { audioContext, sourceNode } = getAudioGraph();
        if (!sourceNode) return;
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        sourceNode.connect(analyser); // tapped before volume, so it still moves when quiet
        const bins = new Uint8Array(analyser.frequencyBinCount);
        // quickTo drives single properties, so the dots get separate scaleX/scaleY setters
        const setters = shapes.current.map((el, i) => {
            const props = i === 0 || i === 4 ? ["scaleX", "scaleY"] : ["scaleY"];
            const fns = props.map((p) => gsap.quickTo(el, p, { duration: 0.16, ease: "power2.out" }));
            return (v) => fns.forEach((fn) => fn(v));
        });

        a.idle.pause();
        const tick = () => {
            analyser.getByteFrequencyData(bins);
            BANDS.forEach(([from, to], i) => {
                let sum = 0;
                for (let b = from; b <= to; b++) sum += bins[b];
                const level = sum / ((to - from + 1) * 255);
                const isDot = i === 0 || i === 4;
                setters[i](isDot ? 0.8 + level * 1.6 : 0.35 + level * 0.95);
            });
        };
        gsap.ticker.add(tick);
        return () => {
            gsap.ticker.remove(tick);
            sourceNode.disconnect(analyser);
            // Settle back to the logo's shape, then carry on breathing
            gsap.to(shapes.current, {
                scale: 1,
                scaleY: 1,
                duration: 0.6,
                ease: "power2.out",
                overwrite: true,
                onComplete: () => a.idle.invalidate().restart(),
            });
        };
    }, [isPlaying]);

    const shape = (i) => (el) => (shapes.current[i] = el);

    return (
        <svg ref={root} viewBox="0 0 632 172" className={className} role="img" aria-label="Audire">
            <defs>
                <linearGradient id="audire-wave-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="172" y2="172" gradientTransform="rotate(0 86 86)">
                    <stop offset="0" stopColor="#a5b4fc" />
                    <stop offset="0.35" stopColor="#818cf8" />
                    <stop offset="0.65" stopColor="#a78bfa" />
                    <stop offset="1" stopColor="#7dd3fc" />
                </linearGradient>
                <linearGradient id="audire-text-gradient" gradientUnits="userSpaceOnUse" x1="-420" y1="0" x2="-120" y2="0">
                    <stop offset="0" stopColor="#e2e8f0" />
                    <stop offset="0.42" stopColor="#e2e8f0" />
                    <stop offset="0.5" stopColor="#c7d2fe" />
                    <stop offset="0.58" stopColor="#e2e8f0" />
                    <stop offset="1" stopColor="#e2e8f0" />
                </linearGradient>
            </defs>
            <g fill="url(#audire-wave-gradient)">
                <rect ref={shape(0)} x="2" y="78" width="16" height="16" rx="8" />
                <rect ref={shape(1)} x="40" y="38" width="16" height="96" rx="8" />
                <rect ref={shape(2)} x="79" y="4" width="16" height="164" rx="8" />
                <rect ref={shape(3)} x="118" y="38" width="16" height="96" rx="8" />
                <rect ref={shape(4)} x="156" y="78" width="16" height="16" rx="8" />
            </g>
            <text
                x="200"
                y="134"
                fill="url(#audire-text-gradient)"
                fontFamily="'Plus Jakarta Sans Variable', ui-sans-serif, system-ui, sans-serif"
                fontSize="140"
                fontWeight="500"
                letterSpacing="-2"
            >
                Audire
            </text>
        </svg>
    );
}
