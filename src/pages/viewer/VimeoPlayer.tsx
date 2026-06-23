// src/pages/viewer/VimeoPlayer.tsx
// Reproductor Vimeo embebido instrumentado con el SDK oficial (@vimeo/player).
// A diferencia de un <iframe> crudo (cross-origin, imposible de medir), el SDK
// nos da eventos play/pause/ended para reportar tiempo de reproducción REAL.
import { useEffect, useRef } from "react";
import Player from "@vimeo/player";

type Props = {
  /** URL embed de Vimeo (player.vimeo.com/video/ID). */
  src: string;
  /** Notifica cuándo el video está realmente reproduciéndose (métricas reales). */
  onPlayingChange?: (playing: boolean) => void;
  title?: string;
};

export function VimeoPlayer({ src, onPlayingChange, title }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onPlayingChangeRef = useRef(onPlayingChange);
  onPlayingChangeRef.current = onPlayingChange;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // El SDK se engancha al iframe existente (su src ya es un player de Vimeo).
    const player = new Player(iframe);
    const setPlaying = (p: boolean) => onPlayingChangeRef.current?.(p);

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    // bufferstart/bufferend: durante el buffering no está "reproduciendo".
    const onBufferStart = () => setPlaying(false);
    const onBufferEnd = () => setPlaying(true);

    player.on("play", onPlay);
    player.on("playing", onPlay);
    player.on("pause", onPause);
    player.on("ended", onEnded);
    player.on("bufferstart", onBufferStart);
    player.on("bufferend", onBufferEnd);

    return () => {
      setPlaying(false);
      try {
        player.off("play", onPlay);
        player.off("playing", onPlay);
        player.off("pause", onPause);
        player.off("ended", onEnded);
        player.off("bufferstart", onBufferStart);
        player.off("bufferend", onBufferEnd);
        // No destruimos el player (destruiría el iframe que React controla);
        // basta con soltar los listeners.
      } catch {
        /* empty */
      }
    };
  }, [src]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title={title || "Reproductor de video"}
      style={{ width: "100%", height: "100%", border: 0 }}
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
    />
  );
}
