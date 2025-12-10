import { useState, useEffect } from "react";
import {
  Stack,
  Title,
  Card,
  Group,
  Text,
  Badge,
  Grid,
  Button,
  SimpleGrid,
} from "@mantine/core";
import { Link, useParams } from "react-router-dom";
import { fetchEventsByOrgPrivate, type EventItem } from "../../api/events";
import { api } from "../../core/api";

interface AdminDashboardViewProps {
  orgId: string;
  orgName: string;
}

export default function AdminDashboardView({ orgId, orgName }: AdminDashboardViewProps) {
  const { slug } = useParams<{ slug: string }>();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [attendeeStats, setAttendeeStats] = useState<{ total: number; thisMonth: number } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [eventsData, statsData] = await Promise.all([
          fetchEventsByOrgPrivate(orgId),
          api.get(`/orgs/${orgId}/attendees/stats`),
        ]);
        setEvents(eventsData);
        setAttendeeStats(statsData.data);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      }
    };

    if (orgId) {
      loadData();
    }
  }, [orgId]);

  const getStatusColor = (status: EventItem['status']) => {
    switch (status) {
      case 'live': return 'green';
      case 'upcoming': return 'blue';
      case 'ended': return 'gray';
      case 'replay': return 'orange';
      default: return 'gray';
    }
  };

  const eventsByStatus = {
    live: events.filter(e => e.status === 'live').length,
    upcoming: events.filter(e => e.status === 'upcoming').length,
    ended: events.filter(e => e.status === 'ended').length,
    replay: events.filter(e => e.status === 'replay').length,
  };

  return (
    <Stack gap="xl">
      <div>
        <Title order={1}>Panel general</Title>
        <Text c="dimmed" size="lg">
          Vista general de {orgName}
        </Text>
      </div>

      {/* Estadísticas principales */}
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <Card withBorder p="md" radius="md">
          <Stack align="center" gap="xs">
            <Text size="xl" fw={700} c="blue">
              {events.length}
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              Total eventos
            </Text>
          </Stack>
        </Card>

        <Card withBorder p="md" radius="md">
          <Stack align="center" gap="xs">
            <Text size="xl" fw={700} c="green">
              {eventsByStatus.live}
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              En vivo
            </Text>
          </Stack>
        </Card>

        <Card withBorder p="md" radius="md">
          <Stack align="center" gap="xs">
            <Text size="xl" fw={700} c="orange">
              {attendeeStats?.total || 0}
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              Total asistentes
            </Text>
          </Stack>
        </Card>

        <Card withBorder p="md" radius="md">
          <Stack align="center" gap="xs">
            <Text size="xl" fw={700} c="grape">
              {attendeeStats?.thisMonth || 0}
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              Este mes
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>

      {/* Eventos recientes */}
      <Card withBorder radius="lg" p="lg">
        <Stack gap="lg">
          <Group justify="space-between" align="center">
            <Title order={3}>Eventos recientes</Title>
            <Button 
              component={Link}
              to={`/org/${slug}/admin/events`}
              variant="light"
              size="sm"
            >
              Ver todos →
            </Button>
          </Group>

          {events.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No hay eventos creados aún.
            </Text>
          ) : (
            <Grid>
              {events.slice(0, 6).map((event) => (
                <Grid.Col key={event._id} span={{ base: 12, sm: 6, md: 4 }}>
                  <Card withBorder radius="md" p="md" h="100%">
                    <Stack gap="sm" h="100%">
                      <Group justify="space-between" align="flex-start">
                        <Text fw={500} lineClamp={2} style={{ flex: 1 }}>
                          {event.title}
                        </Text>
                        <Badge 
                          color={getStatusColor(event.status)}
                          variant={event.status === 'live' ? 'filled' : 'light'}
                          size="xs"
                        >
                          {event.status}
                        </Badge>
                      </Group>

                      {event.description && (
                        <Text size="sm" c="dimmed" lineClamp={2}>
                          {event.description}
                        </Text>
                      )}

                      <Group gap="xs" mt="auto">
                        <Button 
                          component={Link}
                          to={`/org/${slug}/event/${event.slug || event._id}`}
                          variant="light"
                          size="xs"
                          style={{ flex: 1 }}
                        >
                          Ver
                        </Button>
                        <Button 
                          component={Link}
                          to={`/org/${slug}/event/${event.slug || event._id}/admin`}
                          variant="filled"
                          size="xs"
                          style={{ flex: 1 }}
                        >
                          Admin
                        </Button>
                      </Group>
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          )}
        </Stack>
      </Card>

      {/* Acciones rápidas */}
      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>Acciones rápidas</Title>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button 
                component={Link}
                to={`/org/${slug}/admin/events`}
                variant="light"
                fullWidth
              >
                🎯 Gestionar eventos
              </Button>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button 
                component={Link}
                to={`/org/${slug}/admin/attendees`}
                variant="light"
                fullWidth
              >
                👥 Base de registros
              </Button>
            </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button 
                component={Link}
                to={`/org/${slug}/admin/registration-form`}
                variant="light"
                fullWidth
              >
                📋 Formulario de registro
              </Button>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button 
                component={Link}
                to={`/org/${slug}/admin/settings`}
                variant="light"
                fullWidth
              >
                ⚙️ Configuración
              </Button>
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>
    </Stack>
  );
}