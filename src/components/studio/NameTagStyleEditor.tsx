import { useState } from "react";
import {
  Popover,
  ActionIcon,
  Stack,
  ColorInput,
  Select,
  Button,
  Group,
  Text,
  Box,
  Divider,
  Tooltip,
} from "@mantine/core";
import { IconPalette, IconX } from "@tabler/icons-react";
import { setNameTagStyle, type NameTagStyle } from "../../api/live-stage-service";

const FONT_OPTIONS = [
  { value: "", label: "Predeterminada" },
  { value: "Georgia, serif", label: "Georgia (Serif)" },
  { value: "'Courier New', Courier, monospace", label: "Courier (Monospace)" },
  { value: "Impact, 'Arial Narrow', sans-serif", label: "Impact (Bold)" },
  { value: "'Trebuchet MS', Helvetica, sans-serif", label: "Trebuchet MS" },
];

type Props = {
  eventSlug: string;
  identity: string;
  participantName: string;
  currentStyle: NameTagStyle;
  canEdit: boolean;
};

export function NameTagStyleEditor({
  eventSlug,
  identity,
  participantName,
  currentStyle,
  canEdit,
}: Props) {
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState<NameTagStyle>(currentStyle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    if (!opened) {
      // Sincronizar draft con el estilo actual al abrir
      setDraft(currentStyle);
      setError(null);
    }
    setOpened((o) => !o);
  };

  const handleClose = () => setOpened(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await setNameTagStyle(eventSlug, identity, draft);
      setOpened(false);
    } catch (e) {
      setError("Error al guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setError(null);
    try {
      await setNameTagStyle(eventSlug, identity, {});
      setDraft({});
      setOpened(false);
    } catch (e) {
      setError("Error al restablecer. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) return null;

  // Mini preview del name tag con los estilos actuales del draft
  const previewAccent = draft.accentColor || "#4dabf7";
  const previewBg = draft.bgColor || "rgba(0,0,0,0.60)";
  const previewText = draft.textColor || "white";
  const previewFont = draft.fontFamily || undefined;

  return (
    <Popover
      opened={opened}
      position="left"
      withArrow
      shadow="lg"
      width={300}
      closeOnClickOutside={false}
    >
      <Popover.Target>
        <Tooltip label="Estilo del nombre en pantalla" position="top" withArrow>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="grape"
            onClick={handleToggle}
            aria-label="Editar estilo del nombre"
          >
            <IconPalette size={14} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text size="sm" fw={600}>
              Estilo del nombre
            </Text>
            <ActionIcon size="xs" variant="subtle" onClick={handleClose} aria-label="Cerrar">
              <IconX size={12} />
            </ActionIcon>
          </Group>

          {/* Preview */}
          <Box
            style={{
              background: "#1a1a2e",
              borderRadius: 8,
              padding: "12px 16px",
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <Box
              style={{
                display: "flex",
                overflow: "hidden",
                borderRadius: 4,
                boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                fontFamily: previewFont,
              }}
            >
              <Box style={{ width: 3, background: previewAccent, flexShrink: 0 }} />
              <Box
                style={{
                  padding: "3px 8px",
                  background: previewBg,
                }}
              >
                <Text
                  size="xs"
                  fw={700}
                  style={{ color: previewText, fontFamily: previewFont, lineHeight: 1.2 }}
                >
                  {participantName || "Nombre"}
                </Text>
              </Box>
            </Box>
          </Box>

          <Divider />

          <ColorInput
            label="Color de acento (barra lateral)"
            size="xs"
            value={draft.accentColor || ""}
            onChange={(v) => setDraft((d) => ({ ...d, accentColor: v || undefined }))}
            placeholder="#4dabf7"
            format="hex"
            swatches={["#4dabf7", "#ff6b6b", "#51cf66", "#ffd43b", "#cc5de8", "#ff922b", "#ffffff"]}
            popoverProps={{ withinPortal: false }}
          />

          <ColorInput
            label="Color de fondo del nombre"
            size="xs"
            value={draft.bgColor || ""}
            onChange={(v) => setDraft((d) => ({ ...d, bgColor: v || undefined }))}
            placeholder="rgba(0,0,0,0.55)"
            format="hex"
            swatches={["#000000", "#1a1a2e", "#16213e", "#0f3460", "#1b1b2f", "#2d132c"]}
            popoverProps={{ withinPortal: false }}
          />

          <ColorInput
            label="Color del texto del nombre"
            size="xs"
            value={draft.textColor || ""}
            onChange={(v) => setDraft((d) => ({ ...d, textColor: v || undefined }))}
            placeholder="#ffffff"
            format="hex"
            swatches={["#ffffff", "#f8f9fa", "#ffd43b", "#74c0fc", "#ff6b6b", "#69db7c"]}
            popoverProps={{ withinPortal: false }}
          />

          <Select
            label="Tipografía"
            size="xs"
            data={FONT_OPTIONS}
            value={draft.fontFamily || ""}
            onChange={(v) => setDraft((d) => ({ ...d, fontFamily: v || undefined }))}
            allowDeselect={false}
            comboboxProps={{ withinPortal: false }}
          />

          {error && (
            <Text size="xs" c="red">
              {error}
            </Text>
          )}

          <Group gap="xs" mt={4}>
            <Button size="xs" flex={1} loading={saving} onClick={handleSave}>
              Guardar
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="red"
              loading={saving}
              onClick={handleReset}
            >
              Restablecer
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
