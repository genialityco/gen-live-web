// src/components/live/LiveMonitor.tsx
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Box, Center, Text, ActionIcon, Tooltip } from "@mantine/core";
import { IconMaximize, IconMinimize } from "@tabler/icons-react";
import {
  useTracks,
  type TrackReference,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import type { StageState } from "../../hooks/useStage";
import type { LayoutMode } from "../../types";
import {
  getStageKeyForTrack,
  parseStageKey,
} from "../../utils/screen-share-utils";
import { CleanTile } from "../../components/studio/CleanTile";

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

  /** Oculta controles de UI (ej: botón fullscreen) cuando se renderiza para egress */
  hideControls?: boolean;
};

export function LiveMonitor({
  showFrame,
  frameUrl,
  stage,
  layoutMode,
  mediaEnabled,
  hideControls = false,
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
  // Ahora filtra por track individual (cámara o screen share por separado)
  const stageTracks = useMemo(() => {
    return tracks.filter((t) => {
      const uid = t.participant?.identity;
      if (!uid) return false;

      // Generar la key específica para este track
      const stageKey = getStageKeyForTrack(uid, t.source);

      // Solo mostrar si la key específica está en escena
      return !!stage.onStage[stageKey];
    });
  }, [tracks, stage.onStage]);

  // Track pineado - ahora puede ser un track específico (cámara o screen)
  const pinnedTrack = useMemo(() => {
    const activeKey = stage.activeUid;
    if (!activeKey) return null;

    // Parsear la key para ver si es un track específico
    const parsed = parseStageKey(activeKey);

    if (parsed.isScreen) {
      // Buscar específicamente el screen share de este usuario
      return (
        tracks.find(
          (t) =>
            t.participant?.identity === parsed.identity &&
            t.source === Track.Source.ScreenShare,
        ) ?? null
      );
    }

    // Buscar el track de cámara (comportamiento original)
    const cam = tracks.find(
      (t) =>
        t.participant?.identity === parsed.identity &&
        t.source === Track.Source.Camera,
    );

    // Fallback: si no hay cámara, buscar screen share del mismo usuario
    const ss = tracks.find(
      (t) =>
        t.participant?.identity === parsed.identity &&
        t.source === Track.Source.ScreenShare,
    );

    return cam ?? ss ?? null;
  }, [tracks, stage.activeUid]);

  // Fallback: si no hay pin, usa el primer onStage (prioriza screenshare)
  const fallbackSpeaker = useMemo(() => {
    const ss = stageTracks.find((t) => t.source === Track.Source.ScreenShare);
    const cam = stageTracks.find((t) => t.source === Track.Source.Camera);
    return ss ?? cam ?? null;
  }, [stageTracks]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

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
      ref={containerRef}
      style={{
        width: "100%",
        aspectRatio: isFullscreen ? undefined : "16 / 9",
        height: isFullscreen ? "100%" : undefined,
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

      {/* FULLSCREEN BUTTON (zIndex 30) — oculto en egress */}
      {!hideControls && (
        <Tooltip
          label={
            isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"
          }
          position="left"
          withArrow
        >
          <ActionIcon
            onClick={toggleFullscreen}
            variant="filled"
            color="dark"
            size="sm"
            radius="sm"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 30,
              opacity: 0.7,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
          >
            {isFullscreen ? (
              <IconMinimize size={14} />
            ) : (
              <IconMaximize size={14} />
            )}
          </ActionIcon>
        </Tooltip>
      )}

      {/* VIDEO TILES (zIndex 1) */}
      {renderVideoTiles && (
        <Box style={{ position: "absolute", inset: 0, zIndex: 1 }}>
          {(() => {
            switch (effectiveMode) {
              case "grid":
                return (
                  <Box
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: 10,
                      padding: 10,
                    }}
                  >
                    {stageTracks.map((t) => (
                      <Box
                        key={`${t.participant?.identity}-${t.source}`}
                        style={{
                          position: "relative",
                          width: "100%",
                          aspectRatio: "16 / 9",
                          overflow: "hidden",
                          borderRadius: 12,
                          background: "#111",
                        }}
                      >
                        <CleanTile trackRef={t as TrackReference} />
                      </Box>
                    ))}
                  </Box>
                );

              case "speaker":
                return focus ? (
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
                        position: "relative",
                      }}
                    >
                      <CleanTile trackRef={focus as TrackReference} />
                    </Box>
                  </Box>
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
                                position: "relative",
                              }}
                            >
                              <CleanTile
                                trackRef={t as TrackReference}
                                nameTagSize="sm"
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
                          position: "relative",
                        }}
                      >
                        <CleanTile trackRef={focus as TrackReference} />
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
                        position: "relative",
                      }}
                    >
                      <CleanTile trackRef={focus as TrackReference} />
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
                                position: "relative",
                              }}
                            >
                              <CleanTile
                                trackRef={t as TrackReference}
                                nameTagSize="sm"
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
                          position: "relative",
                        }}
                      >
                        <CleanTile trackRef={first as TrackReference} />
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
                          position: "relative",
                        }}
                      >
                        <CleanTile trackRef={second as TrackReference} />
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
                        position: "relative",
                      }}
                    >
                      <CleanTile trackRef={first as TrackReference} />
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
