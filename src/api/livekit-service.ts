/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "../core/api";

export type LiveRole = "host" | "speaker" | "viewer";
export type LayoutMode = "speaker" | "grid";

export interface LiveConfig {
  eventSlug: string;
  ingestProtocol: "rtmp" | "srt";
  rtmpServerUrl?: string;
  rtmpStreamKey?: string; // vendrá '****' o vacío
  srtIngestUrl?: string; // '****' o vacío
  playbackHlsUrl?: string;
  layout?: "grid" | "speaker";
  maxParticipants?: number;
  status?: string;
  activeEgressId?: string;
  lastError?: string;
}

export interface EnsureRoomResponse {
  roomName: string;
  numParticipants?: number;
  metadata?: string;
}

export interface TokenResponse {
  token: string;
}

export interface StartLiveResponse {
  egressId: string;
  status?: any;
  playbackUrl?: string; // si backend lo retorna
}

export interface StopLiveResponse {
  egressId: string;
  status?: any;
}

export interface PlaybackResponse {
  playbackUrl: string;
}

export interface EgressStatusResponse {
  status?: any;
  error?: string;
  errorCode?: number;
  info?: any;
}

/**
 * LiveKit rooms
 */
export async function ensureRoom(eventSlug: string) {
  const { data } = await api.post<EnsureRoomResponse>("/livekit/rooms/ensure", {
    eventSlug,
  });
  return data;
}

export async function getLivekitToken(params: {
  eventSlug: string;
  role: LiveRole;
  identity?: string;
  name?: string;
}) {
  const qs = new URLSearchParams({
    eventSlug: params.eventSlug,
    role: params.role,
  });
  if (params.name) qs.append("name", params.name);
  if (params.identity) qs.append("identity", params.identity);

  const { data } = await api.get<TokenResponse>(
    `/livekit/token?${qs.toString()}`
  );
  return data;
}

/**
 * Live (egress)
 * Por ahora usas RTMP: /live/start-rtmp
 * (más adelante lo cambias a /live/start sin tocar UI)
 */
export async function startLiveRtmp(eventSlug: string) {
  const { data } = await api.post<StartLiveResponse>("/live/start-rtmp", {
    eventSlug,
  });
  return data;
}

export async function stopLive(egressId: string) {
  const { data } = await api.post<StopLiveResponse>("/live/stop", {
    egressId,
  });
  return data;
}

export async function getPlayback(eventSlug: string) {
  const { data } = await api.get<PlaybackResponse>(
    `/live/playback?eventSlug=${encodeURIComponent(eventSlug)}`
  );
  return data;
}

export async function getEgressStatus(egressId: string) {
  const { data } = await api.get<EgressStatusResponse>(
    `/live/status?egressId=${encodeURIComponent(egressId)}`
  );
  return data;
}

export async function getLiveConfig(eventSlug: string) {
  const { data } = await api.get<LiveConfig>(
    `/livekit/config?eventSlug=${encodeURIComponent(eventSlug)}`
  );
  return data;
}

export async function updateLiveConfig(
  payload: Partial<LiveConfig> & { eventSlug: string }
) {
  const { data } = await api.put(`/livekit/config`, payload);
  return data as { ok: boolean; id: string };
}
