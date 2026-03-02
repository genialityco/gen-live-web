import { Box, Text } from "@mantine/core";
import type { TrackReference } from "@livekit/components-react";

type Props = {
  trackRef: TrackReference;
  variant?: "solid" | "glass";
  size?: "sm" | "md";
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  fontFamily?: string;
};

export function NameTag({
  trackRef,
  variant = "glass",
  size = "md",
  accentColor = "#4dabf7",
  bgColor,
  textColor,
  fontFamily,
}: Props) {
  const p = trackRef.participant;
  const name = p?.name || p?.identity || "Invitado";
  const isSmall = size === "sm";

  const subtitle: string = (() => {
    try { return JSON.parse(p?.metadata ?? "{}").subtitle ?? ""; }
    catch { return ""; }
  })();

  const resolvedBg = bgColor
    ? bgColor
    : variant === "glass"
      ? "rgba(0,0,0,0.55)"
      : "rgba(0,0,0,0.82)";

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
      {/* Barra de acento lateral */}
      <Box
        style={{
          width: isSmall ? 3 : 4,
          background: accentColor,
          flexShrink: 0,
        }}
      />

      {/* Área de texto */}
      <Box
        style={{
          padding: isSmall ? "3px 7px" : "5px 11px",
          backdropFilter: !bgColor && variant === "glass" ? "blur(12px)" : undefined,
          background: resolvedBg,
          borderTop:
            !bgColor && variant === "glass" ? "1px solid rgba(255,255,255,0.10)" : "none",
          borderRight:
            !bgColor && variant === "glass" ? "1px solid rgba(255,255,255,0.10)" : "none",
          borderBottom:
            !bgColor && variant === "glass" ? "1px solid rgba(255,255,255,0.10)" : "none",
        }}
      >
        <Text
          size={isSmall ? "xs" : "sm"}
          fw={700}
          style={{
            color: resolvedText,
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
        {!isSmall && subtitle && (
          <Text
            size="xs"
            style={{
              color: resolvedSubtitleText,
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
