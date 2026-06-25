// api/event-report.ts
// Informe global por evento: unifica campañas de email + WhatsApp con el
// engagement / tiempo de visualización de los asistentes (yuxtaposición).
import { api } from "../core/api";
import type { EventTimelines } from "./events";

export interface EmailCampaignTotals {
  total: number;
  sent: number;
  bounced: number;
  failed: number;
  clicked: number;
  totalClicks: number;
}

export interface WaCampaignTotals {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  optedOut: number;
  clicked: number;
  totalClicks: number;
}

export interface ReportCampaign {
  id: string;
  name: string;
  status: string;
  stats: Record<string, number>;
}

export interface RegistrationDistributionItem {
  value: string;
  label: string | null;
  count: number; // registrados con esta opción
  viewers: number; // espectadores únicos (asistieron) con esta opción
}

export interface RegistrationDistribution {
  key: "pais" | "perfil" | "especialidad" | "subespecialidad";
  fieldId: string;
  fieldLabel: string;
  isCountry: boolean;
  items: RegistrationDistributionItem[];
  unknown: number; // registrados sin valor en este campo
  unknownViewers: number; // espectadores únicos sin valor en este campo
}

export interface RegistrationsReport {
  total: number;
  viewersTotal: number; // registrados que asistieron (espectadores únicos)
  distributions: RegistrationDistribution[];
}

export interface EventReport {
  eventId: string;
  generatedAt: string;
  email: {
    campaignCount: number;
    totals: EmailCampaignTotals;
    campaigns: ReportCampaign[];
  };
  whatsapp: {
    campaignCount: number;
    totals: WaCampaignTotals;
    campaigns: ReportCampaign[];
  };
  viewing: {
    currentConcurrentViewers: number;
    peakConcurrentViewers: number;
    totalUniqueViewers: number;
    uniqueViewers: number;
    liveViewers: number;
    replayViewers: number;
    totalSessions: number;
    totalWatchTimeSeconds: number;
    totalLiveWatchTimeSeconds: number;
    totalReplayWatchTimeSeconds: number;
    avgWatchTimeSeconds: number;
    avgLiveWatchTimeSeconds: number;
    avgReplayWatchTimeSeconds: number;
  };
  registrations?: RegistrationsReport;
}

export async function getEventReport(eventId: string): Promise<EventReport> {
  const { data } = await api.get<EventReport>(`/events/${eventId}/report`);
  return data;
}

// ─── Informe público (sin autenticación, por slug del evento) ────────────────
export interface PublicEventReportMeta {
  title: string;
  status: string;
  schedule?: { startsAt?: string; endsAt?: string } | null;
  branding?: {
    header?: { backgroundImageUrl?: string };
    coverImageUrl?: string;
  } | null;
}

export interface PublicEventReportOrg {
  name: string | null;
  branding?: { logoUrl?: string | null } | null;
}

export interface PublicEventReportResponse {
  event: PublicEventReportMeta;
  org: PublicEventReportOrg;
  report: EventReport;
}

export async function getPublicEventReport(
  slug: string
): Promise<PublicEventReportResponse> {
  const { data } = await api.get<PublicEventReportResponse>(
    `/events/public/${encodeURIComponent(slug)}/report`
  );
  return data;
}

// ─── Métricas públicas (sin autenticación, por slug del evento) ──────────────
export interface PublicMetricsSummary {
  currentConcurrentViewers: number;
  peakConcurrentViewers: number;
  totalUniqueViewers: number;
  lastUpdate: number;
}

export interface PublicEventMetricsResponse {
  event: PublicEventReportMeta;
  org: PublicEventReportOrg;
  metrics: PublicMetricsSummary;
  timelines: EventTimelines;
}

export async function getPublicEventMetrics(
  slug: string
): Promise<PublicEventMetricsResponse> {
  const { data } = await api.get<PublicEventMetricsResponse>(
    `/events/public/${encodeURIComponent(slug)}/metrics`
  );
  return data;
}
