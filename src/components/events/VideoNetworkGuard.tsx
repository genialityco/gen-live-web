// src/components/events/VideoNetworkGuard.tsx
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Box, Button, List, Stack, Text } from "@mantine/core";
import { IconRefresh, IconWifiOff } from "@tabler/icons-react";
import { trackEvent } from "../../lib/utmTracking";
import {
  reportNetworkBlock,
  type NetworkBlockCause,
  type NetworkProbe,
} from "../../api/network-reports";

const PROBE_TIMEOUT_MS = 10_000;
const PROBE_RETRY_MS = 2_000;

// Sitio neutro de control: si también falla, la red intercepta todo el
// tráfico HTTPS (inspección SSL), no solo el video
const CONTROL_URL = "https://www.gstatic.com/generate_204";
// CDN del proveedor, para saber si el bloqueo alcanza también la entrega del video
const cdnFor = (host: string) => (/(^|\.)vimeo\.com$/i.test(host) ? "https://i.vimeocdn.com/" : null);

type ProbeResult = NetworkProbe["result"] | "offline";

/**
 * ¿El navegador puede conectarse a la URL? Un fetch no-cors resuelve
 * (respuesta opaca) si hay conexión y falla con TypeError si la red la corta:
 * firewall, proxy o inspección SSL con certificado no confiable (p. ej.
 * Fortinet → ERR_CERT_AUTHORITY_INVALID). El navegador no expone el código
 * exacto del error, solo que falló.
 */
async function probe(url: string): Promise<{ result: ProbeResult; ms: number }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { result: "offline", ms: 0 };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  const start = performance.now();
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store", credentials: "omit", signal: ctrl.signal });
    return { result: "ok", ms: Math.round(performance.now() - start) };
  } catch {
    return { result: ctrl.signal.aborted ? "timeout" : "blocked", ms: Math.round(performance.now() - start) };
  } finally {
    clearTimeout(timer);
  }
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/** Prueba el CDN y el sitio de control para saber qué alcanza el bloqueo */
async function diagnose(src: string, videoProbe: { result: ProbeResult; ms: number }) {
  const host = hostOf(src);
  const urls = [cdnFor(host), CONTROL_URL].filter((u): u is string => !!u);
  const results = await Promise.all(urls.map(probe));
  const probes: NetworkProbe[] = [{ url: src, ...videoProbe }, ...urls.map((url, i) => ({ url, ...results[i] }))]
    .filter((p): p is { url: string; result: NetworkProbe["result"]; ms: number } => p.result !== "offline")
    .map((p) => ({ host: hostOf(p.url), result: p.result, ms: p.ms }));
  const control = results[results.length - 1];
  const cause: NetworkBlockCause = control.result === "blocked" ? "all_blocked" : "video_blocked";
  return { cause, probes };
}

type NavigatorExtras = Navigator & {
  userAgentData?: { mobile?: boolean; platform?: string };
  connection?: { effectiveType?: string; type?: string };
};

function deviceInfo() {
  const nav = navigator as NavigatorExtras;
  return {
    mobile: nav.userAgentData?.mobile ?? /Mobi|Android|iPhone|iPad/i.test(nav.userAgent),
    platform: (nav.userAgentData?.platform || nav.platform || "").slice(0, 100) || undefined,
    connectionType: nav.connection?.type || nav.connection?.effectiveType || undefined,
  };
}

/**
 * Envuelve el reproductor: si la red del asistente bloquea el servidor del
 * video, muestra encima un aviso con qué hacer en lugar de la página de error
 * del navegador, y lo reporta al backend (causa, dominios que fallan, equipo)
 * para el resumen del control del evento. Solo avisa tras dos fallos seguidos
 * (evita falsos positivos por un corte momentáneo).
 */
export function VideoNetworkGuard({
  src,
  eventId,
  children,
}: {
  src: string;
  eventId?: string | null;
  children: ReactNode;
}) {
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  // Cambiarla remonta el reproductor al reintentar
  const [attempt, setAttempt] = useState(0);
  // Hubo bloqueo con esta fuente: si luego conecta, se reporta la recuperación
  const wasBlocked = useRef(false);

  const onBlocked = useCallback(
    async (videoProbe: { result: ProbeResult; ms: number }) => {
      const { cause, probes } = await diagnose(src, videoProbe);
      trackEvent("video_network_blocked", { video_host: hostOf(src), cause });
      if (!eventId) return;
      await reportNetworkBlock(eventId, {
        videoHost: hostOf(src),
        videoUrl: src.slice(0, 500),
        cause,
        probes,
        ...deviceInfo(),
      }).catch((err) => console.warn("No se pudo reportar el bloqueo de red:", err));
    },
    [src, eventId],
  );

  const check = useCallback(
    async (isAlive: () => boolean) => {
      setChecking(true);
      let p = await probe(src);
      if (p.result === "blocked" && isAlive()) {
        await new Promise((r) => setTimeout(r, PROBE_RETRY_MS));
        p = await probe(src);
      }
      if (!isAlive()) return;
      setChecking(false);
      setBlocked(p.result === "blocked");
      if (p.result === "blocked") {
        wasBlocked.current = true;
        void onBlocked(p);
      } else if (p.result === "ok" && wasBlocked.current) {
        wasBlocked.current = false;
        trackEvent("video_network_recovered", { video_host: hostOf(src) });
        if (eventId) {
          void reportNetworkBlock(eventId, { videoHost: hostOf(src), recovered: true }).catch(() => {});
        }
      }
    },
    [src, eventId, onBlocked],
  );

  useEffect(() => {
    let alive = true;
    wasBlocked.current = false;
    setBlocked(false);
    void check(() => alive);
    return () => {
      alive = false;
    };
  }, [check]);

  const retry = async () => {
    await check(() => true);
    setAttempt((n) => n + 1);
  };

  return (
    <Box style={{ position: "relative", width: "100%", height: "100%" }}>
      <Box key={attempt} style={{ width: "100%", height: "100%" }}>
        {children}
      </Box>
      {blocked && (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            // Opaco: tapa la página de error del navegador que queda debajo
            background: "#0a0c10",
            color: "#fff",
            overflowY: "auto",
            // margin: auto (no align-items) centra sin recortar si no cabe
            display: "flex",
            padding: 12,
          }}
        >
          <Stack gap={6} align="center" style={{ margin: "auto", width: "100%", maxWidth: 520, textAlign: "center" }}>
            <IconWifiOff size={28} />
            <Text fw={700} size="sm">Tu red no permite cargar el video</Text>
            {/* En celular el video es bajo: basta con el título y las opciones */}
            <Text size="xs" c="gray.4" visibleFrom="xs">
              La red a la que estás conectado (por ejemplo, la de tu entidad o
              empresa) o un programa de seguridad está bloqueando el servicio de
              video de esta transmisión.
            </Text>
            <List size="xs" c="gray.3" ta="left" spacing={2} style={{ overflowWrap: "anywhere" }}>
              <List.Item>Conéctate con los datos de tu celular, o compártelos a tu computador.</List.Item>
              <List.Item>
                O pide al área de sistemas que habilite <b>{hostOf(src)}</b>.
              </List.Item>
            </List>
            <Button
              size="xs"
              variant="white"
              leftSection={<IconRefresh size={14} />}
              loading={checking}
              onClick={() => void retry()}
            >
              Reintentar
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
