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

  // Media layer - separado en visual y audio
  mediaEnabled: boolean;

  // Visual layer (video/imagen/gif)
  visualUrl: string;
  visualType: "image" | "gif" | "video";
  visualMode: "overlay" | "full";
  visualLoop: boolean;
  visualMuted: boolean;
  visualFit: "cover" | "contain";
  visualOpacity: number;

  // Audio layer
  audioUrl: string;
  audioLoop: boolean;
  audioMuted: boolean;
  
  // Background
  backgroundUrl: string;
  backgroundType: "image" | "gif" | "video";
  backgroundColor: string;

  // Legacy para backward compatibility
  mediaType: "image" | "gif" | "video" | "audio";
  mediaUrl: string;
  mediaMode: "overlay" | "full";
  mediaLoop: boolean;
  mediaMuted: boolean;
  mediaFit: "cover" | "contain";
  mediaOpacity: number;
};

export function LiveMonitor({
  showFrame,
  frameUrl,
  stage,
  layoutMode,
  mediaEnabled,
  visualUrl,
  visualType,
  visualMode,
  visualLoop,
  visualMuted,
  visualFit,
  visualOpacity,
  audioUrl,
  audioLoop,
  audioMuted,
  backgroundUrl,
  backgroundType,
  backgroundColor,
  mediaType,
  mediaUrl,
  mediaMode,
  mediaLoop,
  mediaMuted,
  mediaFit,
  mediaOpacity,
}: Props) {
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: true },
    ],
    { onlySubscribed: false },
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
        t.participant?.identity === uid &&
        t.source === Track.Source.ScreenShare,
    );
    const cam = tracks.find(
      (t) =>
        t.participant?.identity === uid && t.source === Track.Source.Camera,
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

  // Usar visual/audio separados si están disponibles, sino usar legacy
  const showVisual = !!(mediaEnabled && visualUrl);
  const showAudio = !!(mediaEnabled && audioUrl);
  const showLegacyMedia = !!(
    mediaEnabled &&
    mediaUrl &&
    !visualUrl &&
    !audioUrl
  );

  const renderVideoTiles =
    !(showVisual && visualMode === "full") &&
    !(showLegacyMedia && mediaMode === "full");

  return (
    <Box
      style={{
        width: "100%",
        aspectRatio: "16 / 9",
        background: backgroundColor || "#000",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* BACKGROUND IMAGE (zIndex 0) - Fondo personalizado */}
      {backgroundUrl && (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
          }}
        >
          {backgroundType === "video" ? (
            <video
              src={backgroundUrl}
              autoPlay
              playsInline
              muted
              loop
              controls={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <img
              src={backgroundUrl}
              alt="Fondo"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          )}
        </Box>
      )}

      {/* VISUAL LAYER (zIndex 10) - video/imagen/gif */}
      {showVisual && (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            pointerEvents: "none",
            opacity:
              typeof visualOpacity === "number"
                ? Math.min(1, Math.max(0, visualOpacity))
                : 1,
          }}
        >
          {visualType === "video" ? (
            <video
              src={visualUrl}
              autoPlay
              playsInline
              muted={visualMuted ?? true}
              loop={visualLoop ?? false}
              controls={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: visualFit ?? "cover",
                display: "block",
              }}
            />
          ) : (
            <img
              src={visualUrl}
              alt="Visual Media"
              style={{
                width: "100%",
                height: "100%",
                objectFit: visualFit ?? "cover",
                display: "block",
              }}
            />
          )}
        </Box>
      )}

      {/* AUDIO LAYER (zIndex 11) - separado, siempre invisible */}
      {showAudio && (
        <audio
          src={audioUrl}
          autoPlay
          muted={audioMuted ?? true}
          loop={audioLoop ?? false}
          style={{ display: "none" }}
        />
      )}

      {/* LEGACY MEDIA LAYER para backward compatibility */}
      {showLegacyMedia && (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            pointerEvents: "none",
            opacity:
              typeof mediaOpacity === "number"
                ? Math.min(1, Math.max(0, mediaOpacity))
                : 1,
          }}
        >
          {mediaType === "video" ? (
            <video
              src={mediaUrl}
              autoPlay
              playsInline
              muted={mediaMuted ?? true}
              loop={mediaLoop ?? false}
              controls={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: mediaFit ?? "cover",
                display: "block",
              }}
            />
          ) : mediaType === "audio" ? (
            <audio
              src={mediaUrl}
              autoPlay
              muted={mediaMuted ?? true}
              loop={mediaLoop ?? false}
              style={{ display: "none" }}
            />
          ) : (
            <img
              src={mediaUrl}
              alt="Media"
              style={{
                width: "100%",
                height: "100%",
                objectFit: mediaFit ?? "cover",
                display: "block",
              }}
            />
          )}
        </Box>
      )}

      {/* FRAME (zIndex 20) */}
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
        </Box>
      )}

      {/* VIDEO TILES (zIndex 1) */}
      {renderVideoTiles && (
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
                return focus ? (
                  <Box
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      flexDirection: "row",
                      overflow: "hidden",
                    }}
                  >
                    {/* PARTICIPANTES (IZQUIERDA) */}
                    <Box
                      style={{
                        flex: 1,
                        height: "100%",
                        minWidth: 220,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflowY: "auto",
                        flexDirection: "column",
                      }}
                    >
                      {stageTracks
                        .filter((t) => t !== focus)
                        .map((t) => (
                          <Box
                            key={t.participant?.identity}
                            style={{
                              padding: 6,
                              flexShrink: 0,
                            }}
                          >
                            <Box
                              style={{
                                width: "100%",
                                aspectRatio: "16 / 9",
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

                    {/* PRESENTACIÓN (DERECHA) */}
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
                          aspectRatio: "16 / 9",
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
                  </Box>
                ) : (
                  <Center h="100%">
                    <Text c="dimmed">Nadie en escena</Text>
                  </Center>
                );

              case "pip":
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
                const [first, second] = stageTracks;
                return first && second ? (
                  <Box
                    style={{ width: "100%", height: "100%", display: "flex" }}
                  >
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
      )}

      {/* Si mediaMode=full y no hay video tiles, muestra fallback si no hay media */}
      {!renderVideoTiles && !showVisual && !showAudio && !showLegacyMedia && (
        <Center h="100%">
          <Text c="dimmed">Sin contenido</Text>
        </Center>
      )}
    </Box>
  );
}
