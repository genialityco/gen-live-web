// src/ParticipantsPanel.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParticipants } from "@livekit/components-react";
import { Stack, Text, Button, Group, Badge } from "@mantine/core";
import { useMemo, useState } from "react";
import { auth } from "../../core/firebase";
import { kickSpeaker } from "../../api/live-join-service";
import type { StageState } from "../../hooks/useStage";
import type { ProgramMode } from "../../api/live-stage-service";

type Props = {
  eventSlug: string;
  stage: StageState;

  onToggleStage: (uid: string, next: boolean) => Promise<void>;
  onPin: (uid: string) => Promise<void>;
  onUnpin: () => Promise<void>;
  onSetMode: (m: ProgramMode) => Promise<void>;
};

export function ParticipantsPanel({
  eventSlug,
  stage,
  onToggleStage,
  onPin,
  onUnpin,
}: Props) {
  const participants = useParticipants();
  const [kicking, setKicking] = useState<string | null>(null);
  const myUid = auth.currentUser?.uid ?? null;

  // Orden: speaking primero, luego onStage, luego nombre
  const sorted = useMemo(() => {
    const arr = [...participants];
    arr.sort((a, b) => {
      const aUid = a.identity;
      const bUid = b.identity;

      const aSpeak = a.isSpeaking ? 1 : 0;
      const bSpeak = b.isSpeaking ? 1 : 0;
      if (bSpeak !== aSpeak) return bSpeak - aSpeak;

      const aStage = stage.onStage[aUid] ? 1 : 0;
      const bStage = stage.onStage[bUid] ? 1 : 0;
      if (bStage !== aStage) return bStage - aStage;

      const an = (a.name || aUid || "").toLowerCase();
      const bn = (b.name || bUid || "").toLowerCase();
      return an.localeCompare(bn);
    });
    return arr;
  }, [participants, stage.onStage]);

  const handleKick = async (uid: string) => {
    setKicking(uid);
    try {
      await kickSpeaker(eventSlug, uid);
      // OJO: stage cleanup lo hace tu StudioView (o lo puedes hacer aquí si quieres)
    } finally {
      setKicking(null);
    }
  };

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text fw={600}>Participantes ({participants.length})</Text>
      </Group>

      {stage.activeUid ? (
        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">
            Pineado:{" "}
            <Text span fw={600}>
              {participants.find((p) => p.identity === stage.activeUid)?.name ||
                stage.activeUid}
            </Text>
          </Text>
          <Button size="xs" variant="subtle" onClick={onUnpin}>
            Quitar pin
          </Button>
        </Group>
      ) : (
        <Text size="xs" c="dimmed">
          Ningún participante pineado.
        </Text>
      )}

      {sorted.map((p) => {
        const uid = p.identity;
        const isMe = !!myUid && uid === myUid;
        const isOnStage = !!stage.onStage[uid];
        const isPinned = stage.activeUid === uid;

        // Si tu versión no expone esto, déjalo en undefined y no se muestra nada
        const micOn = (p as any).isMicrophoneEnabled ?? undefined;
        const camOn = (p as any).isCameraEnabled ?? undefined;
        const screenOn = (p as any).isScreenShareEnabled ?? undefined;

        return (
          <Group
            key={uid}
            justify="space-between"
            align="center"
            wrap="nowrap"
            style={{
              padding: 10,
              borderRadius: 12,
              background: isOnStage
                ? "rgba(34,139,230,0.14)"
                : "rgba(255,255,255,0.05)",
              border: isPinned
                ? "1px solid rgba(34,139,230,0.55)"
                : "1px solid transparent",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Group gap={6} wrap="nowrap">
                <Text
                  size="sm"
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 240,
                  }}
                >
                  {p.name || uid}
                </Text>

                {isPinned ? (
                  <Badge size="xs" variant="filled">
                    📌 PIN
                  </Badge>
                ) : null}

                {isOnStage ? (
                  <Badge size="xs" variant="light">
                    🎬 En escena
                  </Badge>
                ) : (
                  <Badge size="xs" variant="outline">
                    Backstage
                  </Badge>
                )}

                {p.isSpeaking ? (
                  <Badge size="xs" variant="light">
                    🎙️ Hablando
                  </Badge>
                ) : null}

                {isMe ? (
                  <Badge size="xs" variant="outline">
                    Tú
                  </Badge>
                ) : null}
              </Group>

              <Text size="xs" c="dimmed">
                {micOn === undefined ? "" : micOn ? "🎤 On" : "🎤 Off"}{" "}
                {camOn === undefined ? "" : camOn ? "📷 On" : "📷 Off"}{" "}
                {screenOn === undefined ? "" : screenOn ? "🖥️ On" : ""}
              </Text>
            </div>

            <Group gap={6} wrap="nowrap">
              <Button
                size="xs"
                variant={isOnStage ? "default" : "filled"}
                onClick={() => onToggleStage(uid, !isOnStage)}
              >
                {isOnStage ? "Bajar" : "Subir"}
              </Button>

              <Button
                size="xs"
                variant="light"
                onClick={() => onPin(uid)}
                disabled={isPinned}
              >
                📌
              </Button>

              <Button
                size="xs"
                color="red"
                variant="light"
                loading={kicking === uid}
                disabled={isMe}
                onClick={() => handleKick(uid)}
              >
                Expulsar
              </Button>
            </Group>
          </Group>
        );
      })}

      {participants.length === 0 ? (
        <Text size="sm" c="dimmed">
          No hay participantes conectados.
        </Text>
      ) : null}
    </Stack>
  );
}
