import { useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Grid,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { IconPlayerPlay, IconRefresh, IconTrash } from "@tabler/icons-react";
import {
  DEFAULT_ANNOUNCEMENT_STYLE,
  deleteAnnouncement,
  hideBanner,
  publishAnnouncement,
  saveAnnouncement,
  updateBannerContent,
  type Announcement,
  type AnnouncementStyle,
} from "../../api/live-stage-service";
import { AnnouncementBanner } from "../../components/studio/AnnouncementBanner";
import { AnnouncementStyleFields } from "../../components/studio/AnnouncementStyleFields";
import {
  ANNOUNCEMENT_PREVIEW_BG as PREVIEW_BG,
  ANNOUNCEMENT_TEMPLATES,
} from "../../components/studio/announcement-templates";
import { useAsyncAction } from "../../hooks/useAnnouncements";

const MAX_LEN = 280;
const MAX_LABEL_LEN = 24;

const DURATION_OPTIONS = [
  { value: "0", label: "Sin límite" },
  { value: "10", label: "10 segundos" },
  { value: "30", label: "30 segundos" },
  { value: "60", label: "1 minuto" },
  { value: "120", label: "2 minutos" },
  { value: "300", label: "5 minutos" },
  { value: "600", label: "10 minutos" },
];

type Draft = {
  text: string;
  label: string;
  style: Required<AnnouncementStyle>;
  durationSec: number;
};

const draftFrom = (a: Announcement | null): Draft =>
  a
    ? {
        text: a.text,
        label: a.label ?? "",
        style: { ...DEFAULT_ANNOUNCEMENT_STYLE, ...(a.style ?? {}) },
        durationSec: a.durationSec ?? 0,
      }
    : {
        text: "",
        label: "",
        style: { ...DEFAULT_ANNOUNCEMENT_STYLE, ...ANNOUNCEMENT_TEMPLATES.bar.style },
        durationSec: 0,
      };

type Props = {
  opened: boolean;
  onClose: () => void;
  eventSlug: string;
  // null = anuncio nuevo
  editing: Announcement | null;
  onAirId: string | null;
  disabled?: boolean;
};

/**
 * Editor amplio de un anuncio: vista previa grande a la izquierda y todos los
 * controles de diseño a la derecha. Se monta de nuevo (key) en cada apertura,
 * así el borrador siempre parte del anuncio elegido.
 */
export function AnnouncementEditorModal({ opened, onClose, eventSlug, editing, onAirId, disabled }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(editing));
  // Cambiar este valor simula una publicación nueva en la vista previa (sale y vuelve a entrar)
  const [previewRun, setPreviewRun] = useState(1);
  const { run, busy } = useAsyncAction();

  const trimmed = draft.text.trim();
  const trimmedLabel = draft.label.trim();
  const isOnAir = !!editing && editing.id === onAirId;
  const off = disabled || busy;

  const data = () => ({
    text: trimmed,
    label: trimmedLabel || null,
    style: draft.style,
    durationSec: draft.durationSec || null,
  });

  const setStyle = (patch: Partial<AnnouncementStyle>) =>
    setDraft((d) => ({ ...d, style: { ...d.style, ...patch } }));

  const handleSave = () =>
    run(
      async () => {
        await saveAnnouncement(eventSlug, data(), editing?.id);
        // Si se edita el anuncio que está al aire, reflejar el cambio en vivo
        if (isOnAir) {
          await updateBannerContent(eventSlug, { text: trimmed, label: trimmedLabel || null, style: draft.style });
        }
        onClose();
      },
      "Error al guardar el anuncio",
      editing ? "Anuncio actualizado" : "Anuncio guardado",
    );

  const handlePublish = () =>
    run(
      async () => {
        const id = await saveAnnouncement(eventSlug, data(), editing?.id);
        await publishAnnouncement(eventSlug, { ...data(), id });
        onClose();
      },
      "Error al publicar el anuncio",
      "Anuncio al aire",
    );

  const handleDelete = () =>
    editing &&
    run(async () => {
      if (isOnAir) await hideBanner(eventSlug);
      await deleteAnnouncement(eventSlug, editing.id);
      onClose();
    }, "Error al eliminar el anuncio");

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size={1080}
      radius="md"
      centered
      title={
        <Text fw={700}>
          {editing ? "Editar anuncio" : "Nuevo anuncio"}
          {isOnAir && (
            <Text span c="red" size="sm" fw={600} ml={8}>
              · al aire (los cambios se verán en vivo al guardar)
            </Text>
          )}
        </Text>
      }
    >
      <Grid gutter="lg">
        {/* ── VISTA PREVIA ─────────────────────────────────────── */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="xs" style={{ position: "sticky", top: 0 }}>
            <Box
              style={{
                position: "relative",
                aspectRatio: "16 / 9",
                borderRadius: 8,
                overflow: "hidden",
                background: PREVIEW_BG,
              }}
            >
              <AnnouncementBanner
                zIndex={1}
                banner={{
                  visible: true,
                  text: trimmed || "Vista previa del anuncio",
                  label: trimmedLabel || null,
                  style: draft.style,
                  publishedAt: previewRun,
                }}
              />
            </Box>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Así se verá en el monitor y en la transmisión.
              </Text>
              <Button
                size="compact-xs"
                variant="subtle"
                leftSection={<IconRefresh size={14} />}
                onClick={() => setPreviewRun((n) => n + 1)}
              >
                Ver animación
              </Button>
            </Group>

            <Textarea
              label="Mensaje"
              placeholder="Ej: ¡Próximo sorteo en 5 minutos!"
              value={draft.text}
              onChange={(e) => {
                const text = e.currentTarget.value.slice(0, MAX_LEN);
                setDraft((d) => ({ ...d, text }));
              }}
              autosize
              minRows={2}
              maxRows={4}
              data-autofocus
              disabled={disabled}
              description={`${draft.text.length}/${MAX_LEN}`}
              inputWrapperOrder={["label", "input", "description"]}
            />
            <Group grow align="flex-start">
              <TextInput
                label="Etiqueta (opcional)"
                placeholder="Ej: AVISO, EN VIVO"
                value={draft.label}
                onChange={(e) => {
                  const label = e.currentTarget.value.slice(0, MAX_LABEL_LEN);
                  setDraft((d) => ({ ...d, label }));
                }}
                disabled={disabled}
              />
              <Select
                label="Ocultar automáticamente"
                data={DURATION_OPTIONS}
                value={String(draft.durationSec)}
                onChange={(v) => setDraft((d) => ({ ...d, durationSec: Number(v) || 0 }))}
                allowDeselect={false}
              />
            </Group>
          </Stack>
        </Grid.Col>

        {/* ── DISEÑO ───────────────────────────────────────────── */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <ScrollArea.Autosize mah="min(68vh, 640px)" offsetScrollbars>
            <Stack gap="sm">
              <AnnouncementStyleFields
                style={draft.style}
                onChange={setStyle}
                onReplay={() => setPreviewRun((n) => n + 1)}
              />
            </Stack>
          </ScrollArea.Autosize>
        </Grid.Col>
      </Grid>

      {/* ── ACCIONES ───────────────────────────────────────────── */}
      <Group justify="space-between" mt="lg">
        {editing ? (
          <Tooltip label="Eliminar anuncio">
            <ActionIcon variant="subtle" color="red" onClick={handleDelete} disabled={off}>
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <span />
        )}
        <Group gap="xs">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="light" onClick={handleSave} disabled={off || !trimmed}>
            {editing ? "Guardar cambios" : "Guardar"}
          </Button>
          <Button leftSection={<IconPlayerPlay size={16} />} onClick={handlePublish} disabled={off || !trimmed}>
            {editing ? "Guardar y publicar" : "Publicar ahora"}
          </Button>
        </Group>
      </Group>
    </Modal>
  );
}
