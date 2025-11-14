import {
  Stack,
  Title,
  Card,
  Group,
  Text,
  Alert,
} from "@mantine/core";
import { type Org } from "../../api/orgs";
import { type EventItem } from "../../api/events";

interface EventAdminOverviewProps {
  org: Org;
  event: EventItem;
}

export default function EventAdminOverview({ org, event }: EventAdminOverviewProps) {
  return (
    <Stack gap="xl">
      <div>
        <Title order={1}>Vista general</Title>
        <Text c="dimmed" size="lg">
          Información y estado del evento {event.title}
        </Text>
      </div>

      {/* Información del evento */}
      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>Información del evento</Title>
          <Group gap="lg" wrap="wrap">
            <Stack gap="xs">
              <Text size="sm" fw={500} c="dimmed">Título</Text>
              <Text>{event.title}</Text>
            </Stack>
            <Stack gap="xs">
              <Text size="sm" fw={500} c="dimmed">Organización</Text>
              <Text>{org.name}</Text>
            </Stack>
            {event.description && (
              <Stack gap="xs" style={{ flex: "1 1 100%" }}>
                <Text size="sm" fw={500} c="dimmed">Descripción</Text>
                <Text>{event.description}</Text>
              </Stack>
            )}
            {(event.startDate || event.schedule?.startsAt) && (
              <Stack gap="xs">
                <Text size="sm" fw={500} c="dimmed">Fecha y hora</Text>
                <Text>
                  {new Date(event.startDate || event.schedule?.startsAt || '').toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </Stack>
            )}
          </Group>
        </Stack>
      </Card>

      {/* Estado de la transmisión */}
      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>Estado de la transmisión</Title>
          
          {event.stream?.url ? (
            <Alert variant="light" color="green">
              <Text>✅ Stream configurado: {event.stream.url}</Text>
            </Alert>
          ) : (
            <Alert variant="light" color="orange">
              <Text>⚠️ No hay stream configurado. Ve a "Control del evento" para configurarlo.</Text>
            </Alert>
          )}
        </Stack>
      </Card>

      {/* Accesos rápidos */}
      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>Accesos rápidos</Title>
          <Text c="dimmed" size="sm">
            Utiliza el menú lateral para acceder a las diferentes funciones de administración:
          </Text>
          
          <Stack gap="sm">
            <Text size="sm">🎛️ <strong>Control del evento:</strong> Cambiar estado y configurar transmisión</Text>
            <Text size="sm">👥 <strong>Asistentes:</strong> Ver y gestionar participantes</Text>
            <Text size="sm">⚙️ <strong>Configuración:</strong> Editar detalles del evento</Text>
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}