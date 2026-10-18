// frontend/src/retro/ThemeMenu.jsx
// Retro mode colour picker and presets. Colours come from a palette (or any custom colour)
// and can be saved as named presets, which the user can rename and delete.
import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Link2, Link2Off, Pencil, Plus, Trash2 } from "lucide-react";
import { BUILT_IN_PRESETS, PALETTE } from "./colours";

function Swatch({ hex, size = 14 }) {
    return <span className="inline-block shrink-0 rounded-full ring-1 ring-black/40" style={{ width: size, height: size, background: hex }} />;
}

function ColourRow({ label, value, onChange }) {
    return (
        <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</div>
            <div className="flex flex-wrap items-center gap-1.5">
                {PALETTE.map((c) => (
                    <button
                        key={c.hex}
                        onClick={() => onChange(c.hex)}
                        title={c.name}
                        aria-label={c.name}
                        aria-pressed={value === c.hex}
                        className={`grid h-6 w-6 place-items-center rounded-full ring-1 transition ${value === c.hex ? "ring-2 ring-white" : "ring-black/40 hover:scale-110"}`}
                        style={{ background: c.hex }}
                    >
                        {value === c.hex && <Check size={12} className="text-slate-950" strokeWidth={3} />}
                    </button>
                ))}
                <label className="relative grid h-6 w-6 cursor-pointer place-items-center rounded-full ring-1 ring-slate-600 hover:ring-slate-400" title="Custom colour">
                    <span className="absolute inset-0.5 rounded-full" style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }} />
                    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`Custom ${label.toLowerCase()} colour`} />
                </label>
            </div>
        </div>
    );
}

export default function ThemeMenu({ settings, update }) {
    const [open, setOpen] = useState(false);
    const [renaming, setRenaming] = useState(null); // { id, name }
    const ref = useRef(null);

    const userPresets = settings.retro_presets || [];
    const presets = [...BUILT_IN_PRESETS, ...userPresets];
    const active = presets.find((p) => p.id === settings.retro_preset);
    const { retro_lamp: lamp, retro_display: display, retro_link: linked } = settings;
    const modified = !active || active.lamp !== lamp || active.display !== display;

    // Close when clicking elsewhere
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
        window.addEventListener("pointerdown", onDown);
        return () => window.removeEventListener("pointerdown", onDown);
    }, [open]);

    const apply = (p) => update({ retro_preset: p.id, retro_lamp: p.lamp, retro_display: p.display, retro_link: p.lamp === p.display });
    const setLamp = (hex) => update(linked ? { retro_lamp: hex, retro_display: hex } : { retro_lamp: hex });
    const setDisplay = (hex) => update({ retro_display: hex });

    const saveAsNew = () => {
        const n = userPresets.length + 1;
        const preset = { id: `user-${Date.now()}`, name: `My preset ${n}`, lamp, display };
        update({ retro_presets: [...userPresets, preset], retro_preset: preset.id });
        setRenaming({ id: preset.id, name: preset.name });
    };
    const updateActive = () =>
        update({ retro_presets: userPresets.map((p) => (p.id === active.id ? { ...p, lamp, display } : p)) });
    const rename = () => {
        const name = renaming.name.trim();
        if (name) update({ retro_presets: userPresets.map((p) => (p.id === renaming.id ? { ...p, name } : p)) });
        setRenaming(null);
    };
    const remove = (id) =>
        update({ retro_presets: userPresets.filter((p) => p.id !== id), ...(settings.retro_preset === id ? { retro_preset: "custom" } : {}) });

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${open ? "border-indigo-300/70 bg-indigo-500/20 text-white" : "border-slate-700/70 text-slate-300 hover:border-slate-500 hover:text-white"}`}
                aria-expanded={open}
            >
                <span className="flex -space-x-1">
                    <Swatch hex={lamp} />
                    <Swatch hex={display} />
                </span>
                {active ? active.name : "Custom"}
                {active && modified && <span className="text-indigo-300" title="Changed since the preset was chosen">•</span>}
                <ChevronDown size={12} className={`transition ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="absolute right-0 top-9 z-30 w-80 space-y-4 rounded-xl border border-slate-700/60 bg-slate-950/95 p-4 text-sm shadow-2xl backdrop-blur">
                    <div>
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Presets</div>
                        <ul className="space-y-0.5">
                            {presets.map((p) => (
                                <li key={p.id} className={`group flex items-center gap-2 rounded-lg px-2 py-1 ${p.id === settings.retro_preset ? "bg-indigo-500/15" : "hover:bg-slate-800/60"}`}>
                                    <span className="flex -space-x-1">
                                        <Swatch hex={p.lamp} size={12} />
                                        <Swatch hex={p.display} size={12} />
                                    </span>
                                    {renaming?.id === p.id ? (
                                        <input
                                            autoFocus
                                            value={renaming.name}
                                            onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") rename();
                                                if (e.key === "Escape") setRenaming(null);
                                            }}
                                            onBlur={rename}
                                            className="min-w-0 flex-1 rounded border border-indigo-400 bg-slate-900 px-1.5 py-0.5 text-sm outline-none"
                                            aria-label="Preset name"
                                        />
                                    ) : (
                                        <button onClick={() => apply(p)} className="min-w-0 flex-1 truncate text-left text-slate-200">
                                            {p.name}
                                            {p.builtIn && <span className="ml-1.5 text-[10px] text-slate-500">built in</span>}
                                        </button>
                                    )}
                                    {!p.builtIn && renaming?.id !== p.id && (
                                        <span className="flex opacity-60 group-hover:opacity-100">
                                            <button onClick={() => setRenaming({ id: p.id, name: p.name })} className="rounded p-1 text-slate-400 hover:text-white" title="Rename" aria-label={`Rename ${p.name}`}>
                                                <Pencil size={12} />
                                            </button>
                                            <button onClick={() => remove(p.id)} className="rounded p-1 text-slate-400 hover:text-rose-400" title="Delete" aria-label={`Delete ${p.name}`}>
                                                <Trash2 size={12} />
                                            </button>
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="space-y-3 border-t border-slate-800 pt-3">
                        <button
                            onClick={() => update(linked ? { retro_link: false } : { retro_link: true, retro_display: lamp })}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white"
                            title={linked ? "Pick the meter lamps and the display separately" : "Use one colour for every meter"}
                        >
                            {linked ? <Link2 size={13} className="text-indigo-300" /> : <Link2Off size={13} />}
                            {linked ? "One colour for every meter" : "Separate lamp and display colours"}
                        </button>
                        {linked ? (
                            <ColourRow label="All meters" value={lamp} onChange={setLamp} />
                        ) : (
                            <>
                                <ColourRow label="Meter lamps" value={lamp} onChange={setLamp} />
                                <ColourRow label="Display" value={display} onChange={setDisplay} />
                            </>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                        <button onClick={saveAsNew} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
                            <Plus size={12} /> Save as preset
                        </button>
                        {active && !active.builtIn && modified && (
                            <button onClick={updateActive} className="btn-accent rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                                Update "{active.name}"
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
