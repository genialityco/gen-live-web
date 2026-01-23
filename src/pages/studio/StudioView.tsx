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
  updateLiveConfig,
} from "../../api/livekit-service";
import { getEffectiveMediaConfig } from "../../api/media-library-service";
import {
  LiveKitRoom,
  ControlBar,
  useLocalParticipant,
  LayoutContextProvider,
  useRemoteParticipants,
} from "@livekit/components-react";
import { Track } from "livekit-client";

import "@livekit/components-styles";
import {
  Box,
  Text,
  Center,
  Loader,
  Paper,
  AppShell,
  ScrollArea,
  Container,
  Drawer,
  Group,
  Badge,
  Button,
  Stack,
  Alert,
  Affix,
  ActionIcon,
  Indicator,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconAlertTriangle,
  IconMessageCircle,
  IconX,
  IconSettings,
} from "@tabler/icons-react";

import { LIVEKIT_WS_URL } from "../../core/livekitConfig";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { LiveMonitor } from "./LiveMonitor";
import { useStage } from "../../hooks/useStage";
import {
  setOnStage,
  setActiveUid,
  setProgramMode,
  setLayoutMode,
  setEgressState,
  type ProgramMode,
} from "../../api/live-stage-service";
import { StudioToolbar } from "./StudioToolbar";
import { StudioSidePanel } from "./StudioSidePanel";
import { VirtualBackgroundControl } from "./VirtualBackgroundControl";
import type { LayoutMode } from "../../types";
import {
  emergencyResetEventState,
  validateEgressState,
} from "../../api/emergency-reset-service";
import { StudioChatPanel } from "./StudioChatPanel";

type Role = "host" | "speaker";

interface StudioViewProps {
  eventSlug: string;
  role: Role;
  displayName?: string;
  identity?: string;
  token?: string; // Token pre-generado (opcional)
}

function normalizeStatus(s: any): string {
  if (!s) return "";
  if (typeof s === "string") return s.toLowerCase();
  if (typeof s === "number") return String(s);
  return String(s).toLowerCase();
}

function isTerminalEgressStatus(status: string) {
  // ajusta si tu API devuelve otros strings
  return [
    "complete",
    "completed",
    "ended",
    "failed",
    "aborted",
    "stopped",
  ].includes(status);
}

/**
 * Componente que solo reproduce audio de participantes que están on-stage
 */
function FilteredRoomAudio(props: { onStageMap: Record<string, boolean> }) {
  const remoteParticipants = useRemoteParticipants();

  return (
    <>
      {remoteParticipants.map((participant) => {
        const isOnStage = props.onStageMap[participant.identity] ?? false;
        if (!isOnStage) return null;

        return (
          <ParticipantAudio
            key={participant.identity}
            participant={participant}
          />
        );
      })}
    </>
  );
}

/**
 * Renderiza el audio de un participante individual
 * Incluye tanto el micrófono como el audio de pantalla compartida
 */
function ParticipantAudio(props: { participant: any }) {
  const microphoneTrack = props.participant.getTrackPublication(
    Track.Source.Microphone,
  )?.audioTrack;
  const screenShareAudioTrack = props.participant.getTrackPublication(
    Track.Source.ScreenShareAudio,
  )?.audioTrack;

  // Reproducir audio del micrófono
  useEffect(() => {
    if (!microphoneTrack) return;

    const audioElement = microphoneTrack.attach();
    document.body.appendChild(audioElement);

    return () => {
      microphoneTrack.detach(audioElement);
      audioElement.remove();
    };
  }, [microphoneTrack]);

  // Reproducir audio de la pantalla compartida
  useEffect(() => {
    if (!screenShareAudioTrack) return;

    const audioElement = screenShareAudioTrack.attach();
    document.body.appendChild(audioElement);

    return () => {
      screenShareAudioTrack.detach(audioElement);
      audioElement.remove();
    };
  }, [screenShareAudioTrack]);

  return null;
}

function StudioRoomUI(props: {
  chatOpen: boolean;
  setChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  unread: number;
  setUnread: React.Dispatch<React.SetStateAction<number>>;
}) {
  const { localParticipant } = useLocalParticipant();
  const myId = localParticipant?.identity;

  return (
    <>
      <Drawer
        opened={props.chatOpen}
        onClose={() => props.setChatOpen(false)}
        position="right"
        size={420}
        overlayProps={{ opacity: 0.35, blur: 2 }}
        withCloseButton
        keepMounted
      >
        <StudioChatPanel
          chatOpen={props.chatOpen}
          setUnread={props.setUnread}
          myId={myId}
        />
      </Drawer>

      <Affix position={{ bottom: 20, right: 20 }}>
        <Indicator
          disabled={props.unread === 0}
          label={props.unread > 99 ? "99+" : props.unread}
          size={18}
          processing
        >
          <ActionIcon
            size="xl"
            radius="xl"
            variant="filled"
            onClick={() => props.setChatOpen((v) => !v)}
            aria-label={props.chatOpen ? "Cerrar chat" : "Abrir chat"}
            style={{ boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}
          >
            {props.chatOpen ? <IconX size={22} /> : <IconMessageCircle size={22} />}
          </ActionIcon>
        </Indicator>
      </Affix>
    </>
  );
}

export const StudioView: React.FC<StudioViewProps> = ({
  eventSlug,
  role,
  displayName: initialDisplayName,
  identity,
  token: preGeneratedToken,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipLiveKit, setSkipLiveKit] = useState(false);
  const [, setEmergencyReason] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [stateWarning, setStateWarning] = useState<string | null>(null);

  const [showFrame, setShowFrame] = useState(false);
  const [frameUrl, setFrameUrl] = useState("");
  const [, setActiveMediaItemId] = useState(""); // Legacy
  const [activeVisualId, setActiveVisualId] = useState("");
  const [activeAudioId, setActiveAudioId] = useState("");
  const [mediaEnabled, setMediaEnabled] = useState(false);

  // Estados separados para visual y audio
  const [visualUrl, setVisualUrl] = useState("");
  const [visualType, setVisualType] = useState<"image" | "gif" | "video">("image");
  const [visualMode, setVisualMode] = useState<"overlay" | "full">("overlay");
  const [visualLoop, setVisualLoop] = useState(false);
  const [visualMuted, setVisualMuted] = useState(true);
  const [visualFit, setVisualFit] = useState<"cover" | "contain">("cover");
  const [visualOpacity, setVisualOpacity] = useState(1);

  const [audioUrl, setAudioUrl] = useState("");
  const [audioLoop, setAudioLoop] = useState(false);
  const [audioMuted, setAudioMuted] = useState(true);

  // Background
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [backgroundType, setBackgroundType] = useState<"image" | "gif" | "video">(
    "image",
  );
  const [backgroundColor, setBackgroundColor] = useState("#000000");

  // Legacy para backward compatibility
  const [mediaType, setMediaType] = useState<"image" | "gif" | "video" | "audio">(
    "image",
  );
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaMode, setMediaMode] = useState<"overlay" | "full">("overlay");
  const [mediaLoop, setMediaLoop] = useState(false);
  const [mediaMuted, setMediaMuted] = useState(true);
  const [mediaFit, setMediaFit] = useState<"cover" | "contain">("cover");
  const [mediaOpacity, setMediaOpacity] = useState(1);

  const [startingEgress, setStartingEgress] = useState(false);
  const [stoppingEgress, setStoppingEgress] = useState(false);

  // Responsive
  const isNarrow = useMediaQuery("(max-width: 1100px)");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [sideOpen, setSideOpen] = useState(false);

  // Nombre por defecto: "Producción" para host
  const displayName = initialDisplayName || (role === "host" ? "Producción" : undefined);

  // Estado para nombres personalizados de participantes (identity -> nombre)
  const [customNames, setCustomNames] = useState<Record<string, string>>({});

  // single source of truth
  const stage = useStage(eventSlug);

  // Usar egressId y egressStatus del stage (sincronizado via RTDB)
  const egressId = stage.egressId ?? null;
  const egressStatus = stage.egressStatus ?? null;

  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // Guardar layout en RTDB (tiempo real) y backend
  const handleLayoutModeChange = async (mode: LayoutMode) => {
    try {
      await setLayoutMode(eventSlug, mode);
      await updateLiveConfig({ eventSlug, layout: mode });
    } catch (err) {
      console.error("Error updating layout:", err);
    }
  };

  // ----- egress status poll (adaptativo) - solo para host -----
  useEffect(() => {
    if (role !== "host" || !egressId) return;

    let alive = true;
    let timer: number | null = null;

    const tick = async () => {
      try {
        const s = await getEgressStatus(egressId);
        if (!alive) return;

        const st = normalizeStatus(s.status);

        // Sincronizar estado en RTDB para que todos lo vean
        await setEgressState(eventSlug, egressId, st || "");

        if (s?.error) {
          setStateWarning(`No se pudo consultar estado del egress: ${String(s.error)}`);
        }

        if (st && isTerminalEgressStatus(st)) {
          if (timer) window.clearTimeout(timer);
          timer = null;
          return;
        }

        const delay = st === "starting" || st === "pending" ? 1000 : 3500;
        timer = window.setTimeout(() => void tick(), delay);
      } catch (e: any) {
        console.error("Error polling egress status:", e);
        if (!alive) return;
        timer = window.setTimeout(() => void tick(), 3500);
      }
    };

    void tick();

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [egressId, role, eventSlug]);

  const handleStartTransmission = async () => {
    setError(null);
    setStartingEgress(true);
    try {
      const data = await startLiveRtmp(eventSlug);
      await setEgressState(eventSlug, data.egressId, "starting");
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err.message || "Error iniciando transmisión",
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
      await setEgressState(eventSlug, null, null);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err.message || "Error deteniendo transmisión",
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
        if (preGeneratedToken) {
          setToken(preGeneratedToken);
          return;
        }

        await ensureRoom(eventSlug);

        const { token } = await getLivekitToken({
          eventSlug,
          role,
          name: displayName,
          identity,
        });

        setToken(token);
      } catch (err: any) {
        const errorMsg =
          err?.response?.data?.message || err.message || "Error inesperado";
        setError(errorMsg);

        if (role === "host") {
          setEmergencyReason(errorMsg);
        }
      }
    };
    void run();
  }, [eventSlug, role, displayName, identity, preGeneratedToken]);

  // ----- stage handlers (pro) -----

  // Subir/bajar de escena: ahora acepta cualquier key (cámara o pantalla)
  const handleToggleStage = async (stageKey: string, next: boolean) => {
    await setOnStage(eventSlug, stageKey, next);

    // Si se sube y no hay pin, pinear ese mismo item
    if (next && !stage.activeUid) {
      await setActiveUid(eventSlug, stageKey);
      await setProgramMode(eventSlug, "speaker");
    }

    // Si se baja y está pineado, quitar pin
    if (!next && stage.activeUid === stageKey) {
      await setActiveUid(eventSlug, "");
    }
  };

  // Pinear: acepta cualquier key (cámara o pantalla)
  const handlePin = async (stageKey: string) => {
    await setActiveUid(eventSlug, stageKey);
    await setProgramMode(eventSlug, "speaker");
    if (!stage.onStage[stageKey]) {
      await setOnStage(eventSlug, stageKey, true);
    }
  };

  const handleUnpin = async () => {
    await setActiveUid(eventSlug, "");
  };

  const handleSetMode = async (m: ProgramMode) => {
    await setProgramMode(eventSlug, m);
  };

  const handleChangeParticipantName = (identity: string, newName: string) => {
    setCustomNames((prev) => ({
      ...prev,
      [identity]: newName,
    }));
  };

  // Función de reset de emergencia
  const handleEmergencyReset = async () => {
    if (
      !confirm(
        "¿Estás seguro de resetear todo el estado? Esto detendrá cualquier transmisión activa.",
      )
    ) {
      return;
    }

    setResetting(true);
    try {
      const result = await emergencyResetEventState(eventSlug);
      if (result.success) {
        setStateWarning(null);
        alert("Estado reseteado exitosamente. Recarga la página.");
        window.location.reload();
      } else {
        alert(`Error al resetear: ${result.message}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  // Validar estado del egress al montar
  useEffect(() => {
    const validateState = async () => {
      if (!egressId || role !== "host") return;

      const validation = await validateEgressState(egressId);
      if (!validation.exists) {
        setStateWarning(
          `Egress ${egressId.slice(0, 8)}... no existe. El estado puede estar desincronizado.`,
        );
      }
    };

    void validateState();
  }, [egressId, role]);

  const fetchConfig = async () => {
    try {
      const cfg = await getLiveConfig(eventSlug);

      setShowFrame(!!cfg.showFrame);
      setFrameUrl(cfg.frameUrl || "");

      setActiveMediaItemId(cfg.activeMediaItemId || ""); // Legacy
      setActiveVisualId(cfg.activeVisualItemId || "");
      setActiveAudioId(cfg.activeAudioItemId || "");
      setMediaEnabled(!!cfg.mediaEnabled);

      console.log("📊 fetchConfig - IDs:", {
        visual: cfg.activeVisualItemId,
        audio: cfg.activeAudioItemId,
        mediaEnabled: cfg.mediaEnabled,
      });

      // Legacy fields
      setMediaType(cfg.mediaType || "image");
      setMediaUrl(cfg.mediaUrl || "");
      setMediaMode(cfg.mediaMode || "overlay");
      setMediaLoop(cfg.mediaLoop ?? false);
      setMediaMuted(cfg.mediaMuted ?? true);
      setMediaFit(cfg.mediaFit || "cover");
      setMediaOpacity(typeof cfg.mediaOpacity === "number" ? cfg.mediaOpacity : 1);

      // Obtener effective config para visual y audio
      const effectiveConfig = await getEffectiveMediaConfig(eventSlug);

      console.log("📊 effectiveConfig:", effectiveConfig);

      if (effectiveConfig.visual) {
        setVisualUrl(effectiveConfig.visual.item.url);
        setVisualType(
          effectiveConfig.visual.item.type as "image" | "gif" | "video",
        );
        setVisualMode(effectiveConfig.visual.config.mode);
        setVisualLoop(effectiveConfig.visual.config.loop);
        setVisualMuted(effectiveConfig.visual.config.muted);
        setVisualFit(effectiveConfig.visual.config.fit);
        setVisualOpacity(effectiveConfig.visual.config.opacity);
      } else {
        setVisualUrl("");
      }

      if (effectiveConfig.audio) {
        setAudioUrl(effectiveConfig.audio.item.url);
        setAudioLoop(effectiveConfig.audio.config.loop);
        setAudioMuted(effectiveConfig.audio.config.muted);
      } else {
        setAudioUrl("");
      }

      // Background
      setBackgroundUrl(cfg.backgroundUrl || "");
      setBackgroundType(cfg.backgroundType || "image");
      setBackgroundColor(cfg.backgroundColor || "#000000");
    } catch (err) {
      console.error("Error fetching config:", err);
    }
  };

  // fetch initial config
  useEffect(() => {
    void fetchConfig();

    const interval = setInterval(() => {
      void fetchConfig();
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug]);

  // Mostrar error solo si no es host o si aún no se activa modo emergencia
  if (error && !skipLiveKit) {
    const isHost = role === "host";

    return (
      <Center>
        <Stack gap="md" align="center" maw={520} px="md">
          <Alert icon={<IconAlertTriangle />} title="Error de conexión" color="red" w="100%">
            {error}
          </Alert>

          {isHost ? (
            <Stack w="100%" gap="xs">
              <Button
                onClick={() => {
                  setStateWarning("Modo de emergencia activado manualmente.");
                  setSkipLiveKit(true);
                }}
              >
                Entrar en modo emergencia
              </Button>

              <Button
                variant="default"
                onClick={() => {
                  setError(null);
                  setToken(null);
                  setEmergencyReason(null);
                  setSkipLiveKit(false);
                }}
              >
                Reintentar conexión
              </Button>

              <Text size="xs" c="dimmed">
                Si LiveKit o el backend no responden, puedes entrar igual para gestionar el
                estado del evento/transmisión.
              </Text>
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              Contacta al host para revisar la conexión.
            </Text>
          )}
        </Stack>
      </Center>
    );
  }

  if (!token && !skipLiveKit) {
    return (
      <Center h="100%">
        <Loader color="blue" />
      </Center>
    );
  }

  const isBusy = startingEgress || stoppingEgress;

  // Modo emergencia: solo controles sin LiveKit
  if (skipLiveKit && role === "host") {
    return (
      <Container p="md">
        <Stack gap="md">
          <Alert icon={<IconAlertTriangle />} title="Modo de Emergencia" color="yellow">
            LiveKit no está disponible. Solo puedes gestionar el estado de la transmisión.
          </Alert>

          {stateWarning && (
            <Alert icon={<IconAlertTriangle />} title="Advertencia de Estado" color="orange">
              {stateWarning}
            </Alert>
          )}

          <Paper p="lg" withBorder>
            <Stack gap="md">
              <Group justify="space-between">
                <div>
                  <Text fw={600} size="lg">
                    Estado de la Transmisión
                  </Text>
                  <Text size="sm" c="dimmed">
                    Evento: {eventSlug}
                  </Text>
                </div>
                {egressId && egressStatus && (
                  <Badge color={egressStatus === "active" ? "green" : "gray"}>
                    {egressStatus}
                  </Badge>
                )}
              </Group>

              <Group>
                <Button
                  color="blue"
                  disabled={!!egressId || isBusy}
                  loading={startingEgress}
                  onClick={handleStartTransmission}
                >
                  Iniciar Transmisión
                </Button>

                <Button
                  color="red"
                  disabled={!egressId || isBusy}
                  loading={stoppingEgress}
                  onClick={handleStopTransmission}
                >
                  Detener Transmisión
                </Button>

                <Button
                  color="orange"
                  variant="light"
                  loading={resetting}
                  onClick={handleEmergencyReset}
                >
                  Resetear Estado
                </Button>
              </Group>

              {egressId && (
                <Text size="sm" c="dimmed">
                  Egress ID: {egressId}
                </Text>
              )}
            </Stack>
          </Paper>

          <Alert color="blue" title="Instrucciones">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>Si la transmisión está bloqueada, usa "Resetear Estado"</li>
              <li>Esto detendrá cualquier transmisión activa y limpiará el estado</li>
              <li>Después del reset, recarga la página para reconectar LiveKit</li>
            </ul>
          </Alert>
        </Stack>
      </Container>
    );
  }

  // Renderizado normal con LiveKit
  return (
    <div>
      <LiveKitRoom token={token!} serverUrl={LIVEKIT_WS_URL} connect video audio>
        <AppShell
          header={{ height: 64 }}
          padding="md"
          styles={{
            main: {
              display: "flex",
              flexDirection: "column",
              minHeight: "calc(100dvh - 60px)",
            },
          }}
        >
          {/* HEADER */}
          <AppShell.Header>
            <Paper
              h="100%"
              px="md"
              radius={0}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--mantine-color-dark-4)",
              }}
            >
              <Group gap="xs">
                {displayName && (
                  <Group gap="xs">
                    <Badge color={role === "host" ? "blue" : "green"} variant="dot">
                      {role === "host" ? "Host" : "Speaker"}
                    </Badge>
                    <Text size="sm" fw={500}>
                      {displayName}
                    </Text>
                  </Group>
                )}
              </Group>

              <Group gap="xs" wrap="nowrap">
                {/* Responsive: botón de controles (solo host + narrow) */}
                {role === "host" && isNarrow && (
                  <ActionIcon
                    variant="light"
                    radius="xl"
                    onClick={() => setSideOpen(true)}
                    aria-label="Abrir controles"
                  >
                    <IconSettings size={18} />
                  </ActionIcon>
                )}

                <StudioToolbar
                  role={role}
                  egressId={egressId}
                  isBusy={isBusy}
                  egressStatus={egressStatus}
                  stage={stage}
                  showFrame={showFrame}
                  onToggleFrame={setShowFrame}
                  onStart={handleStartTransmission}
                  onStop={handleStopTransmission}
                  layoutMode={stage.layoutMode}
                  onLayoutMode={handleLayoutModeChange}
                  onMode={handleSetMode}
                />
              </Group>
            </Paper>
          </AppShell.Header>

          {/* MAIN */}
          <AppShell.Main style={{ padding: 0 }}>
            {/* Advertencia de estado */}
            {stateWarning && role === "host" && (
              <Alert
                icon={<IconAlertTriangle />}
                title="Advertencia de Estado"
                color="orange"
                withCloseButton
                onClose={() => setStateWarning(null)}
                mb="md"
              >
                <Stack gap="xs">
                  <Text size="sm">{stateWarning}</Text>
                  <Button
                    size="xs"
                    color="orange"
                    variant="light"
                    loading={resetting}
                    onClick={handleEmergencyReset}
                  >
                    Resetear Estado
                  </Button>
                </Stack>
              </Alert>
            )}

            <Box
              style={{
                display: "grid",
                gridTemplateColumns:
                  role === "host" && !isNarrow ? "minmax(0, 1fr) 500px" : "1fr",
                gap: isMobile ? 12 : 16,
                alignItems: "start",
              }}
            >
              {/* Columna principal - Monitor y participantes */}
              <Box
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  minWidth: 0,
                }}
              >
                <LayoutContextProvider>
                  <LiveMonitor
                    showFrame={showFrame}
                    frameUrl={frameUrl}
                    stage={stage}
                    layoutMode={stage.layoutMode}
                    mediaEnabled={mediaEnabled}
                    visualUrl={visualUrl}
                    visualType={visualType}
                    visualMode={visualMode}
                    visualLoop={visualLoop}
                    visualMuted={visualMuted}
                    visualFit={visualFit}
                    visualOpacity={visualOpacity}
                    audioUrl={audioUrl}
                    audioLoop={audioLoop}
                    audioMuted={audioMuted}
                    backgroundUrl={backgroundUrl}
                    backgroundType={backgroundType}
                    backgroundColor={backgroundColor}
                    mediaType={mediaType}
                    mediaUrl={mediaUrl}
                    mediaMode={mediaMode}
                    mediaLoop={mediaLoop}
                    mediaMuted={mediaMuted}
                    mediaFit={mediaFit}
                    mediaOpacity={mediaOpacity}
                  />
                </LayoutContextProvider>

                <Paper
                  p="sm"
                  withBorder
                  radius="md"
                  style={{ display: "flex", justifyContent: "center" }}
                >
                  <ControlBar variation="minimal" />
                </Paper>

                <Paper p="sm" withBorder radius="md">
                  <VirtualBackgroundControl
                    eventSlug={eventSlug}
                    disabled={isBusy}
                  />
                </Paper>

                <Paper p="sm" radius="md" withBorder style={{ minHeight: 0 }}>
                  {/* ✅ Scroll real: damos una altura razonable para que no “explote” */}
                  <ScrollArea h={isNarrow ? 320 : 420} offsetScrollbars>
                    <ParticipantsPanel
                      role={role}
                      eventSlug={eventSlug}
                      stage={stage}
                      customNames={customNames}
                      onChangeParticipantName={handleChangeParticipantName}
                      onToggleStage={handleToggleStage}
                      onPin={handlePin}
                      onUnpin={handleUnpin}
                      onSetMode={handleSetMode}
                    />
                  </ScrollArea>
                </Paper>
              </Box>

              {/* Columna lateral - Panel de control (solo host) */}
              {role === "host" && !isNarrow && (
                <Paper
                  p="md"
                  radius="md"
                  withBorder
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                  }}
                >
                  <StudioSidePanel
                    role={role}
                    eventSlug={eventSlug}
                    disabled={isBusy}
                    showFrame={showFrame}
                    frameUrl={frameUrl}
                    backgroundUrl={backgroundUrl}
                    backgroundType={backgroundType}
                    onRefreshFrameConfig={fetchConfig}
                    activeVisualId={activeVisualId}
                    activeAudioId={activeAudioId}
                  />
                </Paper>
              )}
            </Box>

            {/* Responsive: SidePanel en Drawer (host + narrow) */}
            {role === "host" && isNarrow && (
              <Drawer
                opened={sideOpen}
                onClose={() => setSideOpen(false)}
                position="right"
                size={isMobile ? "95%" : 420}
                overlayProps={{ opacity: 0.35, blur: 2 }}
                withCloseButton
                title="Control del Live"
                keepMounted
              >
                <div style={{ height: "calc(100dvh - 140px)" }}>
                  <StudioSidePanel
                    role={role}
                    eventSlug={eventSlug}
                    disabled={isBusy}
                    showFrame={showFrame}
                    frameUrl={frameUrl}
                    backgroundUrl={backgroundUrl}
                    backgroundType={backgroundType}
                    onRefreshFrameConfig={fetchConfig}
                    activeVisualId={activeVisualId}
                    activeAudioId={activeAudioId}
                  />
                </div>
              </Drawer>
            )}

            <FilteredRoomAudio onStageMap={stage.onStage} />

            {/* DRAWER CHAT */}
            <StudioRoomUI
              chatOpen={chatOpen}
              setChatOpen={setChatOpen}
              unread={unread}
              setUnread={setUnread}
            />
          </AppShell.Main>
        </AppShell>
      </LiveKitRoom>
    </div>
  );
};
