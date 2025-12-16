/* eslint-disable @typescript-eslint/no-explicit-any */
// src/viewer/LiveViewerPage.tsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Paper,
  Stack,
  Title,
  Text,
  Center,
  Loader,
  Badge,
} from "@mantine/core";
import { getPlayback } from "../../api/livekit-service";
import { ViewerHlsPlayer } from "./ViewerHlsPlayer";

export const LiveViewerPage: React.FC = () => {
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!eventSlug) return;
      setError(null);

      try {
        const { playbackUrl } = await getPlayback(eventSlug);
        setPlaybackUrl(playbackUrl);
      } catch (e: any) {
        setError(
          e?.response?.data?.message || e.message || "Error cargando el stream"
        );
      }
    };

    void run();
  }, [eventSlug]);

  if (!eventSlug) {
    return (
      <Container size="sm" py="xl">
        <Paper p="lg" withBorder radius="md">
          <Title order={3}>Falta eventSlug</Title>
          <Text c="dimmed">Entra por una ruta como /live/mi-evento</Text>
        </Paper>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="sm" py="xl">
        <Paper p="lg" withBorder radius="md">
          <Title order={3}>No se pudo cargar la transmisión</Title>
          <Text c="red" mt="xs">
            {error}
          </Text>
        </Paper>
      </Container>
    );
  }

  if (!playbackUrl) {
    return (
      <Center style={{ minHeight: "70vh" }}>
        <Stack align="center" gap="xs">
          <Loader />
          <Text c="dimmed">Cargando transmisión…</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Container size="lg" py="md">
      <Stack gap="md">
        <Stack gap={4}>
          <Badge color="red" variant="filled" radius="sm" w="fit-content">
            EN VIVO
          </Badge>
          <Title order={2}>Gen Live</Title>
          <Text c="dimmed">Evento: {eventSlug}</Text>
        </Stack>

        <Paper p="sm" radius="lg" withBorder>
          <ViewerHlsPlayer src={playbackUrl} />
        </Paper>

        <Text size="sm" c="dimmed">
          Si quieres participar, aquí luego ponemos el botón de “Solicitar
          unirme” (join request).
        </Text>
      </Stack>
    </Container>
  );
};
