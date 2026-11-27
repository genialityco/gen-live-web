// utils/youtube.ts
// Helpers de URL de YouTube compartidos entre YouTubePlayer y las páginas que
// eligen el reproductor según la fuente.

/** Extrae el ID del video de cualquier formato de URL de YouTube. */
export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.split("/")[1] || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
      if (m) return m[2];
    }
  } catch {
    /* URL inválida */
  }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null;
}

/**
 * Construye la URL embed con enablejsapi=1 (obligatorio para que la IFrame API
 * pueda escuchar el iframe) y origin (YouTube solo envía eventos a ese origen).
 * Conserva parámetros útiles del original (start, list, autoplay…).
 */
export function buildYouTubeEmbedUrl(src: string): string {
  const id = extractYouTubeId(src);
  if (!id) return src;
  const embed = new URL(`https://www.youtube.com/embed/${id}`);
  try {
    const original = new URL(src);
    original.searchParams.forEach((value, key) => {
      if (key !== "v" && key !== "si" && key !== "t") {
        embed.searchParams.set(key, value);
      }
    });
    // Formato watch?t=90 → start=90 en el embed.
    const t = original.searchParams.get("t");
    if (t && !embed.searchParams.has("start")) {
      embed.searchParams.set("start", String(parseInt(t, 10) || 0));
    }
  } catch {
    /* empty */
  }
  embed.searchParams.set("enablejsapi", "1");
  embed.searchParams.set("playsinline", "1");
  embed.searchParams.set("rel", "0");
  if (typeof window !== "undefined") {
    embed.searchParams.set("origin", window.location.origin);
  }
  return embed.toString();
}
