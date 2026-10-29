// src/components/studio/AnnouncementBanner.tsx
import { useEffect, useState, type CSSProperties } from "react";
import { Box } from "@mantine/core";
import {
  DEFAULT_ANNOUNCEMENT_STYLE,
  getServerNow,
  isBannerActive,
  subscribeBannerOverlay,
  type AnnouncementStyle,
  type BannerState,
} from "../../api/live-stage-service";
import {
  ANIMATION_KEYFRAME,
  ANNOUNCEMENT_FONTS,
  EASE_ENTER,
  EASE_EXIT,
  ENTER_MS,
  EXIT_MS,
  POP_EASE,
  ensureAnnouncementFont,
  ensureAnnouncementStyles,
  readableOn,
} from "./announcement-templates";

// Keyframes disponibles antes del primer render (si se inyectan en un effect,
// la primera animación de entrada puede no ejecutarse).
ensureAnnouncementStyles();

const FONT_SIZE = { sm: 1.9, md: 2.4, lg: 3.1 } as const; // en cqw
// Margen de seguridad de TV: los gráficos no tocan el borde del cuadro
const SAFE_X = 3.5;
const SAFE_Y = 3;
const SHADOW = "0 0.6cqw 1.8cqw rgba(0, 0, 0, 0.35)";

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

type Phase = "in" | "out";
type Shown = { banner: BannerState; key: string };

// Cada publicación tiene su propio publishedAt: si cambia, es un anuncio nuevo
// (sale el anterior y entra el nuevo); si no, es una edición en caliente.
const bannerKey = (b: BannerState) => String(b.publishedAt ?? b.announcementId ?? b.text);

/**
 * Máquina de estados de la transición: mantiene montado el banner saliente
 * durante EXIT_MS para que pueda animar su salida antes de quitarlo o
 * reemplazarlo por el siguiente.
 */
function useBannerTransition(banner: BannerState | undefined | null, animate: boolean) {
  const active = useBannerActive(banner);
  const target = active && banner ? banner : null;
  const targetKey = target ? bannerKey(target) : null;

  const [shown, setShown] = useState<Shown | null>(() =>
    target ? { banner: target, key: targetKey! } : null,
  );
  const [phase, setPhase] = useState<Phase>("in");

  useEffect(() => {
    if (!animate) return;
    if (!shown && !target) return;

    if (shown && shown.key === targetKey) {
      // Mismo anuncio con contenido editado: actualizar sin animar
      if (target && target !== shown.banner) setShown({ banner: target, key: shown.key });
      return;
    }

    if (!shown) {
      setShown({ banner: target!, key: targetKey! });
      setPhase("in");
      return;
    }

    setPhase("out");
    const t = setTimeout(() => {
      setShown(target ? { banner: target, key: targetKey! } : null);
      setPhase("in");
    }, EXIT_MS);
    return () => clearTimeout(t);
  }, [animate, target, targetKey, shown]);

  if (!animate) {
    return { shown: target ? { banner: target, key: targetKey! } : null, phase: "in" as Phase };
  }
  return { shown, phase };
}

type Props = {
  banner: BannerState | undefined | null;
  zIndex?: number;
  // false = sin animaciones de entrada/salida (miniaturas del selector de plantillas)
  animate?: boolean;
};

/**
 * Overlay del banner de anuncios. Ocupa todo el contenedor padre (que debe ser
 * position: relative) y escala con su ancho vía unidades cqw, así se ve igual en
 * el preview del estudio, en el egress a 1080p y sobre el reproductor del asistente.
 */
export function AnnouncementBanner({ banner, zIndex = 25, animate = true }: Props) {
  const { shown, phase } = useBannerTransition(banner, animate);
  if (!shown) return null;

  const style = { ...DEFAULT_ANNOUNCEMENT_STYLE, ...(shown.banner.style ?? {}) };
  ensureAnnouncementFont(style.font);

  return (
    <Box
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        pointerEvents: "none",
        containerType: "inline-size",
        overflow: "hidden",
      }}
    >
      <BannerGraphic
        // key: cada anuncio nuevo se monta de cero y reproduce su entrada
        key={shown.key}
        banner={shown.banner}
        style={style}
        phase={phase}
        animate={animate}
      />
    </Box>
  );
}

function BannerGraphic({
  banner,
  style,
  phase,
  animate,
}: {
  banner: BannerState;
  style: Required<AnnouncementStyle>;
  phase: Phase;
  animate: boolean;
}) {
  const { template, accentColor: accent, bgColor: bg, textColor } = style;
  const fs = FONT_SIZE[style.size];
  const fontFamily = ANNOUNCEMENT_FONTS[style.font]?.family;
  const isTop = style.position === "top";
  const isTicker = style.mode === "ticker";
  const fullWidth = template === "bar" || template === "breaking";
  const align = fullWidth ? "left" : style.align;
  const label = banner.label?.trim() || (template === "breaking" ? "Aviso" : "");

  // ── Animación ────────────────────────────────────────────────────────
  // Las plantillas alineadas a un lado entran desde ese lado; el resto, desde
  // el borde superior/inferior más cercano.
  const fromSide = !fullWidth && template !== "pill" && align !== "center";
  const animVars = {
    "--ann-dx": fromSide ? (align === "left" ? "-115%" : "115%") : "0",
    "--ann-dy": fromSide ? "0" : isTop ? "-140%" : "140%",
    "--ann-wipe-from":
      align === "right" ? "inset(-40% -5% -40% 100%)"
      : align === "center" ? "inset(-40% 50% -40% 50%)"
      : "inset(-40% 100% -40% -5%)",
  } as CSSProperties;

  const kf = ANIMATION_KEYFRAME[style.animation];
  const entering = animate && phase === "in";
  const boxAnimation = !animate
    ? undefined
    : phase === "in"
      ? `${kf}In ${ENTER_MS}ms ${style.animation === "pop" ? POP_EASE : EASE_ENTER} both`
      : `${kf}Out ${EXIT_MS}ms ${EASE_EXIT} both`;
  // Entrada por capas: primero la caja/acento, luego el texto
  const textAnimation = entering ? `annText 520ms ${EASE_ENTER} 200ms both` : undefined;
  const growAnimation = (axis: "X" | "Y") =>
    entering ? `annGrow${axis} 480ms ${EASE_ENTER} 60ms both` : undefined;

  // ── Piezas comunes ───────────────────────────────────────────────────
  const slot: CSSProperties = {
    position: "absolute",
    left: template === "bar" ? 0 : `${SAFE_X}cqw`,
    right: template === "bar" ? 0 : `${SAFE_X}cqw`,
    [isTop ? "top" : "bottom"]: template === "bar" ? 0 : `${SAFE_Y}cqw`,
    display: "flex",
    justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
  };

  const box: CSSProperties = {
    ...animVars,
    animation: boxAnimation,
    fontFamily,
    color: textColor,
  };

  const textStyle: CSSProperties = {
    fontSize: `${fs}cqw`,
    lineHeight: 1.2,
    fontWeight: template === "breaking" ? 600 : 700,
    letterSpacing: template === "breaking" ? "0.01em" : undefined,
  };

  const tickerSeconds = Math.max(10, banner.text.length * 0.22 + 8);
  const renderText = (textAlign: "left" | "center" | "right", tickerWidth?: string) =>
    isTicker ? (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          width: tickerWidth,
          overflow: "hidden",
          animation: textAnimation,
          // Desvanece los extremos para que el texto no "corte" en seco
          maskImage: "linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent)",
        }}
      >
        <span
          // key: reinicia el recorrido cuando cambia el texto
          key={banner.text}
          style={{
            ...textStyle,
            display: "inline-block",
            whiteSpace: "nowrap",
            paddingLeft: "100%",
            animation: `annTicker ${tickerSeconds}s linear infinite`,
          }}
        >
          {banner.text.replace(/\s*\n\s*/g, "   •   ")}
        </span>
      </div>
    ) : (
      <span
        style={{
          ...textStyle,
          display: "block",
          textAlign,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          animation: textAnimation,
        }}
      >
        {banner.text}
        {banner.action && (
          <span style={{ display: "block", marginTop: "0.6cqw", textAlign }}>
            <button
              type="button"
              disabled={banner.action.disabled}
              onClick={banner.action.onClick}
              style={{
                // El overlay no captura clics; el botón sí
                pointerEvents: "auto",
                cursor: banner.action.disabled ? "default" : "pointer",
                // Tocable también en celular, donde el video es angosto
                fontSize: `max(12px, ${fs * 0.72}cqw)`,
                fontWeight: 700,
                fontFamily: "inherit",
                lineHeight: 1.1,
                padding: "0.45em 0.9em",
                borderRadius: 999,
                border: "none",
                background: accent,
                color: readableOn(accent),
                opacity: banner.action.disabled ? 0.6 : 1,
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              }}
            >
              {banner.action.label}
            </button>
          </span>
        )}
      </span>
    );

  const labelTag = (radius: string) =>
    label ? (
      <span
        style={{
          background: accent,
          color: readableOn(accent),
          fontSize: `${fs * 0.6}cqw`,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          lineHeight: 1.1,
          padding: "0.45cqw 1cqw",
          borderRadius: radius,
          whiteSpace: "nowrap",
          flexShrink: 0,
          animation: textAnimation,
        }}
      >
        {label}
      </span>
    ) : null;

  const pulseDot = (color: string) => (
    <span
      style={{
        width: `${fs * 0.34}cqw`,
        height: `${fs * 0.34}cqw`,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        animation: "annPulse 1.4s ease-in-out infinite",
      }}
    />
  );

  // ── Plantillas ───────────────────────────────────────────────────────
  if (template === "lowerThird") {
    return (
      <div style={slot}>
        <div
          style={{
            ...box,
            display: "flex",
            flexDirection: "column",
            alignItems: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
            maxWidth: "72cqw",
          }}
        >
          {labelTag("0")}
          <div
            style={{
              display: "flex",
              flexDirection: align === "right" ? "row-reverse" : "row",
              alignItems: "stretch",
              boxShadow: SHADOW,
            }}
          >
            <div
              style={{
                width: "0.6cqw",
                flexShrink: 0,
                background: accent,
                transformOrigin: isTop ? "top" : "bottom",
                animation: growAnimation("Y"),
              }}
            />
            <div style={{ background: bg, padding: "1.1cqw 2.2cqw", minWidth: 0 }}>
              {renderText(align, "56cqw")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (template === "breaking") {
    return (
      <div style={slot}>
        <div style={{ ...box, width: "100%", display: "flex", alignItems: "stretch", boxShadow: SHADOW }}>
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: "0.8cqw",
              padding: "0.9cqw 2.8cqw 0.9cqw 1.6cqw",
              background: accent,
              color: readableOn(accent),
              clipPath: "polygon(0 0, 100% 0, calc(100% - 1.4cqw) 100%, 0 100%)",
              fontSize: `${fs * 0.78}cqw`,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {pulseDot(readableOn(accent))}
            {label}
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              marginLeft: "-1.4cqw",
              padding: "0.9cqw 2.2cqw 0.9cqw 2.8cqw",
              background: bg,
              display: "flex",
              alignItems: "center",
            }}
          >
            {renderText("left")}
          </div>
        </div>
      </div>
    );
  }

  if (template === "pill") {
    return (
      <div style={slot}>
        <div
          style={{
            ...box,
            display: "flex",
            alignItems: "center",
            gap: "1.1cqw",
            maxWidth: "80cqw",
            padding: label ? "0.8cqw 2.4cqw 0.8cqw 0.9cqw" : "0.9cqw 2.6cqw 0.9cqw 1.6cqw",
            background: bg,
            borderRadius: 999,
            border: "1px solid rgba(255, 255, 255, 0.18)",
            backdropFilter: "blur(1cqw) saturate(1.4)",
            WebkitBackdropFilter: "blur(1cqw) saturate(1.4)",
            boxShadow: SHADOW,
          }}
        >
          {label ? labelTag("999px") : pulseDot(accent)}
          {renderText("left", "56cqw")}
        </div>
      </div>
    );
  }

  if (template === "glass") {
    return (
      <div style={slot}>
        <div
          style={{
            ...box,
            position: "relative",
            overflow: "hidden",
            maxWidth: "62cqw",
            padding: align === "right" ? "1.3cqw 2.8cqw 1.3cqw 2.2cqw" : "1.3cqw 2.2cqw 1.3cqw 2.8cqw",
            background: bg,
            borderRadius: "1.1cqw",
            border: "1px solid rgba(255, 255, 255, 0.22)",
            backdropFilter: "blur(1.4cqw) saturate(1.6)",
            WebkitBackdropFilter: "blur(1.4cqw) saturate(1.6)",
            boxShadow: SHADOW,
            textAlign: align,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              [align === "right" ? "right" : "left"]: 0,
              width: "0.45cqw",
              background: accent,
              transformOrigin: "top",
              animation: growAnimation("Y"),
            }}
          />
          {label && (
            <div
              style={{
                color: accent,
                fontSize: `${fs * 0.55}cqw`,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                marginBottom: "0.4cqw",
                animation: textAnimation,
              }}
            >
              {label}
            </div>
          )}
          {renderText(align, "50cqw")}
        </div>
      </div>
    );
  }

  // bar (Barra clásica): franja completa pegada al borde
  return (
    <div style={slot}>
      <div
        style={{
          ...box,
          position: "relative",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: !label && !isTicker ? "center" : "flex-start",
          gap: "1.6cqw",
          padding: `1.2cqw ${SAFE_X}cqw`,
          background: bg,
          boxShadow: SHADOW,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            [isTop ? "bottom" : "top"]: 0,
            height: "0.25cqw",
            background: accent,
            transformOrigin: "left",
            animation: growAnimation("X"),
          }}
        />
        {labelTag("0.3cqw")}
        {renderText(label ? "left" : "center")}
      </div>
    </div>
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
