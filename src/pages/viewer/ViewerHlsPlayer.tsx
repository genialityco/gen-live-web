/* eslint-disable @typescript-eslint/no-explicit-any */
// src/viewer/ViewerHlsPlayer.tsx
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type Props = {
  src: string;
  targetLatencySec?: number;   // 2–4 recomendado
  maxBehindSec?: number;       // si estás más atrás que esto, saltas al vivo
  showGoLiveButton?: boolean;
};

export function ViewerHlsPlayer({
  src,
  targetLatencySec = 3,
  maxBehindSec = 6,
  showGoLiveButton = true,
}: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [behindLiveSec, setBehindLiveSec] = useState<number>(0);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    let userInteracting = false;
    const onSeeking = () => (userInteracting = true);
    const onSeeked = () => setTimeout(() => (userInteracting = false), 1200);

    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);

    // Safari / iOS nativo
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;

      // “Ir al vivo” en Safari: currentTime = duration funciona cuando duration crece.
      const snapSafari = () => {
        if (userInteracting) return;
        const d = video.duration;
        if (!Number.isFinite(d) || d <= 0) return;
        const target = Math.max(d - targetLatencySec, 0);
        const behind = Math.max(d - video.currentTime, 0);
        setBehindLiveSec(behind);

        if (!video.paused && behind > maxBehindSec) {
          video.currentTime = target;
        }
      };

      const id = window.setInterval(snapSafari, 1500);
      video.play().catch(() => {});
      return () => {
        window.clearInterval(id);
        video.removeEventListener("seeking", onSeeking);
        video.removeEventListener("seeked", onSeeked);
      };
    }

    if (!Hls.isSupported()) return;

    const hls = new Hls({
      lowLatencyMode: true,

      // ✅ clave: arrancar en LIVE
      startPosition: -1,

      // ✅ target cerca del vivo
      liveSyncDuration: targetLatencySec,
      liveMaxLatencyDuration: targetLatencySec + maxBehindSec,

      maxLiveSyncPlaybackRate: 1.5,
      backBufferLength: 30,
      enableWorker: true,
    });

    hlsRef.current = hls;
    hls.loadSource(src);
    hls.attachMedia(video);

    const tryPlay = () => video.play().catch(() => {});
    hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);

    const computeAndMaybeSnap = (_: any, data: any) => {
      if (userInteracting) return;

      const details = data?.details;
      if (!details?.live) return;

      const edge = details.edge; // live edge en segundos (timeline del stream)
      if (typeof edge !== "number") return;

      const target = Math.max(edge - targetLatencySec, 0);
      const behind = Math.max(edge - video.currentTime, 0);
      setBehindLiveSec(behind);

      // ✅ si está reproduciendo y quedó muy atrás => saltar automáticamente
      if (!video.paused && behind > maxBehindSec) {
        video.currentTime = target;
      }
    };

    // cuando se refresca playlist
    hls.on(Hls.Events.LEVEL_UPDATED, computeAndMaybeSnap);

    return () => {
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
      hls.off(Hls.Events.LEVEL_UPDATED, computeAndMaybeSnap);
      hls.destroy();
      hlsRef.current = null;
    };
  }, [src, targetLatencySec, maxBehindSec]);

  const goLive = () => {
    const video = ref.current;
    const hls = hlsRef.current;
    if (!video) return;

    // hls.js: si existe liveSyncPosition úsala, si no cae a duration
    const livePos =
      (hls as any)?.liveSyncPosition ??
      (Number.isFinite(video.duration) ? video.duration : null);

    if (typeof livePos === "number") {
      video.currentTime = Math.max(livePos - targetLatencySec, 0);
      video.play().catch(() => {});
    }
  };

  const isBehind = behindLiveSec > maxBehindSec;

  return (
    <div style={{ position: "relative" }}>
      <video
        ref={ref}
        controls
        autoPlay
        playsInline
        muted
        style={{ width: "100%", borderRadius: 12, background: "#000" }}
      />

      {showGoLiveButton && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            display: "flex",
            gap: 8,
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 12,
              background: isBehind ? "rgba(255,193,7,0.95)" : "rgba(220,53,69,0.95)",
              color: "#111",
              fontWeight: 700,
            }}
            title={
              isBehind
                ? `Atrasado ~${Math.round(behindLiveSec)}s`
                : "En vivo"
            }
          >
            {isBehind ? `ATRASADO ~${Math.round(behindLiveSec)}s` : "EN VIVO"}
          </div>

          {isBehind && (
            <button
              onClick={goLive}
              style={{
                pointerEvents: "auto",
                padding: "6px 10px",
                borderRadius: 999,
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                background: "white",
                cursor: "pointer",
              }}
            >
              Ir al vivo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
