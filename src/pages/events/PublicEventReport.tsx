import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Stack,
  Text,
  Loader,
  Alert,
  Center,
} from "@mantine/core";
import {
  getPublicEventReport,
  type PublicEventReportResponse,
} from "../../api/event-report";
import EventReportView, {
  type ReportMode,
} from "../../components/events/EventReportView";
import PublicEventHeader from "../../components/events/PublicEventHeader";

// El informe es más pesado que las métricas; refrescamos con menos frecuencia.
const POLL_INTERVAL_MS = 30_000;

/**
 * Página PÚBLICA del informe del evento (compartible por enlace, sin login).
 * Solo expone este informe: no da acceso a ninguna otra sección del admin.
 * Se actualiza por polling al endpoint público `GET /events/public/:slug/report`.
 */
export default function PublicEventReport() {
  const { eventSlug } = useParams<{ slug: string; eventSlug: string }>();
  const [data, setData] = useState<PublicEventReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ReportMode>("general");
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
        const res = await getPublicEventReport(eventSlug);
        if (cancelled) return;
        setData(res);
        setError(null);
      } catch (err) {
        console.error("Error loading public event report:", err);
        // Solo error en la carga inicial; en refrescos mantenemos los últimos
        // datos válidos para no parpadear ante un fallo puntual.
        if (!cancelled && firstLoad.current) {
          setError("No se pudo cargar el informe del evento");
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
            Generando informe...
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

  return (
    <Container size="lg" py="xl">
      <PublicEventHeader
        title={data.event.title}
        startsAt={data.event.schedule?.startsAt}
        orgName={data.org.name}
        logoUrl={data.org.branding?.logoUrl}
      />
      <EventReportView
        report={data.report}
        event={data.event}
        org={data.org}
        mode={mode}
        onModeChange={setMode}
        onRefresh={() => {
          getPublicEventReport(eventSlug!).then(setData).catch(() => {});
        }}
      />
    </Container>
  );
}
