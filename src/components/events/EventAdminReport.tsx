import { useEffect, useState } from "react";
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Grid,
  Loader,
  Alert,
  Button,
  Badge,
  Center,
  Divider,
  SimpleGrid,
} from "@mantine/core";
import {
  IconMail,
  IconBrandWhatsapp,
  IconEye,
  IconRefresh,
  IconClock,
} from "@tabler/icons-react";
import { getEventReport, type EventReport } from "../../api/event-report";
import type { EventItem } from "../../api/events";

interface EventAdminReportProps {
  event: EventItem;
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds < 0) return "0s";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Stack gap={2}>
      <Text size="xl" fw={700}>
        {value}
      </Text>
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
    </Stack>
  );
}

export default function EventAdminReport({ event }: EventAdminReportProps) {
  const [report, setReport] = useState<EventReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            Generando informe global...
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

  const { email, whatsapp, viewing } = report;

  // Tasas derivadas (evita división por cero)
  const emailClickRate = email.totals.sent
    ? ((email.totals.clicked / email.totals.sent) * 100).toFixed(1)
    : "0.0";
  const waReadRate = whatsapp.totals.sent
    ? ((whatsapp.totals.read / whatsapp.totals.sent) * 100).toFixed(1)
    : "0.0";
  const waClickRate = whatsapp.totals.sent
    ? ((whatsapp.totals.clicked / whatsapp.totals.sent) * 100).toFixed(1)
    : "0.0";

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <div>
          <Title order={3}>Informe global del evento</Title>
          <Text size="xs" c="dimmed">
            Generado {new Date(report.generatedAt).toLocaleString("es")}
          </Text>
        </div>
        <Button
          leftSection={<IconRefresh size={16} />}
          onClick={load}
          variant="light"
          size="sm"
        >
          Actualizar
        </Button>
      </Group>

      <Grid gutter="md">
        {/* ─── Email ─── */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="md" h="100%">
            <Group gap="xs" mb="md">
              <IconMail size={22} color="var(--mantine-color-blue-6)" />
              <Title order={4}>Email</Title>
              <Badge variant="light" color="blue">
                {email.campaignCount}{" "}
                {email.campaignCount === 1 ? "campaña" : "campañas"}
              </Badge>
            </Group>
            <SimpleGrid cols={3} spacing="sm">
              <Stat label="Enviados" value={email.totals.sent} />
              <Stat label="Clics únicos" value={email.totals.clicked} />
              <Stat label="CTR" value={`${emailClickRate}%`} />
              <Stat label="Clics totales" value={email.totals.totalClicks} />
              <Stat label="Rebotes" value={email.totals.bounced} />
              <Stat label="Fallidos" value={email.totals.failed} />
            </SimpleGrid>
          </Card>
        </Grid.Col>

        {/* ─── WhatsApp ─── */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="md" h="100%">
            <Group gap="xs" mb="md">
              <IconBrandWhatsapp size={22} color="var(--mantine-color-teal-6)" />
              <Title order={4}>WhatsApp</Title>
              <Badge variant="light" color="teal">
                {whatsapp.campaignCount}{" "}
                {whatsapp.campaignCount === 1 ? "campaña" : "campañas"}
              </Badge>
            </Group>
            <SimpleGrid cols={3} spacing="sm">
              <Stat label="Enviados" value={whatsapp.totals.sent} />
              <Stat label="Entregados" value={whatsapp.totals.delivered} />
              <Stat label="Leídos" value={`${whatsapp.totals.read} (${waReadRate}%)`} />
              <Stat label="Clics" value={`${whatsapp.totals.clicked} (${waClickRate}%)`} />
              <Stat label="Fallidos" value={whatsapp.totals.failed} />
              <Stat label="Bajas" value={whatsapp.totals.optedOut} />
            </SimpleGrid>
          </Card>
        </Grid.Col>

        {/* ─── Engagement / visualización ─── */}
        <Grid.Col span={12}>
          <Card withBorder radius="md">
            <Group gap="xs" mb="md">
              <IconEye size={22} color="var(--mantine-color-grape-6)" />
              <Title order={4}>Engagement y visualización</Title>
            </Group>
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="lg">
              <Stat label="Espectadores únicos" value={viewing.uniqueViewers} />
              <Stat label="Vieron en vivo" value={viewing.liveViewers} />
              <Stat label="Vieron en diferido" value={viewing.replayViewers} />
              <Stat label="Pico concurrente" value={viewing.peakConcurrentViewers} />
              <Stat label="Sesiones totales" value={viewing.totalSessions} />
              <Stack gap={2}>
                <Group gap={4} wrap="nowrap">
                  <IconClock size={18} />
                  <Text size="xl" fw={700}>
                    {formatDuration(viewing.avgWatchTimeSeconds)}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" tt="uppercase">
                  Tiempo medio total / espectador
                </Text>
              </Stack>
              <Stack gap={2}>
                <Group gap={4} wrap="nowrap">
                  <IconClock size={18} />
                  <Text size="xl" fw={700}>
                    {formatDuration(viewing.avgLiveWatchTimeSeconds)}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" tt="uppercase">
                  Tiempo medio en vivo
                </Text>
              </Stack>
              <Stack gap={2}>
                <Group gap={4} wrap="nowrap">
                  <IconClock size={18} />
                  <Text size="xl" fw={700}>
                    {formatDuration(viewing.avgReplayWatchTimeSeconds)}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" tt="uppercase">
                  Tiempo medio en diferido
                </Text>
              </Stack>
            </SimpleGrid>
            <Divider my="md" />
            <Text size="xs" c="dimmed">
              <b>Espectadores únicos</b> = personas distintas que vieron en
              cualquier momento; <b>vieron en vivo</b> / <b>en diferido</b> son
              los subconjuntos según hayan estado durante el live o en el replay
              (una misma persona puede estar en ambos). <b>Sesiones</b> cuenta
              conexiones por dispositivo/pestaña, por lo que es mayor cuando hay
              reconexiones o multidispositivo. El <b>tiempo medio total</b> suma
              vivo + diferido; el <b>tiempo en diferido</b> se mide mientras el
              evento está en estado replay.
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Tiempo total acumulado: {formatDuration(viewing.totalWatchTimeSeconds)}{" "}
              (en vivo {formatDuration(viewing.totalLiveWatchTimeSeconds)} · diferido{" "}
              {formatDuration(viewing.totalReplayWatchTimeSeconds)}) ·{" "}
              {viewing.currentConcurrentViewers} viendo ahora
            </Text>
          </Card>
        </Grid.Col>
      </Grid>

      <Text size="xs" c="dimmed">
        Este informe yuxtapone el alcance de las campañas con la asistencia
        real. No correlaciona qué canal trajo a cada espectador (atribución por
        canal queda pendiente para una fase posterior).
      </Text>
    </Stack>
  );
}
