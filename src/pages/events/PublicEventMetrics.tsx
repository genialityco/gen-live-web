import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Container, Stack, Text, Loader, Alert, Center } from "@mantine/core";
import {
  getPublicEventMetrics,
  type PublicEventMetricsResponse,
} from "../../api/event-report";
import EventMetricsView from "../../components/events/EventMetricsView";
import PublicEventHeader from "../../components/events/PublicEventHeader";

const POLL_INTERVAL_MS = 10_000;

/**
 * Página PÚBLICA de métricas del evento (compartible por enlace, sin login).
 * Solo expone estas métricas; no da acceso a ninguna otra sección del admin.
 * Como no hay sesión Firebase para escuchar RTDB, se actualiza por polling al
 * endpoint público `GET /events/public/:slug/metrics` (~cada 10s).
 */
export default function PublicEventMetrics() {
  const { eventSlug } = useParams<{ slug: string; eventSlug: string }>();
  const [data, setData] = useState<PublicEventMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    if (!eventSlug) {
      setError("Evento no encontrado");
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const res = await getPublicEventMetrics(eventSlug);
        if (cancelled) return;
        setData(res);
        setError(null);
      } catch (err) {
        console.error("Error loading public event metrics:", err);
        // Solo mostramos error en la carga inicial; en refrescos mantenemos los
        // últimos datos válidos para no parpadear ante un fallo puntual.
        if (!cancelled && firstLoad.current) {
          setError("No se pudieron cargar las métricas del evento");
        }
      } finally {
        if (!cancelled) {
          firstLoad.current = false;
          setLoading(false);
        }
      }
    };

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [eventSlug]);

  if (loading) {
    return (
      <Center mih="60vh">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            Cargando métricas en tiempo real...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (error || !data) {
    return (
      <Container size="sm" py="xl">
        <Alert variant="filled" color="red" title="Error">
          {error || "Sin datos"}
        </Alert>
      </Container>
    );
  }

  const isLive = data.event.status === "live";

  return (
    <Container size="lg" py="xl">
      <PublicEventHeader
        title={data.event.title}
        startsAt={data.event.schedule?.startsAt}
        orgName={data.org.name}
        logoUrl={data.org.branding?.logoUrl}
      />
      <EventMetricsView
        isLive={isLive}
        metrics={data.metrics}
        timelines={data.timelines}
      />
    </Container>
  );
}
