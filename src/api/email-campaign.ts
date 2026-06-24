import { api } from "../core/api";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CampaignStatus =
  | "draft"
  | "sending"
  | "completed"
  | "failed"
  | "cancelled";

export interface UtmParam {
  name: string;
  value: string;
}

export type TargetAudience = "event_users" | "org_attendees" | "both";
export type DeliveryStatus =
  | "pending"
  | "sent"
  | "rejected"
  | "failed"
  | "bounced"
  | "complained";

export type EmailStatus = "valid" | "bounced" | "complained";

export interface SuppressedAttendee {
  _id: string;
  email: string;
  name: string;
  emailStatus: EmailStatus;
  emailBounceType: "Permanent" | "Transient" | null;
  emailSuppressedAt: string | null;
  emailSuppressReason: string | null;
}

export interface CampaignStats {
  total: number;
  pending: number;
  sent: number;
  rejected: number;
  failed: number;
  bounced: number;
  complained: number;
  clicked: number;
  totalClicks: number;
}

export interface UtmValueStat {
  value: string;
  sent: number; // destinatarios enviados con este valor de UTM
  clicks: number;
  uniqueClickers: number;
}

export interface CampaignAnalytics {
  totalClicks: number;
  uniqueClickers: number;
  byUtm: Record<string, UtmValueStat[]>;
}

export interface CountryReportItem {
  value: string; // valor del campo país (normalmente ISO2, ej: 'CO')
  label: string | null; // etiqueta del formulario si existe
  count: number;
}

export interface CountryReport {
  fieldId: string | null; // null si la org no tiene campo país en el formulario
  fieldLabel: string | null;
  byCountry: CountryReportItem[];
  unknown: number; // envíos sin país declarado
  total: number;
}

export interface GeoCountryStat {
  country: string; // ISO2 resuelto por geolocalización
  clicks: number;
  uniqueClickers: number;
}

export interface GeoAnalytics {
  byCountry: GeoCountryStat[];
  unknown: { clicks: number; uniqueClickers: number };
}

export interface EmailCampaign {
  _id: string;
  orgId: string;
  eventId: string;
  name: string;
  templateId: string;
  targetAudience: TargetAudience;
  audienceFilters?: { eventUserStatus?: string[] };
  utmParams?: UtmParam[] | null;
  excludeEventUsers?: boolean;
  status: CampaignStatus;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  stats: CampaignStats;
}

export interface EmailDelivery {
  _id: string;
  email: string;
  name: string;
  status: DeliveryStatus;
  sesMessageId?: string;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface DeliveryPage {
  data: EmailDelivery[];
  total: number;
}

// ─── API functions ───────────────────────────────────────────────────────────

export async function createCampaign(payload: {
  orgId: string;
  eventId: string;
  name: string;
  templateId: string;
  targetAudience: TargetAudience;
  audienceFilters?: { eventUserStatus?: string[] };
  utmParams?: UtmParam[];
  excludeEventUsers?: boolean;
}): Promise<EmailCampaign> {
  const { data } = await api.post("/email-campaign", payload);
  return data;
}

export async function listCampaigns(
  orgId: string,
  eventId: string
): Promise<EmailCampaign[]> {
  const { data } = await api.get(
    `/email-campaign/org/${orgId}/event/${eventId}`
  );
  return data;
}

export async function getCampaign(campaignId: string): Promise<EmailCampaign> {
  const { data } = await api.get(`/email-campaign/${campaignId}`);
  return data;
}

export async function sendCampaign(
  campaignId: string
): Promise<{ total: number }> {
  const { data } = await api.post(`/email-campaign/${campaignId}/send`);
  return data;
}

export async function cancelCampaign(campaignId: string): Promise<void> {
  await api.post(`/email-campaign/${campaignId}/cancel`);
}

export async function resumeCampaign(
  campaignId: string
): Promise<{ pending: number }> {
  const { data } = await api.post(`/email-campaign/${campaignId}/resume`);
  return data;
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  await api.delete(`/email-campaign/${campaignId}`);
}

export async function listDeliveries(
  campaignId: string,
  params?: { status?: DeliveryStatus; page?: number; limit?: number }
): Promise<DeliveryPage> {
  const { data } = await api.get(`/email-campaign/${campaignId}/deliveries`, {
    params,
  });
  return data;
}

export function exportDeliveriesUrl(campaignId: string): string {
  const baseUrl = import.meta.env.VITE_API_URL as string;
  return `${baseUrl}/email-campaign/${campaignId}/deliveries/export`;
}

export async function fetchSuppressedAttendees(
  orgId: string
): Promise<SuppressedAttendee[]> {
  const { data } = await api.get(`/email-campaign/org/${orgId}/suppressed`);
  return data;
}

export async function restoreAttendeeEmail(attendeeId: string): Promise<void> {
  await api.post(`/email-campaign/attendee/${attendeeId}/restore-email`);
}

export async function getCampaignAnalytics(
  campaignId: string
): Promise<CampaignAnalytics> {
  const { data } = await api.get(
    `/email-campaign/${campaignId}/analytics`
  );
  return data;
}

export async function getCountryReport(
  campaignId: string
): Promise<CountryReport> {
  const { data } = await api.get(`/email-campaign/${campaignId}/country-report`);
  return data;
}

export async function getGeoAnalytics(
  campaignId: string
): Promise<GeoAnalytics> {
  const { data } = await api.get(`/email-campaign/${campaignId}/geo-analytics`);
  return data;
}

export async function backfillGeo(
  campaignId: string
): Promise<{ updated: number; pending: number }> {
  const { data } = await api.post(`/email-campaign/${campaignId}/backfill-geo`);
  return data;
}
