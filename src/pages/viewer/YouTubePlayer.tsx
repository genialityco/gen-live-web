// src/pages/viewer/YouTubePlayer.tsx
// Reproductor YouTube embebido instrumentado con la IFrame Player API oficial.
// Equivalente a VimeoPlayer: reporta reproducción REAL (onStateChange) para que
// las métricas de asistencia en vivo / diferido cuenten a quien ve por YouTube.
// Un iframe crudo de YouTube es cross-origin y no permite saber si el video
// está sonando, por eso antes estas sesiones quedaban con reproducción 0.
import { useEffect, useMemo, useRef } from "react";
import { buildYouTubeEmbedUrl } from "../../utils/youtube";

type Props = {
  /** URL de YouTube (embed, watch, youtu.be, shorts o live). */
  src: string;
  /** Notifica cuándo el video está realmente reproduciéndose (métricas reales). */
  onPlayingChange?: (playing: boolean) => void;
  /** Notifica un error del reproductor (video privado, eliminado, embed bloqueado…). */
  onError?: () => void;
  title?: string;
};

// Tipos mínimos de la IFrame Player API (evita depender de @types/youtube).
type YTPlayer = { getPlayerState?: () => number };
type YTNamespace = {
  Player: new (
    el: HTMLIFrameElement,
    opts: {
      events: {
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_STATE_PLAYING = 1;

// Carga única del script de la API (compartida entre instancias).
let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YT API no disponible"));
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      // Permite reintentar en un próximo montaje (ad-blocker, red caída…).
      apiPromise = null;
      reject(new Error("No se pudo cargar la API de YouTube"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export function YouTubePlayer({ src, onPlayingChange, onError, title }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onPlayingChangeRef = useRef(onPlayingChange);
  onPlayingChangeRef.current = onPlayingChange;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const embedSrc = useMemo(() => buildYouTubeEmbedUrl(src), [src]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let disposed = false;
    let lastPlaying = false;
    const setPlaying = (p: boolean) => {
      if (disposed || p === lastPlaying) return;
      lastPlaying = p;
      onPlayingChangeRef.current?.(p);
    };

    // La API es best-effort: si no carga, el iframe sigue funcionando y solo
    // se pierde la métrica de reproducción. Nunca debe romper el visor.
    loadYouTubeApi()
      .then((YT) => {
        if (disposed) return;
        new YT.Player(iframe, {
          events: {
            // 1 = reproduciendo; pausa, fin, buffering, cue y sin iniciar = no.
            onStateChange: (e) => setPlaying(e.data === YT_STATE_PLAYING),
            // 2/5/100/101/150: ID inválido, error HTML5, no existe o embed bloqueado.
            onError: () => {
              setPlaying(false);
              if (!disposed) onErrorRef.current?.();
            },
          },
        });
      })
      .catch(() => {
        /* sin métricas, el video sigue visible */
      });

    return () => {
      // No llamamos destroy(): eliminaría el iframe que controla React.
      // El iframe se remonta con key={embedSrc} si cambia la fuente.
      if (lastPlaying) onPlayingChangeRef.current?.(false);
      disposed = true;
    };
  }, [embedSrc]);

  return (
    <iframe
      key={embedSrc}
      ref={iframeRef}
      src={embedSrc}
      title={title || "Reproductor de video"}
      style={{ width: "100%", height: "100%", border: 0 }}
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
    />
  );
}
