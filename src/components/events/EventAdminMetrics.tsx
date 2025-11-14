import { useState } from "react";
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Badge,
  Grid,
  Loader,
  Alert,
  Button,
  Paper,
  Center,
} from "@mantine/core";
import {
  IconUsers,
  IconEye,
  IconTrendingUp,
  IconRefresh,
  IconPlugConnected,
} from "@tabler/icons-react";
import { api } from "../../core/api";
import { useRealtimeMetrics } from "../../hooks/useRealtimeMetrics";
import type { EventItem } from "../../api/events";

interface EventAdminMetricsProps {
  event: EventItem;
}

export default function EventAdminMetrics({ event }: EventAdminMetricsProps) {
  const { metrics, loading, error: rtdbError } = useRealtimeMetrics(event._id);
  
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const isLive = event.status === "live";

  const recalculateMetrics = async () => {
    setRecalculating(true);
    setError(null);
    try {
      await api.post(`/events/${event._id}/metrics/recalculate`);
      // No necesitamos setMetrics - RTDB actualizará automáticamente
    } catch (err) {
      console.error("Error recalculating metrics:", err);
      setError("Error al recalcular métricas");
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">Conectando a métricas en tiempo real...</Text>
        </Stack>
      </Center>
    );
  }

  if (rtdbError || error || !metrics) {
    return (
      <Alert color="red" title="Error de conexión">
        {rtdbError || error || "No se pudieron cargar las métricas en tiempo real"}
      </Alert>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Métricas del Evento</Title>
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
              Última actualización: {new Date(metrics.lastUpdate).toLocaleTimeString()}
            </Text>
          )}
        </div>
        <Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={recalculateMetrics}
            loading={recalculating}
            variant="filled"
          >
            Recalcular
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert color="yellow" title="Advertencia">
          {error}
        </Alert>
      )}

      {/* Métricas principales */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={600} size="lg">📊 Métricas Simplificadas</Text>
          
          <Grid>
            {isLive && (
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Paper p="xl" withBorder style={{ height: "100%", background: "var(--mantine-color-blue-0)" }}>
                  <Stack gap="xs" align="center">
                    <IconEye size={48} color="var(--mantine-color-blue-6)" />
                    <Text size="xs" c="dimmed" ta="center" fw={500}>
                      Espectadores Ahora
                    </Text>
                    <Text size="2.5rem" fw={700} c="blue">
                      {metrics.currentConcurrentViewers}
                    </Text>
                    <Badge color="green" variant="dot">En vivo</Badge>
                  </Stack>
                </Paper>
              </Grid.Col>
            )}
            
            <Grid.Col span={{ base: 12, md: isLive ? 4 : 6 }}>
              <Paper p="xl" withBorder style={{ height: "100%", background: "var(--mantine-color-orange-0)" }}>
                <Stack gap="xs" align="center">
                  <IconTrendingUp size={48} color="var(--mantine-color-orange-6)" />
                  <Text size="xs" c="dimmed" ta="center" fw={500}>
                    Pico Máximo
                  </Text>
                  <Text size="2.5rem" fw={700} c="orange">
                    {metrics.peakConcurrentViewers}
                  </Text>
                  <Text size="xs" c="dimmed">Mayor concurrencia</Text>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: isLive ? 4 : 6 }}>
              <Paper p="xl" withBorder style={{ height: "100%", background: "var(--mantine-color-teal-0)" }}>
                <Stack gap="xs" align="center">
                  <IconUsers size={48} color="var(--mantine-color-teal-6)" />
                  <Text size="xs" c="dimmed" ta="center" fw={500}>
                    Total de Asistentes
                  </Text>
                  <Text size="2.5rem" fw={700} c="teal">
                    {metrics.totalUniqueViewers}
                  </Text>
                  <Text size="xs" c="dimmed">Únicos durante el live</Text>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>

      {/* Información */}
      <Alert color="blue" title="ℹ️ Cómo funcionan las métricas">
        <Stack gap="xs">
          <Text size="sm">
            • <strong>Espectadores Ahora:</strong> Usuarios viendo el evento en este momento (actualización en tiempo real)
          </Text>
          <Text size="sm">
            • <strong>Pico Máximo:</strong> Mayor cantidad de espectadores concurrentes alcanzado durante el live
          </Text>
          <Text size="sm">
            • <strong>Total de Asistentes:</strong> Todos los usuarios únicos que estuvieron durante el evento live
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            📌 Los usuarios con múltiples dispositivos se cuentan como 1 solo asistente.
          </Text>
          <Text size="sm" c="dimmed">
            ⚡ Las métricas se actualizan automáticamente sin recargar la página.
          </Text>
        </Stack>
      </Alert>
    </Stack>
  );
}
