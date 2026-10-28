// src/components/events/VideoNetworkGuard.tsx
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Box, Button, List, Stack, Text } from "@mantine/core";
import { IconRefresh, IconWifiOff } from "@tabler/icons-react";
import { trackEvent } from "../../lib/utmTracking";

const PROBE_TIMEOUT_MS = 10_000;
const PROBE_RETRY_MS = 2_000;

/**
 * ¿El navegador puede conectarse al servidor del video? Un fetch no-cors
 * resuelve (respuesta opaca) si hay conexión y falla con TypeError si la red
 * la corta: firewall, proxy o inspección SSL con certificado no confiable
 * (p. ej. Fortinet → ERR_CERT_AUTHORITY_INVALID).
 * true = alcanzable, false = bloqueado, null = no se sabe (timeout/offline).
 */
async function probe(url: string): Promise<boolean | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store", credentials: "omit", signal: ctrl.signal });
    return true;
  } catch {
    return ctrl.signal.aborted ? null : false;
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

/**
 * Envuelve el reproductor: si la red del asistente bloquea el servidor del
 * video, muestra encima un aviso con qué hacer en lugar de la página de error
 * del navegador. Solo avisa tras dos fallos seguidos (evita falsos positivos
 * por un corte momentáneo).
 */
export function VideoNetworkGuard({ src, children }: { src: string; children: ReactNode }) {
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  // Cambiarla remonta el reproductor al reintentar
  const [attempt, setAttempt] = useState(0);

  const check = useCallback(
    async (isAlive: () => boolean) => {
      setChecking(true);
      let ok = await probe(src);
      if (ok === false && isAlive()) {
        await new Promise((r) => setTimeout(r, PROBE_RETRY_MS));
        ok = await probe(src);
      }
      if (!isAlive()) return;
      setChecking(false);
      setBlocked(ok === false);
      if (ok === false) trackEvent("video_network_blocked", { video_host: hostOf(src) });
    },
    [src],
  );

  useEffect(() => {
    let alive = true;
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
