// src/StudioView.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
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
} from "@livekit/components-react";
import "@livekit/components-styles";
import {
  Box,
  Text,
  Center,
  Loader,
  Paper,
  Stack,
  Grid,
  Switch,
  Divider,
} from "@mantine/core";
import { LIVEKIT_WS_URL } from "../../core/livekitConfig";
import { LiveConfigPanel } from "./LiveConfigPanel";
import { JoinRequestsPanel } from "./JoinRequestsPanel";
import { ParticipantsPanel } from "./ParticipantsPanel";

import { LiveMonitor } from "./LiveMonitor"; // ajusta ruta
import { useStage } from "../../hooks/useStage";
import {
  setOnStage,
  setActiveUid,
  setProgramMode,
  type ProgramMode,
} from "../../api/live-stage-service";
import { StudioToolbar } from "./StudioToolbar";

type Role = "host" | "speaker";

interface StudioViewProps {
  eventSlug: string;
  role: Role;
  displayName?: string;
  identity?: string;
  showFrame?: boolean;
}

export const StudioView: React.FC<StudioViewProps> = ({
  eventSlug,
  role,
  displayName,
  identity,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showFrame, setShowFrame] = useState(true);

  const [egressId, setEgressId] = useState<string | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [egressStatus, setEgressStatus] = useState<string | null>(null);

  // ✅ single source of truth
  const stage = useStage(eventSlug);

  // ----- egress status poll -----
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

  // ----- token -----
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

  // ----- stage handlers (pro) -----
  const handleToggleStage = async (uid: string, next: boolean) => {
    await setOnStage(eventSlug, uid, next);

    // UX: si lo subes y no hay pin, pínalo automáticamente en speaker mode
    if (next && !stage.activeUid) {
      await setActiveUid(eventSlug, uid);
      await setProgramMode(eventSlug, "speaker");
    }

    // si lo bajas y estaba pineado, quita pin
    if (!next && stage.activeUid === uid) {
      await setActiveUid(eventSlug, "");
    }
  };

  const handlePin = async (uid: string) => {
    await setActiveUid(eventSlug, uid);
    await setProgramMode(eventSlug, "speaker");
    if (!stage.onStage[uid]) {
      await setOnStage(eventSlug, uid, true);
    }
  };

  const handleUnpin = async () => {
    await setActiveUid(eventSlug, "");
  };

  const handleSetMode = async (m: ProgramMode) => {
    await setProgramMode(eventSlug, m);
  };

  if (error) return <Text c="red">{error}</Text>;
  if (!token)
    return (
      <Center h="100%">
        <Loader color="blue" />
      </Center>
    );

  return (
    <LiveKitRoom token={token} serverUrl={LIVEKIT_WS_URL} connect video audio>
      <Box
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* HEADER */}
        <Paper
          p="sm"
          radius={0}
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Box style={{ display: "flex", alignItems: "center", gap: 12 }}>

            <Box style={{ marginLeft: "auto" }} />
          </Box>
          <StudioToolbar
            egressId={egressId}
            isBusy={isTransmitting}
            egressStatus={egressStatus}
            stage={stage}
            showFrame={showFrame}
            onToggleFrame={setShowFrame}
            onStart={handleStartTransmission}
            onStop={handleStopTransmission}
            onMode={handleSetMode}
          />
        </Paper>

        {/* BODY */}
        <Box style={{ flex: 1, minHeight: 0, padding: 12 }}>
          <Grid gutter="md" style={{ height: "100%", margin: 0 }}>
            {/* IZQUIERDA */}
            <Grid.Col span={9} style={{ height: "100%", minHeight: 0 }}>
              <Box
                style={{
                  height: "100%",
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Monitor grande (PROGRAMA: solo onStage) */}
                <Box style={{ flex: 1, minHeight: 360 }}>
                  <LiveMonitor showFrame={showFrame} stage={stage} />
                </Box>

                {/* Dock participantes */}
                <Paper
                  radius="md"
                  p="sm"
                  bg="dark.7"
                  style={{
                    height: 240,
                    overflow: "auto",
                  }}
                >
                  <ParticipantsPanel
                    eventSlug={eventSlug}
                    stage={stage}
                    onToggleStage={handleToggleStage}
                    onPin={handlePin}
                    onUnpin={handleUnpin}
                    onSetMode={handleSetMode}
                  />
                </Paper>
              </Box>
            </Grid.Col>

            {/* DERECHA */}
            <Grid.Col span={3} style={{ height: "100%", minHeight: 0 }}>
              <Box
                style={{
                  height: "100%",
                  minHeight: 0,
                  position: "sticky",
                  top: 12,
                }}
              >
                <Stack
                  gap="md"
                  style={{
                    height: "100%",
                    minHeight: 0,
                    overflow: "hidden",
                  }}
                >
                  <Box style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                    <Stack gap="md">
                      <LiveConfigPanel
                        eventSlug={eventSlug}
                        disabled={!!egressId || isTransmitting}
                      />

                      <JoinRequestsPanel eventSlug={eventSlug} />

                      <Paper p="sm" radius="md" bg="dark.7">
                        <Stack gap="sm">
                          <Text fw={500}>Producción</Text>

                          <Switch
                            checked={showFrame}
                            onChange={(e) =>
                              setShowFrame(e.currentTarget.checked)
                            }
                            label="Marco activo"
                          />

                          <Divider />

                          <Text size="xs" c="dimmed">
                            Tip pro: el monitor muestra SOLO los que están “En
                            escena”. Los demás están en “Backstage”.
                          </Text>
                        </Stack>
                      </Paper>
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            </Grid.Col>
          </Grid>
        </Box>

        {/* FOOTER */}
        <Paper
          p="sm"
          radius={0}
          bg="dark.8"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Center>
            <ControlBar variation="minimal" />
          </Center>
        </Paper>

        <RoomAudioRenderer />
      </Box>
    </LiveKitRoom>
  );
};
