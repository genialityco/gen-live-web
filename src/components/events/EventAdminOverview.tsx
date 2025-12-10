import {
  Stack,
  Title,
  Card,
  Group,
  Text,
  Alert,
  Badge,
  SimpleGrid,
  Button,
} from "@mantine/core";
import { useParams, Link } from "react-router-dom";
import { type Org } from "../../api/orgs";
import { type EventItem } from "../../api/events";

interface EventAdminOverviewProps {
  org: Org;
  event: EventItem;
}

export default function EventAdminOverview({ org, event }: EventAdminOverviewProps) {
  const { slug, eventSlug } = useParams<{ slug: string; eventSlug: string }>();

  const startsAt = event.startDate || event.schedule?.startsAt || "";
  const formattedDate =
    startsAt &&
    new Date(startsAt).toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getStatusColor = (status: EventItem["status"] | undefined) => {
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

  const getStatusLabel = (status: EventItem["status"] | undefined) => {
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

  return (
    <Stack gap="xl">
      {/* Encabezado */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="sm" align="center">
            <Title order={1}>Vista general</Title>
            <Badge
              color={getStatusColor(event.status)}
              variant={event.status === "live" ? "filled" : "light"}
              size="lg"
            >
              {event.status === "live" && "🔴 "}
              {getStatusLabel(event.status)}
            </Badge>
          </Group>
          <Text c="dimmed" size="sm" mt={4}>
            Resumen del evento <strong>{event.title}</strong> en{" "}
            <strong>{org.name}</strong>.
          </Text>
        </div>

        {/* Acciones rápidas principales */}
        <Group gap="xs">
          <Button
            component={Link}
            to={`/org/${slug}/event/${eventSlug}/admin/control`}
            size="sm"
            variant="filled"
          >
            🎛️ Ir al control
          </Button>
          <Button
            component={Link}
            to={`/org/${slug}/event/${eventSlug}`}
            size="sm"
            variant="light"
            target="_blank"
          >
            👀 Ver evento público
          </Button>
        </Group>
      </Group>

      {/* Resumen clave en 3 columnas */}
      <Card withBorder radius="lg" p="lg">
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          <Stack gap={4}>
            <Text size="xs" fw={600} c="dimmed" tt="uppercase">
              Organización
            </Text>
            <Text size="sm">{org.name}</Text>
            {org.domainSlug && (
              <Text size="xs" c="dimmed">
                {org.domainSlug}
              </Text>
            )}
          </Stack>

          <Stack gap={4}>
            <Text size="xs" fw={600} c="dimmed" tt="uppercase">
              Fecha y hora
            </Text>
            <Text size="sm">
              {formattedDate ? formattedDate : "Sin fecha definida"}
            </Text>
          </Stack>

          <Stack gap={4}>
            <Text size="xs" fw={600} c="dimmed" tt="uppercase">
              Tipo / Estado
            </Text>
            <Group gap="xs">
              <Badge color={getStatusColor(event.status)} variant="light">
                {getStatusLabel(event.status)}
              </Badge>
              {event.stream?.url && (
                <Badge color="teal" variant="light">
                  Stream configurado
                </Badge>
              )}
            </Group>
          </Stack>
        </SimpleGrid>
      </Card>

      {/* Información detallada del evento */}
      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>Detalles del evento</Title>
          <Group gap="lg" align="flex-start" wrap="wrap">
            <Stack gap={4} style={{ minWidth: 220 }}>
              <Text size="sm" fw={500} c="dimmed">
                Título
              </Text>
              <Text>{event.title}</Text>
            </Stack>

            {event.description && (
              <Stack gap={4} style={{ flex: "1 1 260px" }}>
                <Text size="sm" fw={500} c="dimmed">
                  Descripción
                </Text>
                <Text size="sm">{event.description}</Text>
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
              <Text size="sm" fw={500}>
                ✅ Stream configurado
              </Text>
              <Text size="sm" mt={4}>
                URL:{" "}
                <a
                  href={event.stream.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {event.stream.url}
                </a>
              </Text>
              <Text size="xs" c="dimmed" mt={6}>
                Puedes ajustar la transmisión desde la sección{" "}
                <strong>Control del evento</strong>.
              </Text>
            </Alert>
          ) : (
            <Alert variant="light" color="orange">
              <Text size="sm" fw={500}>
                ⚠️ No hay stream configurado
              </Text>
              <Text size="sm" mt={4}>
                Ve a la sección <strong>Control del evento</strong> para agregar
                la URL de transmisión y cambiar el estado del evento.
              </Text>
            </Alert>
          )}
        </Stack>
      </Card>

      {/* Atajos de administración */}
      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>¿Qué quieres hacer ahora?</Title>
          <Text c="dimmed" size="sm">
            Accesos rápidos a las secciones más usadas del panel del evento:
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Stack gap={4}>
              <Text size="sm">
                🎛️ <strong>Control del evento</strong>
              </Text>
              <Text size="xs" c="dimmed">
                Cambia el estado del evento (en vivo, finalizado, replay) y
                configura la transmisión.
              </Text>
              <Button
                component={Link}
                to={`/org/${slug}/event/${eventSlug}/admin/control`}
                size="xs"
                variant="light"
              >
                Abrir control
              </Button>
            </Stack>

            <Stack gap={4}>
              <Text size="sm">
                👥 <strong>Asistentes</strong>
              </Text>
              <Text size="xs" c="dimmed">
                Revisa inscripciones, asistencia en vivo y exporta la base a
                Excel.
              </Text>
              <Button
                component={Link}
                to={`/org/${slug}/event/${eventSlug}/admin/attendees`}
                size="xs"
                variant="light"
              >
                Ver asistentes
              </Button>
            </Stack>

            <Stack gap={4}>
              <Text size="sm">
                📈 <strong>Métricas</strong>
              </Text>
              <Text size="xs" c="dimmed">
                Analiza el comportamiento de la audiencia durante el evento.
              </Text>
              <Button
                component={Link}
                to={`/org/${slug}/event/${eventSlug}/admin/metrics`}
                size="xs"
                variant="light"
              >
                Ver métricas
              </Button>
            </Stack>

            <Stack gap={4}>
              <Text size="sm">
                ⚙️ <strong>Configuración</strong>
              </Text>
              <Text size="xs" c="dimmed">
                Ajusta título, descripción, horarios y otros detalles del
                evento.
              </Text>
              <Button
                component={Link}
                to={`/org/${slug}/event/${eventSlug}/admin/settings`}
                size="xs"
                variant="light"
              >
                Ir a configuración
              </Button>
            </Stack>
          </SimpleGrid>
        </Stack>
      </Card>
    </Stack>
  );
}
