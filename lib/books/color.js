// Spine colors: take a cover's dominant color, keep it inside the site's warm, muted range,
// and pick ink or paper text so the spine title passes WCAG AA (4.5:1).

export const INK = "#2b211a";
export const PAPER = "#fbfaf4";
// Used when a book has no cover (seeded by book id so it's stable).
export const FALLBACK_PALETTE = [
  "#6b3f2a", "#2f4f4a", "#a9603a", "#d9c7a0", "#3b4a63", "#7a2e2e", "#5c6b3a", "#c9a86a",
  "#4a3b52", "#e6d9c0", "#1f3a3a", "#8c5a3c", "#b7b39a", "#34495e", "#9b4f3f", "#6e7f6a",
];

const toHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const fromHex = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

function luminance(hex) {
  const c = fromHex(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Dominant cover color → { color, text } with text contrast ≥ 4.5. */
export function spineColors([r, g, b]) {
  let [h, s, l] = rgbToHsl(r, g, b);
  // Near-greys stay near-grey (don't invent a hue); everything else is toned into the palette's range.
  s = s < 0.08 ? s : Math.min(0.6, Math.max(0.25, s));
  l = Math.min(0.7, Math.max(0.22, l));
  for (let i = 0; i < 20; i++) {
    const hex = toHex(...hslToRgb(h, s, l));
    const ink = contrast(hex, INK), paper = contrast(hex, PAPER);
    if (Math.max(ink, paper) >= 4.5) return { color: hex, text: ink >= paper ? INK : PAPER };
    l += l >= 0.5 ? 0.03 : -0.03; // push away from the muddy middle until one text color passes
  }
  const hex = toHex(...hslToRgb(h, s, l));
  return { color: hex, text: contrast(hex, INK) >= contrast(hex, PAPER) ? INK : PAPER };
}

export function fallbackColors(seed) {
  const color = FALLBACK_PALETTE[seed % FALLBACK_PALETTE.length];
  return { color, text: contrast(color, INK) >= contrast(color, PAPER) ? INK : PAPER };
}
