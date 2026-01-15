/* eslint-disable @typescript-eslint/no-explicit-any */
// src/viewer/ViewerHlsPlayer.tsx
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type Props = {
  src: string;
  targetLatencySec?: number; // 2–4 recomendado
  maxBehindSec?: number; // si estás más atrás que esto, saltas al vivo
  showGoLiveButton?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Throttle simple sin dependencias
function throttle<T extends (...args: any[]) => void>(fn: T, waitMs: number) {
  let last = 0;
  let t: any = null;
  let lastArgs: any[] | null = null;

  return (...args: any[]) => {
    const now = Date.now();
    const remaining = waitMs - (now - last);
    lastArgs = args;

    if (remaining <= 0) {
      last = now;
      fn(...args);
      return;
    }

    if (!t) {
      t = setTimeout(() => {
        t = null;
        last = Date.now();
        if (lastArgs) fn(...(lastArgs as any[]));
        lastArgs = null;
      }, remaining);
    }
  };
}

export function ViewerHlsPlayer({
  src,
  targetLatencySec = 3,
  maxBehindSec = 6,
  showGoLiveButton = true,
}: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [behindLiveSec, setBehindLiveSec] = useState<number>(0);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    let userInteracting = false;
    const onSeeking = () => (userInteracting = true);
    const onSeeked = () => setTimeout(() => (userInteracting = false), 900);

    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);

    // ---- Safari / iOS nativo (sin hls.js) ----
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;

      const snapSafari = throttle(() => {
        if (userInteracting) return;

        // En Safari, live edge ~ duration (creciente)
        const d = video.duration;
        if (!Number.isFinite(d) || d <= 0) return;

        const current = video.currentTime;
        const liveEdge = d; // aproximación práctica
        const target = Math.max(liveEdge - targetLatencySec, 0);
        const behind = Math.max(liveEdge - current, 0);

        setBehindLiveSec(behind);

        // solo auto-snap si está reproduciendo y se quedó atrás
        if (!video.paused && behind > maxBehindSec) {
          video.currentTime = target;
        }
      }, 900);

      const onTimeUpdate = () => snapSafari();
      const onDurationChange = () => snapSafari();

      video.addEventListener("timeupdate", onTimeUpdate);
      video.addEventListener("durationchange", onDurationChange);
      video.addEventListener("loadedmetadata", onDurationChange);

      video.play().catch(() => {});

      return () => {
        video.removeEventListener("timeupdate", onTimeUpdate);
        video.removeEventListener("durationchange", onDurationChange);
        video.removeEventListener("loadedmetadata", onDurationChange);
        video.removeEventListener("seeking", onSeeking);
        video.removeEventListener("seeked", onSeeked);
      };
    }

    // ---- hls.js ----
    if (!Hls.isSupported()) return;

    // Limpia previo si existía
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch { /* empty */ }
      hlsRef.current = null;
    }

    const hls = new Hls({
      lowLatencyMode: true,
      liveDurationInfinity: true,

      startPosition: -1,

      // objetivo de latencia y snapping
      liveSyncDuration: targetLatencySec,
      liveMaxLatencyDuration: targetLatencySec + maxBehindSec,

      // permite acelerar un poco para ponerse al día sin saltos bruscos
      maxLiveSyncPlaybackRate: 1.5,

      // buffers más bajos => menor delay (pero más sensible a red mala)
      backBufferLength: 5,
      maxBufferLength: 6,

      enableWorker: true,
    });

    hlsRef.current = hls;
    setIsRecovering(false);

    hls.loadSource(src);
    hls.attachMedia(video);

    const tryPlay = () => video.play().catch(() => {});
    hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);

    const computeAndMaybeSnap = throttle(() => {
      if (userInteracting) return;

      // liveSyncPosition es la mejor referencia para live edge en hls.js
      const livePos = (hls as any).liveSyncPosition;
      if (typeof livePos !== "number") return;

      const current = video.currentTime;
      const behind = Math.max(livePos - current, 0);
      setBehindLiveSec(behind);

      if (!video.paused && behind > maxBehindSec) {
        const target = Math.max(livePos - targetLatencySec, 0);
        // evita micro saltos si ya estás cerca
        if (Math.abs(video.currentTime - target) > 0.25) {
          video.currentTime = target;
        }
      }
    }, 700);

    // cuando se refresca playlist / avanza el live edge
    hls.on(Hls.Events.LEVEL_UPDATED, computeAndMaybeSnap);
    hls.on(Hls.Events.FRAG_BUFFERED, computeAndMaybeSnap);

    // Recovery robusto
    const onError = (_: any, data: any) => {
      if (!data?.fatal) return;

      setIsRecovering(true);

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        // reintenta red
        try {
          hls.startLoad();
        } catch { /* empty */ }
        return;
      }

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        // repara media error
        try {
          hls.recoverMediaError();
        } catch { /* empty */ }
        return;
      }

      // fatal desconocido => recreate
      try {
        hls.destroy();
      } catch { /* empty */ }
      hlsRef.current = null;
    };

    hls.on(Hls.Events.ERROR, onError);

    return () => {
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
      hls.off(Hls.Events.LEVEL_UPDATED, computeAndMaybeSnap);
      hls.off(Hls.Events.FRAG_BUFFERED, computeAndMaybeSnap);
      hls.off(Hls.Events.ERROR, onError);
      try {
        hls.destroy();
      } catch { /* empty */ }
      hlsRef.current = null;
    };
  }, [src, targetLatencySec, maxBehindSec]);

  const goLive = () => {
    const video = ref.current;
    const hls = hlsRef.current;
    if (!video) return;

    // Prioridad: liveSyncPosition (hls.js), fallback: duration
    const livePos =
      (hls as any)?.liveSyncPosition ??
      (Number.isFinite(video.duration) ? video.duration : null);

    if (typeof livePos === "number") {
      const target = Math.max(livePos - targetLatencySec, 0);
      video.currentTime = clamp(
        target,
        0,
        Number.isFinite(video.duration) ? video.duration : target
      );
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
              background: isRecovering
                ? "rgba(13,110,253,0.95)"
                : isBehind
                ? "rgba(255,193,7,0.95)"
                : "rgba(220,53,69,0.95)",
              color: "#111",
              fontWeight: 700,
            }}
            title={
              isRecovering
                ? "Reconectando…"
                : isBehind
                ? `Atrasado ~${Math.round(behindLiveSec)}s`
                : "En vivo"
            }
          >
            {isRecovering
              ? "RECONectando…"
              : isBehind
              ? `ATRASADO ~${Math.round(behindLiveSec)}s`
              : "EN VIVO"}
          </div>

          {isBehind && !isRecovering && (
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
