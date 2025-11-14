import { Link } from "react-router-dom";
import { Button, Group, Stack, TextInput, Title, Text, Card, Container, Divider } from "@mantine/core";
import { useState } from "react";

export default function Home() {
  const [slug, setSlug] = useState("demo");
  
  return (
    <Container size="md">
      <Stack gap="xl" py="xl">
        {/* Hero Section */}
        <Stack align="center" gap="lg" ta="center">
          <Title order={1} size="3rem" c="blue">LiveEvents</Title>
          <Text size="xl" c="dimmed" maw={600}>
            Plataforma para gestionar y transmitir eventos en vivo. 
            Crea organizaciones, configura eventos y comparte con tu audiencia.
          </Text>
        </Stack>

        {/* Quick Actions */}
        <Card withBorder radius="lg" p="xl">
          <Stack gap="lg">
            <Title order={2} ta="center">¿Qué quieres hacer?</Title>
            
            <Group grow>
              <Button 
                component={Link} 
                to="/organizations"
                size="lg"
                variant="light"
              >
                📋 Ver organizaciones
              </Button>
              <Button 
                component={Link} 
                to="/admin-auth"
                size="lg"
                variant="filled"
              >
                👤 Soy administrador
              </Button>
            </Group>

            <Divider label="o" labelPosition="center" />

            {/* Legacy event access */}
            <Stack gap="md">
              <Title order={4} ta="center" c="dimmed">Acceso directo a evento (legacy)</Title>
              <Group align="end">
                <TextInput
                  label="Slug del evento"
                  placeholder="demo"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button 
                  component={Link} 
                  to={`/e/${encodeURIComponent(slug)}`}
                  disabled={!slug.trim()}
                >
                  Abrir evento
                </Button>
              </Group>
            </Stack>
          </Stack>
        </Card>

        {/* Features */}
        <Stack gap="lg">
          <Title order={2} ta="center">Características principales</Title>
          <Group grow>
            <Card withBorder radius="lg" p="lg" ta="center">
              <Stack gap="md">
                <Text size="2rem">🏢</Text>
                <Title order={4}>Organizaciones</Title>
                <Text size="sm" c="dimmed">
                  Crea y gestiona organizaciones con sus propias páginas y eventos
                </Text>
              </Stack>
            </Card>
            
            <Card withBorder radius="lg" p="lg" ta="center">
              <Stack gap="md">
                <Text size="2rem">🎥</Text>
                <Title order={4}>Eventos en vivo</Title>
                <Text size="sm" c="dimmed">
                  Transmite eventos en tiempo real y gestiona el estado de cada uno
                </Text>
              </Stack>
            </Card>
            
            <Card withBorder radius="lg" p="lg" ta="center">
              <Stack gap="md">
                <Text size="2rem">📱</Text>
                <Title order={4}>Responsive</Title>
                <Text size="sm" c="dimmed">
                  Acceso desde cualquier dispositivo con un diseño adaptativo
                </Text>
              </Stack>
            </Card>
          </Group>
        </Stack>
      </Stack>
    </Container>
  );
}
