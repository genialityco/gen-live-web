import { api } from '../core/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WaTemplateStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'paused' | 'disabled';
export type WaCampaignStatus = 'draft' | 'sending' | 'completed' | 'failed' | 'cancelled';
export type WaDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'opted_out';

export interface WaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: string;
  text?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string; example?: string[] }>;
  example?: { body_text?: string[][]; header_text?: string[]; header_handle?: string[] };
  /** Solo para HEADER format IMAGE: URL pública de una imagen de ejemplo para la revisión de Meta */
  exampleImageUrl?: string;
}

export interface WaTemplate {
  _id: string;
  name: string;
  displayName: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: WaTemplateComponent[];
  variableMappings: Record<string, string>;
  status: WaTemplateStatus;
  metaTemplateId: string | null;
  rejectionReason: string | null;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
}

export interface WaUtmParam {
  name: string;
  value: string;
}

export interface WaCampaignStats {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  optedOut: number;
  clicked: number;
  totalClicks: number;
}

export interface WaCampaign {
  _id: string;
  orgId: string;
  eventId: string;
  name: string;
  templateId: string;
  utmParams: WaUtmParam[] | null;
  status: WaCampaignStatus;
  stats: WaCampaignStats;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface WaDelivery {
  _id: string;
  phone: string;
  name: string;
  status: WaDeliveryStatus;
  waMessageId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  clickCount: number;
  firstClickAt: string | null;
}

export interface WaUtmValueStat {
  value: string;
  clicks: number;
  uniqueClickers: number;
}

export interface WaCampaignAnalytics {
  totalClicks: number;
  uniqueClickers: number;
  byUtm: Record<string, WaUtmValueStat[]>;
}

export interface WaCountryReportItem {
  value: string; // valor del campo país (normalmente ISO2, ej: 'CO')
  label: string | null; // etiqueta del formulario si existe
  count: number;
}

export interface WaCountryReport {
  fieldId: string | null; // null si la org no tiene campo país en el formulario
  fieldLabel: string | null;
  byCountry: WaCountryReportItem[];
  unknown: number; // envíos sin país declarado
  total: number;
}

export interface WaGeoCountryStat {
  country: string; // ISO2 resuelto por geolocalización
  clicks: number;
  uniqueClickers: number;
}

export interface WaGeoAnalytics {
  byCountry: WaGeoCountryStat[];
  unknown: { clicks: number; uniqueClickers: number };
}

// ─── Template API ─────────────────────────────────────────────────────────────

export async function listWaTemplates(): Promise<WaTemplate[]> {
  const res = await api.get('/wa-campaign/templates');
  return res.data;
}

export async function listApprovedWaTemplates(): Promise<WaTemplate[]> {
  const res = await api.get('/wa-campaign/templates/approved');
  return res.data;
}

export async function createWaTemplate(data: {
  name: string;
  displayName: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: WaTemplateComponent[];
  variableMappings: Record<string, string>;
}): Promise<WaTemplate> {
  const res = await api.post('/wa-campaign/templates', data);
  return res.data;
}

export async function updateWaTemplate(
  id: string,
  data: {
    name: string;
    displayName: string;
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
    language: string;
    components: WaTemplateComponent[];
    variableMappings: Record<string, string>;
  },
): Promise<WaTemplate> {
  const res = await api.patch(`/wa-campaign/templates/${id}`, data);
  return res.data;
}

export async function deleteWaTemplate(id: string): Promise<void> {
  await api.delete(`/wa-campaign/templates/${id}`);
}

export async function submitWaTemplate(id: string): Promise<WaTemplate> {
  const res = await api.post(`/wa-campaign/templates/${id}/submit`);
  return res.data;
}

export async function syncWaTemplate(id: string): Promise<WaTemplate> {
  const res = await api.post(`/wa-campaign/templates/${id}/sync`);
  return res.data;
}

export async function syncWaTemplateUrl(id: string): Promise<WaTemplate> {
  const res = await api.post(`/wa-campaign/templates/${id}/sync-url`);
  return res.data;
}

// ─── Campaign API ─────────────────────────────────────────────────────────────

export async function listWaCampaigns(orgId: string, eventId: string): Promise<WaCampaign[]> {
  const res = await api.get('/wa-campaign', { params: { orgId, eventId } });
  return res.data;
}

export async function getWaCampaign(id: string): Promise<WaCampaign> {
  const res = await api.get(`/wa-campaign/${id}`);
  return res.data;
}

export async function createWaCampaign(data: {
  orgId: string;
  eventId: string;
  name: string;
  templateId: string;
  utmParams?: WaUtmParam[];
}): Promise<WaCampaign> {
  const res = await api.post('/wa-campaign', data);
  return res.data;
}

export async function sendWaCampaign(id: string): Promise<{ total: number }> {
  const res = await api.post(`/wa-campaign/${id}/send`);
  return res.data;
}

export async function cancelWaCampaign(id: string): Promise<void> {
  await api.patch(`/wa-campaign/${id}/cancel`);
}

export async function deleteWaCampaign(id: string): Promise<void> {
  await api.delete(`/wa-campaign/${id}`);
}

export async function listWaDeliveries(
  campaignId: string,
  params: { status?: string; page?: number; limit?: number },
): Promise<{ data: WaDelivery[]; total: number }> {
  const res = await api.get(`/wa-campaign/${campaignId}/deliveries`, { params });
  return res.data;
}

export async function previewWaRecipients(
  campaignId: string,
  params: { page?: number; limit?: number },
): Promise<{ data: { phone: string; name: string }[]; total: number }> {
  const res = await api.get(`/wa-campaign/${campaignId}/preview-recipients`, { params });
  return res.data;
}

export async function getWaCampaignAnalytics(campaignId: string): Promise<WaCampaignAnalytics> {
  const res = await api.get(`/wa-campaign/${campaignId}/analytics`);
  return res.data;
}

export async function getWaCountryReport(campaignId: string): Promise<WaCountryReport> {
  const res = await api.get(`/wa-campaign/${campaignId}/country-report`);
  return res.data;
}

export async function getWaGeoAnalytics(campaignId: string): Promise<WaGeoAnalytics> {
  const res = await api.get(`/wa-campaign/${campaignId}/geo-analytics`);
  return res.data;
}

export async function backfillWaGeo(
  campaignId: string,
): Promise<{ updated: number; pending: number }> {
  const res = await api.post(`/wa-campaign/${campaignId}/backfill-geo`);
  return res.data;
}
