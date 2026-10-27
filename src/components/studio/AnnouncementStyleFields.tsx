// src/components/studio/AnnouncementStyleFields.tsx
// Controles de diseño de un anuncio (plantilla, animación, tamaño, colores,
// fuente). Los comparten el editor de anuncios del estudio y los anuncios de
// manada sobre el video del asistente.
import type { ReactNode } from "react";
import { Box, ColorInput, Group, SegmentedControl, Select, SimpleGrid, Text, UnstyledButton } from "@mantine/core";
import type { AnnouncementStyle, AnnouncementTemplate } from "../../api/live-stage-service";
import { AnnouncementBanner } from "./AnnouncementBanner";
import {
  ALIGNABLE_TEMPLATES,
  ANNOUNCEMENT_FONTS,
  ANNOUNCEMENT_PREVIEW_BG,
  ANNOUNCEMENT_TEMPLATES,
} from "./announcement-templates";

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

const FONT_OPTIONS = Object.entries(ANNOUNCEMENT_FONTS).map(([value, f]) => ({
  value,
  label: f.label,
}));

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
          background: ANNOUNCEMENT_PREVIEW_BG,
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

export function StyleField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Text size="xs" fw={500} mb={4}>{label}</Text>
      {children}
    </Box>
  );
}

type Props = {
  style: Required<AnnouncementStyle>;
  onChange: (patch: Partial<AnnouncementStyle>) => void;
  // Se llama al cambiar la animación, para re-reproducirla en la vista previa
  onReplay?: () => void;
  // false = la posición/alineación las controla quien usa el componente
  showPlacement?: boolean;
};

export function AnnouncementStyleFields({ style, onChange, onReplay, showPlacement = true }: Props) {
  // Elegir plantilla aplica sus colores/fuente recomendados; luego se pueden ajustar.
  // Sin controles de colocación, la alineación tampoco se pisa.
  const applyTemplate = (template: AnnouncementTemplate) => {
    const { align, ...presetStyle } = ANNOUNCEMENT_TEMPLATES[template].style;
    onChange({ template, ...presetStyle, ...(showPlacement ? { align } : {}) });
  };

  return (
    <>
      <StyleField label="Plantilla">
        <SimpleGrid cols={3} spacing={8} verticalSpacing={8}>
          {TEMPLATE_ORDER.map((t) => (
            <TemplateThumb
              key={t}
              template={t}
              base={style}
              selected={style.template === t}
              onClick={() => applyTemplate(t)}
            />
          ))}
        </SimpleGrid>
        <Text size="xs" c="dimmed" mt={6}>
          {ANNOUNCEMENT_TEMPLATES[style.template].description}
        </Text>
      </StyleField>

      <StyleField label="Animación de entrada y salida">
        <SegmentedControl
          fullWidth
          size="xs"
          value={style.animation}
          onChange={(v) => {
            onChange({ animation: v as AnnouncementStyle["animation"] });
            onReplay?.();
          }}
          data={[
            { value: "slide", label: "Deslizar" },
            { value: "fade", label: "Fundido" },
            { value: "wipe", label: "Barrido" },
            { value: "pop", label: "Pop" },
          ]}
        />
      </StyleField>

      <Group grow gap="xs">
        <StyleField label="Tipo">
          <SegmentedControl
            fullWidth
            size="xs"
            value={style.mode}
            onChange={(v) => onChange({ mode: v as AnnouncementStyle["mode"] })}
            data={[
              { value: "static", label: "Fijo" },
              { value: "ticker", label: "Desplazable" },
            ]}
          />
        </StyleField>
        {showPlacement && (
          <StyleField label="Posición">
            <SegmentedControl
              fullWidth
              size="xs"
              value={style.position}
              onChange={(v) => onChange({ position: v as AnnouncementStyle["position"] })}
              data={[
                { value: "bottom", label: "Abajo" },
                { value: "top", label: "Arriba" },
              ]}
            />
          </StyleField>
        )}
      </Group>

      <Group grow gap="xs">
        {showPlacement && ALIGNABLE_TEMPLATES.includes(style.template) && (
          <StyleField label="Alineación">
            <SegmentedControl
              fullWidth
              size="xs"
              value={style.align}
              onChange={(v) => onChange({ align: v as AnnouncementStyle["align"] })}
              data={[
                { value: "left", label: "Izq." },
                { value: "center", label: "Centro" },
                { value: "right", label: "Der." },
              ]}
            />
          </StyleField>
        )}
        <StyleField label="Tamaño">
          <SegmentedControl
            fullWidth
            size="xs"
            value={style.size}
            onChange={(v) => onChange({ size: v as AnnouncementStyle["size"] })}
            data={[
              { value: "sm", label: "S" },
              { value: "md", label: "M" },
              { value: "lg", label: "L" },
            ]}
          />
        </StyleField>
      </Group>

      <SimpleGrid cols={2} spacing="xs" verticalSpacing="xs">
        <ColorInput
          size="xs"
          label="Fondo"
          format="rgba"
          value={style.bgColor}
          onChange={(v) => onChange({ bgColor: v })}
          swatches={BG_SWATCHES}
          swatchesPerRow={6}
        />
        <ColorInput
          size="xs"
          label="Texto"
          format="hex"
          value={style.textColor}
          onChange={(v) => onChange({ textColor: v })}
          swatches={TEXT_SWATCHES}
          swatchesPerRow={5}
        />
        <ColorInput
          size="xs"
          label="Acento"
          format="hex"
          value={style.accentColor}
          onChange={(v) => onChange({ accentColor: v })}
          swatches={ACCENT_SWATCHES}
          swatchesPerRow={7}
        />
        <Select
          size="xs"
          label="Fuente"
          data={FONT_OPTIONS}
          value={style.font}
          onChange={(v) => v && onChange({ font: v as AnnouncementStyle["font"] })}
          allowDeselect={false}
        />
      </SimpleGrid>
    </>
  );
}
