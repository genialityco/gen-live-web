/* eslint-disable @typescript-eslint/no-explicit-any */
// src/StudioView.tsx
import React, { useEffect, useState } from "react";
import {
  ensureRoom,
  getLivekitToken,
  startLiveRtmp,
  stopLive,
  getEgressStatus,
} from "../../api/livekit-service";
import {
  LiveKitRoom,
  ControlBar,
  RoomAudioRenderer,
  FocusLayout,
  ParticipantTile,
  GridLayout,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import {
  Box,
  Text,
  Badge,
  Center,
  Loader,
  Paper,
  Stack,
  Grid,
  SegmentedControl,
  Switch,
  Divider,
} from "@mantine/core";
import { LIVEKIT_WS_URL } from "../../core/livekitConfig";
import { LiveConfigPanel } from "./LiveConfigPanel";

type Role = "host" | "speaker";

interface StudioViewProps {
  eventSlug: string;
  role: Role;
  displayName?: string;
  identity?: string;
  showFrame?: boolean;
}

function LiveMonitor({
  layoutMode,
  showFrame,
}: {
  layoutMode: "speaker" | "grid";
  showFrame: boolean;
  eventSlug?: string;
}) {
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: true },
    ],
    { onlySubscribed: false }
  );

  // Elegimos el "focus" track:
  // - Prioriza screenshare si existe
  // - Si no, usa el primer track disponible
  const focusTrack =
    tracks.find((t) => t.source === Track.Source.ScreenShare) ??
    tracks.find((t) => t.source === Track.Source.Camera) ??
    tracks[0];

  return (
    <Box
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        background: "#000",
        overflow: "hidden",
        borderRadius: 8,
      }}
    >
      {/* MARCO */}
      {showFrame && (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            pointerEvents: "none",
          }}
        >
          <img
            src="/cortinilla-marco.png"
            alt="Marco"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <Badge
            color="red"
            size="md"
            style={{ position: "absolute", top: 16, left: 16 }}
          >
            EN VIVO
          </Badge>
        </Box>
      )}

      {/* VIDEO */}
      <Box style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        {layoutMode === "grid" ? (
          <GridLayout tracks={tracks}>
            <ParticipantTile />
          </GridLayout>
        ) : focusTrack ? (
          <FocusLayout trackRef={focusTrack}>
            <ParticipantTile trackRef={focusTrack} />
          </FocusLayout>
        ) : null}
      </Box>
    </Box>
  );
}

export const StudioView: React.FC<StudioViewProps> = ({
  eventSlug,
  role,
  displayName,
  identity,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<"speaker" | "grid">("speaker");
  const [showFrame, setShowFrame] = useState(true);
  const [egressId, setEgressId] = useState<string | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);

  const [egressStatus, setEgressStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!egressId) {
      setEgressStatus(null);
      return;
    }

    let alive = true;
    const tick = async () => {
      try {
        const s = await getEgressStatus(egressId);
        if (!alive) return;
        setEgressStatus(String(s.status ?? ""));
        if (s.error) setError(s.error);
      } catch {
        // no bloquees UI si status falla
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 2500);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [egressId]);

  // Iniciar transmisión
  const handleStartTransmission = async () => {
    setError(null);
    setIsTransmitting(true);
    try {
      const data = await startLiveRtmp(eventSlug);
      setEgressId(data.egressId);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Error iniciando transmisión"
      );
    } finally {
      setIsTransmitting(false);
    }
  };

  // Detener transmisión
  const handleStopTransmission = async () => {
    if (!egressId) return;
    setError(null);
    setIsTransmitting(true);
    try {
      await stopLive(egressId);
      setEgressId(null);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Error deteniendo transmisión"
      );
    } finally {
      setIsTransmitting(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      setError(null);
      try {
        await ensureRoom(eventSlug);

        const { token } = await getLivekitToken({
          eventSlug,
          role,
          name: displayName,
          identity,
        });

        setToken(token);
      } catch (err: any) {
        setError(
          err?.response?.data?.message || err.message || "Error inesperado"
        );
      }
    };
    void run();
  }, [eventSlug, role, displayName, identity]);

  if (error) return <Text c="red">{error}</Text>;
  if (!token)
    return (
      <Center h="100%">
        <Loader color="blue" />
      </Center>
    );

  return (
    <LiveKitRoom token={token} serverUrl={LIVEKIT_WS_URL} connect video audio>
      <Stack h="100%" gap="xs">
        {/* Botón de transmisión */}
        <Box mb="xs">
          {egressId ? (
            <>
              <Badge color="green" mr="sm">
                Transmisión activa
              </Badge>
              <button
                onClick={handleStopTransmission}
                disabled={isTransmitting}
                style={{ marginLeft: 8 }}
              >
                Detener transmisión
              </button>
            </>
          ) : (
            <button onClick={handleStartTransmission} disabled={isTransmitting}>
              Iniciar transmisión
            </button>
          )}
          {egressId && (
            <Badge variant="light" ml="sm">
              Estado: {egressStatus ?? "…"}
            </Badge>
          )}
        </Box>
        {/* ZONA CENTRAL */}
        <Grid gutter="md" style={{ flex: 1 }}>
          {/* MONITOR */}
          <Grid.Col span={9}>
            <LiveMonitor
              layoutMode={layoutMode}
              showFrame={showFrame}
              eventSlug={eventSlug}
            />
          </Grid.Col>

          {/* PANEL DERECHO */}
          <Grid.Col span={3}>
            <Stack gap="md" h="100%">
              <LiveConfigPanel
                eventSlug={eventSlug}
                disabled={!!egressId || isTransmitting}
              />
              <Paper p="sm" radius="md" bg="dark.7" h="100%">
                <Stack gap="sm">
                  <Text fw={500}>Producción</Text>

                  <SegmentedControl
                    fullWidth
                    value={layoutMode}
                    onChange={(v) => setLayoutMode(v as any)}
                    data={[
                      { label: "Speaker", value: "speaker" },
                      { label: "Mosaico", value: "grid" },
                    ]}
                  />

                  <Switch
                    checked={showFrame}
                    onChange={(e) => setShowFrame(e.currentTarget.checked)}
                    label="Marco activo"
                  />

                  <Divider />

                  <Text size="sm" c="dimmed">
                    Próximo:
                  </Text>
                  <Text size="xs">• Requests</Text>
                  <Text size="xs">• Chat</Text>
                  <Text size="xs">• Escenas</Text>
                </Stack>
              </Paper>
            </Stack>
          </Grid.Col>
        </Grid>

        {/* CONTROLES */}
        <Paper p="sm" bg="dark.8">
          <Center>
            <ControlBar variation="minimal" />
          </Center>
        </Paper>

        <RoomAudioRenderer />
      </Stack>
    </LiveKitRoom>
  );
};
