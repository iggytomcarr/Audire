// frontend/src/PlayerBar.jsx
// The player bar along the bottom of every view. Drag its top edge up to expand it into a
// larger now-playing panel with the queue; double-click the handle to toggle.
import React, { useEffect, useRef, useState } from "react";
import { SkipBack, Play, Pause, SkipForward, Volume2, Loader2 } from "lucide-react";
import { useAudioPlayer, formatTime } from "./AudioPlayerContext";

const COMPACT = 76;
const EXPANDED_FROM = 170; // heights below this snap back to compact
const DEFAULT_EXPANDED = 420;

function readHeight() {
    try {
        const h = Number(localStorage.getItem("audire.playerHeight"));
        return h >= COMPACT ? h : COMPACT;
    } catch {
        return COMPACT;
    }
}

const maxHeight = () => Math.round(window.innerHeight * 0.85);

export default function PlayerBar({ playingAlbum, onOpenAlbum, onHeightChange }) {
    const {
        currentTrack, isPlaying, isLoading, currentTime, duration, error, volume, setVolume,
        togglePlayPause, next, previous, seek, hasNext, queue, queueIndex, playQueue,
    } = useAudioPlayer();
    const [height, setHeight] = useState(() => Math.min(readHeight(), maxHeight()));
    const [dragging, setDragging] = useState(false);
    const lastExpanded = useRef(height > COMPACT ? height : DEFAULT_EXPANDED);
    const drag = useRef(null);
    const queueRef = useRef(null);

    const expanded = height >= EXPANDED_FROM;

    useEffect(() => {
        onHeightChange?.(height);
        if (dragging) return;
        try {
            localStorage.setItem("audire.playerHeight", String(height));
        } catch {
            // remembering the size is a convenience only
        }
    }, [height, dragging]);

    useEffect(() => {
        const onResize = () => setHeight((h) => Math.min(h, maxHeight()));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // Keep the playing track visible in the queue
    useEffect(() => {
        queueRef.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: "nearest" });
    }, [queueIndex, expanded]);

    const onPointerDown = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { startY: e.clientY, startHeight: height };
        setDragging(true);
    };
    const onPointerMove = (e) => {
        if (!drag.current) return;
        const h = drag.current.startHeight + (drag.current.startY - e.clientY);
        setHeight(Math.max(COMPACT, Math.min(maxHeight(), Math.round(h))));
    };
    const onPointerUp = () => {
        if (!drag.current) return;
        drag.current = null;
        setDragging(false);
        setHeight((h) => {
            if (h < EXPANDED_FROM) return COMPACT;
            lastExpanded.current = h;
            return h;
        });
    };
    const toggle = () => setHeight((h) => (h >= EXPANDED_FROM ? COMPACT : Math.min(lastExpanded.current, maxHeight())));

    const cover = (size) => (
        <div
            className={`shrink-0 overflow-hidden rounded-lg border border-slate-800 ${playingAlbum && !playingAlbum.coverImage ? `bg-gradient-to-br ${playingAlbum.colors}` : "bg-slate-900"}`}
            style={{ width: size, height: size }}
        >
            {playingAlbum?.coverImage && <img src={playingAlbum.coverImage} alt="" className="h-full w-full object-cover" />}
        </div>
    );

    const status = currentTrack
        ? error || (isLoading ? "Loading… (cloud files download on first play)" : `${currentTrack.artist} — ${currentTrack.album}`)
        : "Select an album to start";

    const transport = (big) => (
        <div className="flex justify-center gap-2">
            <button onClick={previous} disabled={!currentTrack} className={`rounded-lg border border-slate-800 transition hover:bg-slate-800 disabled:opacity-40 ${big ? "px-4 py-3" : "px-3 py-2"}`} title="Previous">
                <SkipBack size={big ? 22 : 20} />
            </button>
            <button
                onClick={togglePlayPause}
                disabled={!currentTrack}
                className={`rounded-lg btn-accent font-semibold transition disabled:opacity-40 ${big ? "px-6 py-3" : "px-4 py-2"}`}
                title={isPlaying ? "Pause" : "Play"}
            >
                {isLoading && !isPlaying ? (
                    <Loader2 size={big ? 22 : 20} className="animate-spin" />
                ) : isPlaying ? (
                    <Pause size={big ? 22 : 20} fill="currentColor" />
                ) : (
                    <Play size={big ? 22 : 20} fill="currentColor" />
                )}
            </button>
            <button onClick={next} disabled={!hasNext} className={`rounded-lg border border-slate-800 transition hover:bg-slate-800 disabled:opacity-40 ${big ? "px-4 py-3" : "px-3 py-2"}`} title="Next">
                <SkipForward size={big ? 22 : 20} />
            </button>
        </div>
    );

    const seekBar = (wide) => (
        <div className="flex min-w-0 items-center gap-3">
            <span className="w-10 text-right text-xs tabular-nums text-slate-400">{formatTime(currentTime)}</span>
            <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(currentTime, duration || 0)}
                onChange={(e) => seek(Number(e.target.value))}
                disabled={!duration}
                className={`accent-indigo-400 ${wide ? "flex-1" : "w-full md:w-48"}`}
                aria-label="Seek"
            />
            <span className="w-10 text-xs tabular-nums text-slate-400">{formatTime(duration)}</span>
        </div>
    );

    const volumeControl = (
        <div className="flex items-center gap-2">
            <Volume2 size={16} className="shrink-0 text-slate-400" />
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-24 accent-indigo-400" aria-label="Volume" />
        </div>
    );

    const coverSize = Math.max(96, Math.min(height - 72, 340));

    return (
        <footer
            className={`fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/85 backdrop-blur ${dragging ? "" : "transition-[height] duration-200"}`}
            style={{ height }}
        >
            {/* Drag handle */}
            <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={toggle}
                className="group absolute inset-x-0 -top-1.5 z-10 flex h-4 cursor-ns-resize touch-none justify-center"
                title="Drag to resize · double-click to expand or collapse"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize player"
            >
                <span className={`mt-1 h-1 w-12 rounded-full transition ${dragging ? "bg-indigo-400" : "bg-slate-600 group-hover:bg-slate-400"}`} />
            </div>

            {expanded ? (
                <div className="mx-auto flex h-full max-w-7xl gap-6 px-6 pb-5 pt-6">
                    <button onClick={() => playingAlbum && onOpenAlbum(playingAlbum)} className="self-center" title={playingAlbum ? "Open album" : undefined}>
                        {cover(coverSize)}
                    </button>

                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-4">
                        <div className="min-w-0">
                            <div className="truncate text-3xl font-extrabold tracking-tight">{currentTrack?.title || "Nothing playing"}</div>
                            <button
                                onClick={() => playingAlbum && onOpenAlbum(playingAlbum)}
                                className={`mt-1 max-w-full truncate text-left text-base ${error ? "text-rose-400" : "text-slate-400 hover:text-slate-200"}`}
                            >
                                {status}
                            </button>
                        </div>
                        {seekBar(true)}
                        <div className="flex items-center justify-between gap-4">
                            <div className="w-28" />
                            {transport(true)}
                            <div className="flex w-28 justify-end">{volumeControl}</div>
                        </div>
                    </div>

                    {queue.length > 0 && (
                        <div className="hidden w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 lg:flex">
                            <div className="border-b border-slate-800 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                                Up next · {queue.length - queueIndex - 1}
                            </div>
                            <ol ref={queueRef} className="flex-1 overflow-y-auto py-1 text-sm">
                                {queue.map((t, i) => (
                                    <li key={t.path} data-current={i === queueIndex}>
                                        <button
                                            onClick={() => playQueue(queue, i)}
                                            className={`flex w-full items-center gap-3 px-4 py-1.5 text-left hover:bg-slate-800/60 ${i === queueIndex ? "text-indigo-300" : i < queueIndex ? "text-slate-500" : "text-slate-200"}`}
                                        >
                                            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-500">
                                                {i === queueIndex && isPlaying ? <Volume2 size={12} className="ml-auto text-indigo-300" /> : i + 1}
                                            </span>
                                            <span className="truncate">{t.title}</span>
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                </div>
            ) : (
                <div className="mx-auto grid h-full max-w-7xl grid-cols-1 items-center gap-3 px-4 py-3 md:grid-cols-3">
                    <div
                        className={`flex min-w-0 items-center gap-3 ${playingAlbum ? "cursor-pointer" : ""}`}
                        onClick={() => playingAlbum && onOpenAlbum(playingAlbum)}
                    >
                        {cover(40)}
                        <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{currentTrack?.title || "Nothing playing"}</div>
                            <div className={`truncate text-xs ${error ? "text-rose-400" : "text-slate-400"}`}>{status}</div>
                        </div>
                    </div>
                    {transport(false)}
                    <div className="flex items-center gap-3 md:justify-end">
                        {seekBar(false)}
                        {volumeControl}
                    </div>
                </div>
            )}
        </footer>
    );
}
