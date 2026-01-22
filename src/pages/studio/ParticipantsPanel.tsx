// src/ParticipantsPanel.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParticipants } from "@livekit/components-react";
import {
  Stack,
  Text,
  Button,
  Group,
  Badge,
  Menu,
  ActionIcon,
  Modal,
  TextInput,
  SimpleGrid,
  Paper,
  Flex,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { auth } from "../../core/firebase";
import { kickSpeaker } from "../../api/live-join-service";
import type { StageState } from "../../hooks/useStage";
import type { ProgramMode } from "../../api/live-stage-service";
import {
  IconDots,
  IconPin,
  IconPinnedOff,
  IconUserX,
  IconPencil,
  IconScreenShare,
} from "@tabler/icons-react";
import {
  getScreenShareKey,
  parseStageKey,
} from "../../utils/screen-share-utils";

// Representa un item en la lista (puede ser participante o pantalla compartida)
type StageListItem = {
  key: string; // Unique key for React
  stageKey: string; // Key used in stage.onStage (identity or identity:screen)
  identity: string; // Participant identity
  name: string; // Display name
  isScreenShare: boolean;
  participant: any; // Reference to the actual participant
};

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

  // Crear lista de items que incluye participantes Y sus pantallas compartidas
  const stageItems = useMemo(() => {
    const items: StageListItem[] = [];

    participants.forEach((p) => {
      const uid = p.identity;
      const screenOn = (p as any).isScreenShareEnabled ?? false;

      // Agregar item de cámara/participante
      items.push({
        key: uid,
        stageKey: uid,
        identity: uid,
        name: p.name || uid,
        isScreenShare: false,
        participant: p,
      });

      // Si tiene pantalla compartida, agregar como item separado
      if (screenOn) {
        const screenKey = getScreenShareKey(uid);
        items.push({
          key: screenKey,
          stageKey: screenKey,
          identity: uid,
          name: `Pantalla de ${p.name || uid}`,
          isScreenShare: true,
          participant: p,
        });
      }
    });

    return items;
  }, [participants]);

  // Orden: onStage primero, luego nombre
  const sorted = useMemo(() => {
    const arr = [...stageItems];
    arr.sort((a, b) => {
      // 1) onStage primero
      const aStage = stage.onStage[a.stageKey] ? 1 : 0;
      const bStage = stage.onStage[b.stageKey] ? 1 : 0;
      if (bStage !== aStage) return bStage - aStage;

      // 2) Pantallas al final de su grupo
      if (a.identity === b.identity) {
        return a.isScreenShare ? 1 : -1;
      }

      // 3) nombre/uid estable
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();
      return an.localeCompare(bn);
    });

    return arr;
  }, [stageItems, stage.onStage]);

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

  const getDisplayName = (item: StageListItem) => {
    const baseName = customNames[item.identity] || item.participant.name || item.identity;
    if (item.isScreenShare) {
      return `🖥️ Pantalla de ${baseName}`;
    }
    return baseName;
  };

  // Helper para obtener el nombre base del participante
  const getBaseName = (identity: string, originalName: string) => {
    return customNames[identity] || originalName || identity;
  };

  // Helper para parsear activeUid y obtener el nombre correcto
  const getPinnedDisplayName = () => {
    if (!stage.activeUid) return "";
    const parsed = parseStageKey(stage.activeUid);
    const participant = participants.find((p) => p.identity === parsed.identity);
    const baseName = getBaseName(parsed.identity, participant?.name || "");
    if (parsed.isScreen) {
      return `🖥️ Pantalla de ${baseName}`;
    }
    return baseName;
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
              {getPinnedDisplayName()}
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

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
        {sorted.map((item) => {
          const uid = item.identity;
          const stageKey = item.stageKey;
          const isMe = !!myUid && uid === myUid;
          const isOnStage = !!stage.onStage[stageKey];
          const isPinned = stage.activeUid === stageKey;
          const p = item.participant;

          // Si tu versión no expone esto, déjalo en undefined y no se muestra nada
          const micOn = (p as any).isMicrophoneEnabled ?? undefined;
          const camOn = (p as any).isCameraEnabled ?? undefined;
          const screenOn = (p as any).isScreenShareEnabled ?? undefined;

          return (
            <Paper
              key={item.key}
              p="sm"
              radius="md"
              withBorder
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                borderColor: item.isScreenShare ? "var(--mantine-color-blue-6)" : undefined,
                background: item.isScreenShare ? "var(--mantine-color-dark-7)" : undefined,
              }}
            >
              {/* Header */}
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Group gap={8} wrap="nowrap">
                    {item.isScreenShare && (
                      <IconScreenShare size={18} style={{ flexShrink: 0, color: "var(--mantine-color-blue-5)" }} />
                    )}
                    <Text size="sm" fw={700} truncate style={{ flex: 1 }}>
                      {getDisplayName(item)}
                    </Text>

                    {!isSpeaker && !item.isScreenShare && (
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={() => handleOpenEditName(uid, p.name || "")}
                        aria-label="Editar nombre"
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    )}
                  </Group>
                </div>

                {/* Menu acciones (host) - solo para participantes, no pantallas */}
                {!isSpeaker && !item.isScreenShare && (
                  <Menu shadow="md" position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" aria-label="Más acciones">
                        <IconDots size={18} />
                      </ActionIcon>
                    </Menu.Target>

                    <Menu.Dropdown>
                      <Menu.Label>Acciones</Menu.Label>

                      {!isPinned ? (
                        <Menu.Item
                          leftSection={<IconPin size={16} />}
                          onClick={() => onPin(stageKey)}
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
                )}

                {/* Menu simplificado para pantallas compartidas */}
                {!isSpeaker && item.isScreenShare && (
                  <Menu shadow="md" position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" aria-label="Más acciones">
                        <IconDots size={18} />
                      </ActionIcon>
                    </Menu.Target>

                    <Menu.Dropdown>
                      <Menu.Label>Pantalla compartida</Menu.Label>

                      {!isPinned ? (
                        <Menu.Item
                          leftSection={<IconPin size={16} />}
                          onClick={() => onPin(stageKey)}
                        >
                          Pinear pantalla
                        </Menu.Item>
                      ) : (
                        <Menu.Item
                          leftSection={<IconPinnedOff size={16} />}
                          onClick={onUnpin}
                        >
                          Quitar pin
                        </Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>

              {/* Status chips */}
              <Flex gap={6} wrap="wrap">
                {isPinned && (
                  <Badge size="xs" variant="filled">
                    📌 PIN
                  </Badge>
                )}

                <Badge size="xs" variant={isOnStage ? "light" : "outline"}>
                  {isOnStage ? "🎬 En escena" : "Backstage"}
                </Badge>

                {/* Solo mostrar estado de cámara/mic para participantes, no para pantallas */}
                {!item.isScreenShare && (camOn !== undefined || screenOn !== undefined) && (
                  <Text size="xs" c="dimmed">
                    {camOn === undefined ? "" : camOn ? "📷 On" : "📷 Off"}{" "}
                    {screenOn ? "🖥️ Screen" : ""}
                  </Text>
                )}

                {!item.isScreenShare && micOn !== undefined && (
                  <Text size="xs" c="dimmed">
                    {micOn
                      ? p.isSpeaking
                        ? "🎤 Hablando"
                        : "🎤 On"
                      : "🎤 Off"}
                  </Text>
                )}

                {isMe && !item.isScreenShare && (
                  <Badge size="xs" variant="outline">
                    Tú
                  </Badge>
                )}
              </Flex>

              {/* Spacer para empujar CTA al fondo */}
              <div style={{ flex: 1 }} />

              {/* CTA principal (host) */}
              {!isSpeaker && (
                <Button
                  fullWidth
                  size="xs"
                  variant={isOnStage ? "default" : "filled"}
                  color={item.isScreenShare ? "blue" : undefined}
                  onClick={() => onToggleStage(stageKey, !isOnStage)}
                >
                  {isOnStage ? "Bajar de escena" : "Subir a escena"}
                </Button>
              )}
            </Paper>
          );
        })}
      </SimpleGrid>

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
