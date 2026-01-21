/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/studio/LkEgressProgram.tsx
import { useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { LiveMonitor } from "./LiveMonitor";
import { useStage } from "../../hooks/useStage"; // ajusta tu path real
import { getEffectiveMediaConfig } from "../../api/media-library-service";

const qp = (k: string) =>
  new URLSearchParams(window.location.search).get(k) || "";

function ProgramCanvas({ eventSlug }: { eventSlug: string }) {
  const stage = useStage(eventSlug);

  const [showFrame, setShowFrame] = useState(false);
  const [frameUrl, setFrameUrl] = useState("");
  const [frameLoaded, setFrameLoaded] = useState(false);

  // media
  const [mediaEnabled, setMediaEnabled] = useState(false);
  
  // Visual layer
  const [visualUrl, setVisualUrl] = useState("");
  const [visualType, setVisualType] = useState<"image" | "gif" | "video">("image");
  const [visualMode, setVisualMode] = useState<"overlay" | "full">("overlay");
  const [visualLoop, setVisualLoop] = useState(false);
  const [visualMuted, setVisualMuted] = useState(true);
  const [visualFit, setVisualFit] = useState<"cover" | "contain">("cover");
  const [visualOpacity, setVisualOpacity] = useState(1);
  
  // Audio layer
  const [audioUrl, setAudioUrl] = useState("");
  const [audioLoop, setAudioLoop] = useState(false);
  const [audioMuted, setAudioMuted] = useState(true);
  
  // Background
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [backgroundType, setBackgroundType] = useState<"image" | "gif" | "video">("image");
  const [backgroundColor, setBackgroundColor] = useState("#000000");
  
  // Legacy
  const [mediaType, setMediaType] = useState<"image" | "gif" | "video" | "audio">(
    "image",
  );
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaMode, setMediaMode] = useState<"overlay" | "full">("overlay");
  const [mediaLoop, setMediaLoop] = useState(false);
  const [mediaMuted, setMediaMuted] = useState(true);
  const [mediaFit, setMediaFit] = useState<"cover" | "contain">("cover");
  const [mediaOpacity, setMediaOpacity] = useState(1);

  const [initialConfigLoaded, setInitialConfigLoaded] = useState(false);

  // Poll config every 1.5s (frame + media)
  useEffect(() => {
    let alive = true;

    async function poll() {
      try {
        // Usamos el endpoint que devuelve config efectiva (merged)
        const effectiveMedia: any = await getEffectiveMediaConfig(eventSlug);
        if (!alive) return;

        // Frame config
        setShowFrame(!!effectiveMedia?.showFrame);
        setFrameUrl(effectiveMedia?.frameUrl || "");

        // Media config
        setMediaEnabled(!!effectiveMedia?.enabled);

        // Visual layer
        if (effectiveMedia?.visual) {
          setVisualUrl(effectiveMedia.visual.item.url || "");
          setVisualType(effectiveMedia.visual.item.type as "image" | "gif" | "video");
          setVisualMode(effectiveMedia.visual.config.mode);
          setVisualLoop(effectiveMedia.visual.config.loop ?? false);
          setVisualMuted(effectiveMedia.visual.config.muted ?? true);
          setVisualFit(effectiveMedia.visual.config.fit);
          setVisualOpacity(
            typeof effectiveMedia.visual.config.opacity === "number"
              ? effectiveMedia.visual.config.opacity
              : 1,
          );
        } else {
          setVisualUrl("");
        }
        
        // Audio layer
        if (effectiveMedia?.audio) {
          setAudioUrl(effectiveMedia.audio.item.url || "");
          setAudioLoop(effectiveMedia.audio.config.loop ?? false);
          setAudioMuted(effectiveMedia.audio.config.muted ?? true);
        } else {
          setAudioUrl("");
        }
        
        // Legacy fallback
        if (effectiveMedia?.item) {
          const item = effectiveMedia.item;
          const config = effectiveMedia.config;

          setMediaType(item.type as any);
          setMediaUrl(item.url || "");
          setMediaMode((config?.mode || "full") as any);
          setMediaLoop(config?.loop ?? false);
          setMediaMuted(config?.muted ?? true);
          setMediaFit((config?.fit || "cover") as any);
          setMediaOpacity(
            typeof config?.opacity === "number" ? config.opacity : 1,
          );
        } else if (!effectiveMedia?.visual && !effectiveMedia?.audio) {
          setMediaUrl("");
        }
        
        // Background
        setBackgroundUrl(effectiveMedia?.backgroundUrl || "");
        setBackgroundType(effectiveMedia?.backgroundType || "image");
        setBackgroundColor(effectiveMedia?.backgroundColor || "#000000");

        setInitialConfigLoaded(true);
      } catch {
        // keep polling
      }

      if (alive) setTimeout(poll, 1500);
    }

    poll();
    return () => {
      alive = false;
    };
  }, [eventSlug]);

  // Track frame image loading (mantén tu lógica)
  useEffect(() => {
    if (!showFrame || !frameUrl) {
      setFrameLoaded(false);
      return;
    }
    setFrameLoaded(false);
    const img = new window.Image();
    img.onload = () => setFrameLoaded(true);
    img.onerror = () => setFrameLoaded(false);
    img.src = frameUrl;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [showFrame, frameUrl]);

  if (!initialConfigLoaded) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 18,
        }}
      >
        Cargando configuración...
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Render audio from all participants in the room */}
      <RoomAudioRenderer />

      <LiveMonitor
        showFrame={showFrame && frameLoaded}
        frameUrl={frameUrl}
        stage={stage}
        layoutMode={stage.layoutMode}
        mediaEnabled={mediaEnabled}
        // Visual layer
        visualUrl={visualUrl}
        visualType={visualType}
        visualMode={visualMode}
        visualLoop={visualLoop}
        visualMuted={visualMuted}
        visualFit={visualFit}
        visualOpacity={visualOpacity}
        // Audio layer
        audioUrl={audioUrl}
        audioLoop={audioLoop}
        audioMuted={audioMuted}
        // Background
        backgroundUrl={backgroundUrl}
        backgroundType={backgroundType}
        backgroundColor={backgroundColor}
        // Legacy
        mediaType={mediaType}
        mediaUrl={mediaUrl}
        mediaMode={mediaMode}
        mediaLoop={mediaLoop}
        mediaMuted={mediaMuted}
        mediaFit={mediaFit}
        mediaOpacity={mediaOpacity}
      />

      {/* Signal to LiveKit Egress that page is ready */}
      {initialConfigLoaded && (
        <div id="egress-ready" data-ready="true" style={{ display: "none" }} />
      )}
    </div>
  );
}

export default function LkEgressProgram() {
  const serverUrl = qp("url");
  const token = qp("token");
  const eventSlug = qp("eventSlug");
  // layout param ya no se usa, el layoutMode se sincroniza en tiempo real desde el backend

  console.log("🚀 LkEgressProgram INIT", {
    serverUrl,
    token: token?.slice(0, 20) + "...",
    eventSlug,
  });

  if (!serverUrl || !token) {
    console.error("❌ Missing serverUrl or token");
    return <div style={{ padding: 24 }}>Missing url/token</div>;
  }
  if (!eventSlug) {
    console.error("❌ Missing eventSlug");
    return <div style={{ padding: 24 }}>Missing eventSlug</div>;
  }

  console.log("✅ Rendering LiveKitRoom...");

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      video={false} // Egress NO publica video
      audio={true} // Egress DEBE suscribirse al audio para transmitirlo
      onConnected={() => {
        console.log("LiveKit CONNECTED");
        console.log("START_RECORDING");
      }}
      onDisconnected={() => console.log("❌ LiveKit DISCONNECTED")}
      onError={(error) => console.error("❌ LiveKit ERROR:", error)}
    >
      <ProgramCanvas eventSlug={eventSlug} />
    </LiveKitRoom>
  );
}
