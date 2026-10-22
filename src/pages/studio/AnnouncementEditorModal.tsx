import { useState, type ReactNode } from "react";
import {
  ActionIcon,
  Box,
  Button,
  ColorInput,
  Grid,
  Group,
  Modal,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
  UnstyledButton,
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
  type AnnouncementTemplate,
} from "../../api/live-stage-service";
import { AnnouncementBanner } from "../../components/studio/AnnouncementBanner";
import {
  ANNOUNCEMENT_FONTS,
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

const BG_SWATCHES = [
  "rgba(12, 12, 14, 0.85)",
  "rgba(255, 255, 255, 0.96)",
  "rgba(255, 255, 255, 0.12)",
  "rgba(15, 23, 42, 0.55)",
  "rgba(30, 58, 138, 0.92)",
  "rgba(127, 29, 29, 0.92)",
];
const TEXT_SWATCHES = ["#ffffff", "#0f172a", "#facc15", "#f87171", "#60a5fa"];
const ACCENT_SWATCHES = ["#3b82f6", "#2563eb", "#dc2626", "#22c55e", "#a78bfa", "#f59e0b", "#ec4899"];

const TEMPLATE_ORDER: AnnouncementTemplate[] = ["bar", "lowerThird", "breaking", "pill", "glass"];
// Plantillas que no ocupan todo el ancho y por tanto admiten alineación
const ALIGNABLE: AnnouncementTemplate[] = ["lowerThird", "pill", "glass"];

const FONT_OPTIONS = Object.entries(ANNOUNCEMENT_FONTS).map(([value, f]) => ({
  value,
  label: f.label,
}));

const PREVIEW_BG = "radial-gradient(circle at 30% 35%, #3b4252 0%, #1a1d26 55%, #0d0f14 100%)";

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

/** Miniatura 16:9 de una plantilla, renderizada con el componente real */
function TemplateThumb({
  template,
  base,
  selected,
  onClick,
}: {
  template: AnnouncementTemplate;
  base: Required<AnnouncementStyle>;
  selected: boolean;
  onClick: () => void;
}) {
  const preset = ANNOUNCEMENT_TEMPLATES[template];
  return (
    <UnstyledButton onClick={onClick}>
      <Box
        style={{
          position: "relative",
          aspectRatio: "16 / 9",
          borderRadius: 6,
          overflow: "hidden",
          background: PREVIEW_BG,
          outline: selected
            ? "2px solid var(--mantine-color-blue-5)"
            : "1px solid var(--mantine-color-default-border)",
          outlineOffset: selected ? 1 : 0,
        }}
      >
        <AnnouncementBanner
          animate={false}
          zIndex={1}
          banner={{
            visible: true,
            text: "Texto del anuncio",
            label: template === "breaking" ? "En vivo" : "Aviso",
            style: { ...base, ...preset.style, template, mode: "static", size: "lg" },
          }}
        />
      </Box>
      <Text size="xs" fw={selected ? 700 : 500} mt={4} ta="center">
        {preset.label}
      </Text>
    </UnstyledButton>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Text size="xs" fw={500} mb={4}>{label}</Text>
      {children}
    </Box>
  );
}

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

  // Elegir plantilla aplica sus colores/fuente recomendados; luego se pueden ajustar
  const applyTemplate = (template: AnnouncementTemplate) =>
    setStyle({ template, ...ANNOUNCEMENT_TEMPLATES[template].style });

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
              <Field label="Plantilla">
                <SimpleGrid cols={3} spacing={8} verticalSpacing={8}>
                  {TEMPLATE_ORDER.map((t) => (
                    <TemplateThumb
                      key={t}
                      template={t}
                      base={draft.style}
                      selected={draft.style.template === t}
                      onClick={() => applyTemplate(t)}
                    />
                  ))}
                </SimpleGrid>
                <Text size="xs" c="dimmed" mt={6}>
                  {ANNOUNCEMENT_TEMPLATES[draft.style.template].description}
                </Text>
              </Field>

              <Field label="Animación de entrada y salida">
                <SegmentedControl
                  fullWidth
                  size="xs"
                  value={draft.style.animation}
                  onChange={(v) => {
                    setStyle({ animation: v as AnnouncementStyle["animation"] });
                    setPreviewRun((n) => n + 1);
                  }}
                  data={[
                    { value: "slide", label: "Deslizar" },
                    { value: "fade", label: "Fundido" },
                    { value: "wipe", label: "Barrido" },
                    { value: "pop", label: "Pop" },
                  ]}
                />
              </Field>

              <Group grow gap="xs">
                <Field label="Tipo">
                  <SegmentedControl
                    fullWidth
                    size="xs"
                    value={draft.style.mode}
                    onChange={(v) => setStyle({ mode: v as AnnouncementStyle["mode"] })}
                    data={[
                      { value: "static", label: "Fijo" },
                      { value: "ticker", label: "Desplazable" },
                    ]}
                  />
                </Field>
                <Field label="Posición">
                  <SegmentedControl
                    fullWidth
                    size="xs"
                    value={draft.style.position}
                    onChange={(v) => setStyle({ position: v as AnnouncementStyle["position"] })}
                    data={[
                      { value: "bottom", label: "Abajo" },
                      { value: "top", label: "Arriba" },
                    ]}
                  />
                </Field>
              </Group>

              <Group grow gap="xs">
                {ALIGNABLE.includes(draft.style.template) && (
                  <Field label="Alineación">
                    <SegmentedControl
                      fullWidth
                      size="xs"
                      value={draft.style.align}
                      onChange={(v) => setStyle({ align: v as AnnouncementStyle["align"] })}
                      data={[
                        { value: "left", label: "Izq." },
                        { value: "center", label: "Centro" },
                        { value: "right", label: "Der." },
                      ]}
                    />
                  </Field>
                )}
                <Field label="Tamaño">
                  <SegmentedControl
                    fullWidth
                    size="xs"
                    value={draft.style.size}
                    onChange={(v) => setStyle({ size: v as AnnouncementStyle["size"] })}
                    data={[
                      { value: "sm", label: "S" },
                      { value: "md", label: "M" },
                      { value: "lg", label: "L" },
                    ]}
                  />
                </Field>
              </Group>

              <SimpleGrid cols={2} spacing="xs" verticalSpacing="xs">
                <ColorInput
                  size="xs"
                  label="Fondo"
                  format="rgba"
                  value={draft.style.bgColor}
                  onChange={(v) => setStyle({ bgColor: v })}
                  swatches={BG_SWATCHES}
                  swatchesPerRow={6}
                />
                <ColorInput
                  size="xs"
                  label="Texto"
                  format="hex"
                  value={draft.style.textColor}
                  onChange={(v) => setStyle({ textColor: v })}
                  swatches={TEXT_SWATCHES}
                  swatchesPerRow={5}
                />
                <ColorInput
                  size="xs"
                  label="Acento"
                  format="hex"
                  value={draft.style.accentColor}
                  onChange={(v) => setStyle({ accentColor: v })}
                  swatches={ACCENT_SWATCHES}
                  swatchesPerRow={7}
                />
                <Select
                  size="xs"
                  label="Fuente"
                  data={FONT_OPTIONS}
                  value={draft.style.font}
                  onChange={(v) => v && setStyle({ font: v as AnnouncementStyle["font"] })}
                  allowDeselect={false}
                />
              </SimpleGrid>
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
