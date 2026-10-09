// Wallpaper presets for chat backgrounds. Each entry is a CSS background
// value applied to `.message-list` when the user picks it. Wallpaper ids are
// validated server-side with /^[a-z0-9_-]{1,32}$/i, so keep ids simple.
export const WALLPAPERS = [
  { id: "plain", name: "Plain", background: "transparent" },
  {
    id: "mint",
    name: "Mint",
    background: "linear-gradient(160deg, #0e2b1f 0%, #101815 60%)",
  },
  {
    id: "dusk",
    name: "Dusk",
    background: "linear-gradient(160deg, #241b3a 0%, #141016 60%)",
  },
  {
    id: "ocean",
    name: "Ocean",
    background: "linear-gradient(160deg, #0b2537 0%, #0d161c 60%)",
  },
  {
    id: "sand",
    name: "Sand",
    background: "linear-gradient(160deg, #33291a 0%, #191512 60%)",
  },
  {
    id: "rose",
    name: "Rose",
    background: "linear-gradient(160deg, #3a1a24 0%, #171013 60%)",
  },
  {
    id: "grid",
    name: "Grid",
    background:
      "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px), #101815",
    backgroundSize: "24px 24px",
  },
  {
    id: "paper",
    name: "Paper",
    background:
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 28px), #141a17",
  },
];

// Background colors for status stories (WhatsApp-style colored full screens).
export const STATUS_COLORS = [
  "#7bd389",
  "#4fc3f7",
  "#ba68c8",
  "#ffb74d",
  "#e57373",
  "#4db6ac",
  "#f06292",
  "#9575cd",
];

// Accent colors offered for the profile avatar.
export const AVATAR_COLORS = [
  "#7bd389",
  "#4fc3f7",
  "#ba68c8",
  "#ffb74d",
  "#e57373",
  "#4db6ac",
  "#f06292",
  "#9575cd",
  "#9e9e9e",
];

export function wallpaperBackground(id) {
  const found = WALLPAPERS.find((w) => w.id === id);
  return found ? found.background : "transparent";
}

export function wallpaperBackgroundSize(id) {
  const found = WALLPAPERS.find((w) => w.id === id);
  return found?.backgroundSize || "auto";
}
