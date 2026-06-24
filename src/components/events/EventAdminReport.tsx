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
  SegmentedControl,
} from "@mantine/core";
import {
  IconMail,
  IconBrandWhatsapp,
  IconEye,
  IconRefresh,
  IconClock,
  IconUsers,
} from "@tabler/icons-react";
import {
  getEventReport,
  type EventReport,
  type RegistrationDistribution,
} from "../../api/event-report";
import type { EventItem } from "../../api/events";
import { CountryBars, isoToFlag, countryName } from "../common/CountryBars";

interface EventAdminReportProps {
  event: EventItem;
}

type ReportMode = "general" | "detallado";

const DIST_TITLES: Record<RegistrationDistribution["key"], string> = {
  pais: "Distribución por país",
  perfil: "Distribución por perfil",
  especialidad: "Distribución por especialidad",
  subespecialidad: "Distribución por subespecialidad",
};

const DIST_COLORS: Record<RegistrationDistribution["key"], string> = {
  pais: "grape",
  perfil: "blue",
  especialidad: "teal",
  subespecialidad: "indigo",
};

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

  const { email, whatsapp, viewing, registrations } = report;
  const detailed = mode === "detallado";

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
          <Title order={3}>
            {detailed ? "Informe detallado del evento" : "Informe general del evento"}
          </Title>
          <Text size="xs" c="dimmed">
            Generado {new Date(report.generatedAt).toLocaleString("es")}
          </Text>
        </div>
        <Group gap="sm">
          <SegmentedControl
            size="sm"
            value={mode}
            onChange={(v) => setMode(v as ReportMode)}
            data={[
              { label: "General", value: "general" },
              { label: "Detallado", value: "detallado" },
            ]}
          />
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={load}
            variant="light"
            size="sm"
          >
            Actualizar
          </Button>
        </Group>
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
            {/* En el informe general se omiten sesiones, pico concurrente y tiempos
                medios; quedan solo los espectadores. El detallado los incluye. */}
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="lg">
              <Stat label="Espectadores únicos" value={viewing.uniqueViewers} />
              <Stat label="Vieron en vivo" value={viewing.liveViewers} />
              <Stat label="Vieron en diferido" value={viewing.replayViewers} />
              {detailed && (
                <>
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
                </>
              )}
            </SimpleGrid>
            <Divider my="md" />
            {detailed ? (
              <>
                <Text size="xs" c="dimmed">
                  <b>Espectadores únicos</b> = personas distintas que se conectaron
                  (asistencia), reprodujeran o no. <b>Vieron en vivo</b> /{" "}
                  <b>en diferido</b> son quienes <b>reprodujeron de verdad</b> el
                  video durante el live o el replay (una misma persona puede estar en
                  ambos); pueden ser menos que los únicos, lo que revela cuántos
                  llegaron pero no llegaron a ver. Los <b>tiempos</b> miden{" "}
                  <b>reproducción real</b> (solo mientras el video se reproduce): no
                  cuentan la cuenta-regresiva, las pausas ni pestañas de fondo, y los
                  promedios se calculan sobre quienes reprodujeron cada tramo.{" "}
                  <b>Sesiones</b> cuenta conexiones por dispositivo/pestaña, mayor
                  cuando hay reconexiones o multidispositivo.
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  Tiempo total acumulado: {formatDuration(viewing.totalWatchTimeSeconds)}{" "}
                  (en vivo {formatDuration(viewing.totalLiveWatchTimeSeconds)} · diferido{" "}
                  {formatDuration(viewing.totalReplayWatchTimeSeconds)})
                  {(event.status === "live" || event.status === "replay") && (
                    <> · {viewing.currentConcurrentViewers} viendo ahora</>
                  )}
                </Text>
              </>
            ) : (
              <Text size="xs" c="dimmed">
                <b>Espectadores únicos</b> = personas distintas que se conectaron
                (asistencia). <b>Vieron en vivo</b> / <b>en diferido</b> son quienes
                reprodujeron de verdad el video. Cambia a <b>Detallado</b> para ver
                sesiones, pico concurrente y tiempos de reproducción.
              </Text>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      {/* ─── Distribución de registros (solo informe general) ─── */}
      {!detailed && registrations && registrations.distributions.length > 0 && (
        <>
          <Divider />
          <Group gap="xs" align="center">
            <IconUsers size={22} color="var(--mantine-color-grape-6)" />
            <div>
              <Title order={4}>Distribución de registros</Title>
              <Text size="xs" c="dimmed">
                {registrations.total.toLocaleString()} personas registradas al evento,
                según los datos del formulario de registro.
              </Text>
            </div>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {registrations.distributions.map((d) => (
              <Card key={d.key} withBorder radius="md" p="sm">
                <Text size="sm" fw={600}>
                  {DIST_TITLES[d.key]}
                </Text>
                <Text size="xs" c="dimmed" mb="sm">
                  {d.fieldLabel}
                </Text>
                <CountryBars
                  color={DIST_COLORS[d.key]}
                  unknownLabel="Sin especificar"
                  unknown={d.unknown}
                  rows={d.items.map((it) => ({
                    key: it.value,
                    flag: d.isCountry ? isoToFlag(it.value) : undefined,
                    name: it.label ?? (d.isCountry ? countryName(it.value) : it.value),
                    value: it.count,
                  }))}
                />
              </Card>
            ))}
          </SimpleGrid>
        </>
      )}

      {detailed && (
        <Text size="xs" c="dimmed">
          Este informe yuxtapone el alcance de las campañas con la asistencia
          real. No correlaciona qué canal trajo a cada espectador (atribución por
          canal queda pendiente para una fase posterior).
        </Text>
      )}
    </Stack>
  );
}
