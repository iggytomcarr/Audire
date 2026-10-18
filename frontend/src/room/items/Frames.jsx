// Album art on show: a framed cover for the wall, and a record on a stand that can sit on top
// of a shelf. Either can show a chosen album, a most-played rank, or a shelf's favourite.
import React from "react";
import { useRoom } from "../runtime";
import { ALBUM_SOURCE_FIELDS, pickAlbum } from "../albumPick";

const FRAME_STYLES = {
    wood: { border: "#6b4a2e", inner: "#4a321f" },
    black: { border: "#141414", inner: "#000" },
    gold: { border: "#b08d3c", inner: "#7d6326" },
    white: { border: "#f2efe8", inner: "#d6d1c6" },
};

function Cover({ album, room }) {
    return album?.coverImage ? (
        <img src={album.coverImage} alt="" className="h-full w-full object-cover" draggable={false} />
    ) : (
        <div className={`h-full w-full bg-gradient-to-br ${album?.colors || "from-slate-700 to-slate-900"}`} />
    );
}

// Shown instead of an empty frame or stand, only while the room is being edited
function Placeholder({ room, label }) {
    return room.editing ? (
        <div className="grid h-full w-full place-items-center rounded border-2 border-dashed border-white/30 text-center text-[13px] text-white/60">{label}</div>
    ) : null;
}

function Frame({ item }) {
    const room = useRoom();
    const album = pickAlbum(item.props, room);
    if (!album) return <Placeholder room={room} label="Frame: no album yet" />;
    const style = FRAME_STYLES[item.props.style] || FRAME_STYLES.wood;
    return (
        <div
            className={`flex h-full w-full flex-col items-center ${room.editing || !album ? "" : "cursor-pointer"}`}
            onClick={() => !room.editing && album && room.openAlbum(album)}
            title={album ? `${album.title} — ${album.artist}` : "No album yet"}
        >
            <div className="aspect-square w-full p-[7%]" style={{ background: style.border, boxShadow: `0 14px 22px rgba(0,0,0,0.45), inset 0 0 0 3px ${style.inner}` }}>
                <div className="h-full w-full bg-[#f3efe6] p-[7%]">
                    <Cover album={album} room={room} />
                </div>
            </div>
            {item.props.plaque && album && (
                <div className="mt-[5%] max-w-full truncate rounded-[2px] bg-[#c9b27a] px-2 text-[11px] font-semibold text-[#3a2e14]">
                    {album.title}
                </div>
            )}
        </div>
    );
}

function Display({ item }) {
    const room = useRoom();
    const album = pickAlbum(item.props, room);
    if (!album) return <Placeholder room={room} label="Stand: no album on that shelf yet" />;
    return (
        <div
            className={`relative h-full w-full ${room.editing || !album ? "" : "cursor-pointer"}`}
            onClick={() => !room.editing && album && room.openAlbum(album)}
            title={album ? `${album.title} — ${album.artist}` : "No album yet"}
        >
            <div className="absolute bottom-[8%] left-[6%] aspect-square w-[88%] overflow-hidden rounded-[2px]" style={{ transform: "rotate(-3deg)", transformOrigin: "bottom left", boxShadow: "6px 10px 14px rgba(0,0,0,0.5)" }}>
                <Cover album={album} room={room} />
            </div>
            <div className="absolute bottom-0 left-[10%] h-[9%] w-[80%] rounded-[2px]" style={{ background: "linear-gradient(#cfcfd4, #8d8d94)" }} />
        </div>
    );
}

export const FrameItem = {
    type: "frame",
    label: "Framed cover",
    size: () => ({ w: 190, h: 220 }),
    defaults: { source: "top", rank: 1, style: "wood", plaque: true },
    fields: [
        ...ALBUM_SOURCE_FIELDS(true),
        {
            key: "style",
            label: "Frame",
            type: "select",
            options: [
                { value: "wood", label: "Wood" },
                { value: "black", label: "Black" },
                { value: "gold", label: "Gold" },
                { value: "white", label: "White" },
            ],
        },
        { key: "plaque", label: "Name plaque", type: "toggle" },
    ],
    Component: Frame,
};

export const DisplayItem = {
    type: "display",
    label: "Record on a stand",
    size: () => ({ w: 140, h: 150 }),
    defaults: { source: "topIn", category: "ambient", rank: 1 },
    fields: ALBUM_SOURCE_FIELDS(true),
    Component: Display,
};
