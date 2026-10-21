// src/components/studio/AnnouncementBanner.tsx
import { useEffect, useState } from "react";
import { Box } from "@mantine/core";
import {
  DEFAULT_ANNOUNCEMENT_STYLE,
  getServerNow,
  isBannerActive,
  subscribeBannerOverlay,
  type BannerState,
} from "../../api/live-stage-service";

const FONT_SIZE = { sm: 2, md: 2.6, lg: 3.4 } as const; // en cqw

/**
 * Devuelve si el banner debe verse ahora, y re-renderiza justo cuando expira
 * (expiresAt) para ocultarlo sin depender de que el estudio siga abierto.
 */
function useBannerActive(banner: BannerState | undefined | null) {
  const [, force] = useState(0);
  const expiresAt = banner?.visible ? banner.expiresAt : null;

  useEffect(() => {
    if (!expiresAt) return;
    const ms = expiresAt - getServerNow();
    if (ms <= 0) return;
    const t = setTimeout(() => force((n) => n + 1), ms + 50);
    return () => clearTimeout(t);
  }, [expiresAt]);

  return isBannerActive(banner);
}

type Props = {
  banner: BannerState | undefined | null;
  zIndex?: number;
};

/**
 * Overlay del banner de anuncios. Ocupa todo el contenedor padre (que debe ser
 * position: relative) y escala con su ancho vía unidades cqw, así se ve igual en
 * el preview del estudio, en el egress a 1080p y sobre el reproductor del asistente.
 */
export function AnnouncementBanner({ banner, zIndex = 25 }: Props) {
  const active = useBannerActive(banner);
  if (!active || !banner) return null;

  const style = { ...DEFAULT_ANNOUNCEMENT_STYLE, ...(banner.style ?? {}) };
  const isTicker = style.mode === "ticker";
  // Velocidad de lectura constante: textos largos tardan más en cruzar
  const tickerSeconds = Math.max(10, banner.text.length * 0.22 + 8);

  return (
    <Box
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        pointerEvents: "none",
        containerType: "inline-size",
      }}
    >
      <style>{`
        @keyframes announcementTicker {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
      `}</style>
      <Box
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          [style.position]: 0,
          background: style.bgColor,
          color: style.textColor,
          padding: "1.4cqw 2.4cqw",
          display: "flex",
          alignItems: "center",
          justifyContent: isTicker ? "flex-start" : "center",
          overflow: "hidden",
        }}
      >
        <span
          // key: reinicia la animación del ticker cuando cambia el texto
          key={isTicker ? banner.text : undefined}
          style={{
            fontSize: `${FONT_SIZE[style.size]}cqw`,
            lineHeight: 1.25,
            fontWeight: 600,
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            ...(isTicker
              ? {
                  display: "inline-block",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                  paddingLeft: "100%",
                  animation: `announcementTicker ${tickerSeconds}s linear infinite`,
                }
              : {
                  textAlign: "center",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }),
          }}
        >
          {isTicker ? banner.text.replace(/\s*\n\s*/g, "   •   ") : banner.text}
        </span>
      </Box>
    </Box>
  );
}

/**
 * Banner sobre el reproductor de la página del asistente. Solo se muestra si el
 * host activó "Mostrar también sobre el reproductor del asistente" (transmisiones
 * que no salen del egress del estudio, donde el banner no va dentro del video).
 */
export function AttendAnnouncementOverlay({
  eventSlug,
  enabled,
}: {
  eventSlug: string;
  enabled: boolean;
}) {
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [showOnAttend, setShowOnAttend] = useState(false);

  useEffect(() => {
    if (!enabled || !eventSlug) return;
    const unsub = subscribeBannerOverlay(eventSlug, (s) => {
      setBanner(s.banner);
      setShowOnAttend(!!s.settings.showOnAttend);
    });
    return () => {
      unsub();
      setBanner(null);
    };
  }, [eventSlug, enabled]);

  if (!enabled || !showOnAttend) return null;
  return <AnnouncementBanner banner={banner} zIndex={5} />;
}
