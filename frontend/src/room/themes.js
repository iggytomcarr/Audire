// Room themes: the walls, floor and lighting a room's objects sit in.
// Objects read `accent`, `wood` and `text` so they suit whichever theme they are placed in.

export const ROOM_THEMES = {
    den: {
        name: "Navy den",
        wall: ["#2f4052", "#223140"],
        floor: ["#c7b391", "#a8946f"],
        skirting: "#1b2631",
        light: "rgba(255, 214, 150, 0.22)",
        accent: "#f2c06b",
        wood: "#6b4a2e",
        shelf: "#3b2a1d",
        text: "#e8edf2",
    },
    golden: {
        name: "Golden hour",
        wall: ["#5a4630", "#3a2d1f"],
        floor: ["#dccaa6", "#bfa57b"],
        skirting: "#271e14",
        light: "rgba(255, 200, 110, 0.35)",
        accent: "#ffcf7a",
        wood: "#2a2622",
        shelf: "#1c1a18",
        text: "#fff3df",
        slats: "#b9874a",
    },
    daylight: {
        name: "Daylight",
        wall: ["#f1ede4", "#e2dccf"],
        floor: ["#d39556", "#b87a3e"],
        skirting: "#d8d1c2",
        light: "rgba(255, 255, 255, 0.5)",
        accent: "#5ea8ff",
        wood: "#d2b48c",
        shelf: "#c9a46b",
        text: "#2a2a2a",
    },
    crate: {
        name: "Record room",
        wall: ["#94722e", "#6f5420"],
        floor: ["#dad3c8", "#c3baad"],
        skirting: "#3a2e18",
        light: "rgba(255, 230, 176, 0.3)",
        accent: "#8dffa8",
        wood: "#1e1c1b",
        shelf: "#151413",
        text: "#fff7e6",
    },
    evening: {
        name: "Evening",
        wall: ["#2a2140", "#1b1530"],
        floor: ["#4a3226", "#31211a"],
        skirting: "#130e1d",
        light: "rgba(255, 160, 100, 0.12)",
        accent: "#ff9e6b",
        wood: "#3a2618",
        shelf: "#22160e",
        text: "#f6e9ff",
    },
};

export const DEFAULT_THEME = "den";
