import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  type EventItem,
  type VodMirrorJobStatus,
  type VodMirrorStatus,
  getEventVodMirror,
  retryEventVodMirror,
  updateEventBunnyReplayConfig,
} from "../../api/events";
import type { StreamProvider } from "../../api/livekit-service";

/** Cada cuánto se refresca el estado mientras la copia avanza. */
const POLL_MS = 30_000;

const STATUS_LABEL: Record<VodMirrorJobStatus, { label: string; color: string }> = {
  waiting_source: { label: "Esperando a Vimeo", color: "yellow" },
  importing: { label: "Subiendo a Bunny", color: "blue" },
  encoding: { label: "Procesando en Bunny", color: "blue" },
  ready: { label: "Lista", color: "green" },
  failed: { label: "Falló", color: "red" },
};

const isActive = (s?: VodMirrorJobStatus) =>
  s === "waiting_source" || s === "importing" || s === "encoding";

interface BunnyReplaySectionProps {
  event: EventItem;
  liveProvider: StreamProvider | null;
  onEventUpdate: (event: EventItem) => void;
}

/**
 * Opción del evento (apagada por defecto): al terminar un vivo hecho con
 * Vimeo, la plataforma sube la grabación a Bunny y la deja como fuente
 * principal de la repetición; Vimeo queda de respaldo. Muestra el avance de
 * la copia y permite reintentarla si falla.
 */
export function BunnyReplaySection({
  event,
  liveProvider,
  onEventUpdate,
}: BunnyReplaySectionProps) {
  const enabled = !!event.bunnyReplayConfig?.enabled;
  const [toggling, setToggling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [status, setStatus] = useState<VodMirrorStatus | null>(null);

  const latest = status?.jobs[0];

  // ¿La última copia ya era la fuente principal en la consulta anterior?
  const appliedRef = useRef<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getEventVodMirror(event._id);
      const nowApplied = !!next.jobs[0]?.applied;
      // La copia acaba de quedar como fuente principal: reflejarlo en el
      // panel (lista de fuentes y vista previa) sin recargar.
      if (appliedRef.current === false && nowApplied) {
        onEventUpdate({
          ...event,
          stream: next.stream ?? undefined,
          streams: next.streams,
        });
      }
      appliedRef.current = nowApplied;
      setStatus(next);
    } catch (err) {
      console.error("Error cargando la copia a Bunny:", err);
    }
  }, [event, onEventUpdate]);

  // Estado al abrir y, mientras la copia avanza, cada 30 s.
  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, event._id, event.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled || !isActive(latest?.status)) return;
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, latest?.status, refresh]);

  // Solo tiene sentido con Vimeo; si quedó activada con otro proveedor, se
  // sigue mostrando para poder apagarla.
  if (liveProvider !== "vimeo" && !enabled) return null;

  const handleToggle = async (next: boolean) => {
    setToggling(true);
    try {
      const updated = await updateEventBunnyReplayConfig(event._id, next);
      onEventUpdate({ ...event, ...updated });
      if (!next) {
        setStatus(null);
        appliedRef.current = null;
      }
      notifications.show({
        title: next ? "Copia a Bunny activada" : "Copia a Bunny desactivada",
        message: next
          ? event.status === "ended" || event.status === "replay"
            ? "Se empezó a copiar la grabación de Vimeo a Bunny."
            : "Al terminar el evento, la grabación se copiará a Bunny."
          : "La repetición seguirá usando las fuentes actuales.",
        color: next ? "green" : "gray",
      });
    } catch (err) {
      console.error("Error cambiando la copia a Bunny:", err);
      notifications.show({
        title: "Error",
        message: "No se pudo cambiar la configuración. Intenta de nuevo.",
        color: "red",
      });
    } finally {
      setToggling(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const next = await retryEventVodMirror(event._id);
      appliedRef.current = !!next.jobs[0]?.applied;
      setStatus(next);
    } catch (err) {
      console.error("Error reintentando la copia a Bunny:", err);
      notifications.show({
        title: "Error",
        message: "No se pudo reintentar la copia. Intenta de nuevo.",
        color: "red",
      });
    } finally {
      setRetrying(false);
    }
  };

  const badge = latest ? STATUS_LABEL[latest.status] : null;

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center" wrap="nowrap">
        <div>
          <Text fw={600} size="sm">
            🐰 Usar Bunny para la repetición
          </Text>
          <Text size="xs" c="dimmed">
            Al terminar el evento, copia la grabación de Vimeo a Bunny y la
            usa como fuente principal (Vimeo queda de respaldo). Puede tardar
            desde minutos hasta horas, según la duración.
          </Text>
        </div>
        <Switch
          checked={enabled}
          onChange={(e) => void handleToggle(e.currentTarget.checked)}
          disabled={toggling}
          color="yellow"
        />
      </Group>

      {enabled && liveProvider !== "vimeo" && (
        <Alert variant="light" color="gray" p="xs">
          <Text size="xs">
            Solo aplica cuando el estudio transmite con Vimeo.
          </Text>
        </Alert>
      )}

      {enabled && status && !status.configured && (
        <Alert variant="light" color="orange" p="xs">
          <Text size="xs">
            El servidor no tiene credenciales de Vimeo y Bunny: la copia no se
            hará hasta que se configuren.
          </Text>
        </Alert>
      )}

      {enabled && status?.configured && !latest && (
        <Text size="xs" c="dimmed">
          {event.status === "ended" || event.status === "replay"
            ? "Preparando la copia…"
            : "La copia empieza al pasar el evento a Finalizado o Repetición."}
        </Text>
      )}

      {enabled && latest && badge && (
        <Alert variant="light" color={badge.color} p="xs">
          <Group justify="space-between" align="center" wrap="nowrap">
            <div>
              <Group gap={6}>
                <Badge size="xs" variant="light" color={badge.color}>
                  {badge.label}
                </Badge>
                {latest.status === "ready" && (
                  <Text size="xs" c="dimmed">
                    {latest.applied
                      ? "Es la fuente principal de la repetición."
                      : "Se usará al pasar el evento a Repetición."}
                  </Text>
                )}
              </Group>
              {latest.status === "failed" ? (
                <Text size="xs" mt={4}>
                  {latest.lastError}
                </Text>
              ) : (
                latest.status !== "ready" &&
                latest.detail && (
                  <Text size="xs" mt={4}>
                    {latest.detail}
                  </Text>
                )
              )}
            </div>
            {latest.status === "failed" && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconRefresh size={14} />}
                loading={retrying}
                onClick={() => void handleRetry()}
                style={{ flexShrink: 0 }}
              >
                Reintentar
              </Button>
            )}
          </Group>
        </Alert>
      )}
    </Stack>
  );
}
