// frontend/src/room/RoomView.jsx
// The Room layout of the library: a listening room whose objects (shelves, turntable, rack,
// speakers, frames, lamps, furniture) can be moved, resized and configured, Microsoft Bob style.
// Rooms are saved to %AppData%\Audire\rooms.json; objects come from registry.js.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { useAudioPlayer } from "../AudioPlayerContext";
import { GetPlayStats, LoadRooms, LoadVisualSettings, SaveRooms } from "../../wailsjs/go/main/App";
import { RoomContext, createLevels, measure, useCoverColours } from "./runtime";
import { ITEM_TYPES, createItem, itemSize, newItemId } from "./registry";
import { ROOM_THEMES, DEFAULT_THEME } from "./themes";
import { FLOOR_Y, ROOM_H, ROOM_W, defaultRooms, roomFromTemplate } from "./templates";
import { categoryName, shelfFor } from "./categories";
import { displayColours, lampColours, normaliseHex } from "../retro/colours";
import { AddMenu, PropertiesPanel, RoomMenu } from "./EditorPanels";

function Background({ theme }) {
    return (
        <>
            <div className="absolute inset-x-0 top-0" style={{ height: FLOOR_Y, background: `linear-gradient(${theme.wall[0]}, ${theme.wall[1]})` }} />
            {theme.slats && (
                <div className="absolute" style={{ left: 380, top: 40, width: 840, height: 520, background: `repeating-linear-gradient(90deg, ${theme.slats} 0 8px, transparent 8px 22px)`, opacity: 0.55 }} />
            )}
            <div className="absolute left-1/2 top-0 h-[260px] w-[900px] -translate-x-1/2 rounded-b-full" style={{ background: `radial-gradient(ellipse at top, ${theme.light}, transparent 70%)` }} />
            <div className="absolute inset-x-0" style={{ top: FLOOR_Y, bottom: 0, background: `linear-gradient(${theme.floor[0]}, ${theme.floor[1]})` }} />
            <div className="absolute inset-x-0" style={{ top: FLOOR_Y, bottom: 0, background: "repeating-linear-gradient(90deg, rgba(0,0,0,0.06) 0 2px, transparent 2px 120px)" }} />
            <div className="absolute inset-x-0" style={{ top: FLOOR_Y - 8, height: 10, background: theme.skirting }} />
        </>
    );
}

function Crate({ category, albums, onClose, onOpenAlbum, onPlayAlbum }) {
    return (
        <div className="absolute inset-x-6 bottom-4 z-[500] rounded-2xl border border-slate-700/60 bg-slate-950/90 p-4 shadow-2xl backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <div className="text-lg font-bold">{categoryName(category)}</div>
                    <div className="text-xs text-slate-400">{albums.length} {albums.length === 1 ? "album" : "albums"} · click a sleeve to open it</div>
                </div>
                <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close crate"><X size={18} /></button>
            </div>
            {albums.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">Nothing on this shelf yet. Albums are shelved by genre: use Gather info, or pick a Shelf when editing an album.</div>
            ) : (
                <div
                    className={albums.length > 10 ? "grid max-h-[46vh] grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-4 overflow-y-auto pb-2 pr-1" : "flex gap-4 overflow-x-auto pb-2"}
                    style={{ perspective: 900 }}
                >
                    {albums.map((a) => (
                        <div key={a.id} className="group w-36 shrink-0">
                            <button onClick={() => onOpenAlbum(a)} className="relative block aspect-square w-full overflow-hidden rounded-md shadow-lg transition duration-300 group-hover:-translate-y-2 group-hover:[transform:rotateY(-12deg)]">
                                {a.coverImage ? <img src={a.coverImage} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className={`h-full w-full bg-gradient-to-br ${a.colors}`} />}
                            </button>
                            <div className="mt-1.5 flex items-start gap-1">
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-xs font-semibold">{a.title}</div>
                                    <div className="truncate text-[11px] text-slate-400">{a.artist}</div>
                                </div>
                                <button onClick={() => onPlayAlbum(a)} className="btn-accent rounded-full p-1" title={`Play ${a.title}`} aria-label={`Play ${a.title}`}>
                                    <Play size={11} fill="currentColor" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function RoomView({ active, albums, playingAlbum, onOpenAlbum, onPlayAlbum, bottomInset }) {
    const { getAudioGraph, isPlaying, currentTrack } = useAudioPlayer();
    const [state, setState] = useState(null); // { version, activeRoomId, rooms }
    const [stats, setStats] = useState({});
    const [retro, setRetro] = useState({ lamp: lampColours("#f2c06b"), display: displayColours("#8ff6ff") });
    const [editing, setEditing] = useState(false);
    const [selected, setSelected] = useState(null);
    const [crate, setCrate] = useState(null);
    const [scale, setScale] = useState(1);
    const frames = useMemo(() => new Set(), []);
    const wrap = useRef(null);
    const drag = useRef(null);

    // Load rooms (or create the starters), play counts and the Retro colours
    useEffect(() => {
        LoadRooms()
            .then((json) => {
                const parsed = json ? JSON.parse(json) : null;
                setState(parsed?.rooms?.length ? parsed : defaultRooms());
            })
            .catch(() => setState(defaultRooms()));
        LoadVisualSettings()
            .then((v) => setRetro({ lamp: lampColours(normaliseHex(v.retro_lamp, "#f2c06b")), display: displayColours(normaliseHex(v.retro_display, "#8ff6ff")) }))
            .catch(() => {});
    }, []);

    // Play counts change as music plays, so refresh them now and then while the room is shown
    useEffect(() => {
        if (!active) return;
        const load = () => GetPlayStats().then((s) => setStats(s || {})).catch(() => {});
        load();
        const id = setInterval(load, 20000);
        return () => clearInterval(id);
    }, [active, currentTrack?.path]);

    // Save changes after a short pause
    useEffect(() => {
        if (!state) return;
        const id = setTimeout(() => SaveRooms(JSON.stringify(state)).catch((e) => console.error("Failed to save rooms:", e)), 600);
        return () => clearTimeout(id);
    }, [state]);

    // Fit the 1600 × 900 room into the available space
    useEffect(() => {
        if (!wrap.current) return;
        const ro = new ResizeObserver(([e]) => setScale(Math.min(e.contentRect.width / ROOM_W, e.contentRect.height / ROOM_H)));
        ro.observe(wrap.current);
        return () => ro.disconnect();
    }, [state !== null]);

    // One animation loop: measure the music, then let every object update itself
    useEffect(() => {
        if (!active) return;
        const { audioContext, sourceNode } = getAudioGraph();
        const analyser = audioContext ? new AnalyserNode(audioContext, { fftSize: 2048, smoothingTimeConstant: 0.6 }) : null;
        if (analyser) sourceNode.connect(analyser);
        const buffers = analyser && { freq: new Float32Array(analyser.frequencyBinCount), timeL: new Float32Array(analyser.fftSize) };
        const levels = createLevels();
        let raf, last = performance.now();
        const loop = (now) => {
            raf = requestAnimationFrame(loop);
            const dt = Math.min((now - last) / 1000, 0.1);
            last = now;
            if (analyser) measure(analyser, buffers, levels, dt);
            frames.forEach((cb) => cb(levels, dt));
        };
        raf = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(raf);
            if (analyser) try { sourceNode.disconnect(analyser); } catch { /* already gone */ }
        };
    }, [active]);

    const spineColour = useCoverColours(albums);
    const byCategory = useMemo(() => {
        const map = new Map();
        [...albums].sort((a, b) => `${a.artist} ${a.year} ${a.title}`.localeCompare(`${b.artist} ${b.year} ${b.title}`)).forEach((a) => {
            const c = shelfFor(a);
            if (!map.has(c)) map.set(c, []);
            map.get(c).push(a);
        });
        return map;
    }, [albums]);
    const mostPlayed = useMemo(() => albums.filter((a) => stats[a.id]?.plays).sort((a, b) => stats[b.id].plays - stats[a.id].plays), [albums, stats]);

    const room = state?.rooms.find((r) => r.id === state.activeRoomId) || state?.rooms[0];
    const theme = ROOM_THEMES[room?.theme] || ROOM_THEMES[DEFAULT_THEME];

    const updateRoom = useCallback((fn) => setState((s) => ({ ...s, rooms: s.rooms.map((r) => (r.id === s.activeRoomId ? fn(r) : r)) })), []);
    const updateItem = (id, changes) => updateRoom((r) => ({ ...r, items: r.items.map((i) => (i.id === id ? { ...i, ...changes } : i)) }));

    // Drag to move, or drag the corner handle to resize, in room units
    const onItemPointerDown = (e, item, mode) => {
        if (!editing) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setSelected(item.id);
        drag.current = { id: item.id, mode, x0: e.clientX, y0: e.clientY, item, w0: itemSize(item).w };
    };
    const onPointerMove = (e) => {
        const d = drag.current;
        if (!d) return;
        const dx = (e.clientX - d.x0) / scale, dy = (e.clientY - d.y0) / scale;
        if (d.mode === "move") {
            updateItem(d.id, { x: Math.round(Math.max(-200, Math.min(ROOM_W - 40, d.item.x + dx))), y: Math.round(Math.max(-100, Math.min(ROOM_H - 40, d.item.y + dy))) });
        } else {
            updateItem(d.id, { scale: Math.max(0.3, Math.min(2.5, +(d.item.scale * (d.w0 + dx) / d.w0).toFixed(2))) });
        }
    };
    const onPointerUp = () => (drag.current = null);

    useEffect(() => {
        if (!editing) return;
        const onKey = (e) => {
            if (e.target.closest?.("input, select, textarea")) return;
            if ((e.key === "Delete" || e.key === "Backspace") && selected) {
                updateRoom((r) => ({ ...r, items: r.items.filter((i) => i.id !== selected) }));
                setSelected(null);
            }
            if (e.key === "Escape") setSelected(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [editing, selected]);

    if (!state || !room) return <div className="fixed inset-x-0 top-[64px] grid place-items-center text-slate-400" style={{ bottom: bottomInset }}>Setting up the room…</div>;

    const items = [...room.items].sort((a, b) => a.z - b.z);
    const selectedItem = room.items.find((i) => i.id === selected);
    const zs = room.items.map((i) => i.z);

    const ctx = {
        frames, theme, albums, byCategory, stats, mostPlayed, playingAlbum, isPlaying, spineColour, retro, editing,
        openCrate: (c) => setCrate(c),
        openAlbum: (a) => onOpenAlbum(a),
        playAlbum: (a) => onPlayAlbum(a),
    };

    return (
        <RoomContext.Provider value={ctx}>
            {/* Wall colour above the room and floor colour below it, for windows of other shapes */}
            <div className="fixed inset-x-0 top-[64px] flex flex-col" style={{ bottom: bottomInset, background: `linear-gradient(${theme.wall[0]} 0 50%, ${theme.floor[1]} 50% 100%)` }}>
                {/* Toolbar */}
                <div className="absolute right-4 top-3 z-[600] flex items-center gap-2">
                    {editing && <AddMenu onAdd={(type) => {
                        const { w, h } = ITEM_TYPES[type].size(ITEM_TYPES[type].defaults);
                        const item = createItem(type, Math.round(ROOM_W / 2 - w / 2), Math.round(FLOOR_Y - h + 40), 1, {}, Math.max(0, ...zs) + 1);
                        updateRoom((r) => ({ ...r, items: [...r.items, item] }));
                        setSelected(item.id);
                    }} />}
                    <RoomMenu
                        state={state}
                        activeRoom={room}
                        editing={editing}
                        onSwitch={(id) => { setState((s) => ({ ...s, activeRoomId: id })); setSelected(null); }}
                        onNew={(templateId) => { const r = roomFromTemplate(templateId); setState((s) => ({ ...s, rooms: [...s.rooms, r], activeRoomId: r.id })); }}
                        onRename={(id, name) => name.trim() && setState((s) => ({ ...s, rooms: s.rooms.map((r) => (r.id === id ? { ...r, name: name.trim() } : r)) }))}
                        onDuplicate={(id) => setState((s) => {
                            const src = s.rooms.find((r) => r.id === id);
                            const copy = { ...src, id: `room-${Date.now().toString(36)}`, name: `${src.name} copy`, items: src.items.map((i) => ({ ...i, id: newItemId() })) };
                            return { ...s, rooms: [...s.rooms, copy], activeRoomId: copy.id };
                        })}
                        onDelete={(id) => setState((s) => {
                            const rooms = s.rooms.filter((r) => r.id !== id);
                            return { ...s, rooms, activeRoomId: s.activeRoomId === id ? rooms[0].id : s.activeRoomId };
                        })}
                        onTheme={(themeId) => updateRoom((r) => ({ ...r, theme: themeId }))}
                    />
                    <button
                        onClick={() => { setEditing((e) => !e); setSelected(null); setCrate(null); }}
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${editing ? "btn-accent" : "border border-slate-700/70 bg-slate-950/70 text-slate-200 hover:border-slate-500"}`}
                    >
                        {editing ? "Done" : "Edit room"}
                    </button>
                </div>
                {editing && (
                    <div className="absolute left-4 top-3 z-[600] rounded-full bg-slate-950/70 px-3 py-1 text-[11px] text-slate-300">
                        Drag to move · drag the corner to resize · click an object for its settings
                    </div>
                )}

                {/* Room */}
                <div ref={wrap} className="relative flex-1 overflow-hidden" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerDown={() => editing && setSelected(null)}>
                    <div
                        className="absolute left-1/2 top-1/2 select-none"
                        style={{ width: ROOM_W, height: ROOM_H, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center" }}
                    >
                        <Background theme={theme} />
                        {items.map((item) => {
                            const type = ITEM_TYPES[item.type];
                            if (!type) return null;
                            const { w, h } = itemSize(item);
                            const base = type.size({ ...type.defaults, ...item.props });
                            const isSel = editing && item.id === selected;
                            return (
                                <div
                                    key={item.id}
                                    className={`absolute ${editing ? "cursor-move" : ""}`}
                                    style={{ left: item.x, top: item.y, width: w, height: h, zIndex: item.z }}
                                    onPointerDown={(e) => onItemPointerDown(e, item, "move")}
                                >
                                    <div style={{ width: base.w, height: base.h, transform: `scale(${item.scale})`, transformOrigin: "top left", pointerEvents: editing ? "none" : "auto" }}>
                                        <type.Component item={item} />
                                    </div>
                                    {editing && (
                                        <div className={`pointer-events-none absolute inset-0 rounded ${isSel ? "outline outline-2 outline-indigo-400" : "outline-dashed outline-1 outline-white/25"}`} />
                                    )}
                                    {isSel && (
                                        <div
                                            className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-indigo-500"
                                            onPointerDown={(e) => onItemPointerDown(e, item, "resize")}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {selectedItem && editing && (
                        <div className="absolute right-4 top-14 z-[600]">
                            <PropertiesPanel
                                item={selectedItem}
                                albums={albums}
                                onChange={(props, newScale) => updateItem(selectedItem.id, newScale === undefined ? { props } : { scale: newScale })}
                                onClose={() => setSelected(null)}
                                onForward={() => updateItem(selectedItem.id, { z: Math.max(...zs) + 1 })}
                                onBack={() => updateItem(selectedItem.id, { z: Math.min(...zs) - 1 })}
                                onDuplicate={() => {
                                    const copy = { ...selectedItem, id: newItemId(), x: selectedItem.x + 30, y: selectedItem.y + 30, z: Math.max(...zs) + 1 };
                                    updateRoom((r) => ({ ...r, items: [...r.items, copy] }));
                                    setSelected(copy.id);
                                }}
                                onDelete={() => {
                                    updateRoom((r) => ({ ...r, items: r.items.filter((i) => i.id !== selectedItem.id) }));
                                    setSelected(null);
                                }}
                            />
                        </div>
                    )}

                    {crate && !editing && (
                        <Crate
                            category={crate}
                            albums={byCategory.get(crate) || []}
                            onClose={() => setCrate(null)}
                            onOpenAlbum={(a) => { setCrate(null); onOpenAlbum(a); }}
                            onPlayAlbum={onPlayAlbum}
                        />
                    )}
                </div>
            </div>
        </RoomContext.Provider>
    );
}
