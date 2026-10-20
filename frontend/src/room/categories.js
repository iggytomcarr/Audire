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
    // Hard rock shares the heavy metal section, as in a record shop
    ["metal", ["metal", "doom", "sludge", "grindcore", "djent", "stoner", "hard rock"]],
    ["jazz", ["jazz", "bebop", "fusion", "swing", "big band"]],
    ["hiphop", ["hip hop", "hip-hop", "rap", "boom bap", "trap", "turntablism"]],
    ["ambient", ["ambient", "drone", "new age", "field recording", "dark ambient", "lowercase"]],
    ["electronic", ["electronic", "techno", "house", "idm", "electro", "dubstep", "breakbeat", "drum and bass", "jungle", "synthwave", "downtempo", "trip hop", "dance", "trance", "uk garage", "speed garage", "2-step", "footwork", "glitch", "chillwave", "synth", "berlin school", "kosmische"]],
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
    // No genres yet: soundtracks and classical works usually say so in their names
    const name = `${raw.album || ""} ${raw.artist || ""}`.toLowerCase();
    if (/\b(soundtrack|ost|score)\b/.test(name)) return "soundtrack";
    if (/\b(symphon\w*|concert[oi]s?|sonatas?|quartets?|requiem|nocturnes?|preludes?|op\.\s*\d+)\b/.test(name)) return "classical";
    return "unsorted";
}

// The shelf most of each artist's albums sit on, for their albums that have no genres yet
export function artistShelves(albums) {
    const counts = new Map();
    albums.forEach((album) => {
        const c = genreCategory(album);
        if (c === "unsorted") return;
        const key = ((album.rawAlbum || album).artist || "").toLowerCase();
        const tally = counts.get(key) || {};
        tally[c] = (tally[c] || 0) + 1;
        counts.set(key, tally);
    });
    const best = new Map();
    counts.forEach((tally, key) => best.set(key, Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]));
    return best;
}

export function shelfFor(album, artists) {
    const raw = album.rawAlbum || album;
    if (raw.shelf && SHELF_CATEGORIES.some((c) => c.id === raw.shelf)) return raw.shelf;
    const c = genreCategory(album);
    if (c === "unsorted" && artists) return artists.get((raw.artist || "").toLowerCase()) || c;
    return c;
}
