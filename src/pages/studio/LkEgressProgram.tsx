// src/pages/studio/LkEgressProgram.tsx
import { useEffect, useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import { LiveMonitor } from "./LiveMonitor";
import { useStage } from "../../hooks/useStage"; // ajusta tu path real
import { getLiveConfig } from "../../api/livekit-service";

const qp = (k: string) =>
  new URLSearchParams(window.location.search).get(k) || "";

function ProgramCanvas({ eventSlug }: { eventSlug: string }) {
  const stage = useStage(eventSlug);
  const [showFrame, setShowFrame] = useState(false);
  const [frameUrl, setFrameUrl] = useState("");
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [initialConfigLoaded, setInitialConfigLoaded] = useState(false);

  // Poll config every 1.5s (solo para frame, layout viene de RTDB)
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const config = await getLiveConfig(eventSlug);
        if (!alive) return;
        setShowFrame(!!config?.showFrame);
        setFrameUrl(config?.frameUrl || "");
        setInitialConfigLoaded(true);
      } catch {
        // handle error
      }
      if (alive) setTimeout(poll, 1500);
    }
    poll();
    return () => {
      alive = false;
    };
  }, [eventSlug]);

  // Track frame image loading
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
    <div style={{ width: "100vw", height: "100vh", background: "#000", position: "relative", overflow: "hidden" }}>
      <LiveMonitor
        showFrame={showFrame && frameLoaded}
        frameUrl={frameUrl}
        stage={stage}
        layoutMode={stage.layoutMode}
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
      audio={false} // Egress NO publica audio (solo se suscribe)
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
