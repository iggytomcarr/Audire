// Record shelving: a grid of cubbies, each holding one category's records as coloured spines,
// with that shelf's most played album turned face-out at the front.
import React from "react";
import { useRoom } from "../runtime";
import { categoryName, SHELF_CATEGORIES } from "../categories";

const CUBBY_W = 200, CUBBY_H = 150, FRAME = 16;
const SPINE_W = 9;

function seeded(id, salt) {
    let h = 2166136261;
    for (const ch of id + salt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return ((h >>> 0) % 1000) / 1000;
}

function Cubby({ category, albums }) {
    const room = useRoom();
    const { stats, spineColour, editing, theme } = room;
    const faceOut = albums.filter((a) => stats[a.id]?.plays).sort((a, b) => stats[b.id].plays - stats[a.id].plays)[0];
    const spines = albums.filter((a) => a !== faceOut);
    const fit = Math.floor((CUBBY_W - 16) / SPINE_W) - (faceOut ? 9 : 0);
    const shown = spines.slice(0, Math.max(0, fit));
    const hidden = spines.length - shown.length;

    return (
        <div
            className={`group relative overflow-hidden rounded-[3px] ${editing ? "" : "cursor-pointer"}`}
            style={{ background: "#0e0c0b", boxShadow: "inset 0 10px 16px rgba(0,0,0,0.55)" }}
            onClick={() => !editing && room.openCrate(category)}
            title={editing ? undefined : `${categoryName(category)} · ${albums.length} albums`}
        >
            {/* Spines */}
            <div className="absolute bottom-0 left-2 flex items-end">
                {shown.map((a) => (
                    <div
                        key={a.id}
                        style={{
                            width: SPINE_W - 1.5,
                            marginRight: 1.5,
                            height: CUBBY_H * (0.74 + seeded(a.id, "h") * 0.14),
                            background: `linear-gradient(90deg, rgba(0,0,0,0.35), transparent 30%, transparent 70%, rgba(0,0,0,0.4)), ${spineColour(a)}`,
                        }}
                    />
                ))}
                {hidden > 0 && <div className="mb-1 ml-1 self-end text-[11px] font-semibold text-white/70">+{hidden}</div>}
            </div>

            {/* Favourite turned face-out */}
            {faceOut && (
                <div
                    className="absolute bottom-0 overflow-hidden rounded-[2px] shadow-[4px_6px_10px_rgba(0,0,0,0.6)]"
                    style={{ right: 10, width: CUBBY_H * 0.72, height: CUBBY_H * 0.72, transform: "rotate(-4deg)", transformOrigin: "bottom right" }}
                    title={`${faceOut.title} — ${stats[faceOut.id].plays} plays`}
                >
                    {faceOut.coverImage ? (
                        <img src={faceOut.coverImage} alt="" className="h-full w-full object-cover" draggable={false} />
                    ) : (
                        <div className={`h-full w-full bg-gradient-to-br ${faceOut.colors}`} />
                    )}
                </div>
            )}

            {albums.length === 0 && <div className="absolute inset-0 grid place-items-center text-[12px] text-white/25">Empty</div>}

            {/* Label plate */}
            <div className="absolute left-1/2 top-1.5 -translate-x-1/2 rounded-[2px] bg-[#f3ecdc] px-2 py-0.5 text-[11px] font-semibold text-[#3a2e1e] shadow">
                {categoryName(category)}
            </div>

            {/* Highlight */}
            {!editing && (
                <div className="pointer-events-none absolute inset-0 rounded-[3px] opacity-0 transition group-hover:opacity-100" style={{ boxShadow: `inset 0 0 0 3px ${theme.accent}, inset 0 0 26px ${theme.accent}55` }} />
            )}
        </div>
    );
}

function Shelf({ item }) {
    const { byCategory, theme } = useRoom();
    const { cols, rows, cubbies } = item.props;
    return (
        <div
            className="grid h-full w-full rounded-[4px]"
            style={{
                background: theme.shelf,
                padding: FRAME,
                gap: FRAME,
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                boxShadow: "0 18px 30px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.06)",
            }}
        >
            {Array.from({ length: cols * rows }, (_, i) => {
                const category = cubbies[i] || "unsorted";
                return <Cubby key={i} category={category} albums={byCategory.get(category) || []} />;
            })}
        </div>
    );
}

export default {
    type: "shelf",
    label: "Record shelf",
    size: (p) => ({ w: p.cols * CUBBY_W + (p.cols + 1) * FRAME, h: p.rows * CUBBY_H + (p.rows + 1) * FRAME }),
    defaults: { cols: 2, rows: 3, cubbies: ["ambient", "electronic", "hiphop", "indie", "rock", "unsorted"] },
    fields: [
        { key: "cols", label: "Columns", type: "number", min: 1, max: 4, step: 1 },
        { key: "rows", label: "Rows", type: "number", min: 1, max: 4, step: 1 },
        { key: "cubbies", label: "Shelves", type: "cubbies" },
    ],
    Component: Shelf,
    categories: SHELF_CATEGORIES,
};
