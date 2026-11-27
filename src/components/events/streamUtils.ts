import type { EventStream } from "../../api/events";

/**
 * Proveedor que, si está entre las fuentes de la repetición, siempre es la
 * principal (se reproduce primero; las demás quedan de respaldo).
 */
export const PRIMARY_REPLAY_PROVIDER = "bunny";

/**
 * Fuentes de la repetición en el orden en que se reproducen: las de
 * `streams` (o la legacy `stream` si no hay), con la de Bunny primero cuando
 * exista. El resto conserva el orden configurado.
 */
export function resolveStreams(
  streams?: EventStream[] | null,
  legacyStream?: { url?: string; provider?: string | null } | null
): EventStream[] {
  if (streams && streams.length > 0) return withPrimaryFirst(streams);
  if (legacyStream?.url) {
    return [{ provider: legacyStream.provider || "default", url: legacyStream.url }];
  }
  return [];
}

function withPrimaryFirst(list: EventStream[]): EventStream[] {
  const i = list.findIndex(
    (s) => s.provider?.toLowerCase() === PRIMARY_REPLAY_PROVIDER && !!s.url
  );
  if (i <= 0) return list;
  return [list[i], ...list.slice(0, i), ...list.slice(i + 1)];
}
