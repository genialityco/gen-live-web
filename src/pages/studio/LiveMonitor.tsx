// src/components/live/LiveMonitor.tsx
import { useMemo } from "react";
import { Box, Center, Text } from "@mantine/core";
import {
  FocusLayout,
  GridLayout,
  ParticipantTile,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import type { StageState } from "../../hooks/useStage";

import type { LayoutMode } from "../../types";

type Props = {
  showFrame: boolean;
  frameUrl: string;
  stage: StageState;
  layoutMode: LayoutMode;
};

export function LiveMonitor({ showFrame, frameUrl, stage, layoutMode }: Props) {
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

  const effectiveMode = layoutMode;
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
        position: "relative",
      }}
    >
      {/* MARCO */}
      {showFrame && frameUrl && (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            pointerEvents: "none",
          }}
        >
          <img
            src={frameUrl}
            alt="Marco"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* <Badge
            color="red"
            size="md"
            style={{ position: "absolute", top: 16, left: 16 }}
          >
            EN VIVO
          </Badge> */}
        </Box>
      )}

      {/* VIDEO */}
      <Box style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        {(() => {
          switch (effectiveMode) {
            case "grid":
              return (
                <GridLayout tracks={stageTracks}>
                  <ParticipantTile />
                </GridLayout>
              );
            case "speaker":
              return focus ? (
                <FocusLayout trackRef={focus}>
                  <ParticipantTile trackRef={focus} />
                </FocusLayout>
              ) : (
                <Center h="100%">
                  <Text c="dimmed">Nadie en escena</Text>
                </Center>
              );
            case "presentation":
              // Layout: principal grande, otros en columna, cámaras centradas y proporcionadas
              return focus ? (
                <Box
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "row",
                  }}
                >
                  <Box
                    style={{
                      flex: 3,
                      height: "100%",
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Box
                      style={{
                        width: "100%",
                        maxWidth: "100%",
                        aspectRatio: "16/9",
                        maxHeight: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ParticipantTile
                        trackRef={focus}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                    </Box>
                  </Box>
                  <Box
                    style={{
                      flex: 1,
                      height: "100%",
                      minWidth: 0,
                      background: "#111",
                      display: "flex",
                      flexDirection: "column",
                      gap: 0,
                      padding: 0,
                    }}
                  >
                    {stageTracks
                      .filter((t) => t !== focus)
                      .map((t) => (
                        <Box
                          key={t.participant?.identity}
                          style={{
                            flex: 1,
                            minHeight: 0,
                            minWidth: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Box
                            style={{
                              width: "100%",
                              maxWidth: "100%",
                              aspectRatio: "16/9",
                              maxHeight: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <ParticipantTile
                              trackRef={t}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                              }}
                            />
                          </Box>
                        </Box>
                      ))}
                  </Box>
                </Box>
              ) : (
                <Center h="100%">
                  <Text c="dimmed">Nadie en escena</Text>
                </Center>
              );
            case "pip":
              // Picture-in-Picture: focus grande centrado, los demás pequeños en esquina
              return focus ? (
                <Box
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Box
                    style={{
                      width: "100%",
                      maxWidth: "100%",
                      aspectRatio: "16/9",
                      maxHeight: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ParticipantTile
                      trackRef={focus}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </Box>
                  <Box
                    style={{
                      position: "absolute",
                      bottom: 36,
                      left: 36,
                      display: "flex",
                      gap: 8,
                    }}
                  >
                    {stageTracks
                      .filter((t) => t !== focus)
                      .map((t) => (
                        <Box
                          key={t.participant?.identity}
                          style={{
                            width: 150,
                            height: 92,
                            background: "#222",
                            borderRadius: 8,
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Box
                            style={{
                              width: "100%",
                              height: "100%",
                              aspectRatio: "16/9",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <ParticipantTile
                              trackRef={t}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                              }}
                            />
                          </Box>
                        </Box>
                      ))}
                  </Box>
                </Box>
              ) : (
                <Center h="100%">
                  <Text c="dimmed">Nadie en escena</Text>
                </Center>
              );
            case "side_by_side": {
              // Dos participantes principales lado a lado, cámaras centradas y proporcionadas
              const [first, second] = stageTracks;
              return first && second ? (
                <Box style={{ width: "100%", height: "100%", display: "flex" }}>
                  <Box
                    style={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Box
                      style={{
                        width: "100%",
                        maxWidth: "100%",
                        aspectRatio: "16/9",
                        maxHeight: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ParticipantTile
                        trackRef={first}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                    </Box>
                  </Box>
                  <Box
                    style={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Box
                      style={{
                        width: "100%",
                        maxWidth: "100%",
                        aspectRatio: "16/9",
                        maxHeight: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ParticipantTile
                        trackRef={second}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              ) : first ? (
                <Box
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Box
                    style={{
                      width: "100%",
                      maxWidth: "100%",
                      aspectRatio: "16/9",
                      maxHeight: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ParticipantTile
                      trackRef={first}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </Box>
                </Box>
              ) : (
                <Center h="100%">
                  <Text c="dimmed">Nadie en escena</Text>
                </Center>
              );
            }
            default:
              return (
                <Center h="100%">
                  <Text c="dimmed">Nadie en escena</Text>
                </Center>
              );
          }
        })()}
      </Box>
    </Box>
  );
}
