import { useMemo, useState } from "react";
import { Box, Center, SegmentedControl, Stack, Text } from "@mantine/core";
import { VodHlsPlayer } from "../../pages/viewer/VodHlsPlayer";
import type { EventStream } from "../../api/events";
import { resolveStreams } from "./streamUtils";

const PROVIDER_LABELS: Record<string, string> = {
  vimeo: "Vimeo",
  bunny: "Bunny",
  cloudflare: "Cloudflare",
  mux: "Mux",
  youtube: "YouTube",
};

function providerLabel(provider: string) {
  return PROVIDER_LABELS[provider.toLowerCase()] ?? provider;
}

/**
 * Reproductor simple con selector de fuente (cuando hay más de un proveedor)
 * y fallback automático a la siguiente fuente si la activa falla. Usado en el
 * preview de admin; la vista de asistentes (EventAttendGcore) tiene su propia
 * variante para reutilizar el SDK de Vimeo y el tracking de reproducción.
 */
export function StreamPlayer({
  streams,
  legacyStream,
  title,
  autoPlay = false,
}: {
  streams?: EventStream[] | null;
  legacyStream?: { url?: string; provider?: string | null } | null;
  title: string;
  autoPlay?: boolean;
}) {
  const list = useMemo(
    () => resolveStreams(streams, legacyStream),
    [streams, legacyStream]
  );
  const listKey = list.map((s) => `${s.provider}:${s.url}`).join("|");

  const [manualProvider, setManualProvider] = useState<string | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [trackedKey, setTrackedKey] = useState(listKey);

  // Si cambia el conjunto de fuentes (nuevo evento/URLs), reinicia selección y fallos.
  if (trackedKey !== listKey) {
    setTrackedKey(listKey);
    setManualProvider(null);
    setFailed(new Set());
  }

  if (list.length === 0) return null;

  const available = list.filter((s) => !failed.has(s.provider));
  const active =
    (manualProvider &&
      list.find((s) => s.provider === manualProvider && !failed.has(s.provider))) ||
    available[0] ||
    list[0];

  const allFailed = failed.size >= list.length;

  const markFailed = (provider: string) => {
    setFailed((prev) => {
      if (prev.has(provider)) return prev;
      const next = new Set(prev);
      next.add(provider);
      return next;
    });
  };

  return (
    <Box style={{ position: "absolute", inset: 0 }}>
      {list.length > 1 && (
        <Box style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>
          <SegmentedControl
            size="xs"
            value={active.provider}
            onChange={(value) => {
              setFailed((prev) => {
                if (!prev.has(value)) return prev;
                const next = new Set(prev);
                next.delete(value);
                return next;
              });
              setManualProvider(value);
            }}
            data={list.map((s) => ({
              label: providerLabel(s.provider),
              value: s.provider,
            }))}
          />
        </Box>
      )}

      {allFailed ? (
        <Center h="100%" style={{ backgroundColor: "#000" }}>
          <Stack align="center" gap={4}>
            <Text c="white" size="sm" fw={500}>
              No se pudo cargar ninguna fuente de video
            </Text>
          </Stack>
        </Center>
      ) : active.url.includes(".m3u8") ? (
        <VodHlsPlayer
          key={active.url}
          src={active.url}
          autoPlay={autoPlay}
          onError={() => markFailed(active.provider)}
        />
      ) : (
        <iframe
          key={active.url}
          src={active.url}
          style={{ width: "100%", height: "100%", border: "none" }}
          title={title}
          frameBorder={0}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          onError={() => markFailed(active.provider)}
        />
      )}
    </Box>
  );
}
