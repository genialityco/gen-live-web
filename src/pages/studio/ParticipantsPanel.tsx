// src/ParticipantsPanel.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParticipants } from "@livekit/components-react";
import {
  Stack,
  Text,
  Button,
  Group,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  Box,
  Tooltip,
} from "@mantine/core";
import { useMemo, useState, useEffect, useRef } from "react";
import { auth } from "../../core/firebase";
import { kickSpeaker } from "../../api/live-join-service";
import type { StageState } from "../../hooks/useStage";
import type { ProgramMode, NameTagStyle } from "../../api/live-stage-service";
import {
  IconPin,
  IconPinnedOff,
  IconUserX,
  IconPencil,
  IconScreenShare,
  IconMicrophone,
  IconMicrophoneOff,
  IconVideo,
  IconVideoOff,
} from "@tabler/icons-react";
import {
  getScreenShareKey,
  parseStageKey,
} from "../../utils/screen-share-utils";
import { NameTagStyleEditor } from "../../components/studio/NameTagStyleEditor";

function ParticipantThumb({ participant, isScreenShare }: { participant: any; isScreenShare: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!participant || !videoRef.current) return;
    const pub = isScreenShare
      ? participant.getTrackPublication("screen_share")
      : participant.getTrackPublication("camera");
    const track = pub?.videoTrack;
    if (track && videoRef.current) track.attach(videoRef.current);
    return () => { if (track && videoRef.current) track.detach(videoRef.current); };
  }, [participant, isScreenShare]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{ width: "100%", height: "100%", objectFit: isScreenShare ? "contain" : "cover" }}
    />
  );
}

type StageListItem = {
  key: string;
  stageKey: string;
  identity: string;
  name: string;
  isScreenShare: boolean;
  participant: any;
};

type Props = {
  role: "host" | "speaker";
  eventSlug: string;
  stage: StageState;
  customNames: Record<string, string>;
  customSubtitles?: Record<string, string>;
  nameTags?: Record<string, NameTagStyle>;
  onChangeParticipantName: (identity: string, newName: string, newSubtitle?: string) => void;
  onToggleStage: (uid: string, next: boolean) => Promise<void>;
  onPin: (uid: string) => Promise<void>;
  onUnpin: () => Promise<void>;
  onSetMode: (m: ProgramMode) => Promise<void>;
};

export function ParticipantsPanel({
  role,
  eventSlug,
  stage,
  customNames,
  customSubtitles = {},
  nameTags = {},
  onChangeParticipantName,
  onToggleStage,
  onPin,
  onUnpin,
}: Props) {
  const participants = useParticipants();
  const [, setKicking] = useState<string | null>(null);
  const myUid = auth.currentUser?.uid ?? null;
  const isSpeaker = role === "speaker";

  const [editingIdentity, setEditingIdentity] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const [tempSubtitle, setTempSubtitle] = useState("");
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const kickTimerRef = useRef<number | null>(null);

  const stageItems = useMemo(() => {
    const items: StageListItem[] = [];
    participants.forEach((p) => {
      const uid = p.identity;
      const screenOn = (p as any).isScreenShareEnabled ?? false;
      items.push({ key: uid, stageKey: uid, identity: uid, name: p.name || uid, isScreenShare: false, participant: p });
      if (screenOn) {
        const screenKey = getScreenShareKey(uid);
        items.push({ key: screenKey, stageKey: screenKey, identity: uid, name: `Pantalla de ${p.name || uid}`, isScreenShare: true, participant: p });
      }
    });
    return items;
  }, [participants]);

  const sorted = useMemo(() => {
    const arr = [...stageItems];
    arr.sort((a, b) => {
      const aStage = stage.onStage[a.stageKey] ? 1 : 0;
      const bStage = stage.onStage[b.stageKey] ? 1 : 0;
      if (bStage !== aStage) return bStage - aStage;
      if (a.identity === b.identity) return a.isScreenShare ? 1 : -1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    return arr;
  }, [stageItems, stage.onStage]);

  const handleKick = async (uid: string) => {
    setKicking(uid);
    try { await kickSpeaker(eventSlug, uid); }
    finally { setKicking(null); }
  };

  const handleKickClick = (uid: string) => {
    if (confirmKick === uid) {
      // Segundo click: confirmar
      if (kickTimerRef.current) clearTimeout(kickTimerRef.current);
      setConfirmKick(null);
      handleKick(uid);
    } else {
      // Primer click: pedir confirmación, auto-cancelar en 3s
      if (kickTimerRef.current) clearTimeout(kickTimerRef.current);
      setConfirmKick(uid);
      kickTimerRef.current = window.setTimeout(() => setConfirmKick(null), 3000);
    }
  };

  const handleOpenEditName = (identity: string, currentName: string) => {
    setEditingIdentity(identity);
    setTempName(customNames[identity] || currentName);
    const participant = participants.find((p) => p.identity === identity);
    const metaSubtitle = (() => {
      try { return JSON.parse(participant?.metadata ?? "{}").subtitle ?? ""; }
      catch { return ""; }
    })();
    setTempSubtitle(customSubtitles[identity] ?? metaSubtitle);
  };

  const handleSaveName = () => {
    if (editingIdentity && tempName.trim()) {
      onChangeParticipantName(editingIdentity, tempName.trim(), tempSubtitle);
      setEditingIdentity(null);
      setTempName("");
      setTempSubtitle("");
    }
  };

  const getDisplayName = (item: StageListItem) => {
    const base = customNames[item.identity] || item.participant.name || item.identity;
    return item.isScreenShare ? `Pantalla de ${base}` : base;
  };

  const getBaseName = (identity: string, originalName: string) =>
    customNames[identity] || originalName || identity;

  const getPinnedDisplayName = () => {
    if (!stage.activeUid) return "";
    const parsed = parseStageKey(stage.activeUid);
    const p = participants.find((p) => p.identity === parsed.identity);
    const base = getBaseName(parsed.identity, p?.name || "");
    return parsed.isScreen ? `🖥️ Pantalla de ${base}` : base;
  };

  return (
    <Stack gap="xs">
      {/* Header */}
      <Group justify="space-between" align="center">
        <Text fw={600} size="sm">Participantes ({participants.length})</Text>
        {stage.activeUid && !isSpeaker && (
          <Group gap={6}>
            <Text size="xs" c="dimmed">
              PIN: <Text span fw={600} size="xs">{getPinnedDisplayName()}</Text>
            </Text>
            <Button size="xs" variant="subtle" onClick={onUnpin}>Quitar</Button>
          </Group>
        )}
      </Group>

      {/* Grid de tarjetas */}
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: 8,
        }}
      >
        {sorted.map((item) => {
          const uid = item.identity;
          const stageKey = item.stageKey;
          const isMe = !!myUid && uid === myUid;
          const isOnStage = !!stage.onStage[stageKey];
          const isPinned = stage.activeUid === stageKey;
          const p = item.participant;

          const micOn = (p as any).isMicrophoneEnabled ?? undefined;
          const camOn = (p as any).isCameraEnabled ?? undefined;
          const screenEnabled = (p as any).isScreenShareEnabled ?? false;
          const isTalking = p.isSpeaking ?? false;

          const hasVideo = camOn || (item.isScreenShare && screenEnabled);

          return (
            <Box
              key={item.key}
              style={{
                display: "flex",
                flexDirection: "column",
                borderRadius: 8,
                overflow: "hidden",
                border: `1px solid ${
                  isPinned
                    ? "var(--mantine-color-yellow-6)"
                    : isOnStage
                    ? "var(--mantine-color-blue-7)"
                    : item.isScreenShare
                    ? "var(--mantine-color-blue-8)"
                    : "var(--mantine-color-dark-4)"
                }`,
                background: "var(--mantine-color-dark-7)",
              }}
            >
              {/* Área de video — 16:9 */}
              <Box
                style={{
                  position: "relative",
                  width: "100%",
                  paddingBottom: "56.25%", // 16:9
                  background: "var(--mantine-color-dark-6)",
                  flexShrink: 0,
                }}
              >
                <Box style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {hasVideo ? (
                    <ParticipantThumb participant={p} isScreenShare={item.isScreenShare} />
                  ) : (
                    <IconVideoOff size={22} color="var(--mantine-color-dark-3)" />
                  )}
                </Box>

                {/* Overlay superior: nombre + badges */}
                <Box
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    padding: "3px 6px",
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 100%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {item.isScreenShare && (
                    <IconScreenShare size={12} color="var(--mantine-color-blue-3)" style={{ flexShrink: 0 }} />
                  )}
                  <Text size="xs" fw={600} c="white" truncate style={{ flex: 1, minWidth: 0, lineHeight: 1.5 }}>
                    {getDisplayName(item)}
                  </Text>
                  {isPinned && (
                    <Badge size="xs" variant="filled" color="yellow" p="1px 4px" style={{ lineHeight: 1.4, flexShrink: 0 }}>📌</Badge>
                  )}
                  {isMe && (
                    <Badge size="xs" variant="filled" color="gray" p="1px 4px" style={{ lineHeight: 1.4, flexShrink: 0 }}>Tú</Badge>
                  )}
                </Box>

                {/* Overlay inferior: A/V indicators + speaking dot */}
                {!item.isScreenShare && (
                  <Box
                    style={{
                      position: "absolute",
                      bottom: 4,
                      left: 4,
                      display: "flex",
                      gap: 4,
                      alignItems: "center",
                    }}
                  >
                    {/* Dot de habla */}
                    <Box
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: isTalking ? "var(--mantine-color-green-4)" : "var(--mantine-color-dark-3)",
                        boxShadow: isTalking ? "0 0 5px var(--mantine-color-green-5)" : "none",
                        transition: "background 0.2s",
                        flexShrink: 0,
                      }}
                    />
                    {micOn !== undefined && (
                      <Tooltip label={micOn ? "Micrófono activo" : "Micrófono apagado"} fz="xs" withArrow>
                        {micOn
                          ? <IconMicrophone size={12} color="var(--mantine-color-green-4)" />
                          : <IconMicrophoneOff size={12} color="var(--mantine-color-red-5)" />
                        }
                      </Tooltip>
                    )}
                    {camOn !== undefined && (
                      <Tooltip label={camOn ? "Cámara activa" : "Cámara apagada"} fz="xs" withArrow>
                        {camOn
                          ? <IconVideo size={12} color="var(--mantine-color-green-4)" />
                          : <IconVideoOff size={12} color="var(--mantine-color-red-5)" />
                        }
                      </Tooltip>
                    )}
                  </Box>
                )}

                {/* Badge En escena superpuesto (esquina inferior derecha) */}
                {isOnStage && (
                  <Badge
                    size="xs"
                    variant="filled"
                    color="blue"
                    style={{ position: "absolute", bottom: 4, right: 4, lineHeight: 1.4 }}
                  >
                    En escena
                  </Badge>
                )}
              </Box>

              {/* Footer de la card: controles */}
              <Box style={{ padding: "4px 6px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3, background: "var(--mantine-color-dark-6)" }}>
                {/* Editar nombre + nametag style (solo participantes) */}
                {!item.isScreenShare && (!isSpeaker || uid === myUid) && (
                  <>
                    <Tooltip label="Editar nombre" fz="xs" withArrow>
                      <ActionIcon size="xs" variant="subtle" onClick={() => handleOpenEditName(uid, p.name || "")}>
                        <IconPencil size={12} />
                      </ActionIcon>
                    </Tooltip>
                    <NameTagStyleEditor
                      eventSlug={eventSlug}
                      identity={uid}
                      participantName={getBaseName(uid, p.name || "")}
                      currentStyle={nameTags[uid] ?? {}}
                      canEdit={!isSpeaker || uid === myUid}
                    />
                  </>
                )}

                {/* Pin / Unpin */}
                {!isSpeaker && (
                  <Tooltip label={isPinned ? "Quitar pin" : "Pinear"} fz="xs" withArrow>
                    <ActionIcon
                      size="xs"
                      variant={isPinned ? "light" : "subtle"}
                      color={isPinned ? "yellow" : "gray"}
                      onClick={() => isPinned ? onUnpin() : onPin(stageKey)}
                    >
                      {isPinned ? <IconPinnedOff size={12} /> : <IconPin size={12} />}
                    </ActionIcon>
                  </Tooltip>
                )}

                {/* Subir / Bajar de escena */}
                {!isSpeaker && (
                  <Tooltip label={isOnStage ? "Bajar de escena" : "Subir a escena"} fz="xs" withArrow>
                    <ActionIcon
                      size="xs"
                      variant={isOnStage ? "default" : "filled"}
                      color={isOnStage ? "gray" : "blue"}
                      onClick={() => onToggleStage(stageKey, !isOnStage)}
                    >
                      {isOnStage ? "↓" : "↑"}
                    </ActionIcon>
                  </Tooltip>
                )}

                {/* Expulsar (solo participantes, no yo mismo) */}
                {!isSpeaker && !item.isScreenShare && !isMe && (
                  <Tooltip
                    label={confirmKick === uid ? "Click para confirmar" : "Expulsar"}
                    fz="xs"
                    withArrow
                    color={confirmKick === uid ? "red" : undefined}
                  >
                    <ActionIcon
                      size="xs"
                      variant={confirmKick === uid ? "filled" : "subtle"}
                      color="red"
                      onClick={() => handleKickClick(uid)}
                    >
                      <IconUserX size={12} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {participants.length === 0 && (
        <Text size="sm" c="dimmed">No hay participantes conectados.</Text>
      )}

      {/* Modal editar nombre */}
      <Modal
        opened={!!editingIdentity}
        onClose={() => { setEditingIdentity(null); setTempSubtitle(""); }}
        title="Editar participante"
        centered
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Nombre"
            placeholder="Ingresa el nombre"
            value={tempName}
            onChange={(e) => setTempName(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && tempName.trim()) handleSaveName(); }}
            autoFocus
          />
          <TextInput
            label="Subtítulo / Cargo"
            placeholder="Ej: Dr. Especialista, CEO, Ponente…"
            value={tempSubtitle}
            onChange={(e) => setTempSubtitle(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && tempName.trim()) handleSaveName(); }}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => { setEditingIdentity(null); setTempSubtitle(""); }}>Cancelar</Button>
            <Button onClick={handleSaveName} disabled={!tempName.trim()}>Guardar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
