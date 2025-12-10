import { useState, useEffect } from "react";
import {
  Stack,
  Title,
  Card,
  Group,
  Text,
  Button,
  Alert,
  Grid,
  Modal,
  Loader,
  Box,
  Badge,
  Center,
  Select,
} from "@mantine/core";
import { type EventItem, setEventStatus } from "../../api/events";
import EventStreamForm from "./EventStreamForm";

interface EventAdminControlProps {
  event: EventItem;
  onEventUpdate: (event: EventItem) => void;
}

export default function EventAdminControl({
  event,
  onEventUpdate,
}: EventAdminControlProps) {
  const [streamOpen, setStreamOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<EventItem["status"]>(
    event.status
  );

  // Mantener el estado local sincronizado si cambia desde fuera
  useEffect(() => {
    setLocalStatus(event.status);
  }, [event.status]);

  const handleStatusChange = async (status: EventItem["status"]) => {
    if (!status || status === localStatus) return;

    try {
      setStatusError(null);
      setStatusLoading(true);
      setLocalStatus(status); // actualización optimista

      await setEventStatus(event._id, status);
      const updatedEvent = { ...event, status };
      onEventUpdate(updatedEvent);
    } catch (err) {
      console.error("Error updating event status:", err);
      setStatusError("No se pudo actualizar el estado. Intenta de nuevo.");
      // Revertir al estado real
      setLocalStatus(event.status);
    } finally {
      setStatusLoading(false);
    }
  };

  const getStatusHelperText = (status: EventItem["status"]) => {
    switch (status) {
      case "upcoming":
        return "Pantalla de espera hasta que lo pongas en vivo.";
      case "live":
        return "Los asistentes ven la transmisión en tiempo real.";
      case "ended":
        return "Evento marcado como finalizado, sin transmisión.";
      case "replay":
        return "Muestra una grabación usando la URL configurada.";
      default:
        return "";
    }
  };

  const getStatusColor = (status: EventItem["status"]) => {
    switch (status) {
      case "live":
        return "red";
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

  const getStatusLabel = (status: EventItem["status"]) => {
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
        return "Sin estado";
    }
  };

  const hasStream = !!event.stream?.url;

  // -------- Vista previa del evento para asistentes ----------
  const renderAudiencePreview = () => (
    <Card withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Title order={3}>Vista previa para asistentes</Title>
            <Text size="sm" c="dimmed">
              Simulación de lo que verán según el estado actual.
            </Text>
          </div>

          <Badge
            color={getStatusColor(localStatus)}
            variant={localStatus === "live" ? "filled" : "light"}
            size="md"
          >
            {localStatus === "live" && "🔴 "}
            {getStatusLabel(localStatus)}
          </Badge>
        </Group>

        <Box
          style={{
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: "#000",
            border: "1px solid var(--mantine-color-gray-3)",
          }}
        >
          <Box
            style={{
              position: "relative",
              width: "100%",
              paddingTop: "56.25%", // 16:9
            }}
          >
            {/* LIVE / REPLAY con stream */}
            {["live", "replay"].includes(localStatus) && hasStream && (
              <iframe
                src={event.stream!.url}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
                title={
                  localStatus === "live"
                    ? "Preview transmisión en vivo"
                    : "Preview repetición"
                }
                frameBorder={0}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            )}

            {/* LIVE / REPLAY sin stream configurado */}
            {["live", "replay"].includes(localStatus) && !hasStream && (
              <Center
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: 24,
                  backgroundColor: "#ffffff",
                }}
              >
                <Stack align="center" gap="xs" maw={420} ta="center">
                  <Text fw={700} size="lg">
                    {localStatus === "live"
                      ? "No hay stream configurado"
                      : "No hay URL de repetición configurada"}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Los asistentes verían una pantalla en blanco. Configura el
                    stream antes de usar este estado.
                  </Text>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => setStreamOpen(true)}
                  >
                    Configurar stream
                  </Button>
                </Stack>
              </Center>
            )}

            {/* UPCOMING */}
            {localStatus === "upcoming" && (
              <Center
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: 24,
                  backgroundColor: "#ffffff",
                }}
              >
                <Stack align="center" gap="xs" maw={420} ta="center">
                  <Text fw={800} size="lg">
                    🕒 El evento comenzará pronto
                  </Text>
                  <Text size="sm" c="dimmed">
                    Los asistentes verán una pantalla de espera hasta que lo
                    pongas <strong>En vivo</strong>.
                  </Text>
                </Stack>
              </Center>
            )}

            {/* ENDED */}
            {localStatus === "ended" && (
              <Center
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: 24,
                  backgroundColor: "#ffffff",
                }}
              >
                <Stack align="center" gap="xs" maw={420} ta="center">
                  <Box
                    style={{
                      padding: "4px 12px",
                      borderRadius: 999,
                      border: "1px solid var(--mantine-color-gray-3)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontWeight: 600,
                    }}
                  >
                    Evento finalizado
                  </Box>
                  <Text fw={800} size="lg">
                    📝 Gracias por asistir
                  </Text>
                  <Text size="sm" c="dimmed">
                    No se muestra transmisión. Puedes cambiar a{" "}
                    <strong>Repetición</strong> para usar una grabación.
                  </Text>
                </Stack>
              </Center>
            )}
          </Box>
        </Box>
      </Stack>
    </Card>
  );

  return (
    <Stack gap="lg">
      {/* Header de la página */}
      <div>
        <Title order={1}>Control del evento</Title>
        <Text c="dimmed" size="lg">
          Gestiona el estado y la transmisión de {event.title}
        </Text>
      </div>

      {/* Layout principal: preview + controles, responsive */}
      <Grid gutter="lg">
        {/* Columna izquierda: Preview (full width en mobile, 7/12 en desktop) */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          {renderAudiencePreview()}
        </Grid.Col>

        {/* Columna derecha: Estado + Stream (stackeados) */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="lg">
            {/* Estado del evento - solo Select, sin Card ni botones */}
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <div>
                  <Text fw={600} size="sm">
                    Estado del evento
                  </Text>
                  <Text c="dimmed" size="xs">
                    Controla qué ven los asistentes.
                  </Text>
                </div>

                {statusLoading && (
                  <Group gap={6}>
                    <Loader size="xs" />
                    <Text size="xs" c="dimmed">
                      Guardando...
                    </Text>
                  </Group>
                )}
              </Group>

              <Select
                value={localStatus}
                onChange={(value) =>
                  value && handleStatusChange(value as EventItem["status"])
                }
                disabled={statusLoading}
                data={[
                  { label: "📅 Próximamente", value: "upcoming" },
                  { label: "🔴 En vivo", value: "live" },
                  { label: "⏹️ Finalizado", value: "ended" },
                  { label: "▶️ Repetición", value: "replay" },
                ]}
              />

              <Text size="sm" c="dimmed">
                {getStatusHelperText(localStatus)}
              </Text>

              {statusError && (
                <Alert color="red" variant="light" mt="xs">
                  {statusError}
                </Alert>
              )}
            </Stack>

            {/* Configuración de transmisión */}
            <Card withBorder radius="lg" p="lg">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <div>
                    <Title order={3}>Transmisión</Title>
                    <Text size="xs" c="dimmed">
                      URL del stream que verán los asistentes.
                    </Text>
                  </div>
                  <Button onClick={() => setStreamOpen(true)} size="xs">
                    🎛️ Configurar
                  </Button>
                </Group>

                {event.stream?.url ? (
                  <Alert variant="light" color="green">
                    <Text size="sm" fw={500}>
                      ✅ Stream configurado
                    </Text>
                    <Text size="xs" mt={4}>
                      URL:{" "}
                      <a
                        href={event.stream.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {event.stream.url}
                      </a>
                    </Text>
                  </Alert>
                ) : (
                  <Alert variant="light" color="blue">
                    <Text size="sm" fw={500}>
                      ℹ️ No hay stream configurado
                    </Text>
                    <Text size="xs" mt={4}>
                      Configura una URL antes de poner el evento en vivo o en
                      repetición.
                    </Text>
                  </Alert>
                )}
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>

      {/* Modal para configurar stream */}
      <Modal
        opened={streamOpen}
        onClose={() => setStreamOpen(false)}
        title="Configurar transmisión"
        centered
      >
        <EventStreamForm
          eventId={event._id}
          initialUrl={event.stream?.url}
          onSaved={() => {
            setStreamOpen(false);
          }}
        />
      </Modal>
    </Stack>
  );
}
