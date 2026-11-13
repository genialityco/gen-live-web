// src/api/milestones.ts
// Logros del asistente: cada evento define sus hitos (tipo + umbral + entrega)
// y el backend felicita al cumplirlos. Lo que se pinta sobre el video llega por
// RTDB, ya con el texto armado:
// - /milestones/{eventId}/config            apariencia (espejo de milestonesConfig)
// - /milestones/{eventId}/private/{uid}/{id} = { milestoneId, text, at }
// - /milestones/{eventId}/public             = { milestoneId, text, count, at }
import { limitToLast, onChildAdded, onValue, query, ref } from "firebase/database";
import { api } from "../core/api";
import { rtdb } from "../core/firebase";
import type { EventItem } from "./events";
import { HERD_MESSAGE_DEFAULT_STYLE, type HerdMessageConfig } from "./herd";

export type MilestoneType =
  | "watchMinutes"
  | "totalMinutes"
  | "firstToConnect"
  | "frequentAttendee"
  | "pollsAnswered"
  | "pollFirst"
  | "greetingsSent"
  | "manual";
export type MilestoneDelivery = "private" | "public" | "both";

export type MilestoneDef = {
  id: string;
  enabled?: boolean;
  type: MilestoneType;
  threshold: number;
  delivery: MilestoneDelivery;
  privateTemplate?: string;
  publicTemplate?: string;
};

export type MilestoneChannel = Pick<HerdMessageConfig, "position" | "durationSec" | "label" | "style">;

export type EventMilestonesConfig = {
  enabled: boolean;
  holdoutPercent?: number;
  accentColor?: string;
  // El asistente ve la lista de hitos y su avance («Mis logros»)
  showToAttendee?: boolean;
  privateMessage?: MilestoneChannel;
  publicMessage?: MilestoneChannel & { minIntervalSec?: number; maxNames?: number };
  items: MilestoneDef[];
};

/** Lo que el asistente lee de RTDB para pintar */
export type MilestonesLiveConfig = {
  enabled: boolean;
  accentColor?: string;
  showToAttendee?: boolean;
  privateMessage?: MilestoneChannel;
  publicMessage?: MilestoneChannel;
  updatedAt?: number;
};

export type MilestoneNotice = { milestoneId: string; text: string; count?: number; at: number };

// Réplica de gen-live-api/src/events/milestones.service.ts (DEFAULT_*)
export const MILESTONE_TYPES: Array<{
  value: MilestoneType;
  label: string;
  unit: string; // qué cuenta el umbral
  hint: string;
  defaults: { private: string; public: string };
}> = [
  {
    value: "watchMinutes",
    label: "Minutos seguidos conectado",
    unit: "minutos",
    hint: "Cuenta solo con el evento en vivo; un corte de más de 90 s reinicia la racha.",
    defaults: {
      private: "¡{nombre}, llevas {umbral} minutos seguidos con nosotros! Gracias por acompañarnos",
      public: "¡Felicitamos a {nombres} por {umbral} minutos seguidos con nosotros!",
    },
  },
  {
    value: "totalMinutes",
    label: "Minutos totales conectado",
    unit: "minutos",
    hint: "Suma todo el tiempo conectado con el evento en vivo, aunque se desconecte y vuelva.",
    defaults: {
      private: "¡{nombre}, ya sumas {umbral} minutos con nosotros! Gracias por acompañarnos",
      public: "¡{nombres} ya {suma|suman} {umbral} minutos con nosotros!",
    },
  },
  {
    value: "firstToConnect",
    label: "Entre los primeros en conectarse",
    unit: "primeros",
    hint: "Por la primera conexión al evento (también antes de empezar); se felicita cuando esté conectado en vivo.",
    defaults: {
      private:
        "¡{nombre}, fuiste de las primeras {umbral} personas en conectarte! Gracias por llegar temprano",
      public: "¡Gracias a {nombres} por estar entre los primeros en conectarse!",
    },
  },
  {
    value: "frequentAttendee",
    label: "Asistente frecuente",
    unit: "eventos",
    hint: "Eventos de la organización a los que asistió, contando este. {valor} = su número de eventos.",
    defaults: {
      private: "¡{nombre}, este es tu evento número {valor} con nosotros! Gracias por tu fidelidad",
      public: "¡{nombres} ya nos {ha|han} acompañado en {umbral} o más eventos!",
    },
  },
  {
    value: "pollsAnswered",
    label: "Encuestas respondidas",
    unit: "encuestas",
    hint: "Encuestas del evento respondidas por el asistente.",
    defaults: {
      private: "¡{nombre}, ya respondiste {umbral} encuestas! Gracias por participar",
      public: "¡{nombres} ya {respondió|respondieron} {umbral} encuestas!",
    },
  },
  {
    value: "pollFirst",
    label: "Entre los primeros en responder una encuesta",
    unit: "primeros",
    hint: "Se otorga una vez: la primera encuesta en la que quede entre los primeros N.",
    defaults: {
      private: "¡{nombre}, fuiste de los primeros {umbral} en responder la encuesta!",
      public: "¡{nombres} {fue|fueron} de los primeros en responder la encuesta!",
    },
  },
  {
    value: "greetingsSent",
    label: "Saludos enviados a colegas",
    unit: "saludos",
    hint: "Requiere el saludo entre colegas de los anuncios de manada.",
    defaults: {
      private: "¡{nombre}, ya saludaste a tus colegas {umbral} veces!",
      public: "¡{nombres} {está|están} animando la conversación con sus colegas!",
    },
  },
  {
    value: "manual",
    label: "Logro manual (lo otorgas tú)",
    unit: "",
    hint: "Lo entregas desde «Felicitar a…» eligiendo a los asistentes conectados: mejor pregunta, ganador de una dinámica…",
    defaults: {
      private: "¡Felicitaciones, {nombre}!",
      public: "¡Felicitamos a {nombres}!",
    },
  },
];

export const MILESTONE_DELIVERIES: Array<{ value: MilestoneDelivery; label: string }> = [
  { value: "private", label: "Privado" },
  { value: "public", label: "Público" },
  { value: "both", label: "Ambos" },
];

// Valores por defecto: los del evento isglt2-boehringer (acewebinarco)
export const DEFAULT_MILESTONE_PRIVATE: Required<Pick<MilestoneChannel, "position" | "durationSec">> &
  MilestoneChannel = {
  position: "top-center",
  durationSec: 8,
  label: "¡LOGRO!",
  style: HERD_MESSAGE_DEFAULT_STYLE,
};

export const DEFAULT_MILESTONE_PUBLIC: Required<Pick<MilestoneChannel, "position" | "durationSec">> &
  MilestoneChannel & { minIntervalSec: number; maxNames: number } = {
  position: "top-center",
  durationSec: 7,
  label: "FELICITACIONES",
  minIntervalSec: 30,
  maxNames: 3,
  style: HERD_MESSAGE_DEFAULT_STYLE,
};

/** % del grupo de control con que arranca un evento sin hitos configurados */
export const DEFAULT_MILESTONE_HOLDOUT = 20;

/** Hitos con que arranca un evento que aún no tiene hitos configurados */
export const DEFAULT_MILESTONE_ITEMS: MilestoneDef[] = [
  {
    id: "primeros-20",
    enabled: true,
    type: "firstToConnect",
    threshold: 20,
    delivery: "both",
    privateTemplate:
      "¡{nombre}, fuiste de las primeras {umbral} personas en conectarte! Gracias por llegar puntual",
    publicTemplate: "¡Gracias a {nombres} por estar entre los primeros en conectarse!",
  },
  {
    id: "seguidos-30",
    enabled: true,
    type: "watchMinutes",
    threshold: 30,
    delivery: "private",
    privateTemplate:
      "¡{nombre}, llevas {umbral} minutos seguidos con nosotros! Gracias por acompañarnos en esta sesión",
  },
  {
    id: "seguidos-60",
    enabled: true,
    type: "watchMinutes",
    threshold: 60,
    delivery: "private",
    privateTemplate:
      "¡{nombre}, ya son {umbral} minutos seguidos de actualización! Tu compromiso con tus pacientes se nota",
  },
  {
    id: "total-80",
    enabled: true,
    type: "totalMinutes",
    threshold: 80,
    delivery: "both",
    privateTemplate:
      "¡{nombre}, ya sumas {umbral} minutos de actualización médica con nosotros! Gracias por quedarte",
    publicTemplate: "¡Felicitamos a {nombres} por acompañarnos más de {umbral} minutos!",
  },
  {
    id: "frecuente-3",
    enabled: true,
    type: "frequentAttendee",
    threshold: 3,
    delivery: "private",
    privateTemplate: "¡{nombre}, este es tu evento número {valor} con nosotros! Gracias por tu fidelidad",
  },
  {
    id: "frecuente-5",
    enabled: true,
    type: "frequentAttendee",
    threshold: 5,
    delivery: "public",
    publicTemplate:
      "¡{nombres} ya nos {ha|han} acompañado en {umbral} o más eventos! Gracias por su fidelidad",
  },
  {
    id: "saludos-2",
    enabled: true,
    type: "greetingsSent",
    threshold: 2,
    delivery: "private",
    privateTemplate:
      "¡{nombre}, ya saludaste a tus colegas {umbral} veces! Gracias por darle vida a la comunidad",
  },
  {
    id: "mejor-pregunta",
    enabled: true,
    type: "manual",
    threshold: 1,
    delivery: "both",
    privateTemplate: "¡{nombre}, tu pregunta fue elegida como una de las mejores de la sesión!",
    publicTemplate: "¡Felicitamos a {nombres} por {su|sus} excelentes preguntas!",
  },
];

export function milestoneTypeInfo(type: MilestoneType) {
  return MILESTONE_TYPES.find((t) => t.value === type) ?? MILESTONE_TYPES[0];
}

/** Réplica de renderMilestoneTemplate del backend (para la vista previa) */
export function renderMilestoneTemplate(
  template: string,
  vars: { nombre?: string; nombres?: string; cantidad?: number; umbral: number; valor?: number },
) {
  const one = (vars.cantidad ?? 1) === 1;
  return template
    .replace(/\{nombre\}/g, vars.nombre ?? "")
    .replace(/\{nombres\}/g, vars.nombres ?? vars.nombre ?? "")
    .replace(/\{cantidad\}/g, String(vars.cantidad ?? 1))
    .replace(/\{umbral\}/g, String(vars.umbral))
    .replace(/\{valor\}/g, String(vars.valor ?? vars.umbral))
    .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, s: string, p: string) => (one ? s : p))
    .replace(/\s+/g, " ")
    .trim();
}

/** Identificador estable para un hito nuevo */
export function newMilestoneId(type: MilestoneType, threshold: number, taken: string[]) {
  const base = `${type}-${threshold}`.slice(0, 32);
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

const logError = (path: string) => (err: Error) => console.warn(`[milestones] ${path}:`, err.message);

export function subscribeMilestonesConfig(eventId: string, cb: (c: MilestonesLiveConfig | null) => void) {
  return onValue(
    ref(rtdb, `/milestones/${eventId}/config`),
    (s) => cb((s.val() as MilestonesLiveConfig) ?? null),
    logError(`/milestones/${eventId}/config`),
  );
}

/** Felicitaciones privadas nuevas de este uid (las últimas, ya filtradas por hora en el overlay) */
export function subscribeMilestonesPrivate(eventId: string, uid: string, cb: (n: MilestoneNotice & { id: string }) => void) {
  return onChildAdded(
    query(ref(rtdb, `/milestones/${eventId}/private/${uid}`), limitToLast(5)),
    (s) => cb({ id: s.key!, ...(s.val() as MilestoneNotice) }),
    logError(`/milestones/${eventId}/private`),
  );
}

export function subscribeMilestonesPublic(eventId: string, cb: (n: MilestoneNotice | null) => void) {
  return onValue(
    ref(rtdb, `/milestones/${eventId}/public`),
    (s) => cb((s.val() as MilestoneNotice) ?? null),
    logError(`/milestones/${eventId}/public`),
  );
}

export async function updateMilestonesConfig(eventId: string, config: EventMilestonesConfig): Promise<EventItem> {
  const { data } = await api.patch(`/events/${eventId}/milestones-config`, config);
  return data;
}

export type MilestonesReport = {
  enabled: boolean;
  holdoutPercent: number;
  milestones: Array<
    MilestoneDef & {
      awarded: number;
      holdout: number;
      privateSent: number;
      publicShown: number;
      first: string | null;
      last: string | null;
    }
  >;
  recent: Array<{
    milestoneId: string;
    name?: string;
    value?: number;
    holdout: boolean;
    privateSent: boolean;
    publicAt?: string;
    createdAt: string;
  }>;
};

export type MilestoneConnectedAttendee = {
  attendeeId: string;
  name: string;
  email: string;
  awarded: string[]; // logros manuales que ya recibió
};

/** Conectados ahora (para el logro manual) */
export async function getMilestonesConnected(eventId: string): Promise<MilestoneConnectedAttendee[]> {
  const { data } = await api.get(`/events/${eventId}/milestones/connected`);
  return data;
}

/** Otorga un logro manual a los asistentes elegidos */
export async function awardMilestone(
  eventId: string,
  milestoneId: string,
  attendeeIds: string[],
): Promise<{ awarded: number; already: number }> {
  const { data } = await api.post(`/events/${eventId}/milestones/award`, { milestoneId, attendeeIds });
  return data;
}

/** Un hito tal como lo ve el asistente en «Mis logros» */
export type MyMilestone = {
  id: string;
  type: MilestoneType;
  threshold: number;
  achieved: boolean;
  achievedAt: string | null;
  // Avance hacia el umbral; null = sin avance medible (posición o manual)
  progress: number | null;
  // Felicitación personal (solo si lo consiguió)
  text: string | null;
};

export type MyMilestones =
  | { visible: false }
  | { visible: true; live: boolean; accentColor: string | null; items: MyMilestone[] };

export async function getMyMilestones(eventId: string): Promise<MyMilestones> {
  const { data } = await api.get(`/events/${eventId}/milestones/mine`);
  return data;
}

/** Nombre, ícono y reto de cada tipo, como lo lee el asistente */
export const MILESTONE_ATTENDEE_INFO: Record<
  MilestoneType,
  { title: string; emoji: string; goal: (n: number) => string; unit?: string }
> = {
  watchMinutes: {
    title: "Maratonista",
    emoji: "⏱️",
    goal: (n) => `Quédate ${n} minutos seguidos en la transmisión`,
    unit: "min",
  },
  totalMinutes: {
    title: "Compromiso total",
    emoji: "📺",
    goal: (n) => `Suma ${n} minutos conectado en vivo`,
    unit: "min",
  },
  firstToConnect: {
    title: "Madrugador",
    emoji: "🌅",
    goal: (n) => `Sé de las primeras ${n} personas en conectarte`,
  },
  frequentAttendee: {
    title: "Asistente fiel",
    emoji: "💎",
    goal: (n) => `Acompáñanos en ${n} eventos`,
    unit: "eventos",
  },
  pollsAnswered: {
    title: "Voz activa",
    emoji: "🗳️",
    goal: (n) => `Responde ${n} ${n === 1 ? "encuesta" : "encuestas"}`,
    unit: "encuestas",
  },
  pollFirst: {
    title: "Respuesta relámpago",
    emoji: "⚡",
    goal: (n) => `Sé de los primeros ${n} en responder una encuesta`,
  },
  greetingsSent: {
    title: "Buen colega",
    emoji: "👋",
    goal: (n) => `Saluda a tus colegas ${n} ${n === 1 ? "vez" : "veces"}`,
    unit: "saludos",
  },
  manual: {
    title: "Logro sorpresa",
    emoji: "🎁",
    goal: () => "Lo entrega el equipo del evento a quien se destaque",
  },
};

export async function getMilestonesReport(eventId: string): Promise<MilestonesReport> {
  const { data } = await api.get(`/events/${eventId}/milestones/report`);
  return data;
}
