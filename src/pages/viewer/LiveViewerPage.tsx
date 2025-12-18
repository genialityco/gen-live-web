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
  Group,
  Button,
} from "@mantine/core";
import { ensureRoom, getPlayback } from "../../api/livekit-service";
import { ViewerHlsPlayer } from "./ViewerHlsPlayer";
import {
  requestToJoin,
  subscribeJoinDecision,
} from "../../api/live-join-service";
import {
  ControlBar,
  LiveKitRoom,
  RoomAudioRenderer,
} from "@livekit/components-react";
import { LIVEKIT_WS_URL } from "../../core/livekitConfig";

export const LiveViewerPage: React.FC = () => {
  const { eventSlug } = useParams<{ eventSlug: string }>();

  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [joinState, setJoinState] = useState<
    "idle" | "pending" | "approved" | "rejected" | "kicked"
  >("idle");
  const [speakerToken, setSpeakerToken] = useState<string | null>(null);
  const [mode, setMode] = useState<"hls" | "studio">("hls");

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

  // escuchar decisión RTDB
  useEffect(() => {
    if (!eventSlug) return;

    let unsub: (() => void) | null = null;
    try {
      unsub = subscribeJoinDecision(eventSlug, async (d) => {
        if (!d) return;

        if (d.status === "approved" && d.token) {
          setJoinState("approved");
          setSpeakerToken(d.token);

          // asegura room por si acaso
          await ensureRoom(eventSlug);

          // cambia a Studio (LiveKit)
          setMode("studio");
        }

        if (d.status === "rejected") {
          setJoinState("rejected");
          setMode("hls");
          setSpeakerToken(null);
        }

        if (d.status === "kicked") {
          setJoinState("kicked");
          setMode("hls");
          setSpeakerToken(null);
        }
      });
    } catch (e: any) {
      // si no hay auth, no rompe el viewer, solo no habilita join
      console.warn("RTDB decision listener error:", e?.message || e);
    }

    return () => unsub?.();
  }, [eventSlug]);

  const handleJoinRequest = async () => {
    if (!eventSlug) return;
    setError(null);
    setJoinState("pending");
    try {
      await requestToJoin(eventSlug);
    } catch (e: any) {
      setJoinState("idle");
      setError(
        e?.response?.data?.message || e.message || "No se pudo solicitar unirme"
      );
    }
  };

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
          {mode === "hls" ? (
            <ViewerHlsPlayer src={playbackUrl} />
          ) : (
            <LiveKitRoom
              token={speakerToken!}
              serverUrl={LIVEKIT_WS_URL}
              connect
              video
              audio
            >
              <Stack>
                <Group justify="space-between">
                  <Badge color="green">Modo Speaker</Badge>
                  <Text size="sm" c="dimmed">
                    Ya estás dentro del estudio
                  </Text>
                </Group>
                <ControlBar />
                <RoomAudioRenderer />
              </Stack>
            </LiveKitRoom>
          )}
        </Paper>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {joinState === "pending" && "Solicitud enviada. Espera aprobación…"}
            {joinState === "rejected" && "Tu solicitud fue rechazada."}
            {joinState === "kicked" && "Fuiste expulsado del estudio."}
          </Text>

          <Button
            onClick={handleJoinRequest}
            disabled={joinState === "pending" || mode === "studio"}
          >
            Solicitar unirme
          </Button>
        </Group>
      </Stack>
    </Container>
  );
};
