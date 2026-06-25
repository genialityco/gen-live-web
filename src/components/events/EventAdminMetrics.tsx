import { useEffect, useState } from "react";
import { Stack, Text, Loader, Alert, Center } from "@mantine/core";
import { api } from "../../core/api";
import { useRealtimeMetrics } from "../../hooks/useRealtimeMetrics";
import {
  getEventTimelines,
  type EventItem,
  type EventTimelines,
} from "../../api/events";
import type { Org } from "../../api/orgs";
import EventMetricsView from "./EventMetricsView";

interface EventAdminMetricsProps {
  event: EventItem;
  org?: Org | null;
}

export default function EventAdminMetrics({ event, org }: EventAdminMetricsProps) {
  const { metrics, loading, error: rtdbError } = useRealtimeMetrics(event._id);

  // "Espectadores ahora" autoritativo: calculado desde la presencia real en RTDB
  // por el backend (cross-instancia, autocorregido). Refresca el valor de RTDB
  // que podría congelarse si la instancia con el watcher se reinicia/escala.
  const [authoritativeNow, setAuthoritativeNow] = useState<number | null>(null);
  const [timelines, setTimelines] = useState<EventTimelines | null>(null);

  const isLive = event.status === "live";

  // Series temporales (inscripciones + conexiones) para los gráficos.
  useEffect(() => {
    let cancelled = false;
    getEventTimelines(event._id)
      .then((data) => {
        if (!cancelled) setTimelines(data);
      })
      .catch((err) => console.error("Error loading event timelines:", err));
    return () => {
      cancelled = true;
    };
  }, [event._id]);

  useEffect(() => {
    if (!isLive) {
      setAuthoritativeNow(null);
      return;
    }
    let cancelled = false;
    const fetchNow = async () => {
      try {
        const { data } = await api.get<{ currentConcurrentViewers: number }>(
          `/events/${event._id}/concurrent-now`
        );
        if (!cancelled) setAuthoritativeNow(data.currentConcurrentViewers);
      } catch {
        // Si falla, se mantiene el valor de RTDB como fallback
      }
    };
    fetchNow();
    const interval = setInterval(fetchNow, 10000); // cada 10s
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isLive, event._id]);

  if (loading) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            Conectando a métricas en tiempo real...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (rtdbError || !metrics) {
    return (
      <Alert color="red" title="Error de conexión">
        {rtdbError || "No se pudieron cargar las métricas en tiempo real"}
      </Alert>
    );
  }

  // Enlace público compartible (sin login): /org/:domainSlug/event/:eventSlug/metrics
  const shareUrl =
    org?.domainSlug && event.slug
      ? `${window.location.origin}/org/${org.domainSlug}/event/${event.slug}/metrics`
      : undefined;

  return (
    <EventMetricsView
      isLive={isLive}
      metrics={{
        // El concurrente autoritativo (presencia RTDB) tiene prioridad sobre el
        // valor publicado en /metrics, que podría congelarse al escalar.
        currentConcurrentViewers:
          authoritativeNow ?? metrics.currentConcurrentViewers,
        peakConcurrentViewers: metrics.peakConcurrentViewers,
        totalUniqueViewers: metrics.totalUniqueViewers,
        lastUpdate: metrics.lastUpdate,
      }}
      timelines={timelines}
      shareUrl={shareUrl}
    />
  );
}
