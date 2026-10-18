// Which album a frame or display shows: a chosen album, "my most played #N", or the most
// played album on a given shelf (falling back to the first album there before anything is played).
import { shelfFor } from "./categories";

export const ALBUM_SOURCE_FIELDS = (withShelf) => [
    {
        key: "source",
        label: "Shows",
        type: "select",
        options: [
            { value: "top", label: "My most played" },
            ...(withShelf ? [{ value: "topIn", label: "Most played on a shelf" }] : []),
            { value: "album", label: "An album I choose" },
        ],
    },
    { key: "rank", label: "Rank", type: "number", min: 1, max: 20, step: 1, show: (p) => p.source === "top" },
    { key: "category", label: "Shelf", type: "category", show: (p) => p.source === "topIn" },
    { key: "albumId", label: "Album", type: "album", show: (p) => p.source === "album" },
];

export function pickAlbum(props, room) {
    const { albums, mostPlayed, stats } = room;
    if (props.source === "album") return albums.find((a) => a.id === props.albumId) || null;
    if (props.source === "topIn") {
        const onShelf = albums.filter((a) => shelfFor(a) === props.category);
        const played = onShelf.filter((a) => stats[a.id]?.plays).sort((a, b) => stats[b.id].plays - stats[a.id].plays);
        return played[0] || onShelf[0] || null;
    }
    const rank = Math.max(1, props.rank || 1);
    return mostPlayed[rank - 1] || albums[rank - 1] || null;
}
