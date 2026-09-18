import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Badge,
  Grid,
  SimpleGrid,
  Paper,
  Button,
  CopyButton,
  Tooltip,
} from "@mantine/core";
import {
  IconUsers,
  IconEye,
  IconPlugConnected,
  IconUserPlus,
  IconLink,
  IconCheck,
  IconDeviceTv,
  IconRewindForward10,
} from "@tabler/icons-react";
import type { EventTimelines } from "../../api/events";
import TimelineChart from "./TimelineChart";

export interface MetricsSummary {
  currentConcurrentViewers: number;
  peakConcurrentViewers: number;
  totalUniqueViewers: number;
  /** Espectadores únicos que reprodujeron de verdad el video en vivo. */
  liveViewers?: number;
  /** Espectadores únicos que reprodujeron de verdad la repetición (diferido). */
  replayViewers?: number;
  lastUpdate?: number;
}

interface EventMetricsViewProps {
  isLive: boolean;
  metrics: MetricsSummary;
  timelines: EventTimelines | null;
  /** Subtítulo bajo el título (ej. nombre del evento en la página pública). */
  subtitle?: string;
  /** Si se provee, muestra un botón para copiar el enlace público compartible. */
  shareUrl?: string;
}

/**
 * Vista presentacional de las métricas del evento. No hace fetch: recibe las
 * métricas ya resueltas. La usan el panel de admin (RTDB en tiempo real) y la
 * página pública compartible (polling HTTP).
 */
export default function EventMetricsView({
  isLive,
  metrics,
  timelines,
  subtitle,
  shareUrl,
}: EventMetricsViewProps) {
  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Métricas del Evento</Title>
          {subtitle && (
            <Text size="sm" fw={500}>
              {subtitle}
            </Text>
          )}
          <Group gap="xs">
            <Badge
              leftSection={<IconPlugConnected size={12} />}
              color="green"
              variant="light"
            >
              Tiempo Real
            </Badge>
            <Text size="sm" c="dimmed">
              {isLive ? "🔴 En vivo" : "📊 Métricas finales"}
            </Text>
          </Group>
          {metrics.lastUpdate && (
            <Text size="xs" c="dimmed">
              Última actualización:{" "}
              {new Date(metrics.lastUpdate).toLocaleTimeString()}
            </Text>
          )}
        </div>
        {shareUrl && (
          <CopyButton value={shareUrl} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip
                label={copied ? "¡Enlace copiado!" : "Copiar enlace público"}
                withArrow
              >
                <Button
                  leftSection={
                    copied ? <IconCheck size={16} /> : <IconLink size={16} />
                  }
                  onClick={copy}
                  variant="light"
                  color={copied ? "teal" : undefined}
                  size="sm"
                >
                  {copied ? "Copiado" : "Enlace público"}
                </Button>
              </Tooltip>
            )}
          </CopyButton>
        )}
      </Group>

      {/* Métricas principales */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={600} size="lg">
            📊 Métricas Simplificadas
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            {isLive && (
              <Paper p="xl" withBorder style={{ height: "100%", background: "var(--mantine-color-blue-0)" }}>
                <Stack gap="xs" align="center">
                  <IconEye size={48} color="var(--mantine-color-blue-6)" />
                  <Text size="xs" c="dimmed" ta="center" fw={500}>
                    Espectadores Ahora
                  </Text>
                  <Text size="2.5rem" fw={700} c="blue">
                    {metrics.currentConcurrentViewers}
                  </Text>
                  <Badge color="green" variant="dot">
                    En vivo
                  </Badge>
                </Stack>
              </Paper>
            )}

            <Paper p="xl" withBorder style={{ height: "100%", background: "var(--mantine-color-grape-0)" }}>
              <Stack gap="xs" align="center">
                <IconUserPlus size={48} color="var(--mantine-color-grape-6)" />
                <Text size="xs" c="dimmed" ta="center" fw={500}>
                  Registrados / Inscritos
                </Text>
                <Text size="2.5rem" fw={700} c="grape">
                  {timelines?.registeredTotal ?? "—"}
                </Text>
                <Text size="xs" c="dimmed">
                  Personas inscritas al evento
                </Text>
              </Stack>
            </Paper>

            <Paper p="xl" withBorder style={{ height: "100%", background: "var(--mantine-color-red-0)" }}>
              <Stack gap="xs" align="center">
                <IconDeviceTv size={48} color="var(--mantine-color-red-6)" />
                <Text size="xs" c="dimmed" ta="center" fw={500}>
                  Asistentes en Vivo
                </Text>
                <Text size="2.5rem" fw={700} c="red">
                  {metrics.liveViewers ?? "—"}
                </Text>
                <Text size="xs" c="dimmed">
                  Reprodujeron la transmisión en vivo
                </Text>
              </Stack>
            </Paper>

            {!isLive && (
              <Paper p="xl" withBorder style={{ height: "100%", background: "var(--mantine-color-indigo-0)" }}>
                <Stack gap="xs" align="center">
                  <IconRewindForward10 size={48} color="var(--mantine-color-indigo-6)" />
                  <Text size="xs" c="dimmed" ta="center" fw={500}>
                    Diferidos
                  </Text>
                  <Text size="2.5rem" fw={700} c="indigo">
                    {metrics.replayViewers ?? "—"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Reprodujeron la repetición
                  </Text>
                </Stack>
              </Paper>
            )}

            <Paper p="xl" withBorder style={{ height: "100%", background: "var(--mantine-color-teal-0)" }}>
              <Stack gap="xs" align="center">
                <IconUsers size={48} color="var(--mantine-color-teal-6)" />
                <Text size="xs" c="dimmed" ta="center" fw={500}>
                  Total de Asistentes
                </Text>
                <Text size="2.5rem" fw={700} c="teal">
                  {metrics.totalUniqueViewers}
                </Text>
                <Text size="xs" c="dimmed">
                  Personas únicas conectadas (vivo + diferido)
                </Text>
              </Stack>
            </Paper>
          </SimpleGrid>
        </Stack>
      </Card>

      {/* Gráficos de líneas temporales: inscripciones y conexiones */}
      <Grid>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <TimelineChart
            title="Inscripciones en el tiempo"
            description="Cuándo se inscribieron los registrados."
            points={timelines?.registrations ?? []}
            granularities={["week", "day", "hour"]}
            defaultGranularity="day"
            color="var(--mantine-color-grape-6)"
            metricLabel="inscripciones"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <TimelineChart
            title="Conexiones al evento"
            description="Momentos en que los asistentes se conectaron."
            points={timelines?.connections ?? []}
            granularities={["hour", "minute"]}
            defaultGranularity="hour"
            color="var(--mantine-color-blue-6)"
            metricLabel="conexiones"
          />
        </Grid.Col>
      </Grid>

      {/* Información */}
      <Card withBorder radius="md" p="md" bg="var(--mantine-color-blue-0)">
        <Text fw={600} size="sm" mb="xs">
          ℹ️ Cómo funcionan las métricas
        </Text>
        <Stack gap="xs">
          <Text size="sm">
            • <strong>Espectadores Ahora:</strong> Usuarios viendo el evento en
            este momento (actualización en tiempo real)
          </Text>
          <Text size="sm">
            • <strong>Registrados / Inscritos:</strong> Personas que completaron
            el registro al evento, en vivo o en diferido.
          </Text>
          <Text size="sm">
            • <strong>Asistentes en Vivo:</strong> Espectadores únicos que
            reprodujeron de verdad la transmisión en vivo.
          </Text>
          <Text size="sm">
            • <strong>Diferidos:</strong> Espectadores únicos que reprodujeron
            de verdad la repetición (grabación) del evento.
          </Text>
          <Text size="sm">
            • <strong>Total de Asistentes:</strong> Todos los usuarios únicos que
            reprodujeron el evento, en vivo o en diferido.
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            📌 Los usuarios con múltiples dispositivos se cuentan como 1 solo
            asistente.
          </Text>
          <Text size="sm" c="dimmed">
            ⚡ Las métricas se actualizan automáticamente sin recargar la página.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
