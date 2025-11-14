import { useState } from "react";
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
} from "@mantine/core";
import { type EventItem, setEventStatus } from "../../api/events";
import EventStreamForm from "./EventStreamForm";

interface EventAdminControlProps {
  event: EventItem;
  onEventUpdate: (event: EventItem) => void;
}

export default function EventAdminControl({ event, onEventUpdate }: EventAdminControlProps) {
  const [streamOpen, setStreamOpen] = useState(false);

  const handleStatusChange = async (status: EventItem['status']) => {
    try {
      await setEventStatus(event._id, status);
      const updatedEvent = { ...event, status };
      onEventUpdate(updatedEvent);
    } catch (err) {
      console.error("Error updating event status:", err);
    }
  };

  return (
    <Stack gap="xl">
      <div>
        <Title order={1}>Control del evento</Title>
        <Text c="dimmed" size="lg">
          Gestiona el estado y la transmisión de {event.title}
        </Text>
      </div>

      {/* Control de estado */}
      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>Estado del evento</Title>
          <Text c="dimmed" size="sm">
            Cambia el estado del evento para controlar qué ven los asistentes
          </Text>
          
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant={event.status === 'upcoming' ? 'filled' : 'light'}
                onClick={() => handleStatusChange('upcoming')}
                color="blue"
              >
                📅 Próximamente
              </Button>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant={event.status === 'live' ? 'filled' : 'light'}
                onClick={() => handleStatusChange('live')}
                color="red"
              >
                🔴 En vivo
              </Button>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant={event.status === 'ended' ? 'filled' : 'light'}
                onClick={() => handleStatusChange('ended')}
                color="gray"
              >
                ⏹️ Finalizado
              </Button>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant={event.status === 'replay' ? 'filled' : 'light'}
                onClick={() => handleStatusChange('replay')}
                color="orange"
              >
                ▶️ Repetición
              </Button>
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>

      {/* Configuración de transmisión */}
      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Title order={3}>Transmisión</Title>
            <Button 
              onClick={() => setStreamOpen(true)}
              variant="filled"
            >
              🎛️ Configurar stream
            </Button>
          </Group>
          
          {event.stream?.url ? (
            <Alert variant="light" color="green">
              <Text>✅ Stream configurado: {event.stream.url}</Text>
            </Alert>
          ) : (
            <Alert variant="light" color="blue">
              <Text>ℹ️ No hay stream configurado. Configúralo para que los asistentes puedan ver la transmisión.</Text>
            </Alert>
          )}
        </Stack>
      </Card>

      {/* Instrucciones */}
      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>Instrucciones</Title>
          <Stack gap="sm">
            <Text size="sm">
              <strong>📅 Próximamente:</strong> Los asistentes ven la página de espera con información del evento
            </Text>
            <Text size="sm">
              <strong>🔴 En vivo:</strong> Se muestra la transmisión activa (requiere stream configurado)
            </Text>
            <Text size="sm">
              <strong>⏹️ Finalizado:</strong> El evento aparece como terminado
            </Text>
            <Text size="sm">
              <strong>▶️ Repetición:</strong> Se puede reproducir la grabación del evento
            </Text>
          </Stack>
        </Stack>
      </Card>

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
            // Recargar los datos del evento desde el componente padre
          }}
        />
      </Modal>
    </Stack>
  );
}