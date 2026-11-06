// src/api/engagement.ts
// Análisis de permanencia de una organización: cuánto se quedó cada asistente
// en vivo en cada evento y si recibió mensajes (anuncios de manada o logros).
import { api } from "../core/api";

/** Funciones de retención que tuvo el evento */
export type EngagementKind = "base" | "herd" | "milestones" | "both";

/**
 * Qué vivió el asistente en un evento:
 * T recibió mensajes · C grupo de control sorteado · X grupo excluido ·
 * N evento con funciones pero sin mensajes personales · B evento sin funciones
 */
export type ExposureStatus = "T" | "C" | "X" | "N" | "B";

export type EngagementEvent = {
  id: string;
  title: string;
  slug: string;
  status: string;
  hidden: boolean;
  date: string;
  endedAt: string | null;
  kind: EngagementKind;
  herd: { enabled: boolean; holdoutPercent: number; announcements: number };
  milestones: {
    enabled: boolean;
    holdoutPercent: number;
    items: number;
    awards: number;
    awardsShown: number;
  };
  liveViewers: number;
  hasPlayback: boolean;
  refMin: number; // duración de referencia del vivo (p95 de lo visto)
};

/** [índice del evento, minutos en vivo, hasta el final (1/0), estado] */
export type EngagementVisit = [number, number, number, ExposureStatus];

export type EngagementAttendee = {
  id: string;
  name: string;
  email: string;
  groupKey: string | null;
  group: string | null;
  visits: EngagementVisit[];
};

export type EngagementData = {
  events: EngagementEvent[];
  attendees: EngagementAttendee[];
};

export async function fetchEngagementAnalysis(
  orgId: string
): Promise<EngagementData> {
  const { data } = await api.get(`/events/by-org/${orgId}/engagement-analysis`);
  return data;
}
