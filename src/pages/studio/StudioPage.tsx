// src/StudioPage.tsx
import React from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Stack,
  Group,
  Title,
  Text,
  Badge,
  Paper,
  Divider,
} from "@mantine/core";
import { StudioView } from "./StudioView";

export const StudioPage: React.FC = () => {
  const { eventSlug } = useParams<{ eventSlug: string }>();

  if (!eventSlug) {
    return (
      <Container size="sm" py="xl">
        <Paper radius="md" p="lg" withBorder>
          <Title order={3}>Falta eventSlug en la URL</Title>
          <Text c="dimmed" mt="xs">
            Asegúrate de entrar por una ruta como{" "}
            <Text span fw={500}>
              /studio/mi-evento
            </Text>
            .
          </Text>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        {/* Header del Studio */}
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap="xs" align="center">
              <Badge
                radius="xl"
                variant="light"
                size="xs"
                styles={{
                  root: { textTransform: "uppercase", letterSpacing: 0.6 },
                }}
              >
                Studio
              </Badge>
              <Text size="xs" c="dimmed">
                Panel de producción en vivo
              </Text>
            </Group>
            <Title order={2}>Gen Live – Estudio</Title>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Evento:
              </Text>
              <Badge
                radius="sm"
                variant="outline"
                size="sm"
                fw={500}
                tt="none"
              >
                {eventSlug}
              </Badge>
            </Group>
          </Stack>

          <Stack gap={6} align="flex-end">
            <Badge color="green" variant="filled" radius="xl">
              Host
            </Badge>
            <Text size="xs" c="dimmed">
              Conectado a LiveKit · Rol: host
            </Text>
          </Stack>
        </Group>

        <Divider my="xs" />

        {/* Área principal del estudio */}
        <Paper
          radius="lg"
          p="sm"
          withBorder
          bg="dark.8"
          style={{ height: "75vh", display: "flex", flexDirection: "column" }}
        >
          <StudioView eventSlug={eventSlug} role="host" />
        </Paper>
      </Stack>
    </Container>
  );
};
