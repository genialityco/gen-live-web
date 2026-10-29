// src/api/network-reports.ts
import { api } from "../core/api";

/** Por qué no se pudo conectar al servidor del video */
export type NetworkBlockCause =
  | "video_blocked" // solo falla el video: bloqueo por categoría
  | "all_blocked" // falla también el sitio de control: inspección SSL general
  | "timeout"; // la red descarta la conexión sin responder

export type NetworkProbe = { host: string; result: "ok" | "blocked" | "timeout"; ms: number };

export type NetworkBlockReportPayload = {
  videoHost: string;
  videoUrl?: string;
  cause?: NetworkBlockCause;
  probes?: NetworkProbe[];
  mobile?: boolean;
  platform?: string;
  connectionType?: string;
  recovered?: boolean;
};

export async function reportNetworkBlock(eventId: string, payload: NetworkBlockReportPayload) {
  await api.post(`/events/${eventId}/network-reports`, payload);
}

export type NetworkBlockSummary = {
  total: number;
  recovered: number;
  byCause: Partial<Record<NetworkBlockCause, number>>;
  byOrg: Array<{ org: string; n: number; prefixes: string[] }>;
  byHost: Array<{ host: string; n: number }>;
  byCountry: Array<{ country: string; n: number }>;
  recent: Array<{
    name: string | null;
    email: string | null;
    cause: NetworkBlockCause;
    videoHost: string;
    probes: NetworkProbe[];
    org: string | null;
    ipPrefix: string | null;
    country: string | null;
    mobile: boolean | null;
    connectionType: string | null;
    occurrences: number;
    recovered: boolean;
    lastSeenAt: string;
  }>;
};

export async function getNetworkBlockSummary(eventId: string): Promise<NetworkBlockSummary> {
  const { data } = await api.get(`/events/${eventId}/network-reports`);
  return data;
}

export const NETWORK_BLOCK_CAUSE_LABELS: Record<NetworkBlockCause, string> = {
  video_blocked: "Bloquea solo el video",
  all_blocked: "Inspección SSL / bloquea todo",
  timeout: "La red no responde",
};
