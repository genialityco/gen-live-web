// src/pages/viewer/VodHlsPlayer.tsx
// Reproductor HLS para contenido VOD (Video On Demand) / Repeticiones
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type Props = {
  src: string;
  poster?: string;
  autoPlay?: boolean;
};

/**
 * Reproductor HLS simple para VOD (repeticiones).
 * A diferencia de ViewerHlsPlayer, no tiene lógica de live-sync ni latencia.
 */
export function VodHlsPlayer({ src, poster, autoPlay = true }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    setError(null);

    // Safari / iOS nativo (sin hls.js)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      if (autoPlay) {
        video.play().catch(() => {});
      }

      return () => {
        video.src = "";
      };
    }

    // hls.js para otros navegadores
    if (!Hls.isSupported()) {
      setError("Tu navegador no soporta reproducción de video HLS");
      return;
    }

    // Limpia previo si existía
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {
        /* empty */
      }
      hlsRef.current = null;
    }

    const hls = new Hls({
      enableWorker: true,
      // Configuración para VOD (no necesita low latency)
      lowLatencyMode: false,
      // Buffer más amplio para reproducción fluida
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
    });

    hlsRef.current = hls;

    hls.loadSource(src);
    hls.attachMedia(video);

    const tryPlay = () => {
      if (autoPlay) {
        video.play().catch(() => {});
      }
    };

    hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);

    // Manejo de errores
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data?.fatal) return;

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        // Reintenta en errores de red
        try {
          hls.startLoad();
        } catch {
          /* empty */
        }
        return;
      }

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        // Repara errores de media
        try {
          hls.recoverMediaError();
        } catch {
          /* empty */
        }
        return;
      }

      // Error fatal desconocido
      setError("Error al cargar el video");
    });

    return () => {
      try {
        hls.destroy();
      } catch {
        /* empty */
      }
      hlsRef.current = null;
    };
  }, [src, autoPlay]);

  if (error) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
          borderRadius: 12,
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 14 }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <video
      ref={ref}
      controls
      autoPlay={autoPlay}
      playsInline
      poster={poster}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 12,
        background: "#000",
        objectFit: "contain",
      }}
    />
  );
}
