// src/pages/studio/streamProviders.ts
import type { StreamProvider } from "../../api/livekit-service";

/**
 * Qué hace cada proveedor de transmisión en la plataforma: cómo se
 * configura en el estudio, qué reproductor ve el asistente y cómo queda la
 * repetición. Es la fuente de los textos del panel "Configuración del Live"
 * y del Control del evento, así que debe reflejar el comportamiento real
 * del backend (livekit.controller / events.service).
 */
export type ProviderInfo = {
  id: StreamProvider;
  label: string;
  color: string;
  /** auto: la plataforma crea servidor, clave y URL por API */
  setup: "auto" | "manual";
  rtmpServer?: string;
  srtServer?: string;
  /** Dónde sacar la clave y la URL de reproducción en el proveedor */
  where: string;
  playbackPlaceholder: string;
  /** URL de reproducción que la plataforma sabe reproducir y medir */
  playbackOk: RegExp;
  playbackHint: string;
  replayMode: "auto" | "recordings" | "manual";
  replay: string;
};

export const STREAM_PROVIDERS: ProviderInfo[] = [
  {
    id: "mux",
    label: "Mux",
    color: "orange",
    setup: "auto",
    where:
      "No hay que copiar nada: «Crear transmisión en Mux» genera el servidor, la clave y la URL de reproducción.",
    playbackPlaceholder: "https://stream.mux.com/xxxx.m3u8",
    playbackOk: /stream\.mux\.com\/.+\.m3u8/i,
    playbackHint: "La genera Mux al crear la transmisión.",
    replayMode: "recordings",
    replay:
      "Mux graba solo. Al terminar: Control del evento → Repetición → elige la grabación → «Activar repetición».",
  },
  {
    id: "vimeo",
    label: "Vimeo",
    color: "blue",
    setup: "manual",
    rtmpServer: "rtmp://rtmp-global.cloud.vimeo.com/live",
    where:
      "En Vimeo: Live → tu evento → Configuración de transmisión (RTMP). Copia la Stream key. La URL de reproducción es la del video del evento.",
    playbackPlaceholder: "https://player.vimeo.com/video/123456789",
    playbackOk: /vimeo\.com\/(video\/)?\d+/i,
    playbackHint:
      "Pega https://vimeo.com/ID o https://player.vimeo.com/video/ID (se normaliza al guardar).",
    replayMode: "auto",
    replay:
      "Vimeo guarda la grabación en el mismo video (si el evento tiene activado guardar la grabación). Solo cambia el estado del evento a Repetición.",
  },
  {
    id: "cloudflare",
    label: "Cloudflare",
    color: "grape",
    setup: "manual",
    rtmpServer: "rtmps://live.cloudflare.com:443/live",
    srtServer: "srt://live.cloudflare.com:778",
    where:
      "En Cloudflare: Stream → Live inputs → tu input. Copia la clave RTMPS (o la URL SRT) y la URL HLS (.m3u8) de reproducción.",
    playbackPlaceholder:
      "https://customer-xxx.cloudflarestream.com/<id>/manifest/video.m3u8",
    playbackOk: /(cloudflarestream\.com|videodelivery\.net)\/[a-f0-9]{32}\/manifest\/video\.m3u8/i,
    playbackHint: "Usa la URL HLS (.m3u8) del live input, no la del reproductor embebido.",
    replayMode: "auto",
    replay:
      "Automática: al pasar el evento a Finalizado o Repetición, la plataforma espera la grabación (unos minutos) y la pone como fuente. Si no aparece, actívala en Control del evento → Repetición.",
  },
  {
    id: "bunny",
    label: "Bunny",
    color: "yellow",
    setup: "manual",
    rtmpServer: "rtmp://global.rtmp.mediadelivery.net/live",
    where:
      "En Bunny: Stream → tu librería → Live → tu transmisión. Copia la Stream key y la URL HLS (playlist.m3u8).",
    playbackPlaceholder: "https://vz-xxx.b-cdn.net/<videoId>/playlist.m3u8",
    playbackOk: /\.m3u8(\?|$)/i,
    playbackHint:
      "Usa la URL HLS (.m3u8), no la del reproductor embebido (iframe.mediadelivery.net).",
    replayMode: "manual",
    replay:
      "Manual: cuando Bunny termine de procesar la grabación, pega su URL en Control del evento → Fuentes de video y cambia el estado a Repetición.",
  },
];

export function providerInfo(id?: string | null): ProviderInfo | undefined {
  return STREAM_PROVIDERS.find((p) => p.id === id);
}

/** Qué reproductor verá el asistente para esta URL (mismo criterio que EventAttendGcore). */
export function viewerPlayerFor(url: string): { label: string; measured: boolean } {
  if (url.includes(".m3u8"))
    return { label: "reproductor HLS de la plataforma", measured: true };
  if (/vimeo\.com/i.test(url))
    return { label: "reproductor de Vimeo", measured: true };
  return { label: "un iframe genérico", measured: false };
}

/**
 * Deja las URL de Vimeo (vimeo.com/ID o vimeo.com/ID/HASH) como
 * https://player.vimeo.com/video/ID, conservando el hash de los videos no
 * listados (?h=). Las de player.vimeo.com se dejan tal cual.
 */
export function normalizePlaybackUrl(provider: string, input: string) {
  const url = input.trim();
  if (provider === "vimeo" && !/player\.vimeo\.com/i.test(url)) {
    const m = url.match(/vimeo\.com\/(\d+)(?:\/([a-z0-9]+))?/i);
    if (m) {
      const hash = m[2] ?? url.match(/[?&]h=([a-z0-9]+)/i)?.[1];
      return `https://player.vimeo.com/video/${m[1]}${hash ? `?h=${hash}` : ""}`;
    }
  }
  return url;
}
