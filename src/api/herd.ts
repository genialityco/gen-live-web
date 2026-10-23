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
  template?: string; // variables: {nombre}, {cantidad}, {grupo}, {total}
  position?: HerdPosition;
  durationSec?: number;
  label?: string | null; // etiqueta corta opcional del banner ("MANADA", "BIENVENIDA"...)
  // Apariencia del banner (mismas plantillas que los anuncios del estudio). La
  // colocación sale de `position`, no de style.position/align.
  style?: AnnouncementStyle;
};

export type HerdPublicMessageConfig = HerdMessageConfig & {
  minIntervalSec?: number;
  milestoneEvery?: number;
};

export type EventHerdConfig = {
  enabled: boolean;
  fieldId?: string;
  groupLabels?: Array<{ value: string; label: string }>;
  accentColor?: string;
  privateMessage?: HerdMessageConfig;
  publicMessage?: HerdPublicMessageConfig;
};

/** Grupo (opción del campo) tal como lo espeja el backend */
export type HerdGroup = { key: string; value: string; optionLabel: string; label: string };

/** Config espejada en RTDB para el asistente */
export type HerdLiveConfig = {
  enabled: boolean;
  fieldId: string | null;
  accentColor?: string;
  privateMessage?: HerdMessageConfig;
  publicMessage?: HerdPublicMessageConfig;
  groups?: HerdGroup[];
};

export type HerdCounts = { counts: Record<string, number>; total: number };

export type HerdPublicEvent = {
  key: string;
  label: string;
  count: number;
  total: number;
  at: number;
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
export const DEFAULT_HERD_PRIVATE: HerdMessageResolved = {
  enabled: true,
  template: "¡Hola {nombre}! Contigo ya son {cantidad} {grupo} conectados",
  position: "top-left",
  durationSec: 8,
};

export const DEFAULT_HERD_PUBLIC: HerdMessageResolved &
  Required<Pick<HerdPublicMessageConfig, "minIntervalSec" | "milestoneEvery">> = {
  enabled: true,
  template: "¡Ya son {cantidad} {grupo} conectados!",
  position: "bottom-left",
  durationSec: 6,
  minIntervalSec: 20,
  milestoneEvery: 1,
};

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
): { key: string; label: string } | null {
  if (!config.fieldId || !registrationData) return null;
  const rawValue = registrationData[config.fieldId];
  const raw = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (raw == null || typeof raw === "object" || !String(raw).trim()) return null;

  const n = norm(raw);
  const group = (config.groups ?? []).find(
    (g) => norm(g.value) === n || norm(g.optionLabel) === n,
  );
  if (group) return { key: group.key, label: group.label };
  return { key: herdKey(raw), label: String(raw).trim() };
}

/** Sustituye las variables de la plantilla */
export function renderHerdTemplate(
  template: string,
  vars: { nombre?: string; cantidad?: number; grupo?: string; total?: number },
) {
  return template
    .replace(/\{nombre\}/gi, vars.nombre ?? "")
    .replace(/\{cantidad\}/gi, String(vars.cantidad ?? ""))
    .replace(/\{grupo\}/gi, vars.grupo ?? "")
    .replace(/\{total\}/gi, String(vars.total ?? ""))
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
      cb(v ? { counts: v.counts ?? {}, total: Number(v.total ?? 0) } : null);
    },
    logError(`/herd/${eventId}/live`),
  );
}

/** Grupo propio del asistente, publicado por el backend al detectar su presencia */
export function subscribeHerdMember(
  eventId: string,
  uid: string,
  cb: (g: { key: string; label: string } | null) => void,
) {
  return onValue(
    ref(rtdb, `/herd/${eventId}/members/${uid}`),
    (s) => cb((s.val() as { key: string; label: string }) ?? null),
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

export async function updateHerdConfig(
  eventId: string,
  config: EventHerdConfig,
): Promise<EventItem> {
  const { data } = await api.patch(`/events/${eventId}/herd-config`, config);
  return data;
}
