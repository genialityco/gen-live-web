// src/utils/color-contrast.ts
// Texto legible sobre un color de marca (blanco u oscuro según contraste WCAG)

export const DARK_TEXT = "#111827";

/** "#abc" | "#aabbcc" | "rgb(r, g, b)" → [r, g, b]; null si no se reconoce */
export function parseColor(c: string): [number, number, number] | null {
  const s = c.trim();
  const hex = s.match(/^#([\da-f]{3}|[\da-f]{6})([\da-f]{2})?$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((x) => x + x).join("") : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgb = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

/** Luminancia relativa (WCAG) de un color sRGB */
export function luminance([r, g, b]: [number, number, number]) {
  const ch = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Texto blanco u oscuro, el que más contraste dé sobre `bg` */
export function readableOn(bg: string) {
  const rgb = parseColor(bg);
  if (!rgb) return "#ffffff";
  const L = luminance(rgb);
  const dark = luminance(parseColor(DARK_TEXT)!);
  return 1.05 / (L + 0.05) >= (L + 0.05) / (dark + 0.05) ? "#ffffff" : DARK_TEXT;
}
