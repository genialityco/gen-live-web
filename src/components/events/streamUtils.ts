import type { EventStream } from "../../api/events";

export function resolveStreams(
  streams?: EventStream[] | null,
  legacyStream?: { url?: string; provider?: string | null } | null
): EventStream[] {
  if (streams && streams.length > 0) return streams;
  if (legacyStream?.url) {
    return [{ provider: legacyStream.provider || "default", url: legacyStream.url }];
  }
  return [];
}
