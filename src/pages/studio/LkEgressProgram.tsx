// src/pages/studio/LkEgressProgram.tsx
import { useMemo, useEffect, useState } from "react";
import {
  LiveKitRoom,
  GridLayout,
  FocusLayout,
  ParticipantTile,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useStage } from "../../hooks/useStage"; // ajusta tu path real
import { getLiveConfig } from "../../api/livekit-service";

const qp = (k: string) =>
  new URLSearchParams(window.location.search).get(k) || "";

function ProgramCanvas({
  eventSlug,
  layout,
}: {
  eventSlug: string;
  layout: "speaker" | "grid";
}) {
  console.log("🎨 ProgramCanvas RENDERING - eventSlug:", eventSlug, "layout:", layout);
  
  const stage = useStage(eventSlug);
  const [showFrame, setShowFrame] = useState(false);
  const [frameUrl, setFrameUrl] = useState("");
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [initialConfigLoaded, setInitialConfigLoaded] = useState(false);

  useEffect(() => {
    console.log("🎭 Stage state updated:", stage);
  }, [stage]);

  // Poll config every 1.5s
  useEffect(() => {
    let alive = true;

    const poll = async () => {
      try {
        const cfg = await getLiveConfig(eventSlug);
        if (!alive) return;
        
        console.log("🎬 LkEgressProgram config:", {
          showFrame: cfg.showFrame,
          frameUrl: cfg.frameUrl,
          currentFrameUrl: frameUrl,
          frameLoaded,
        });
        
        setShowFrame(!!cfg.showFrame);
        
        // Pre-load image when URL changes
        const newUrl = cfg.frameUrl || "";
        if (newUrl !== frameUrl && newUrl) {
          console.log("🖼️ Loading new frame:", newUrl);
          setFrameLoaded(false);
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            if (!alive) return;
            console.log("✅ Frame loaded successfully:", newUrl);
            setFrameUrl(newUrl);
            setFrameLoaded(true);
            setInitialConfigLoaded(true);
          };
          img.onerror = (e) => {
            console.error("❌ Failed to load frame image:", newUrl, e);
            if (!alive) return;
            setFrameUrl(newUrl);
            setFrameLoaded(true);
            setInitialConfigLoaded(true);
          };
          img.src = newUrl;
        } else if (!newUrl) {
          setFrameUrl("");
          setFrameLoaded(false);
          setInitialConfigLoaded(true);
        } else {
          setInitialConfigLoaded(true);
        }
      } catch (err) {
        console.error("❌ Error polling config:", err);
        setInitialConfigLoaded(true);
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), 1500);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [eventSlug, frameUrl, frameLoaded]);

  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: true },
    ],
    { onlySubscribed: false }
  );

  const stageTracks = useMemo(() => {
    console.log("🎥 LkEgress - All tracks:", tracks.length, tracks.map(t => ({
      identity: t.participant?.identity,
      source: t.source
    })));
    console.log("🎭 LkEgress - Stage state:", stage.onStage);
    
    const filtered = tracks.filter((t) => {
      const uid = t.participant?.identity;
      return uid ? !!stage.onStage[uid] : false;
    });
    
    console.log("✅ LkEgress - Stage tracks:", filtered.length, filtered.map(t => ({
      identity: t.participant?.identity,
      source: t.source
    })));
    
    return filtered;
  }, [tracks, stage.onStage]);

  const pinned = useMemo(() => {
    const uid = stage.activeUid;
    if (!uid) return null;

    const ss = tracks.find(
      (t) =>
        t.participant?.identity === uid && t.source === Track.Source.ScreenShare
    );
    const cam = tracks.find(
      (t) => t.participant?.identity === uid && t.source === Track.Source.Camera
    );
    return ss ?? cam ?? null;
  }, [tracks, stage.activeUid]);

  const fallback = useMemo(() => {
    const ss = stageTracks.find((t) => t.source === Track.Source.ScreenShare);
    const cam = stageTracks.find((t) => t.source === Track.Source.Camera);
    return ss ?? cam ?? null;
  }, [stageTracks]);

  const focus = pinned ?? fallback;

  useEffect(() => {
    console.log("🎯 Render state:", {
      initialConfigLoaded,
      stageTracks: stageTracks.length,
      showFrame,
      frameLoaded,
      layout
    });
  }, [initialConfigLoaded, stageTracks.length, showFrame, frameLoaded, layout]);

  // Don't render until initial config is loaded
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
      {/* VIDEO */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        {layout === "grid" ? (
          <GridLayout tracks={stageTracks}>
            <ParticipantTile />
          </GridLayout>
        ) : focus ? (
          <FocusLayout trackRef={focus}>
            <ParticipantTile trackRef={focus} />
          </FocusLayout>
        ) : (
          <div
            style={{
              height: "100%",
              display: "grid",
              placeItems: "center",
              color: "#999",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            Nadie en escena
          </div>
        )}
      </div>

      {/* MARCO */}
      {showFrame && frameUrl && frameLoaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            pointerEvents: "none",
            border: "4px solid lime", // DEBUG: Visual confirmation
            boxShadow: "inset 0 0 20px rgba(0, 255, 0, 0.5)", // DEBUG: Inner glow
          }}
        >
          <img
            src={frameUrl}
            alt="Marco"
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
      
      {/* DEBUG indicator - remove later */}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 10,
          background: "rgba(0,0,0,0.9)",
          color: "white",
          padding: "12px 16px",
          borderRadius: 8,
          fontSize: 14,
          zIndex: 30,
          fontFamily: "monospace",
          border: "2px solid " + (showFrame && frameUrl && frameLoaded ? "#00ff00" : "#ff0000"),
        }}
      >
        <div>🎬 <strong>LkEgressProgram Debug</strong></div>
        <div>Frame: {showFrame ? "✅ ON" : "❌ OFF"}</div>
        <div>URL: {frameUrl ? `✅ ${frameUrl.slice(-20)}` : "❌ NO"}</div>
        <div>Loaded: {frameLoaded ? "✅ YES" : "⏳ LOADING"}</div>
        <div>Config: {initialConfigLoaded ? "✅ READY" : "⏳ PENDING"}</div>
        <div>Tracks: {stageTracks.length} on stage</div>
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
          {new Date().toLocaleTimeString()}
        </div>
      </div>
      
      {/* Signal to LiveKit Egress that page is ready */}
      {initialConfigLoaded && (
        <div 
          id="egress-ready" 
          data-ready="true"
          style={{ display: "none" }}
        />
      )}
    </div>
  );
}

export default function LkEgressProgram() {
  const serverUrl = qp("url");
  const token = qp("token");
  const eventSlug = qp("eventSlug");
  const layout = (qp("layout") || "speaker") as "speaker" | "grid";

  console.log("🚀 LkEgressProgram INIT", { serverUrl, token: token?.slice(0, 20) + "...", eventSlug, layout });

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
      video={false}  // Egress NO publica video
      audio={false}  // Egress NO publica audio (solo se suscribe)
      onConnected={() => console.log("🔗 LiveKit CONNECTED")}
      onDisconnected={() => console.log("❌ LiveKit DISCONNECTED")}
      onError={(error) => console.error("❌ LiveKit ERROR:", error)}
    >
      <ProgramCanvas eventSlug={eventSlug} layout={layout} />
    </LiveKitRoom>
  );
}
