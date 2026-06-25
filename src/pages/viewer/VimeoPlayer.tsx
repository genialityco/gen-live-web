// src/pages/viewer/VimeoPlayer.tsx
// Reproductor Vimeo embebido instrumentado con el SDK oficial (@vimeo/player).
// El SDK cumple dos funciones:
//  1) Métricas: eventos play/pause/ended para reportar reproducción REAL.
//  2) Autoplay robusto: los navegadores (sobre todo en MÓVIL) bloquean el
//     autoplay CON SONIDO. Intentamos arrancar con sonido y, si se bloquea,
//     reintentamos en silencio y mostramos un botón para activar el sonido con
//     un toque (gesto del usuario). Así el video nunca se queda "en pausa".
import { useEffect, useMemo, useRef, useState } from "react";
import Player from "@vimeo/player";

type Props = {
  /** URL embed de Vimeo (player.vimeo.com/video/ID). */
  src: string;
  /** Notifica cuándo el video está realmente reproduciéndose (métricas reales). */
  onPlayingChange?: (playing: boolean) => void;
  title?: string;
};

/**
 * iOS (iPhone/iPad) es el navegador más estricto: el autoplay SOLO funciona en
 * silencio y debe gestionarlo el propio player de Vimeo (muted=1 en la URL); un
 * play() programático desde el iframe padre no cuenta como gesto de usuario.
 * iPadOS se reporta como "MacIntel" con pantalla táctil.
 */
function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS = /iP(hone|od|ad)/.test(ua);
  const iPadOS =
    navigator.platform === "MacIntel" &&
    (navigator as any).maxTouchPoints > 1;
  return iOS || iPadOS;
}

/** Asegura los parámetros de autoplay/inline (y muted en iOS) en la URL embed. */
function ensureAutoplayParams(src: string, forceMuted: boolean): string {
  try {
    const u = new URL(src);
    u.searchParams.set("autoplay", "1");
    u.searchParams.set("playsinline", "1");
    if (forceMuted) u.searchParams.set("muted", "1");
    return u.toString();
  } catch {
    const sep = src.includes("?") ? "&" : "?";
    return `${src}${sep}autoplay=1&playsinline=1${forceMuted ? "&muted=1" : ""}`;
  }
}

export function VimeoPlayer({ src, onPlayingChange, title }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onPlayingChangeRef = useRef(onPlayingChange);
  onPlayingChangeRef.current = onPlayingChange;
  const playerRef = useRef<Player | null>(null);

  // Si arrancamos en silencio (autoplay bloqueado con sonido), ofrecemos un
  // botón para activarlo. Se oculta cuando el usuario ya tiene sonido.
  const [mutedAutoplay, setMutedAutoplay] = useState(false);

  // En iOS forzamos el arranque en silencio vía URL (única vía permitida);
  // en el resto intentamos con sonido y caemos a silencio si se bloquea.
  const forceMuted = useMemo(() => isIosLike(), []);
  const embedSrc = useMemo(
    () => ensureAutoplayParams(src, forceMuted),
    [src, forceMuted],
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const setPlaying = (p: boolean) => onPlayingChangeRef.current?.(p);

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    // bufferstart/bufferend: durante el buffering no está "reproduciendo".
    const onBufferStart = () => setPlaying(false);
    const onBufferEnd = () => setPlaying(true);
    // Si el usuario reactiva el sonido por los controles de Vimeo, ocultamos
    // nuestro botón. Consultamos el estado real de "muted" (no solo el volumen,
    // que puede ser >0 mientras sigue silenciado).
    const onVolumeChange = () => {
      playerRef.current
        ?.getMuted()
        .then((m) => {
          if (!m) setMutedAutoplay(false);
        })
        .catch(() => {});
    };

    // El SDK es best-effort: si falla (URL inválida, ad-blocker, fallo de red al
    // cargar player.js), el <iframe> sigue funcionando; solo perdemos métricas
    // y el arranque automático asistido. Nunca debe romper el visor.
    let player: Player | null = null;
    try {
      player = new Player(iframe);
      playerRef.current = player;
      player.on("play", onPlay);
      player.on("playing", onPlay);
      player.on("pause", onPause);
      player.on("ended", onEnded);
      player.on("bufferstart", onBufferStart);
      player.on("bufferend", onBufferEnd);
      player.on("volumechange", onVolumeChange);

      // Arranque automático.
      if (forceMuted) {
        // iOS: ya arranca en silencio por la URL (muted=1). Aseguramos el play
        // y mostramos el botón de sonido para que el usuario lo active al tocar.
        setMutedAutoplay(true);
        player.play().catch(() => {});
      } else {
        // Resto: primero con sonido; si el navegador lo bloquea, reintenta en
        // silencio y muestra el botón de sonido.
        player.play().catch(() => {
          player
            ?.setMuted(true)
            .then(() => player!.play())
            .then(() => setMutedAutoplay(true))
            .catch(() => {});
        });
      }
    } catch {
      player = null;
    }

    return () => {
      setPlaying(false);
      playerRef.current = null;
      if (!player) return;
      try {
        player.off("play", onPlay);
        player.off("playing", onPlay);
        player.off("pause", onPause);
        player.off("ended", onEnded);
        player.off("bufferstart", onBufferStart);
        player.off("bufferend", onBufferEnd);
        player.off("volumechange", onVolumeChange);
        // No destruimos el player (destruiría el iframe que React controla);
        // basta con soltar los listeners.
      } catch {
        /* empty */
      }
    };
  }, [embedSrc, forceMuted]);

  const enableSound = () => {
    const p = playerRef.current;
    if (!p) return;
    p.setMuted(false)
      .then(() => p.play())
      .catch(() => {});
    setMutedAutoplay(false);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <iframe
        ref={iframeRef}
        src={embedSrc}
        title={title || "Reproductor de video"}
        style={{ width: "100%", height: "100%", border: 0 }}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />

      {mutedAutoplay && (
        <button
          onClick={enableSound}
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 5,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 999,
            border: "none",
            background: "rgba(0,0,0,0.85)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
          }}
        >
          🔊 Toca para activar el sonido
        </button>
      )}
    </div>
  );
}
