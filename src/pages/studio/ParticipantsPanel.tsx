// src/ParticipantsPanel.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParticipants } from "@livekit/components-react";
import { Stack, Text, Button, Group, Badge, Menu, ActionIcon, Modal, TextInput } from "@mantine/core";
import { useMemo, useState } from "react";
import { auth } from "../../core/firebase";
import { kickSpeaker } from "../../api/live-join-service";
import type { StageState } from "../../hooks/useStage";
import type { ProgramMode } from "../../api/live-stage-service";
import { IconDots, IconPin, IconPinnedOff, IconUserX, IconPencil } from "@tabler/icons-react";

type Props = {
  role: "host" | "speaker";
  eventSlug: string;
  stage: StageState;
  customNames: Record<string, string>;
  onChangeParticipantName: (identity: string, newName: string) => void;
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
  onChangeParticipantName,
  onToggleStage,
  onPin,
  onUnpin,
}: Props) {
  const participants = useParticipants();
  const [, setKicking] = useState<string | null>(null);
  const myUid = auth.currentUser?.uid ?? null;
  const isSpeaker = role === "speaker";

  // Estados para editar nombre
  const [editingIdentity, setEditingIdentity] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");

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

  const handleOpenEditName = (identity: string, currentName: string) => {
    setEditingIdentity(identity);
    setTempName(customNames[identity] || currentName);
  };

  const handleSaveName = () => {
    if (editingIdentity && tempName.trim()) {
      onChangeParticipantName(editingIdentity, tempName.trim());
      setEditingIdentity(null);
      setTempName("");
    }
  };

  const getDisplayName = (identity: string, originalName: string) => {
    return customNames[identity] || originalName || identity;
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
              {getDisplayName(
                stage.activeUid,
                participants.find((p) => p.identity === stage.activeUid)?.name || ""
              )}
            </Text>
          </Text>
          {!isSpeaker && (
            <Button size="xs" variant="subtle" onClick={onUnpin}>
              Despin
            </Button>
          )}
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
              border: "1px solid var(--mantine-color-dark-4)",
              background: isOnStage
                ? "var(--mantine-color-dark-7)"
                : "var(--mantine-color-dark-8)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Group gap={8} wrap="nowrap">
                <Text size="sm" fw={600} truncate style={{ maxWidth: 240 }}>
                  {getDisplayName(uid, p.name || "")}
                </Text>

                {!isSpeaker && (
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    onClick={() => handleOpenEditName(uid, p.name || "")}
                  >
                    <IconPencil size={12} />
                  </ActionIcon>
                )}

                {isPinned && (
                  <Badge size="xs" variant="filled">
                    📌 PIN
                  </Badge>
                )}
                <Badge size="xs" variant={isOnStage ? "light" : "outline"}>
                  {isOnStage ? "🎬 En escena" : "Backstage"}
                </Badge>
                {p.isSpeaking && (
                  <Badge size="xs" variant="light">
                    🎙️ Hablando
                  </Badge>
                )}
                {isMe && (
                  <Badge size="xs" variant="outline">
                    Tú
                  </Badge>
                )}
              </Group>

              {(micOn !== undefined ||
                camOn !== undefined ||
                screenOn !== undefined) && (
                <Text size="xs" c="dimmed">
                  {micOn === undefined ? "" : micOn ? "🎤 On" : "🎤 Off"}{" "}
                  {camOn === undefined ? "" : camOn ? "📷 On" : "📷 Off"}{" "}
                  {screenOn ? "🖥️ On" : ""}
                </Text>
              )}
            </div>

            {/* Acciones - solo para host */}
            {!isSpeaker && (
              <Group gap={8} wrap="nowrap">
                <Button
                  size="xs"
                  variant={isOnStage ? "default" : "filled"}
                  onClick={() => onToggleStage(uid, !isOnStage)}
                >
                  {isOnStage ? "Bajar" : "Subir"}
                </Button>

                <Menu shadow="md" position="bottom-end">
                  <Menu.Target>
                    <ActionIcon variant="subtle">
                      <IconDots size={18} />
                    </ActionIcon>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <Menu.Label>Acciones</Menu.Label>

                    {!isPinned ? (
                      <Menu.Item
                        leftSection={<IconPin size={16} />}
                        onClick={() => onPin(uid)}
                      >
                        Pinear (Speaker)
                      </Menu.Item>
                    ) : (
                      <Menu.Item
                        leftSection={<IconPinnedOff size={16} />}
                        onClick={onUnpin}
                      >
                        Quitar pin
                      </Menu.Item>
                    )}

                    <Menu.Divider />

                    <Menu.Item
                      color="red"
                      leftSection={<IconUserX size={16} />}
                      disabled={isMe}
                      onClick={() => handleKick(uid)}
                    >
                      Expulsar
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            )}
          </Group>
        );
      })}

      {participants.length === 0 ? (
        <Text size="sm" c="dimmed">
          No hay participantes conectados.
        </Text>
      ) : null}

      {/* Modal para editar nombre */}
      <Modal
        opened={!!editingIdentity}
        onClose={() => setEditingIdentity(null)}
        title="Cambiar nombre del participante"
        centered
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Nombre"
            placeholder="Ingresa el nuevo nombre"
            value={tempName}
            onChange={(e) => setTempName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tempName.trim()) {
                handleSaveName();
              }
            }}
            autoFocus
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setEditingIdentity(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveName} disabled={!tempName.trim()}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
