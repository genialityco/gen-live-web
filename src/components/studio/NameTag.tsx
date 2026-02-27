import { Box, Text } from "@mantine/core";
import type { TrackReference } from "@livekit/components-react";

type Props = {
  trackRef: TrackReference;
  variant?: "solid" | "glass";
  size?: "sm" | "md";
  accentColor?: string;
};

export function NameTag({
  trackRef,
  variant = "glass",
  size = "md",
  accentColor = "#4dabf7",
}: Props) {
  const p = trackRef.participant;
  const name = p?.name || p?.identity || "Invitado";
  const isSmall = size === "sm";

  const subtitle: string = (() => {
    try { return JSON.parse(p?.metadata ?? "{}").subtitle ?? ""; }
    catch { return ""; }
  })();

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
          backdropFilter: variant === "glass" ? "blur(12px)" : undefined,
          background:
            variant === "glass" ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.82)",
          borderTop:
            variant === "glass" ? "1px solid rgba(255,255,255,0.10)" : "none",
          borderRight:
            variant === "glass" ? "1px solid rgba(255,255,255,0.10)" : "none",
          borderBottom:
            variant === "glass" ? "1px solid rgba(255,255,255,0.10)" : "none",
        }}
      >
        <Text
          size={isSmall ? "xs" : "sm"}
          fw={700}
          style={{
            color: "white",
            lineHeight: 1.2,
            textOverflow: "ellipsis",
            overflow: "hidden",
            whiteSpace: "nowrap",
            letterSpacing: "0.01em",
          }}
        >
          {name}
        </Text>
        {!isSmall && subtitle && (
          <Text
            size="xs"
            style={{
              color: "rgba(255,255,255,0.70)",
              lineHeight: 1.2,
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
              fontWeight: 500,
              letterSpacing: "0.02em",
              marginTop: 1,
            }}
          >
            {subtitle}
          </Text>
        )}
      </Box>
    </Box>
  );
}
