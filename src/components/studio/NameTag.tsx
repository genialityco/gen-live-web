import { Box, Text } from "@mantine/core";
import type { TrackReference } from "@livekit/components-react";
import type { TileAppearance, TileBoxStyle } from "../../api/live-stage-service";

type Props = {
  trackRef: TrackReference;
  size?: "sm" | "md";
  // Legacy per-participant fallbacks (used when no tileAppearance is set)
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  fontFamily?: string;
  // Global tile appearance (takes priority over per-participant when set)
  tileAppearance?: TileAppearance;
};

const POSITION_STYLES: Record<
  NonNullable<TileAppearance["position"]>,
  { full: React.CSSProperties; small: React.CSSProperties }
> = {
  "bottom-left":   {
    full:  { bottom: 10, left: 10, alignItems: "flex-start" },
    small: { bottom: 5,  left: 5,  alignItems: "flex-start" },
  },
  "bottom-center": {
    full:  { bottom: 10, left: "50%", transform: "translateX(-50%)", alignItems: "center" },
    small: { bottom: 5,  left: "50%", transform: "translateX(-50%)", alignItems: "center" },
  },
  "bottom-right":  {
    full:  { bottom: 10, right: 10, alignItems: "flex-end" },
    small: { bottom: 5,  right: 5,  alignItems: "flex-end" },
  },
  "top-left":      {
    full:  { top: 10, left: 10, alignItems: "flex-start" },
    small: { top: 5,  left: 5,  alignItems: "flex-start" },
  },
  "top-center":    {
    full:  { top: 10, left: "50%", transform: "translateX(-50%)", alignItems: "center" },
    small: { top: 5,  left: "50%", transform: "translateX(-50%)", alignItems: "center" },
  },
  "top-right":     {
    full:  { top: 10, right: 10, alignItems: "flex-end" },
    small: { top: 5,  right: 5,  alignItems: "flex-end" },
  },
};

/**
 * Ancho de tile "de referencia" (px) usado para calibrar los valores en px
 * que configura el host (fontSize, paddingX/Y). A ese ancho, el resultado
 * es idéntico al valor configurado; por debajo o por encima escala en
 * proporción al ancho real del tile gracias a unidades de container query
 * (cqw), que CleanTile habilita con `containerType: inline-size`.
 */
const TILE_REFERENCE_WIDTH = 640;

/** Convierte un valor en px "de referencia" a un tamaño que escala con el
 * ancho real del tile, con piso y techo para que nunca sea ilegible ni
 * absurdamente grande. */
function proportional(px: number, min: number, max: number): string {
  const cqw = (px / TILE_REFERENCE_WIDTH) * 100;
  return `clamp(${min}px, ${cqw}cqw, ${max}px)`;
}

/**
 * Resuelve el estilo CSS de un recuadro.
 * `scale` ajusta el valor de referencia (p. ej. tiles "sm" parten de un
 * fontSize configurado menor) antes de hacerlo proporcional al tile real.
 */
function resolveBoxStyle(
  box: TileBoxStyle | undefined,
  defaults: {
    bgColor: string;
    textColor: string;
    fontSize: number;
    fontWeight: number;
    borderRadius: number;
    paddingX: number;
    paddingY: number;
  },
  scale = 1,
  fontFamily?: string,
): React.CSSProperties {
  const fontSize = (box?.fontSize ?? defaults.fontSize) * scale;
  const paddingX = (box?.paddingX ?? defaults.paddingX) * scale;
  const paddingY = (box?.paddingY ?? defaults.paddingY) * scale;

  return {
    background: box?.bgColor ?? defaults.bgColor,
    color: box?.textColor ?? defaults.textColor,
    fontSize: proportional(fontSize, 8, 56),
    fontWeight: box?.fontWeight ?? defaults.fontWeight,
    fontFamily: box?.fontFamily ?? fontFamily ?? undefined,
    borderRadius: (box?.borderRadius ?? defaults.borderRadius) + "px",
    paddingTop: proportional(paddingY, 2, 20),
    paddingBottom: proportional(paddingY, 2, 20),
    paddingLeft: proportional(paddingX, 3, 28),
    paddingRight: proportional(paddingX, 3, 28),
    border:
      (box?.borderWidth ?? 0) > 0
        ? `${box!.borderWidth}px solid ${box?.borderColor ?? "rgba(255,255,255,0.3)"}`
        : "none",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  };
}

export function NameTag({
  trackRef,
  size = "md",
  accentColor = "#4dabf7",
  bgColor,
  textColor,
  fontFamily,
  tileAppearance,
}: Props) {
  const p = trackRef.participant;
  const name = p?.name || p?.identity || "Invitado";
  const isSmall = size === "sm";

  // Scale factor: small tiles use 75% of the configured sizes
  const scale = isSmall ? 0.75 : 1;

  const subtitle: string = (() => {
    try {
      return JSON.parse(p?.metadata ?? "{}").subtitle ?? "";
    } catch {
      return "";
    }
  })();

  // ── NEW TWO-BOX LAYOUT (when tileAppearance is provided) ──────────────────
  if (tileAppearance) {
    const pos = tileAppearance.position ?? "bottom-left";
    const posStyle = POSITION_STYLES[pos][isSmall ? "small" : "full"];
    const nameBoxCfg = tileAppearance.nameBox;
    const subtitleBoxCfg = tileAppearance.subtitleBox;

    const showName = nameBoxCfg?.show !== false;
    // Subtitle shows at all sizes when tileAppearance is configured
    const showSubtitle = subtitleBoxCfg?.show !== false && !!subtitle;
    const showAccentBar = tileAppearance.showAccentBar !== false;
    const barColor = tileAppearance.accentColor ?? accentColor;
    const accentBarWidth = isSmall ? 3 : 4;

    const nameStyle = resolveBoxStyle(
      nameBoxCfg,
      {
        bgColor: "rgba(0,0,0,0.78)",
        textColor: "white",
        fontSize: 14,
        fontWeight: 700,
        borderRadius: 5,
        paddingX: 11,
        paddingY: 5,
      },
      scale,
      fontFamily,
    );

    const subtitleStyle = resolveBoxStyle(
      subtitleBoxCfg,
      {
        bgColor: "rgba(0,0,0,0.60)",
        textColor: "rgba(255,255,255,0.80)",
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 5,
        paddingX: 10,
        paddingY: 4,
      },
      scale,
      fontFamily,
    );

    const fullWidth = nameBoxCfg?.fullWidth || subtitleBoxCfg?.fullWidth;

    return (
      <Box
        style={{
          position: "absolute",
          ...posStyle,
          display: "flex",
          flexDirection: "column",
          gap: isSmall ? 2 : 3,
          pointerEvents: "none",
          maxWidth: fullWidth ? "100%" : "88%",
          width: fullWidth ? (isSmall ? "calc(100% - 10px)" : "calc(100% - 20px)") : undefined,
        }}
      >
        {showName && (
          <Box style={{ display: "flex", overflow: "hidden" }}>
            {showAccentBar && (
              <Box
                style={{
                  width: accentBarWidth,
                  background: barColor,
                  flexShrink: 0,
                  borderRadius: "5px 0 0 5px",
                }}
              />
            )}
            <Box
              style={{
                ...nameStyle,
                borderRadius: showAccentBar
                  ? `0 ${nameBoxCfg?.borderRadius ?? 5}px ${nameBoxCfg?.borderRadius ?? 5}px 0`
                  : nameStyle.borderRadius,
                flex: 1,
              }}
            >
              {name}
            </Box>
          </Box>
        )}
        {showSubtitle && (
          <Box style={subtitleStyle}>{subtitle}</Box>
        )}
      </Box>
    );
  }

  // ── LEGACY SINGLE-BOX LAYOUT (backward-compat when no tileAppearance) ─────
  const resolvedBg = bgColor ? bgColor : "rgba(0,0,0,0.55)";
  const resolvedText = textColor || "white";
  const resolvedSubtitleText = textColor
    ? `${textColor}b3`
    : "rgba(255,255,255,0.70)";

  return (
    <Box
      style={{
        position: "absolute",
        left: isSmall ? 6 : 10,
        bottom: isSmall ? 6 : 10,
        maxWidth: "85%",
        display: "flex",
        overflow: "hidden",
        borderRadius: 6,
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        pointerEvents: "none",
        fontFamily: fontFamily || undefined,
      }}
    >
      <Box
        style={{
          width: isSmall ? 3 : 4,
          background: accentColor,
          flexShrink: 0,
        }}
      />
      <Box
        style={{
          paddingTop: proportional(isSmall ? 3 : 5, 2, 20),
          paddingBottom: proportional(isSmall ? 3 : 5, 2, 20),
          paddingLeft: proportional(isSmall ? 7 : 11, 3, 28),
          paddingRight: proportional(isSmall ? 7 : 11, 3, 28),
          backdropFilter: !bgColor ? "blur(12px)" : undefined,
          background: resolvedBg,
          borderTop: !bgColor ? "1px solid rgba(255,255,255,0.10)" : "none",
          borderRight: !bgColor ? "1px solid rgba(255,255,255,0.10)" : "none",
          borderBottom: !bgColor ? "1px solid rgba(255,255,255,0.10)" : "none",
        }}
      >
        <Text
          fw={700}
          style={{
            color: resolvedText,
            fontSize: proportional(isSmall ? 12 : 14, 8, 56),
            lineHeight: 1.2,
            textOverflow: "ellipsis",
            overflow: "hidden",
            whiteSpace: "nowrap",
            letterSpacing: "0.01em",
            fontFamily: fontFamily || undefined,
          }}
        >
          {name}
        </Text>
        {subtitle && (
          <Text
            style={{
              color: resolvedSubtitleText,
              fontSize: proportional(isSmall ? 9 : 12, 7, 40),
              lineHeight: 1.2,
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
              fontWeight: 500,
              letterSpacing: "0.02em",
              marginTop: 1,
              fontFamily: fontFamily || undefined,
            }}
          >
            {subtitle}
          </Text>
        )}
      </Box>
    </Box>
  );
}
