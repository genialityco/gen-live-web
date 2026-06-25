import { useEffect, useState } from "react";
import { Stack, Text, Loader, Alert, Button, Center } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { getEventReport, type EventReport } from "../../api/event-report";
import type { EventItem } from "../../api/events";
import type { Org } from "../../api/orgs";
import EventReportView, { type ReportMode } from "./EventReportView";

interface EventAdminReportProps {
  event: EventItem;
  org?: Org | null;
}

export default function EventAdminReport({ event, org }: EventAdminReportProps) {
  const [report, setReport] = useState<EventReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ReportMode>("general");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEventReport(event._id);
      setReport(data);
    } catch (err) {
      console.error("Error loading event report:", err);
      setError("No se pudo cargar el informe del evento");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event._id]);

  if (loading) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            Generando informe...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (error || !report) {
    return (
      <Stack gap="md">
        <Alert variant="filled" color="red" title="Error">
          {error || "Sin datos"}
        </Alert>
        <Button
          leftSection={<IconRefresh size={16} />}
          onClick={load}
          variant="light"
          w="fit-content"
        >
          Reintentar
        </Button>
      </Stack>
    );
  }

  // Enlace público compartible (sin login): /org/:domainSlug/event/:eventSlug/report
  const shareUrl =
    org?.domainSlug && event.slug
      ? `${window.location.origin}/org/${org.domainSlug}/event/${event.slug}/report`
      : undefined;

  return (
    <EventReportView
      report={report}
      event={event}
      org={org}
      mode={mode}
      onModeChange={setMode}
      onRefresh={load}
      shareUrl={shareUrl}
    />
  );
}
