// Room editing UI: the properties panel for a selected object (built from its type's `fields`),
// the Add object menu and the room menu (switch, new, rename, duplicate, delete).
import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X, ChevronDown, Pencil } from "lucide-react";
import { ITEM_TYPES } from "./registry";
import { SHELF_CATEGORIES } from "./categories";
import { ROOM_THEMES } from "./themes";
import { TEMPLATES } from "./templates";

const control = "w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-indigo-400";
const SWATCHES = ["#ff6a3d", "#ffb347", "#f2c06b", "#d14bff", "#5ea8ff", "#8dffa8", "#7a2e2a", "#1d1d1f", "#8a5a32", "#e9dcc2"];

function useClickAway(open, setOpen) {
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
        window.addEventListener("pointerdown", onDown);
        return () => window.removeEventListener("pointerdown", onDown);
    }, [open]);
    return ref;
}

function Field({ field, props, onChange, albums }) {
    const value = props[field.key];
    const set = (v) => onChange({ ...props, [field.key]: v });
    switch (field.type) {
        case "select":
            return (
                <select className={control} value={value} onChange={(e) => set(e.target.value)}>
                    {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            );
        case "category":
            return (
                <select className={control} value={value} onChange={(e) => set(e.target.value)}>
                    {SHELF_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            );
        case "album":
            return (
                <select className={control} value={value || ""} onChange={(e) => set(e.target.value)}>
                    <option value="">Choose an album…</option>
                    {[...albums].sort((a, b) => `${a.artist} ${a.title}`.localeCompare(`${b.artist} ${b.title}`)).map((a) => (
                        <option key={a.id} value={a.id}>{a.artist} — {a.title}</option>
                    ))}
                </select>
            );
        case "number":
            return (
                <div className="flex items-center gap-2">
                    <input type="range" min={field.min} max={field.max} step={field.step} value={value} onChange={(e) => set(Number(e.target.value))} className="flex-1 accent-indigo-400" />
                    <span className="w-6 text-right text-xs tabular-nums text-slate-300">{value}</span>
                </div>
            );
        case "colour":
            return (
                <div className="flex flex-wrap items-center gap-1">
                    {SWATCHES.map((c) => (
                        <button key={c} onClick={() => set(c)} className={`h-5 w-5 rounded-full ring-1 ${value === c ? "ring-2 ring-white" : "ring-black/40"}`} style={{ background: c }} aria-label={c} />
                    ))}
                    <input type="color" value={value} onChange={(e) => set(e.target.value)} className="h-5 w-6 cursor-pointer bg-transparent" aria-label={`Custom ${field.label}`} />
                </div>
            );
        case "toggle":
            return <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} className="accent-indigo-400" />;
        case "cubbies": {
            const count = props.cols * props.rows;
            const cubbies = Array.from({ length: count }, (_, i) => props.cubbies?.[i] || "unsorted");
            return (
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${props.cols}, 1fr)` }}>
                    {cubbies.map((c, i) => (
                        <select key={i} className={control} value={c} onChange={(e) => set(cubbies.map((x, j) => (j === i ? e.target.value : x)))}>
                            {SHELF_CATEGORIES.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                    ))}
                </div>
            );
        }
        default:
            return null;
    }
}

export function PropertiesPanel({ item, albums, onChange, onClose, onForward, onBack, onDuplicate, onDelete }) {
    const type = ITEM_TYPES[item.type];
    const fields = (type.fields || []).filter((f) => !f.show || f.show(item.props));
    return (
        <div className="w-72 space-y-3 rounded-xl border border-slate-700/60 bg-slate-950/95 p-3 text-sm shadow-2xl backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
                <div className="font-semibold">{type.label}</div>
                <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white" aria-label="Close"><X size={14} /></button>
            </div>
            {fields.map((f) => (
                <label key={f.key} className="block space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{f.label}</span>
                    <Field field={f} props={item.props} onChange={onChange} albums={albums} />
                </label>
            ))}
            <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Size</span>
                <div className="flex items-center gap-2">
                    <input type="range" min="0.3" max="2.5" step="0.05" value={item.scale} onChange={(e) => onChange(item.props, Number(e.target.value))} className="flex-1 accent-indigo-400" />
                    <span className="w-10 text-right text-xs tabular-nums text-slate-300">{Math.round(item.scale * 100)}%</span>
                </div>
            </label>
            <div className="flex gap-1 border-t border-slate-800 pt-2">
                <button onClick={onForward} className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800" title="Bring forward"><ArrowUp size={14} /></button>
                <button onClick={onBack} className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800" title="Send back"><ArrowDown size={14} /></button>
                <button onClick={onDuplicate} className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800" title="Duplicate"><Copy size={14} /></button>
                <button onClick={onDelete} className="ml-auto rounded-md p-1.5 text-slate-300 hover:bg-slate-800 hover:text-rose-400" title="Remove from room"><Trash2 size={14} /></button>
            </div>
        </div>
    );
}

export function AddMenu({ onAdd }) {
    const [open, setOpen] = useState(false);
    const ref = useClickAway(open, setOpen);
    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:border-slate-500">
                <Plus size={12} /> Add object
            </button>
            {open && (
                <div className="absolute right-0 top-8 z-30 w-48 rounded-xl border border-slate-700/60 bg-slate-950/95 p-1 shadow-2xl backdrop-blur">
                    {Object.values(ITEM_TYPES).map((t) => (
                        <button key={t.type} onClick={() => { onAdd(t.type); setOpen(false); }} className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800">
                            {t.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function RoomMenu({ state, activeRoom, onSwitch, onNew, onRename, onDuplicate, onDelete, onTheme, editing }) {
    const [open, setOpen] = useState(false);
    const [renaming, setRenaming] = useState(null);
    const ref = useClickAway(open, setOpen);
    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:border-slate-500" aria-expanded={open}>
                {activeRoom.name} <ChevronDown size={12} />
            </button>
            {open && (
                <div className="absolute right-0 top-8 z-30 w-64 space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/95 p-2 text-sm shadow-2xl backdrop-blur">
                    <div className="px-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Your rooms</div>
                    <ul>
                        {state.rooms.map((r) => (
                            <li key={r.id} className={`group flex items-center gap-1 rounded-lg px-2 py-1 ${r.id === activeRoom.id ? "bg-indigo-500/15" : "hover:bg-slate-800/60"}`}>
                                {renaming?.id === r.id ? (
                                    <input
                                        autoFocus
                                        className={control}
                                        value={renaming.name}
                                        onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") { onRename(r.id, renaming.name); setRenaming(null); }
                                            if (e.key === "Escape") setRenaming(null);
                                        }}
                                        onBlur={() => { onRename(r.id, renaming.name); setRenaming(null); }}
                                        aria-label="Room name"
                                    />
                                ) : (
                                    <button onClick={() => { onSwitch(r.id); setOpen(false); }} className="min-w-0 flex-1 truncate text-left text-slate-200">{r.name}</button>
                                )}
                                {renaming?.id !== r.id && (
                                    <span className="flex opacity-60 group-hover:opacity-100">
                                        <button onClick={() => setRenaming({ id: r.id, name: r.name })} className="rounded p-1 text-slate-400 hover:text-white" title="Rename"><Pencil size={12} /></button>
                                        <button onClick={() => onDuplicate(r.id)} className="rounded p-1 text-slate-400 hover:text-white" title="Duplicate"><Copy size={12} /></button>
                                        {state.rooms.length > 1 && (
                                            <button onClick={() => onDelete(r.id)} className="rounded p-1 text-slate-400 hover:text-rose-400" title="Delete"><Trash2 size={12} /></button>
                                        )}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                    <div className="border-t border-slate-800 px-2 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">New room from</div>
                    <div className="flex flex-wrap gap-1 px-1 pb-1">
                        {TEMPLATES.map((t) => (
                            <button key={t.id} onClick={() => { onNew(t.id); setOpen(false); }} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800">{t.name}</button>
                        ))}
                    </div>
                    {editing && (
                        <>
                            <div className="border-t border-slate-800 px-2 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Walls and floor</div>
                            <div className="flex flex-wrap gap-1 px-1 pb-1">
                                {Object.entries(ROOM_THEMES).map(([id, t]) => (
                                    <button key={id} onClick={() => onTheme(id)} className={`rounded-md border px-2 py-1 text-xs ${activeRoom.theme === id ? "border-indigo-400 text-indigo-200" : "border-slate-700 text-slate-200 hover:bg-slate-800"}`}>
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
