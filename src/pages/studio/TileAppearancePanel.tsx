/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import {
  Stack,
  Text,
  Switch,
  ColorInput,
  NumberInput,
  Select,
  Group,
  Button,
  Accordion,
  Divider,
  Box,
} from "@mantine/core";
import { IconUser } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  setTileAppearance,
  subscribeStageState,
  type TileAppearance,
  type TileBoxStyle,
} from "../../api/live-stage-service";

type Props = {
  eventSlug: string;
  disabled?: boolean;
};

const POSITION_OPTIONS = [
  { value: "bottom-left", label: "Inferior izquierda" },
  { value: "bottom-center", label: "Inferior centro" },
  { value: "bottom-right", label: "Inferior derecha" },
  { value: "top-left", label: "Superior izquierda" },
  { value: "top-center", label: "Superior centro" },
  { value: "top-right", label: "Superior derecha" },
];

const POSITION_STYLES: Record<
  NonNullable<TileAppearance["position"]>,
  React.CSSProperties
> = {
  "bottom-left":   { bottom: 8, left: 8, alignItems: "flex-start" },
  "bottom-center": { bottom: 8, left: "50%", transform: "translateX(-50%)", alignItems: "center" },
  "bottom-right":  { bottom: 8, right: 8, alignItems: "flex-end" },
  "top-left":      { top: 8, left: 8, alignItems: "flex-start" },
  "top-center":    { top: 8, left: "50%", transform: "translateX(-50%)", alignItems: "center" },
  "top-right":     { top: 8, right: 8, alignItems: "flex-end" },
};

const DEFAULT_NAME_BOX: TileBoxStyle = {
  show: true,
  bgColor: "rgba(0,0,0,0.78)",
  textColor: "#ffffff",
  fontSize: 14,
  fontWeight: 700,
  borderRadius: 5,
  borderWidth: 0,
  borderColor: "rgba(255,255,255,0.3)",
  paddingX: 11,
  paddingY: 5,
  fullWidth: false,
};

const DEFAULT_SUBTITLE_BOX: TileBoxStyle = {
  show: true,
  bgColor: "rgba(0,0,0,0.60)",
  textColor: "rgba(255,255,255,0.80)",
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 5,
  borderWidth: 0,
  borderColor: "rgba(255,255,255,0.3)",
  paddingX: 10,
  paddingY: 4,
  fullWidth: false,
};

const DEFAULT_APPEARANCE: TileAppearance = {
  position: "bottom-left",
  showAccentBar: true,
  accentColor: "#4dabf7",
  nameBox: DEFAULT_NAME_BOX,
  subtitleBox: DEFAULT_SUBTITLE_BOX,
};

// ─── Preview ─────────────────────────────────────────────────────────────────

function boxCss(box: TileBoxStyle, defaults: TileBoxStyle): React.CSSProperties {
  return {
    background: box.bgColor ?? defaults.bgColor,
    color: box.textColor ?? defaults.textColor,
    fontSize: (box.fontSize ?? defaults.fontSize ?? 14) + "px",
    fontWeight: box.fontWeight ?? defaults.fontWeight,
    fontFamily: box.fontFamily ?? undefined,
    borderRadius: (box.borderRadius ?? defaults.borderRadius ?? 5) + "px",
    paddingTop: (box.paddingY ?? defaults.paddingY ?? 5) + "px",
    paddingBottom: (box.paddingY ?? defaults.paddingY ?? 5) + "px",
    paddingLeft: (box.paddingX ?? defaults.paddingX ?? 11) + "px",
    paddingRight: (box.paddingX ?? defaults.paddingX ?? 11) + "px",
    border:
      (box.borderWidth ?? defaults.borderWidth ?? 0) > 0
        ? `${box.borderWidth}px solid ${box.borderColor ?? defaults.borderColor ?? "rgba(255,255,255,0.3)"}`
        : "none",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
    lineHeight: 1.25,
  };
}

function TilePreview({ appearance }: { appearance: TileAppearance }) {
  const pos = appearance.position ?? "bottom-left";
  const posStyle = POSITION_STYLES[pos];
  const nameBox = appearance.nameBox ?? DEFAULT_NAME_BOX;
  const subtitleBox = appearance.subtitleBox ?? DEFAULT_SUBTITLE_BOX;
  const showName = nameBox.show !== false;
  const showSubtitle = subtitleBox.show !== false;
  const showAccentBar = appearance.showAccentBar !== false;
  const barColor = appearance.accentColor ?? "#4dabf7";
  const fullWidth = nameBox.fullWidth || subtitleBox.fullWidth;

  return (
    <Box
      style={{
        width: "100%",
        aspectRatio: "16 / 9",
        background: "linear-gradient(135deg, #1a1b2e 0%, #2d2f4a 60%, #1e3a5f 100%)",
        borderRadius: 8,
        position: "relative",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Fake camera background: subtle gradient + person icon */}
      <Box
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 4,
          opacity: 0.18,
        }}
      >
        <IconUser size={40} color="white" />
        <Text size="xs" c="white" style={{ letterSpacing: "0.08em" }}>PREVIEW</Text>
      </Box>

      {/* Name + subtitle stack */}
      <Box
        style={{
          position: "absolute",
          ...posStyle,
          display: "flex",
          flexDirection: "column",
          gap: 3,
          pointerEvents: "none",
          maxWidth: fullWidth ? "calc(100% - 16px)" : "80%",
          width: fullWidth ? "calc(100% - 16px)" : undefined,
        }}
      >
        {showName && (
          <Box style={{ display: "flex", overflow: "hidden" }}>
            {showAccentBar && (
              <Box
                style={{
                  width: 4,
                  background: barColor,
                  flexShrink: 0,
                  borderRadius: "5px 0 0 5px",
                }}
              />
            )}
            <Box
              style={{
                ...boxCss(nameBox, DEFAULT_NAME_BOX),
                borderRadius: showAccentBar
                  ? `0 ${nameBox.borderRadius ?? 5}px ${nameBox.borderRadius ?? 5}px 0`
                  : (nameBox.borderRadius ?? 5) + "px",
                flex: 1,
              }}
            >
              Nombre del Speaker
            </Box>
          </Box>
        )}
        {showSubtitle && (
          <Box style={boxCss(subtitleBox, DEFAULT_SUBTITLE_BOX)}>
            Cargo o Subtitulo
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─── BoxStyleEditor ───────────────────────────────────────────────────────────

function BoxStyleEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TileBoxStyle;
  onChange: (v: TileBoxStyle) => void;
}) {
  const set = (key: keyof TileBoxStyle, val: any) =>
    onChange({ ...value, [key]: val });

  return (
    <Stack gap="xs">
      <Switch
        label="Mostrar"
        checked={value.show !== false}
        onChange={(e) => set("show", e.currentTarget.checked)}
        size="sm"
      />

      {value.show !== false && (
        <>
          <Group grow>
            <ColorInput
              label="Color de fondo"
              value={value.bgColor ?? "rgba(0,0,0,0.78)"}
              onChange={(v) => set("bgColor", v)}
              format="rgba"
              size="xs"
            />
            <ColorInput
              label="Color de texto"
              value={value.textColor ?? "#ffffff"}
              onChange={(v) => set("textColor", v)}
              size="xs"
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Tamaño fuente (px)"
              value={value.fontSize ?? 14}
              onChange={(v) => set("fontSize", Number(v))}
              min={8}
              max={72}
              size="xs"
            />
            <NumberInput
              label="Peso fuente"
              value={value.fontWeight ?? 700}
              onChange={(v) => set("fontWeight", Number(v))}
              min={100}
              max={900}
              step={100}
              size="xs"
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Radio borde (px)"
              value={value.borderRadius ?? 5}
              onChange={(v) => set("borderRadius", Number(v))}
              min={0}
              max={50}
              size="xs"
            />
            <NumberInput
              label="Grosor borde (px)"
              value={value.borderWidth ?? 0}
              onChange={(v) => set("borderWidth", Number(v))}
              min={0}
              max={10}
              size="xs"
            />
          </Group>

          {(value.borderWidth ?? 0) > 0 && (
            <ColorInput
              label="Color de borde"
              value={value.borderColor ?? "rgba(255,255,255,0.3)"}
              onChange={(v) => set("borderColor", v)}
              format="rgba"
              size="xs"
            />
          )}

          <Group grow>
            <NumberInput
              label="Padding horizontal (px)"
              value={value.paddingX ?? 11}
              onChange={(v) => set("paddingX", Number(v))}
              min={0}
              max={40}
              size="xs"
            />
            <NumberInput
              label="Padding vertical (px)"
              value={value.paddingY ?? 5}
              onChange={(v) => set("paddingY", Number(v))}
              min={0}
              max={30}
              size="xs"
            />
          </Group>

          <Switch
            label="Ancho completo del tile"
            checked={value.fullWidth === true}
            onChange={(e) => set("fullWidth", e.currentTarget.checked)}
            size="sm"
          />
        </>
      )}

      <Text size="xs" c="dimmed" mt={-4}>{label}</Text>
    </Stack>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export function TileAppearancePanel({ eventSlug, disabled }: Props) {
  const [appearance, setAppearance] = useState<TileAppearance>(DEFAULT_APPEARANCE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeStageState(eventSlug, (s) => {
      if (s.tileAppearance) {
        setAppearance({
          ...DEFAULT_APPEARANCE,
          ...s.tileAppearance,
          nameBox: { ...DEFAULT_NAME_BOX, ...s.tileAppearance.nameBox },
          subtitleBox: { ...DEFAULT_SUBTITLE_BOX, ...s.tileAppearance.subtitleBox },
        });
      }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await setTileAppearance(eventSlug, appearance);
      notifications.show({ message: "Apariencia de tiles guardada", color: "green" });
    } catch {
      notifications.show({ message: "Error al guardar apariencia", color: "red" });
    } finally {
      setSaving(false);
    }
  }, [eventSlug, appearance]);

  const handleReset = async () => {
    setAppearance(DEFAULT_APPEARANCE);
    try {
      await setTileAppearance(eventSlug, DEFAULT_APPEARANCE);
      notifications.show({ message: "Apariencia restablecida", color: "blue" });
    } catch {
      notifications.show({ message: "Error al restablecer", color: "red" });
    }
  };

  return (
    <Stack gap="sm">
      {/* ── PREVIEW ── */}
      <TilePreview appearance={appearance} />

      {/* ── Posicion ── */}
      <Select
        label="Posicion del nombre"
        value={appearance.position ?? "bottom-left"}
        onChange={(v) =>
          setAppearance((a) => ({ ...a, position: (v as any) ?? "bottom-left" }))
        }
        data={POSITION_OPTIONS}
        size="sm"
        disabled={disabled}
      />

      {/* ── Barra de acento ── */}
      <Group align="flex-end">
        <Switch
          label="Mostrar barra de acento"
          checked={appearance.showAccentBar !== false}
          onChange={(e) =>
            setAppearance((a) => ({ ...a, showAccentBar: e.currentTarget.checked }))
          }
          size="sm"
          disabled={disabled}
          style={{ flex: 1 }}
        />
        {appearance.showAccentBar !== false && (
          <ColorInput
            label="Color barra"
            value={appearance.accentColor ?? "#4dabf7"}
            onChange={(v) => setAppearance((a) => ({ ...a, accentColor: v }))}
            size="xs"
            disabled={disabled}
            style={{ flex: 1 }}
          />
        )}
      </Group>

      <Divider label="Recuadros" labelPosition="center" />

      <Accordion variant="separated" radius="md">
        <Accordion.Item value="name">
          <Accordion.Control>
            <Text size="sm" fw={600}>Recuadro superior — Nombre</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Box
              opacity={disabled ? 0.5 : 1}
              style={{ pointerEvents: disabled ? "none" : undefined }}
            >
              <BoxStyleEditor
                label="Estilos del recuadro de nombre"
                value={appearance.nameBox ?? DEFAULT_NAME_BOX}
                onChange={(v) => setAppearance((a) => ({ ...a, nameBox: v }))}
              />
            </Box>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="subtitle">
          <Accordion.Control>
            <Text size="sm" fw={600}>Recuadro inferior — Subtitulo</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Box
              opacity={disabled ? 0.5 : 1}
              style={{ pointerEvents: disabled ? "none" : undefined }}
            >
              <BoxStyleEditor
                label="Estilos del recuadro de subtitulo"
                value={appearance.subtitleBox ?? DEFAULT_SUBTITLE_BOX}
                onChange={(v) => setAppearance((a) => ({ ...a, subtitleBox: v }))}
              />
            </Box>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <Group grow>
        <Button onClick={handleSave} loading={saving} disabled={disabled} size="sm">
          Guardar apariencia
        </Button>
        <Button
          variant="default"
          onClick={handleReset}
          disabled={disabled || saving}
          size="sm"
        >
          Restablecer
        </Button>
      </Group>
    </Stack>
  );
}
