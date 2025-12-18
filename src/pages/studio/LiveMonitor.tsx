// src/components/live/LiveMonitor.tsx
import { useMemo } from "react";
import { Box, Badge, Center, Text } from "@mantine/core";
import {
  FocusLayout,
  GridLayout,
  ParticipantTile,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import type { StageState } from "../../hooks/useStage";

type Props = {
  showFrame: boolean;
  stage: StageState;
};

export function LiveMonitor({ showFrame, stage }: Props) {
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: true },
    ],
    { onlySubscribed: false }
  );

  // Solo los que están en "escena" para el programa
  const stageTracks = useMemo(() => {
    return tracks.filter((t) => {
      const uid = t.participant?.identity;
      if (!uid) return false;
      return !!stage.onStage[uid];
    });
  }, [tracks, stage.onStage]);

  // Track pineado (prioriza screenshare del uid)
  const pinnedTrack = useMemo(() => {
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

  // Fallback: si no hay pin, usa el primer onStage (prioriza screenshare)
  const fallbackSpeaker = useMemo(() => {
    const ss = stageTracks.find((t) => t.source === Track.Source.ScreenShare);
    const cam = stageTracks.find((t) => t.source === Track.Source.Camera);
    return ss ?? cam ?? null;
  }, [stageTracks]);

  const effectiveMode = stage.programMode ?? "speaker";
  const focus = pinnedTrack ?? fallbackSpeaker;

  return (
    <Box
      style={{
        width: "100%",
        aspectRatio: "16 / 9",
        minHeight: 320,
        height: "100%",
        background: "#000",
        overflow: "hidden",
        borderRadius: 12,
        position: "relative",
      }}
    >
      {/* MARCO */}
      {showFrame && (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            pointerEvents: "none",
          }}
        >
          <img
            src="/cortinilla-marco.png"
            alt="Marco"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <Badge
            color="red"
            size="md"
            style={{ position: "absolute", top: 16, left: 16 }}
          >
            EN VIVO
          </Badge>
        </Box>
      )}

      {/* VIDEO */}
      <Box style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        {effectiveMode === "grid" ? (
          <GridLayout tracks={stageTracks}>
            <ParticipantTile />
          </GridLayout>
        ) : focus ? (
          <FocusLayout trackRef={focus}>
            <ParticipantTile trackRef={focus} />
          </FocusLayout>
        ) : (
          <Center h="100%">
            <Text c="dimmed">Nadie en escena</Text>
          </Center>
        )}
      </Box>
    </Box>
  );
}
