// src/utils/hls-url.ts

/**
 * Cloudflare Stream permite pedir el manifest en modo Low-Latency HLS
 * agregando `?protocol=llhls`/`llhlsbeta` (requiere además tener
 * `preferLowLatency: true` configurado en el Live Input de Cloudflare — si
 * no, el parámetro no tiene efecto real). Con versiones viejas de hls.js
 * esto llegó a colgar la reproducción (el "blocking playlist reload" y los
 * segmentos parciales de Cloudflare no calzaban bien), así que se dejó de
 * usar en vivo. Tras subir hls.js a 1.7.3 (con varios fixes de LL-HLS) se
 * volvió a habilitar para el reproductor en vivo (`ViewerHlsPlayer`) — ya
 * no se le quita el parámetro ahí.
 *
 * Para VOD/repetición (`VodHlsPlayer`) sí se sigue quitando con esta
 * función: no hay "borde en vivo" que acelerar, así que no aporta nada y
 * evita cualquier complejidad extra de LL-HLS en ese reproductor.
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
