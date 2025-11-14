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
import { useDisclosure } from "@mantine/hooks";
import { Link, useLocation, useParams } from "react-router-dom";
import { useEffect } from "react";
import { type Org } from "../../api/orgs";

interface AdminLayoutProps {
  children: React.ReactNode;
  org: Org;
}

export default function AdminLayout({ children, org }: AdminLayoutProps) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();

  // Cerrar el drawer al cambiar de ruta
  useEffect(() => {
    close();
  }, [location.pathname, close]);

  const isActive = (path: string) => location.pathname === path;

  const navigationItems = [
    {
      label: "Panel general",
      icon: "📊",
      href: `/org/${slug}/admin`,
      description: "Vista general y configuración",
    },
    {
      label: "Gestión de eventos",
      icon: "🎯",
      href: `/org/${slug}/admin/events`,
      description: "Crear y administrar eventos",
    },
    {
      label: "Base de registros",
      icon: "👥",
      href: `/org/${slug}/admin/attendees`,
      description: "Gestionar usuarios registrados",
    },
    {
      label: "Formulario de registro",
      icon: "📝",
      href: `/org/${slug}/admin/registration-form`,
      description: "Personalizar formulario de inscripción",
    },
    {
      label: "Configuración",
      icon: "⚙️",
      href: `/org/${slug}/admin/settings`,
      description: "Branding y personalización",
    },
  ];

  return (
    <AppShell
      header={{ height: 70 }}
      padding="sm"
    >
      <AppShell.Header>
        <Group h="100%" justify="space-between" px="md">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              size="sm"
              aria-label="Abrir/cerrar navegación"
            />
            <Group gap="md">
              <Title order={3}>Admin: {org.name}</Title>
              <Badge variant="light" color="blue" size="lg">
                {org.domainSlug}
              </Badge>
            </Group>
          </Group>

          <Group gap="sm">
            <Button
              component="a"
              href={`/org/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="light"
              size="sm"
            >
              👀 Ver pública
            </Button>
            <Button
              component={Link}
              to="/organizations"
              variant="outline"
              size="sm"
            >
              ← Organizaciones
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      {/* 🚪 Drawer = Navbar overlay */}
      <Drawer
        opened={opened}
        onClose={close}
        position="left"
        size={300}
        padding="md"
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
        zIndex={2000} // por encima del Header
        keepMounted // mejora perf en móviles
      >
        <ScrollArea style={{ height: "100%" }}>
          <Stack gap="xs">
            <Group justify="space-between" align="center" mb="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                Administración
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
                onClick={close} // cerrar al navegar
              />
            ))}

            <Text size="xs" tt="uppercase" fw={700} c="dimmed" mt="xl" mb="md">
              Enlaces rápidos
            </Text>

            <NavLink
              component={Link}
              to={`/org/${slug}`}
              label="Landing pública"
              description="Ver como la ven los visitantes"
              leftSection={<Text size="lg">🌐</Text>}
              variant="light"
              onClick={close}
            />

            <NavLink
              component={Link}
              to="/organizations"
              label="Mis organizaciones"
              description="Volver al listado"
              leftSection={<Text size="lg">🏢</Text>}
              variant="light"
              onClick={close}
            />
          </Stack>
        </ScrollArea>
      </Drawer>

      <AppShell.Main>
        <Container>{children}</Container>
      </AppShell.Main>
    </AppShell>
  );
}
