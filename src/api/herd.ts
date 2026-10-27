// src/api/herd.ts
// Anuncios de "manada": mensajes sobre el video del asistente con cuántos de su
// grupo (especialidad, sociedad...) están conectados. El backend publica los
// conteos en RTDB (/herd/{eventId}/live) y los anuncios públicos
// (/herd/{eventId}/public); la config se espeja en /herd/{eventId}/config.
import { onValue, ref } from "firebase/database";
import { api } from "../core/api";
import { rtdb } from "../core/firebase";
import type { EventItem } from "./events";
import { DEFAULT_ANNOUNCEMENT_STYLE, type AnnouncementStyle } from "./live-stage-service";
import { ANNOUNCEMENT_TEMPLATES } from "../components/studio/announcement-templates";

export type HerdPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type HerdMessageConfig = {
  enabled?: boolean;
  template?: string; // variables: {nombre}, {cantidad}, {grupo}, {total}, {inscritos}, {inscritos_total}
  position?: HerdPosition;
  durationSec?: number;
  label?: string | null; // etiqueta corta opcional del banner ("MANADA", "BIENVENIDA"...)
  repeatEverySec?: number; // repetir cada N s con los conteos actuales (0 = no)
  repeatTemplate?: string; // plantilla de las repeticiones; vacía = template
  // Apariencia del banner (mismas plantillas que los anuncios del estudio). La
  // colocación sale de `position`, no de style.position/align.
  style?: AnnouncementStyle;
};

export type HerdOrdinalGender = "f" | "m";

export type HerdPrivateMessageConfig = HerdMessageConfig & {
  // Los primeros N de cada grupo ven firstTemplate con {posicion}; del N+1, template
  firstCount?: number; // 0 = desactivado
  firstTemplate?: string;
  ordinalGender?: HerdOrdinalGender; // f: primera, segunda… · m: primer, segundo…
};

export type HerdPublicMessageConfig = HerdMessageConfig & {
  announceOnGrowth?: boolean; // false = solo cada repeatEverySec (y a mano)
  minIntervalSec?: number;
  milestoneEvery?: number;
};

export type EventHerdConfig = {
  enabled: boolean;
  fieldId?: string;
  // label = plural, singular = singular; la forma que falte se deduce
  groupLabels?: Array<{ value: string; label?: string; singular?: string }>;
  // Valores de las opciones cuyos asistentes no ven mensajes (ni se anuncian)
  excludedGroups?: string[];
  // % de asistentes que al azar quedan sin mensajes (grupo de control); 0 = sin experimento
  holdoutPercent?: number;
  accentColor?: string;
  privateMessage?: HerdPrivateMessageConfig;
  publicMessage?: HerdPublicMessageConfig;
};

/** Grupo (opción del campo) tal como lo espeja el backend */
export type HerdGroup = {
  key: string;
  value: string;
  optionLabel: string;
  label: string; // plural
  singular?: string;
  excluded?: boolean; // no recibe mensajes
};

/** Grupo con sus dos formas: label = plural ("endocrinólogos"), singular = "endocrinólogo" */
export type HerdGroupRef = { key: string; label: string; singular?: string };

/** Config espejada en RTDB para el asistente */
export type HerdLiveConfig = {
  enabled: boolean;
  fieldId: string | null;
  accentColor?: string;
  privateMessage?: HerdPrivateMessageConfig;
  publicMessage?: HerdPublicMessageConfig;
  groups?: HerdGroup[];
  holdoutPercent?: number;
};

/** Grupo propio del asistente y su orden de llegada en él (1 = el primero) */
export type HerdMember = HerdGroupRef & {
  position?: number;
  muted?: boolean; // grupo excluido o grupo de control: no ve mensajes
};

export type HerdCounts = {
  counts: Record<string, number>;
  total: number;
  // Inscritos al evento por grupo y en total (el backend los refresca cada minuto)
  registered: Record<string, number>;
  registeredTotal: number;
};

export type HerdPublicEvent = {
  key: string;
  label: string;
  singular?: string;
  count: number;
  total: number;
  registered?: number; // inscritos del grupo
  registeredTotal?: number;
  at: number;
  repeat?: boolean; // repetición periódica: usa repeatTemplate si la hay
  manual?: boolean; // lanzado a mano desde el admin: se muestra aunque el automático esté apagado
  text?: string; // plantilla solo para este anuncio
};

/** Disparo manual del mensaje privado: cada asistente arma el suyo */
export type HerdPrivateTrigger = {
  key: string | null; // null = todos los grupos
  text?: string;
  at: number;
};

/** Mensaje con sus valores por defecto aplicados (etiqueta y estilo siguen siendo opcionales) */
export type HerdMessageResolved = Required<Omit<HerdMessageConfig, "label" | "style">> &
  Pick<HerdMessageConfig, "label" | "style">;

// Deben coincidir con DEFAULT_HERD_CONFIG del backend (events/herd.service.ts)
export const DEFAULT_HERD_PRIVATE: HerdMessageResolved &
  Required<Pick<HerdPrivateMessageConfig, "firstCount" | "firstTemplate" | "ordinalGender">> = {
  enabled: true,
  template: "¡Hola {nombre}! Contigo ya son {cantidad} {grupo} conectados",
  position: "top-left",
  durationSec: 8,
  repeatEverySec: 0,
  repeatTemplate: "",
  firstCount: 5,
  firstTemplate: "¡Hola {nombre}! Eres la {posicion} persona de {grupo_plural} en conectarse",
  ordinalGender: "f",
};

export const DEFAULT_HERD_PUBLIC: HerdMessageResolved &
  Required<Pick<HerdPublicMessageConfig, "announceOnGrowth" | "minIntervalSec" | "milestoneEvery">> = {
  enabled: true,
  template: "¡Ya son {cantidad} {grupo} conectados!",
  position: "bottom-left",
  durationSec: 6,
  announceOnGrowth: true,
  minIntervalSec: 20,
  milestoneEvery: 1,
  repeatEverySec: 0,
  repeatTemplate: "",
};

/** Máximo de "primeros" personalizables (hay ordinales hasta décimo) */
export const HERD_MAX_FIRST = 10;

const ORDINALS: Record<HerdOrdinalGender, string[]> = {
  f: ["primera", "segunda", "tercera", "cuarta", "quinta", "sexta", "séptima", "octava", "novena", "décima"],
  // Forma apocopada, va antes del sustantivo: "el primer médico", "el tercer doctor"
  m: ["primer", "segundo", "tercer", "cuarto", "quinto", "sexto", "séptimo", "octavo", "noveno", "décimo"],
};

/** 1 → "primera" / "primer"; fuera de rango, el número */
export function herdOrdinal(n: number, gender: HerdOrdinalGender = "f") {
  return ORDINALS[gender][n - 1] ?? String(n);
}

export const DEFAULT_HERD_ACCENT = "#3b82f6";

/** Estilo por defecto de los mensajes de manada: tarjeta de cristal */
export const DEFAULT_HERD_STYLE: Required<AnnouncementStyle> = {
  ...DEFAULT_ANNOUNCEMENT_STYLE,
  ...ANNOUNCEMENT_TEMPLATES.glass.style,
  template: "glass",
  size: "sm",
};

/**
 * Estilo final del banner de un mensaje: su estilo guardado + la colocación de
 * las 6 posiciones de manada. accentColor es el color global de versiones
 * anteriores (antes de que cada mensaje tuviera estilo propio).
 */
export function herdBannerStyle(
  msg: HerdMessageConfig | undefined,
  accentColor?: string,
): Required<AnnouncementStyle> {
  const [vertical, horizontal] = (msg?.position ?? "bottom-left").split("-") as [
    "top" | "bottom",
    "left" | "center" | "right",
  ];
  return {
    ...DEFAULT_HERD_STYLE,
    ...(accentColor ? { accentColor } : {}),
    ...(msg?.style ?? {}),
    position: vertical,
    align: horizontal,
  };
}

export const HERD_POSITIONS: Array<{ value: HerdPosition; label: string }> = [
  { value: "top-left", label: "Arriba a la izquierda" },
  { value: "top-center", label: "Arriba al centro" },
  { value: "top-right", label: "Arriba a la derecha" },
  { value: "bottom-left", label: "Abajo a la izquierda" },
  { value: "bottom-center", label: "Abajo al centro" },
  { value: "bottom-right", label: "Abajo a la derecha" },
];

// ── Singular / plural ─────────────────────────────────────────────────────
// Réplica de gen-live-api/src/events/herd-grammar.ts (el backend publica las
// formas finales; aquí se usan para las sugerencias del admin). Si cambian
// allá, cambiar aquí.
const STOP_WORDS = new Set(["de", "del", "en", "con", "para", "por", "y", "e", "o", "u", "a", "al"]);
const STRIP_ACCENT: Record<string, string> = { á: "a", é: "e", í: "i", ó: "o", ú: "u" };

const matchCase = (word: string, suffix: string) =>
  word.length > 1 && word === word.toUpperCase() ? suffix.toUpperCase() : suffix;

function pluralizeWord(word: string): string {
  const w = word.toLowerCase();
  const last = w.slice(-1);
  if (!/[a-záéíóúüñ]/.test(last)) return word;
  if (/[aeiouáéó]/.test(last)) return word + matchCase(word, "s");
  if (/[íú]/.test(last)) return word + matchCase(word, "es");
  if (last === "z") return word.slice(0, -1) + matchCase(word, "ces");
  // Aguda con tilde en n/s: "sección" → "secciones", "francés" → "franceses"
  const accented = /([áéíóú])([ns])$/.exec(w);
  if (accented) {
    const base = word.slice(0, -2) + STRIP_ACCENT[accented[1]] + word.slice(-1);
    return base + matchCase(word, "es");
  }
  // Llanas terminadas en s/x no cambian: "tórax", "análisis"
  if (last === "s" || last === "x") return word;
  return word + matchCase(word, "es");
}

function singularizeWord(word: string): string {
  const w = word.toLowerCase();
  if (!w.endsWith("s") || w.length < 3) return word;
  if (w.endsWith("ces")) return word.slice(0, -3) + matchCase(word, "z");
  if (w.endsWith("iones")) return word.slice(0, -5) + matchCase(word, "ión");
  // "investigadores" → "investigador", "generales" → "general"
  if (/[lrndjy]es$/.test(w)) return word.slice(0, -2);
  if (/[aeiouáéíóú]s$/.test(w)) return word.slice(0, -1);
  return word;
}

// Solo se flexionan las palabras antes de la primera preposición:
// "cirujano de tórax" → "cirujanos de tórax"
function inflect(phrase: string, fn: (w: string) => string) {
  let stopped = false;
  return phrase
    .split(/(\s+)/)
    .map((part) => {
      if (stopped || !part.trim()) return part;
      if (STOP_WORDS.has(part.toLowerCase())) {
        stopped = true;
        return part;
      }
      return fn(part);
    })
    .join("");
}

export const pluralizeEs = (phrase: string) => inflect(phrase.trim(), pluralizeWord);
export const singularizeEs = (phrase: string) => inflect(phrase.trim(), singularizeWord);

/** Formas finales de un grupo: lo escrito por el admin, lo deducido o la opción */
export function herdGroupForms(
  custom: { label?: string; singular?: string } | undefined,
  fallback: string,
): { plural: string; singular: string } {
  const plural = custom?.label?.trim() ?? "";
  const singular = custom?.singular?.trim() ?? "";
  return {
    plural: plural || (singular ? pluralizeEs(singular) : fallback),
    singular: singular || (plural ? singularizeEs(plural) : fallback),
  };
}

// ── Claves de grupo ───────────────────────────────────────────────────────
// Réplica exacta de norm/herdKey del backend: si cambian allá, cambiar aquí.
const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

export const herdKey = (s: unknown) =>
  norm(s)
    .replace(/[.#$/[\]]/g, "_")
    .slice(0, 100) || "_";

/**
 * Grupo del asistente a partir de su registrationData: canoniza el valor
 * guardado (valor o etiqueta de la opción) igual que el backend.
 */
export function findOwnHerdGroup(
  config: HerdLiveConfig,
  registrationData: Record<string, unknown> | null | undefined,
): HerdGroupRef | null {
  if (!config.fieldId || !registrationData) return null;
  const rawValue = registrationData[config.fieldId];
  const raw = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (raw == null || typeof raw === "object" || !String(raw).trim()) return null;

  const n = norm(raw);
  const group = (config.groups ?? []).find(
    (g) => norm(g.value) === n || norm(g.optionLabel) === n,
  );
  if (group) return { key: group.key, label: group.label, singular: group.singular };
  return { key: herdKey(raw), label: String(raw).trim(), singular: String(raw).trim() };
}

/** Sustituye las variables de la plantilla */
export function renderHerdTemplate(
  template: string,
  vars: {
    nombre?: string;
    cantidad?: number;
    grupo?: string; // plural
    grupoSingular?: string;
    total?: number;
    posicion?: string;
    inscritos?: number; // inscritos del grupo
    inscritosTotal?: number;
  },
) {
  const one = vars.cantidad === 1;
  const plural = vars.grupo ?? "";
  const singular = vars.grupoSingular || plural;
  return template
    // {singular|plural}: concordancia con {cantidad} ("ya {es|son} {cantidad}")
    .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_m, a: string, b: string) => (one ? a : b))
    .replace(/\{nombre\}/gi, vars.nombre ?? "")
    .replace(/\{posicion\}/gi, vars.posicion ?? "")
    .replace(/\{cantidad\}/gi, String(vars.cantidad ?? ""))
    .replace(/\{grupo_singular\}/gi, singular)
    .replace(/\{grupo_plural\}/gi, plural)
    // {grupo} se ajusta solo: singular con 1, plural con más
    .replace(/\{grupo\}/gi, one ? singular : plural)
    .replace(/\{total\}/gi, String(vars.total ?? ""))
    .replace(/\{inscritos_total\}/gi, String(vars.inscritosTotal ?? ""))
    .replace(/\{inscritos\}/gi, String(vars.inscritos ?? ""))
    // Si {nombre} quedó vacío: "¡Hola !" → "¡Hola!"
    .replace(/\s+([!,.?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── RTDB ──────────────────────────────────────────────────────────────────

// Sin esto, un permission_denied de las reglas de RTDB pasa en silencio
const logError = (path: string) => (err: Error) =>
  console.warn(`[herd] no se pudo leer ${path}:`, err.message);

export function subscribeHerdConfig(eventId: string, cb: (c: HerdLiveConfig | null) => void) {
  return onValue(
    ref(rtdb, `/herd/${eventId}/config`),
    (s) => cb((s.val() as HerdLiveConfig) ?? null),
    logError(`/herd/${eventId}/config`),
  );
}

export function subscribeHerdCounts(eventId: string, cb: (c: HerdCounts | null) => void) {
  return onValue(
    ref(rtdb, `/herd/${eventId}/live`),
    (s) => {
      const v = s.val() as Partial<HerdCounts> | null;
      cb(
        v
          ? {
              counts: v.counts ?? {},
              total: Number(v.total ?? 0),
              registered: v.registered ?? {},
              registeredTotal: Number(v.registeredTotal ?? 0),
            }
          : null,
      );
    },
    logError(`/herd/${eventId}/live`),
  );
}

/** Grupo propio del asistente, publicado por el backend al detectar su presencia */
export function subscribeHerdMember(
  eventId: string,
  uid: string,
  cb: (g: HerdMember | null) => void,
) {
  return onValue(
    ref(rtdb, `/herd/${eventId}/members/${uid}`),
    (s) => cb((s.val() as HerdMember) ?? null),
    logError(`/herd/${eventId}/members/${uid}`),
  );
}

export function subscribeHerdPublic(eventId: string, cb: (e: HerdPublicEvent | null) => void) {
  return onValue(
    ref(rtdb, `/herd/${eventId}/public`),
    (s) => cb((s.val() as HerdPublicEvent) ?? null),
    logError(`/herd/${eventId}/public`),
  );
}

export function subscribeHerdPrivateTrigger(
  eventId: string,
  cb: (t: HerdPrivateTrigger | null) => void,
) {
  return onValue(
    ref(rtdb, `/herd/${eventId}/privateTrigger`),
    (s) => cb((s.val() as HerdPrivateTrigger) ?? null),
    logError(`/herd/${eventId}/privateTrigger`),
  );
}

// ── API ───────────────────────────────────────────────────────────────────

/** Lanza ya un anuncio de manada desde el admin */
export async function announceHerd(
  eventId: string,
  payload: { type: "public" | "private"; key?: string; text?: string },
): Promise<{ type: string; key: string | null; label?: string; count: number }> {
  const { data } = await api.post(`/events/${eventId}/herd/announce`, payload);
  return data;
}

export type HerdExperimentArm = {
  attendees: number;
  avgPlaybackMin: number;
  medianPlaybackMin: number;
  avgPresenceMin: number;
  avgSessions: number;
  watched15Pct: number;
  watched30Pct: number;
  watched60Pct: number;
  untilEndPct: number | null; // null si el evento no ha terminado
};

/** Retención de quienes vieron los mensajes (tratamiento) vs. el grupo de control */
export type HerdExperimentReport = {
  holdoutPercent: number;
  eventEnded: boolean;
  treatment: HerdExperimentArm;
  control: HerdExperimentArm;
  excluded: HerdExperimentArm;
  lift: { playbackMin: number; playbackPct: number | null; pValue: number | null };
};

export async function getHerdExperiment(eventId: string): Promise<HerdExperimentReport> {
  const { data } = await api.get(`/events/${eventId}/herd/experiment`);
  return data;
}

export async function updateHerdConfig(
  eventId: string,
  config: EventHerdConfig,
): Promise<EventItem> {
  const { data } = await api.patch(`/events/${eventId}/herd-config`, config);
  return data;
}
