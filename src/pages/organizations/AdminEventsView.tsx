/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Stack,
  Title,
  Card,
  Group,
  Text,
  Button,
  Badge,
  Alert,
  Divider,
  Grid,
  Modal,
  LoadingOverlay,
} from "@mantine/core";
import { fetchEventsByOrgPrivate, type EventItem } from "../../api/events";
import CreateEventForOrg from "../../components/events/CreateEventForOrg";

interface AdminEventsViewProps {
  orgId: string;
}

export default function AdminEventsView({ orgId }: AdminEventsViewProps) {
  const { slug } = useParams<{ slug: string }>();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

  const loadEvents = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const eventsData = await fetchEventsByOrgPrivate(orgId);
      setEvents(eventsData);
    } catch (err) {
      console.error("Error loading events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [orgId]);

  const getStatusColor = (status: EventItem["status"]) => {
    switch (status) {
      case "live":
        return "green";
      case "upcoming":
        return "blue";
      case "ended":
        return "gray";
      case "replay":
        return "orange";
      default:
        return "gray";
    }
  };

  const getStatusText = (status: EventItem["status"]) => {
    switch (status) {
      case "live":
        return "En vivo";
      case "upcoming":
        return "Próximamente";
      case "ended":
        return "Finalizado";
      case "replay":
        return "Repetición";
      default:
        return status;
    }
  };

  return (
    <Stack gap="xl" pos="relative">
      <LoadingOverlay
        visible={loading}
        zIndex={1000}
        overlayProps={{ blur: 2 }}
      />

      <div>
        <Group justify="space-between" align="center">
          <div>
            <Title order={1}>Gestión de eventos</Title>
            <Text c="dimmed" size="lg">
              Crea y administra todos los eventos de tu organización
            </Text>
          </div>

          {/* Botón que abre el modal */}
          <Button onClick={() => setModalOpen(true)} size="md">
            ➕ Nuevo evento
          </Button>
        </Group>
      </div>

      {/* Modal de creación */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={<Title order={3}>Crear nuevo evento</Title>}
        centered
        size="lg"
        overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
        withinPortal
        radius="md"
      >
        {/* Pasa callbacks: al crear -> refrescar y cerrar */}
        <CreateEventForOrg
          orgId={orgId}
          onCreated={async () => {
            await loadEvents();
            setModalOpen(false);
          }}
        />
      </Modal>

      {/* Lista de eventos */}
      <Card withBorder radius="lg" p="lg">
        <Stack gap="lg">
          <Group justify="space-between" align="center">
            <Title order={3}>Eventos existentes</Title>
            <Text c="dimmed">
              {events.length} evento{events.length !== 1 ? "s" : ""}
            </Text>
          </Group>

          <Divider />

          {events.length === 0 ? (
            <Alert variant="light" color="blue">
              <Text>
                No hay eventos creados aún. ¡Crea tu primer evento con “Nuevo
                evento”!
              </Text>
            </Alert>
          ) : (
            <Grid>
              {events.map((event) => (
                <Grid.Col key={event._id} span={{ base: 12, md: 6, lg: 4 }}>
                  <Card withBorder radius="md" p="md" h="100%">
                    <Stack gap="md" h="100%">
                      <Group justify="space-between" align="flex-start">
                        <Title order={4} lineClamp={2} style={{ flex: 1 }}>
                          {event.title}
                        </Title>
                        <Badge
                          color={getStatusColor(event.status)}
                          variant={event.status === "live" ? "filled" : "light"}
                          size="sm"
                        >
                          {event.status === "live" && "🔴 "}
                          {getStatusText(event.status)}
                        </Badge>
                      </Group>

                      {event.description && (
                        <Text
                          size="sm"
                          c="dimmed"
                          lineClamp={3}
                          style={{ flex: 1 }}
                        >
                          {event.description}
                        </Text>
                      )}

                      {(event.startDate || event.schedule?.startsAt) && (
                        <Text size="xs" c="dimmed">
                          📅{" "}
                          {new Date(
                            event.startDate || event.schedule?.startsAt || ""
                          ).toLocaleDateString("es-ES", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
                          👀 Visitar
                        </Button>
                        <Button
                          component={Link}
                          to={`/org/${slug}/event/${
                            event.slug || event._id
                          }/admin`}
                          variant="filled"
                          size="xs"
                          style={{ flex: 1 }}
                        >
                          ⚙️ Administrar
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
    </Stack>
  );
}
