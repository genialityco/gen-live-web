import { Link } from "react-router-dom";
import {
  Button,
  Group,
  Stack,
  Title,
  Text,
  Card,
  Container,
  Loader,
} from "@mantine/core";
import { useAuth } from "../../auth/AuthProvider";

export default function Home() {
  const { user, loading } = useAuth();
  const isAdmin = !!user && !user.isAnonymous;

  return (
    <Container size="sm">
      <Stack gap="xl" py="xl">
        {/* Hero / branding */}
        <Stack align="center" gap="sm" ta="center">
          <Title order={1} size="3rem" c="blue">
            Gen Live
          </Title>
          <Text size="md" c="dimmed" maw={520}>
            Plataforma para crear organizaciones y gestionar eventos en vivo,
            con accesos simples para tu audiencia y panel para administradores.
          </Text>
        </Stack>

        {/* Contenido según sesión */}
        {loading ? (
          <Card withBorder radius="lg" p="xl">
            <Stack align="center" gap="md">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Cargando sesión...
              </Text>
            </Stack>
          </Card>
        ) : isAdmin ? (
          // Vista cuando hay sesión de administrador
          <Card withBorder radius="lg" p="xl">
            <Stack gap="md">
              <Title order={3}>Acceso administrador</Title>
              <Text size="sm" c="dimmed">
                Gestiona tus organizaciones, configura eventos y controla tus
                transmisiones en tiempo real.
              </Text>

              <Group>
                <Button
                  component={Link}
                  to="/organizations"
                  size="md"
                  variant="filled"
                >
                  📋 Ver organizaciones
                </Button>
              </Group>
            </Stack>
          </Card>
        ) : (
          // Vista pública (usuario anónimo)
          <Card withBorder radius="lg" p="xl">
            <Stack gap="md">
              <Title order={3}>¿Qué es Gen Live?</Title>
              <Text size="sm" c="dimmed">
                Gen Live centraliza tus eventos en vivo en un solo lugar: creas
                una organización, configuras tus eventos y compartes enlaces
                simples con tus asistentes.
              </Text>

              <Stack gap={4}>
                <Text size="sm">Con Gen Live puedes:</Text>
                <Text size="sm" c="dimmed">
                  • Crear organizaciones con su propia página. <br />
                  • Configurar eventos en vivo y su estado. <br />
                  • Compartir enlaces simples para tu audiencia.
                </Text>
              </Stack>

              <Group>
                <Button
                  component={Link}
                  to="/admin-auth"
                  size="md"
                  variant="filled"
                >
                  👤 Soy administrador
                </Button>
              </Group>
            </Stack>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
