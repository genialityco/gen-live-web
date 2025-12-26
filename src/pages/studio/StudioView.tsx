/* eslint-disable @typescript-eslint/no-explicit-any */
// src/StudioView.tsx
import React, { useEffect, useState } from "react";
import {
  ensureRoom,
  getLivekitToken,
  startLiveRtmp,
  stopLive,
  getEgressStatus,
  getLiveConfig,
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
  Divider,
} from "@mantine/core";
import { LIVEKIT_WS_URL } from "../../core/livekitConfig";
import { LiveConfigPanel } from "./LiveConfigPanel";
import { JoinRequestsPanel } from "./JoinRequestsPanel";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { FrameControls } from "../../components/FrameControls";

import { LiveMonitor } from "./LiveMonitor";
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
}

function normalizeStatus(s: any): string {
  if (!s) return "";
  if (typeof s === "string") return s.toLowerCase();
  if (typeof s === "number") return String(s);
  return String(s).toLowerCase();
}

function isTerminalEgressStatus(status: string) {
  // ajusta si tu API devuelve otros strings
  return ["complete", "completed", "ended", "failed", "aborted", "stopped"].includes(status);
}

export const StudioView: React.FC<StudioViewProps> = ({
  eventSlug,
  role,
  displayName,
  identity,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showFrame, setShowFrame] = useState(false);
  const [frameUrl, setFrameUrl] = useState("");

  const [egressId, setEgressId] = useState<string | null>(null);
  const [startingEgress, setStartingEgress] = useState(false);
  const [stoppingEgress, setStoppingEgress] = useState(false);
  const [egressStatus, setEgressStatus] = useState<string | null>(null);

  // ✅ single source of truth
  const stage = useStage(eventSlug);

  // ----- egress status poll (adaptativo) -----
  useEffect(() => {
    if (!egressId) {
      setEgressStatus(null);
      return;
    }

    let alive = true;
    let timer: number | null = null;

    const tick = async () => {
      try {
        const s = await getEgressStatus(egressId);
        if (!alive) return;

        const st = normalizeStatus(s.status);
        setEgressStatus(st || "");

        if (s.error) setError(String(s.error));

        // terminal => stop polling
        if (st && isTerminalEgressStatus(st)) {
          if (timer) window.clearTimeout(timer);
          timer = null;
          return;
        }

        const delay =
          st === "starting" || st === "pending" ? 1000 : 3500;

        timer = window.setTimeout(() => void tick(), delay);
      } catch {
        if (!alive) return;
        timer = window.setTimeout(() => void tick(), 3500);
      }
    };

    void tick();

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [egressId]);

  const handleStartTransmission = async () => {
    setError(null);
    setStartingEgress(true);
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
      setStartingEgress(false);
    }
  };

  const handleStopTransmission = async () => {
    if (!egressId) return;
    setError(null);
    setStoppingEgress(true);
    try {
      await stopLive(egressId);
      setEgressId(null);
      setEgressStatus(null);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Error deteniendo transmisión"
      );
    } finally {
      setStoppingEgress(false);
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

  const fetchConfig = async () => {
    try {
      const cfg = await getLiveConfig(eventSlug);
      setShowFrame(!!cfg.showFrame);
      setFrameUrl(cfg.frameUrl || "");
    } catch (err) {
      console.error("Error fetching config:", err);
    }
  };

  // fetch initial config
  useEffect(() => {
    void fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug]);

  if (error) return <Text c="red">{error}</Text>;
  if (!token)
    return (
      <Center h="100%">
        <Loader color="blue" />
      </Center>
    );

  const isBusy = startingEgress || stoppingEgress;

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
          <StudioToolbar
            egressId={egressId}
            isBusy={isBusy}
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
                  <LiveMonitor
                    showFrame={showFrame}
                    frameUrl={frameUrl}
                    stage={stage}
                  />
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
                        disabled={!!egressId || isBusy}
                      />

                      <JoinRequestsPanel eventSlug={eventSlug} />

                      <Paper p="sm" radius="md" bg="dark.7">
                        <Stack gap="sm">
                          <Text fw={500}>Marco gráfico</Text>

                          <FrameControls
                            eventSlug={eventSlug}
                            showFrame={showFrame}
                            frameUrl={frameUrl}
                            onUpdate={fetchConfig}
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
