// src/components/studio/announcement-templates.ts
// Plantillas, fuentes y animaciones del banner de anuncios (sin componentes, para
// que AnnouncementBanner.tsx solo exporte componentes y no rompa Fast Refresh).
import type {
  AnnouncementFont,
  AnnouncementStyle,
  AnnouncementTemplate,
} from "../../api/live-stage-service";

type TemplatePreset = {
  label: string;
  description: string;
  // Valores que se aplican al elegir la plantilla (el host puede ajustarlos después)
  style: Required<Pick<AnnouncementStyle, "bgColor" | "textColor" | "accentColor" | "font" | "align">>;
};

export const ANNOUNCEMENT_TEMPLATES: Record<AnnouncementTemplate, TemplatePreset> = {
  bar: {
    label: "Barra clásica",
    description: "Franja completa con línea de acento",
    style: { bgColor: "rgba(12, 12, 14, 0.85)", textColor: "#ffffff", accentColor: "#3b82f6", font: "inter", align: "center" },
  },
  lowerThird: {
    label: "Tercio inferior",
    description: "Etiqueta + caja, estilo noticiero",
    style: { bgColor: "rgba(255, 255, 255, 0.96)", textColor: "#0f172a", accentColor: "#2563eb", font: "montserrat", align: "left" },
  },
  breaking: {
    label: "Último momento",
    description: "Bloque de etiqueta con corte diagonal",
    style: { bgColor: "rgba(15, 15, 15, 0.92)", textColor: "#ffffff", accentColor: "#dc2626", font: "oswald", align: "left" },
  },
  pill: {
    label: "Cápsula",
    description: "Píldora flotante con desenfoque",
    style: { bgColor: "rgba(15, 23, 42, 0.55)", textColor: "#ffffff", accentColor: "#22c55e", font: "inter", align: "center" },
  },
  glass: {
    label: "Tarjeta de cristal",
    description: "Panel translúcido con acento lateral",
    style: { bgColor: "rgba(255, 255, 255, 0.12)", textColor: "#ffffff", accentColor: "#a78bfa", font: "inter", align: "left" },
  },
};

// Plantillas que no ocupan todo el ancho y por tanto admiten alineación
export const ALIGNABLE_TEMPLATES: AnnouncementTemplate[] = ["lowerThird", "pill", "glass"];

export const ANNOUNCEMENT_PREVIEW_BG =
  "radial-gradient(circle at 30% 35%, #3b4252 0%, #1a1d26 55%, #0d0f14 100%)";

export const ANNOUNCEMENT_FONTS: Record<AnnouncementFont, { label: string; family: string; google?: string }> = {
  system: { label: "Sistema", family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  inter: { label: "Inter", family: "'Inter', system-ui, sans-serif", google: "Inter:wght@500;600;700;800" },
  montserrat: { label: "Montserrat", family: "'Montserrat', system-ui, sans-serif", google: "Montserrat:wght@500;600;700;800" },
  oswald: { label: "Oswald", family: "'Oswald', 'Arial Narrow', sans-serif", google: "Oswald:wght@500;600;700" },
};

/** Carga la fuente de Google Fonts solo cuando un banner la usa (una vez por página) */
const loadedFonts = new Set<string>();
export function ensureAnnouncementFont(font: AnnouncementFont) {
  const google = ANNOUNCEMENT_FONTS[font]?.google;
  if (!google || loadedFonts.has(google) || typeof document === "undefined") return;
  loadedFonts.add(google);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${google}&display=swap`;
  document.head.appendChild(link);
}

// ── Animaciones ───────────────────────────────────────────────────────────
// Cada animación tiene versión In y Out con nombres distintos: cambiar solo
// animation-direction no reinicia una animación ya terminada en Chrome.
const KEYFRAMES: Record<string, [string, string]> = {
  annSlide: [
    "transform: translate(var(--ann-dx, 0), var(--ann-dy, 120%)); opacity: 0;",
    "transform: translate(0, 0); opacity: 1;",
  ],
  annFade: [
    "opacity: 0; filter: blur(0.6cqw); transform: scale(1.02);",
    "opacity: 1; filter: none; transform: scale(1);",
  ],
  // El estado final usa inset negativo: con fill-mode "both" el clip-path se
  // queda aplicado y un inset(0) recortaría las sombras de la caja.
  annWipe: [
    "clip-path: var(--ann-wipe-from, inset(-40% 100% -40% -5%));",
    "clip-path: inset(-40% -5% -40% -5%);",
  ],
  annPop: [
    "transform: scale(0.82); opacity: 0;",
    "transform: scale(1); opacity: 1;",
  ],
};

function buildKeyframes() {
  let css = "";
  for (const [name, [hidden, shown]] of Object.entries(KEYFRAMES)) {
    css += `@keyframes ${name}In { from { ${hidden} } to { ${shown} } }\n`;
    css += `@keyframes ${name}Out { from { ${shown} } to { ${hidden} } }\n`;
  }
  css += `
@keyframes annText { from { opacity: 0; transform: translateY(40%); } to { opacity: 1; transform: none; } }
@keyframes annGrowY { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes annGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes annTicker { from { transform: translateX(0); } to { transform: translateX(-100%); } }
@keyframes annPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.75); } }
`;
  return css;
}

/** Inyecta los keyframes una sola vez en <head> */
let stylesInjected = false;
export function ensureAnnouncementStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.id = "announcement-banner-keyframes";
  el.textContent = buildKeyframes();
  document.head.appendChild(el);
}

export const ANIMATION_KEYFRAME = {
  slide: "annSlide",
  fade: "annFade",
  wipe: "annWipe",
  pop: "annPop",
} as const;

export const ENTER_MS = 650;
export const EXIT_MS = 420;
export const EASE_ENTER = "cubic-bezier(0.22, 1, 0.36, 1)"; // entrada suave tipo "expo out"
export const EASE_EXIT = "cubic-bezier(0.55, 0, 1, 0.45)";
export const POP_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // leve rebote

/** Color de texto legible sobre un fondo (para etiquetas sobre el color de acento) */
export function readableOn(color: string): string {
  let r = 0, g = 0, b = 0;
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else {
    const rgb = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!rgb) return "#ffffff";
    [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#111111" : "#ffffff";
}
