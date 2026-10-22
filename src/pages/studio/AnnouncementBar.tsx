import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Menu,
  Paper,
  Popover,
  Stack,
  Switch,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconArrowRight,
  IconDots,
  IconEyeOff,
  IconPencil,
  IconPlayerStopFilled,
  IconPlus,
  IconSettings,
  IconSpeakerphone,
  IconTrash,
} from "@tabler/icons-react";
import {
  DEFAULT_ANNOUNCEMENT_STYLE,
  deleteAnnouncement,
  hideBanner,
  publishAnnouncement,
  setAnnouncementSettings,
  swapAnnouncementOrder,
  type Announcement,
} from "../../api/live-stage-service";
import { useAnnouncements, useAsyncAction } from "../../hooks/useAnnouncements";
import { AnnouncementEditorModal } from "./AnnouncementEditorModal";

function formatRemaining(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, "0")}` : `${s}s`;
}

const dot = (color: string) => (
  <Box w={8} h={8} style={{ borderRadius: "50%", background: color, flexShrink: 0 }} />
);

type Props = {
  eventSlug: string;
  disabled?: boolean;
};

/**
 * Barra de anuncios bajo el monitor: muestra lo que está al aire y los anuncios
 * guardados como botones de disparo (un clic = al aire). Crear/editar abre el
 * editor amplio en un modal.
 */
export function AnnouncementBar({ eventSlug, disabled }: Props) {
  const { announcements, banner, settings, now, onAir, onAirId } = useAnnouncements(eventSlug);
  const { run, busy } = useAsyncAction();
  // session: cambia en cada apertura para remontar el editor con un borrador limpio
  const [editor, setEditor] = useState<{ open: boolean; session: number; editing: Announcement | null }>({
    open: false,
    session: 0,
    editing: null,
  });

  const off = disabled || busy;

  const openEditor = (editing: Announcement | null) =>
    setEditor((e) => ({ open: true, session: e.session + 1, editing }));

  const handlePublish = (a: Announcement) =>
    run(() => publishAnnouncement(eventSlug, a), "Error al publicar el anuncio");

  const handleHide = () => run(() => hideBanner(eventSlug), "Error al quitar el anuncio");

  const handleMove = (index: number, dir: -1 | 1) => {
    const other = announcements[index + dir];
    if (!other) return;
    void run(() => swapAnnouncementOrder(eventSlug, announcements[index], other), "Error al reordenar");
  };

  const handleDelete = (a: Announcement) =>
    run(async () => {
      if (a.id === onAirId) await hideBanner(eventSlug);
      await deleteAnnouncement(eventSlug, a.id);
    }, "Error al eliminar el anuncio");

  return (
    <Paper p="xs" withBorder radius="md">
      <Stack gap={8}>
        {/* ── Cabecera: estado al aire + acciones ─────────────── */}
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Group gap={8} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
            <IconSpeakerphone size={16} style={{ flexShrink: 0 }} />
            <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ flexShrink: 0 }}>
              Anuncios
            </Text>
            {onAir && banner ? (
              <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                <Badge color="red" variant="filled" size="sm" style={{ flexShrink: 0 }}>
                  Al aire
                </Badge>
                <Text size="sm" truncate style={{ minWidth: 0 }}>
                  {banner.label ? <b>{banner.label} · </b> : null}
                  {banner.text}
                </Text>
                {banner.expiresAt && (
                  <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                    {formatRemaining(banner.expiresAt - now)}
                  </Text>
                )}
              </Group>
            ) : (
              <Text size="xs" c="dimmed">Nada al aire</Text>
            )}
          </Group>

          <Group gap={6} wrap="nowrap">
            {onAir && (
              <Button
                size="compact-sm"
                color="red"
                variant="light"
                leftSection={<IconEyeOff size={14} />}
                onClick={handleHide}
                disabled={off}
              >
                Quitar
              </Button>
            )}
            <Popover width={300} position="bottom-end" withArrow shadow="md">
              <Popover.Target>
                <Tooltip label="Opciones de anuncios">
                  <ActionIcon variant="subtle" color="gray">
                    <IconSettings size={16} />
                  </ActionIcon>
                </Tooltip>
              </Popover.Target>
              <Popover.Dropdown>
                <Switch
                  label="Mostrar también sobre el reproductor del asistente"
                  description="Actívalo si la transmisión no sale del estudio (OBS, Vimeo u otra fuente externa). Si sale del estudio, el anuncio ya va dentro del video y se vería doble."
                  checked={!!settings.showOnAttend}
                  onChange={(e) => {
                    const showOnAttend = e.currentTarget.checked;
                    void run(
                      () => setAnnouncementSettings(eventSlug, { showOnAttend }),
                      "Error al guardar la configuración",
                    );
                  }}
                  disabled={off}
                />
              </Popover.Dropdown>
            </Popover>
            <Button
              size="compact-sm"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => openEditor(null)}
              disabled={disabled}
            >
              Nuevo
            </Button>
          </Group>
        </Group>

        {/* ── Botones de disparo ─────────────────────────────── */}
        {announcements.length === 0 ? (
          <Text size="xs" c="dimmed">
            Crea anuncios con «Nuevo» y publícalos aquí con un clic durante la transmisión.
          </Text>
        ) : (
          <Group gap={6}>
            {announcements.map((a, i) => {
              const isLive = a.id === onAirId;
              const accent = a.style?.accentColor ?? DEFAULT_ANNOUNCEMENT_STYLE.accentColor;
              return (
                <Button.Group key={a.id}>
                  <Tooltip
                    label={isLive ? "Quitar del aire" : a.text}
                    multiline
                    maw={280}
                    openDelay={400}
                  >
                    <Button
                      size="xs"
                      variant={isLive ? "filled" : "default"}
                      color={isLive ? "red" : undefined}
                      leftSection={isLive ? <IconPlayerStopFilled size={12} /> : dot(accent)}
                      onClick={() => (isLive ? handleHide() : handlePublish(a))}
                      disabled={off}
                    >
                      <Text span size="xs" fw={500} truncate maw={200}>
                        {a.label ? `${a.label} · ` : ""}
                        {a.text}
                      </Text>
                    </Button>
                  </Tooltip>
                  <Menu position="bottom-end" withinPortal shadow="md">
                    <Menu.Target>
                      <Button
                        size="xs"
                        px={6}
                        variant={isLive ? "filled" : "default"}
                        color={isLive ? "red" : undefined}
                        disabled={off}
                        aria-label="Más opciones"
                      >
                        <IconDots size={14} />
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => openEditor(a)}>
                        Editar diseño y texto
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconArrowLeft size={14} />}
                        onClick={() => handleMove(i, -1)}
                        disabled={i === 0}
                      >
                        Mover a la izquierda
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconArrowRight size={14} />}
                        onClick={() => handleMove(i, 1)}
                        disabled={i === announcements.length - 1}
                      >
                        Mover a la derecha
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => void handleDelete(a)}
                      >
                        Eliminar
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Button.Group>
              );
            })}
          </Group>
        )}
      </Stack>

      <AnnouncementEditorModal
        key={editor.session}
        opened={editor.open}
        onClose={() => setEditor((e) => ({ ...e, open: false }))}
        eventSlug={eventSlug}
        editing={editor.editing}
        onAirId={onAirId}
        disabled={disabled}
      />
    </Paper>
  );
}
