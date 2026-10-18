// Every kind of object a room can contain. To add a new one, write a module that exports
// { type, label, size(props), defaults, fields, Component } and list it here; the editor,
// the Add menu, saving and loading all work from this list.
import Shelf from "./items/Shelf";
import Turntable from "./items/Turntable";
import HifiRack from "./items/HifiRack";
import Speaker from "./items/Speaker";
import LavaLamp from "./items/LavaLamp";
import { DisplayItem, FrameItem } from "./items/Frames";
import { ArmchairItem, PlantItem, RugItem, SideboardItem } from "./items/Furniture";

export const ITEM_TYPES = Object.fromEntries(
    [Shelf, Turntable, HifiRack, Speaker, LavaLamp, FrameItem, DisplayItem, SideboardItem, ArmchairItem, RugItem, PlantItem].map((t) => [t.type, t])
);

// Size of an item in room units (its type's natural size times its scale)
export function itemSize(item) {
    const type = ITEM_TYPES[item.type];
    if (!type) return { w: 100, h: 100 };
    const { w, h } = type.size({ ...type.defaults, ...item.props });
    return { w: w * item.scale, h: h * item.scale };
}

let counter = 0;
export const newItemId = () => `i${Date.now().toString(36)}${(counter++).toString(36)}`;

export function createItem(type, x, y, scale = 1, props = {}, z = 1) {
    return { id: newItemId(), type, x, y, scale, z, props: { ...ITEM_TYPES[type].defaults, ...props } };
}
