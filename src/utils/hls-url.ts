// src/utils/hls-url.ts

/**
 * Cloudflare Stream permite pedir el manifest en modo Low-Latency HLS
 * agregando `?protocol=llhls`/`llhlsbeta`. Ese modo está pensado para
 * reproductores NATIVOS (Safari/iOS AVPlayer tiene soporte LL-HLS real);
 * con hls.js (el resto de navegadores) es conocido que el "blocking
 * playlist reload" y los segmentos parciales de Cloudflare no siempre
 * calzan con su implementación, y la reproducción se cuelga o falla.
 *
 * Esta función quita ese parámetro antes de pasarle la URL a hls.js, para
 * que siempre caiga al manifest HLS regular (compatible), sin importar
 * cómo haya quedado configurada la playback URL. No toca nada si el
 * parámetro no está presente.
 */
export function stripCloudflareLowLatencyParam(url: string): string {
  try {
    const u = new URL(url);
    const protocol = u.searchParams.get("protocol");
    if (protocol && /^llhls/i.test(protocol)) {
      u.searchParams.delete("protocol");
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}
