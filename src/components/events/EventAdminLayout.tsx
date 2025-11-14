import { useEffect } from "react";
import {
  AppShell,
  Text,
  Group,
  Button,
  Stack,
  NavLink,
  Title,
  Badge,
  Burger,
  Container,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link, useLocation, useParams } from "react-router-dom";
import { type Org } from "../../api/orgs";
import { type EventItem } from "../../api/events";

interface EventAdminLayoutProps {
  children: React.ReactNode;
  org: Org;
  event: EventItem;
}

export default function EventAdminLayout({
  children,
  org,
  event,
}: EventAdminLayoutProps) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const location = useLocation();
  const { slug, eventSlug } = useParams<{ slug: string; eventSlug: string }>();

  // Cerrar drawer al cambiar de ruta
  useEffect(() => {
    close();
  }, [location.pathname, close]);

  const isActive = (path: string) => location.pathname === path;

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

  const navigationItems = [
    {
      label: "Vista general",
      icon: "📊",
      href: `/org/${slug}/event/${eventSlug}/admin`,
      description: "Información y configuración general",
    },
    {
      label: "Control del evento",
      icon: "🎛️",
      href: `/org/${slug}/event/${eventSlug}/admin/control`,
      description: "Estado y transmisión en vivo",
    },
    {
      label: "Métricas",
      icon: "📈",
      href: `/org/${slug}/event/${eventSlug}/admin/metrics`,
      description: "Audiencia y visualización",
    },
    {
      label: "Asistentes",
      icon: "👥",
      href: `/org/${slug}/event/${eventSlug}/admin/attendees`,
      description: "Gestionar participantes",
    },
    {
      label: "Configuración",
      icon: "⚙️",
      href: `/org/${slug}/event/${eventSlug}/admin/settings`,
      description: "Editar detalles del evento",
    },
  ];

  return (
    <AppShell
      header={{ height: 70 }}
      navbar={{
        width: 300,
        breakpoint: "sm",
        collapsed: { mobile: !opened, desktop: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} size="sm" />
            <Group gap="md">
              <Title
                order={5}
                style={{
                  maxWidth: "50vw",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {event.title}
              </Title>
              <Badge
                color={getStatusColor(event.status)}
                variant={event.status === "live" ? "filled" : "light"}
                size="lg"
              >
                {event.status === "live" && "🔴 "}
                {getStatusText(event.status)}
              </Badge>
            </Group>
          </Group>

          <Group gap="sm">
            <Button
              component={Link}
              to={`/org/${slug}/event/${eventSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="light"
              size="sm"
            >
              👀 Ver evento
            </Button>
            <Button
              component={Link}
              to={`/org/${slug}/admin/events`}
              variant="outline"
              size="sm"
            >
              ← Eventos
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" withBorder>
        <Stack gap="xs">
          <Group justify="space-between" align="center" mb="md">
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">
              Administración del evento
            </Text>
            <Badge variant="light" color="blue" size="xs">
              Admin
            </Badge>
          </Group>

          {navigationItems.map((item) => (
            <NavLink
              key={item.href}
              component={Link}
              to={item.href}
              label={item.label}
              description={item.description}
              leftSection={<Text size="lg">{item.icon}</Text>}
              active={isActive(item.href)}
              variant="filled"
            />
          ))}

          <Text size="xs" tt="uppercase" fw={700} c="dimmed" mt="xl" mb="md">
            Enlaces rápidos
          </Text>

          <NavLink
            component={Link}
            to={`/org/${slug}/event/${eventSlug}`}
            label="Ver evento público"
            description="Como lo ven los asistentes"
            leftSection={<Text size="lg">🌐</Text>}
            variant="light"
          />

          <NavLink
            component={Link}
            to={`/org/${slug}/admin`}
            label="Panel de organización"
            description={`Volver al admin de ${org.name}`}
            leftSection={<Text size="lg">🏢</Text>}
            variant="light"
          />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="xl" py="xl">
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
