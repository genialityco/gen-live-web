// src/viewer/ViewerHlsPlayer.tsx
import { useEffect, useRef } from "react";
import Hls from "hls.js";

export function ViewerHlsPlayer({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // Safari / iOS
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    // Chrome/Edge/Firefox
    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        maxLiveSyncPlaybackRate: 1.5,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      return () => hls.destroy();
    }
  }, [src]);

  return (
    <video
      ref={ref}
      controls
      autoPlay
      playsInline
      muted
      style={{ width: "100%", borderRadius: 12, background: "#000" }}
    />
  );
}
