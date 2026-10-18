// Starting rooms, one per inspiration photo. Rooms live in a 1600 × 900 space; the wall
// meets the floor at y = 640. Users can rearrange these or start new rooms from them.
import { createItem as it } from "./registry";

export const ROOM_W = 1600, ROOM_H = 900, FLOOR_Y = 640;

const LEFT_SHELF = ["ambient", "electronic", "hiphop", "indie", "rock", "unsorted"];
const RIGHT_SHELF = ["classical", "jazz", "soundtrack", "soul", "world", "metal"];

export const TEMPLATES = [
    {
        id: "den",
        name: "Navy den",
        build: () => [
            it("rug", 380, 728, 1.1, { colour: "#7a2e2a", pattern: "persian" }, 1),
            it("shelf", 24, 290, 0.85, { cubbies: LEFT_SHELF }, 2),
            it("shelf", 1195, 290, 0.85, { cubbies: RIGHT_SHELF }, 2),
            it("speaker", 425, 430, 1, { finish: "walnut" }, 3),
            it("speaker", 1045, 430, 1, { finish: "walnut" }, 3),
            it("sideboard", 570, 575, 1, {}, 3),
            it("hifiRack", 585, 456, 0.8, {}, 4),
            it("turntable", 805, 488, 0.8, {}, 4),
            it("display", 210, 150, 1, { source: "topIn", category: "ambient" }, 4),
            it("lavaLamp", 1490, 112, 0.9, { colour: "#ff6a3d" }, 4),
            it("frame", 690, 110, 1, { source: "top", rank: 1, style: "wood" }, 2),
            it("frame", 905, 140, 0.8, { source: "top", rank: 2, style: "black" }, 2),
            it("armchair", 360, 640, 0.85, { colour: "#1d1d1f" }, 6),
        ],
    },
    {
        id: "golden",
        name: "Golden hour",
        build: () => [
            it("rug", 420, 720, 1, { colour: "#e9dcc2", pattern: "stripes" }, 1),
            it("shelf", 20, 300, 0.8, { cols: 2, rows: 3, cubbies: LEFT_SHELF }, 2),
            it("speaker", 440, 380, 1.15, { finish: "black" }, 3),
            it("speaker", 1010, 380, 1.15, { finish: "black" }, 3),
            it("sideboard", 600, 590, 0.88, {}, 3),
            it("turntable", 650, 500, 0.85, { finish: "silver" }, 4),
            it("hifiRack", 1220, 560, 1, {}, 3),
            it("lavaLamp", 1460, 380, 0.9, { colour: "#ffb347" }, 3),
            it("frame", 620, 110, 0.9, { source: "top", rank: 1, style: "gold" }, 2),
            it("frame", 830, 110, 0.9, { source: "top", rank: 2, style: "gold" }, 2),
            it("display", 1250, 420, 0.9, { source: "topIn", category: "classical" }, 4),
            it("armchair", 650, 600, 1, { colour: "#5a3a22" }, 6),
        ],
    },
    {
        id: "daylight",
        name: "Daylight",
        build: () => [
            it("rug", 420, 740, 1, { colour: "#d9a441", pattern: "round" }, 1),
            it("speaker", 70, 420, 1.05, { finish: "black" }, 3),
            it("sideboard", 250, 560, 1, {}, 2),
            it("hifiRack", 280, 440, 0.8, {}, 3),
            it("turntable", 500, 470, 0.85, { finish: "silver" }, 3),
            it("speaker", 740, 420, 1.05, { finish: "black" }, 3),
            it("shelf", 900, 170, 0.8, { cols: 3, rows: 4, cubbies: [...LEFT_SHELF, ...RIGHT_SHELF] }, 2),
            it("plant", 760, 200, 0.9, {}, 2),
            it("frame", 330, 110, 0.85, { source: "top", rank: 1, style: "white" }, 2),
            it("display", 1150, 30, 0.9, { source: "topIn", category: "indie" }, 4),
            it("armchair", 1080, 600, 1.05, { colour: "#b8742f" }, 6),
        ],
    },
    {
        id: "crate",
        name: "Record room",
        build: () => [
            it("rug", 360, 730, 1.15, { colour: "#7a1f1f", pattern: "persian" }, 1),
            it("shelf", 20, 230, 0.85, { cols: 3, rows: 3, cubbies: ["ambient", "electronic", "hiphop", "indie", "rock", "metal", "pop", "world", "unsorted"] }, 2),
            it("sideboard", 650, 560, 0.75, {}, 2),
            it("turntable", 680, 470, 0.8, {}, 3),
            it("hifiRack", 700, 590, 0.65, {}, 4),
            it("shelf", 1010, 230, 0.85, { cols: 3, rows: 3, cubbies: ["classical", "jazz", "soundtrack", "soul", "unsorted", "ambient", "electronic", "indie", "rock"] }, 2),
            it("frame", 690, 150, 1, { source: "top", rank: 1, style: "black" }, 2),
            it("lavaLamp", 900, 410, 0.8, { colour: "#d14bff" }, 3),
            it("display", 120, 90, 0.9, { source: "topIn", category: "hiphop" }, 4),
            it("armchair", 120, 620, 0.9, { colour: "#c99a3a" }, 6),
        ],
    },
];

export function roomFromTemplate(templateId, name) {
    const t = TEMPLATES.find((x) => x.id === templateId) || TEMPLATES[0];
    return { id: `room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name: name || t.name, theme: t.id, items: t.build() };
}

// First run: one room from each template, so there are versions to choose from straight away
export function defaultRooms() {
    const rooms = TEMPLATES.map((t) => roomFromTemplate(t.id));
    return { version: 1, activeRoomId: rooms[0].id, rooms };
}
