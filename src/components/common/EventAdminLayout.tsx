import { useEffect, useRef } from "react";
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
  Drawer,
  ScrollArea,
  Container,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
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
  // 🚀 Empieza abierto por defecto
  const [opened, { toggle, close }] = useDisclosure(true);
  const location = useLocation();
  const { slug, eventSlug } = useParams<{ slug: string; eventSlug: string }>();

  // Breakpoint para responsive
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Evita que se cierre al montar por primera vez
  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
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
      description: "Información y estado general",
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
      label: "Encuestas",
      icon: "📋",
      href: `/org/${slug}/event/${eventSlug}/admin/polls`,
      description: "Crear y gestionar encuestas en vivo",
    },
    {
      label: "Chat en vivo",
      icon: "💬",
      href: `/org/${slug}/event/${eventSlug}/admin/chat`,
      description: "Administrar el chat del evento",
    },
    {
      label: "Configuración",
      icon: "⚙️",
      href: `/org/${slug}/event/${eventSlug}/admin/settings`,
      description: "Editar detalles del evento",
    },
  ];

  return (
    <AppShell header={{ height: 70 }} padding={isMobile ? "xs" : "sm"}>
      <AppShell.Header>
        <Group
          h="100%"
          px={isMobile ? "xs" : "md"}
          justify="space-between"
          gap="xs"
          wrap="nowrap"
        >
          {/* Lado izquierdo: burger + título + estado */}
          <Group gap={isMobile ? 6 : "md"} wrap="nowrap">
            <Burger
              opened={opened}
              onClick={toggle}
              size={isMobile ? "xs" : "sm"}
              aria-label="Abrir/cerrar navegación"
            />
            <Group
              gap={isMobile ? 6 : "md"}
              wrap="nowrap"
              style={{
                maxWidth: isMobile ? "55vw" : "50vw",
              }}
            >
              <Title
                order={5}
                style={{
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
                size={isMobile ? "sm" : "lg"}
              >
                {event.status === "live" && "🔴 "}
                {getStatusText(event.status)}
              </Badge>
            </Group>
          </Group>

          {/* Lado derecho: acciones */}
          <Group gap={isMobile ? 4 : "sm"} wrap="nowrap">
            <Button
              component={Link}
              to={`/org/${slug}/event/${eventSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              variant={isMobile ? "subtle" : "light"}
              size={isMobile ? "xs" : "sm"}
            >
              {isMobile ? "Ver evento" : "👀 Ver evento"}
            </Button>
            <Button
              component={Link}
              to={`/org/${slug}/admin/events`}
              variant={isMobile ? "outline" : "outline"}
              size={isMobile ? "xs" : "sm"}
            >
              {isMobile ? "← Eventos" : "← Eventos"}
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      {/* Drawer lateral (idéntico comportamiento al AdminLayout, pero responsivo) */}
      <Drawer
        opened={opened}
        onClose={close}
        position="left"
        size={isMobile ? "80%" : 320}
        padding="md"
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
        zIndex={2000}
        keepMounted
      >
        <ScrollArea style={{ height: "100%" }}>
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
                onClick={close}
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
              onClick={close}
            />

            <NavLink
              component={Link}
              to={`/org/${slug}/admin`}
              label="Panel de organización"
              description={`Volver al admin de ${org.name}`}
              leftSection={<Text size="lg">🏢</Text>}
              variant="light"
              onClick={close}
            />
          </Stack>
        </ScrollArea>
      </Drawer>

      <AppShell.Main>
        <Container size="lg" px={isMobile ? "xs" : "md"} py="md">
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
