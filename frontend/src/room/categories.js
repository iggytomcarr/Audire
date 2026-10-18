// Shelf categories for the Room view. An album goes on the shelf the user chose in its edit
// form, or else on the first category its genres match (MusicBrainz genres or the user's own).

export const SHELF_CATEGORIES = [
    { id: "ambient", name: "Ambient" },
    { id: "electronic", name: "Electronic" },
    { id: "hiphop", name: "Hip hop" },
    { id: "indie", name: "Indie" },
    { id: "rock", name: "Rock" },
    { id: "metal", name: "Metal" },
    { id: "classical", name: "Classical" },
    { id: "jazz", name: "Jazz" },
    { id: "soul", name: "Soul and funk" },
    { id: "soundtrack", name: "Soundtrack" },
    { id: "pop", name: "Pop" },
    { id: "world", name: "World" },
    { id: "unsorted", name: "Unsorted" },
];

// Checked in this order, so more specific families win (dream pop is indie, not pop)
const MATCHERS = [
    ["soundtrack", ["soundtrack", "score", "film", "video game", "game music", "musical"]],
    ["classical", ["classical", "romantic", "symphon", "baroque", "opera", "orchestral", "chamber music", "minimalism", "modern composition"]],
    ["metal", ["metal", "doom", "sludge", "grindcore", "djent", "stoner"]],
    ["jazz", ["jazz", "bebop", "fusion", "swing", "big band"]],
    ["hiphop", ["hip hop", "hip-hop", "rap", "boom bap", "trap", "turntablism"]],
    ["ambient", ["ambient", "drone", "new age", "field recording", "dark ambient", "lowercase"]],
    ["electronic", ["electronic", "techno", "house", "idm", "electro", "dubstep", "breakbeat", "drum and bass", "jungle", "synthwave", "downtempo", "trip hop", "dance", "trance", "garage", "footwork", "glitch", "chillwave", "synth"]],
    ["indie", ["indie", "lo-fi", "singer-songwriter", "folk", "dream pop", "shoegaze", "chamber pop", "slowcore", "sadcore", "alternative"]],
    ["rock", ["rock", "punk", "psychedelic", "prog", "grunge", "new wave", "post-punk", "krautrock", "garage rock"]],
    ["soul", ["soul", "funk", "r&b", "rhythm and blues", "disco", "gospel", "motown"]],
    ["world", ["world", "reggae", "dub", "afrobeat", "latin", "bossa", "samba", "kirtan", "devotional", "raga", "highlife"]],
    ["pop", ["pop"]],
];

export const categoryName = (id) => SHELF_CATEGORIES.find((c) => c.id === id)?.name || "Unsorted";

// The category an album's genres point to, or "unsorted" (earlier genres count for more)
export function genreCategory(album) {
    const raw = album.rawAlbum || album;
    const genres = (raw.genre || []).map((g) => g.toLowerCase());
    const score = {};
    genres.forEach((g, i) => {
        const hit = MATCHERS.find(([, words]) => words.some((w) => g.includes(w)));
        if (hit) score[hit[0]] = (score[hit[0]] || 0) + 1 / (i + 1);
    });
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    if (best) return best[0];
    // No genres yet: soundtracks usually say so in their names
    const name = `${raw.album || ""} ${raw.artist || ""}`.toLowerCase();
    if (/\b(soundtrack|ost|score)\b/.test(name)) return "soundtrack";
    return "unsorted";
}

export function shelfFor(album) {
    const raw = album.rawAlbum || album;
    if (raw.shelf && SHELF_CATEGORIES.some((c) => c.id === raw.shelf)) return raw.shelf;
    return genreCategory(album);
}
