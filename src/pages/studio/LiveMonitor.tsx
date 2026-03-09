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
import type { NameTagStyle, TileAppearance } from "../../api/live-stage-service";
import { Document, Page, pdfjs } from "react-pdf";

// Configure pdf.js worker — pdfjs-dist must be a direct dependency for Vite to resolve
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/**
 * Convierte URLs de Firebase Storage al formato con CORS habilitado.
 * storage.googleapis.com (GCS raw) no incluye headers CORS → pdf.js falla con range requests.
 * firebasestorage.googleapis.com/v0/b/... sí incluye Access-Control-Allow-Origin: *.
 */
function toFirebaseDownloadUrl(url: string): string {
  const match = url.match(/^https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)$/);
  if (match) {
    const [, bucket, path] = match;
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
  }
  return url;
}

type PresentationViewerProps = {
  url: string;
  mimeType?: string;
  slides?: string[];
  slide: number;
  fit: "cover" | "contain";
};

function PresentationViewer({ url, mimeType, slides, slide, fit }: PresentationViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1280);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      setContainerWidth(containerRef.current?.clientWidth ?? 1280);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (mimeType === "application/pdf") {
    const pdfUrl = toFirebaseDownloadUrl(url);
    return (
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <Document file={pdfUrl}>
          <Page
            pageNumber={slide + 1}
            width={containerWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>
    );
  }

  // PPTX → pre-rendered PNG images per slide
  const slideUrl = slides?.[slide] ?? url;
  return (
    <img
      src={slideUrl}
      alt={`Slide ${slide + 1}`}
      style={{ width: "100%", height: "100%", objectFit: fit, display: "block" }}
    />
  );
}

/**
 * PdfTile — renderiza una presentación como tile de stage (igual que un participante).
 * Mide su propio ancho para escalar el PDF correctamente.
 */
function PdfTile({
  url,
  slide,
  mimeType,
  slides,
}: {
  url: string;
  slide: number;
  mimeType?: string;
  slides?: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => setW(ref.current?.clientWidth ?? 800));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const pdfUrl = toFirebaseDownloadUrl(url);
  return (
    <div ref={ref} style={{ width: "100%", height: "100%", overflow: "hidden", background: mimeType === "application/pdf" ? "#fff" : "#1a1b2e" }}>
      {mimeType === "application/pdf" ? (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <Document file={pdfUrl}>
            <Page pageNumber={slide + 1} width={w} renderTextLayer={false} renderAnnotationLayer={false} />
          </Document>
        </div>
      ) : (
        <img src={slides?.[slide] ?? url} alt={`Slide ${slide + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      )}
    </div>
  );
}

type Props = {
  showFrame: boolean;
  frameUrl: string;
  stage: StageState;
  layoutMode: LayoutMode;

  // Media layer - separado en visual y audio
  mediaEnabled: boolean;

  // Visual layer (video/imagen/gif/presentation)
  visualUrl: string;
  visualType: "image" | "gif" | "video" | "presentation";
  visualMode: "overlay" | "full";
  visualLoop: boolean;
  visualMuted: boolean;
  visualFit: "cover" | "contain";
  visualOpacity: number;
  // Presentation-specific
  presentationSlide?: number;
  presentationSlides?: string[];
  presentationMimeType?: string;

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

  /** Estilos personalizados por participante (identity → NameTagStyle) */
  nameTags?: Record<string, NameTagStyle>;

  /** Apariencia global de todos los tiles (nombre + subtítulo) */
  tileAppearance?: TileAppearance;

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
  nameTags = {},
  tileAppearance,
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
  presentationSlide = 0,
  presentationSlides,
  presentationMimeType,
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

  // Presentaciones actúan como tile de stage (no como overlay) — mismo comportamiento que StreamYard
  const showPdfAsTile = !!(showVisual && visualType === "presentation");

  const renderVideoTiles =
    showPdfAsTile || // siempre renderizar tiles cuando hay PDF en stage
    (!(showVisual && visualMode === "full") &&
      !(showLegacyMedia && mediaMode === "full"));

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

      {/* VISUAL LAYER (zIndex 10) - video/imagen/gif — las presentaciones van como tile (no overlay) */}
      {showVisual && !showPdfAsTile && (
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
          {visualType === "presentation" ? (
            <PresentationViewer
              url={visualUrl}
              mimeType={presentationMimeType}
              slides={presentationSlides}
              slide={presentationSlide}
              fit={visualFit ?? "contain"}
            />
          ) : visualType === "video" ? (
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
              case "grid": {
                const totalGridTiles =
                  stageTracks.length + (showPdfAsTile ? 1 : 0);
                const gridCols =
                  totalGridTiles <= 1
                    ? 1
                    : totalGridTiles <= 2
                    ? 2
                    : totalGridTiles <= 4
                    ? 2
                    : totalGridTiles <= 9
                    ? 3
                    : totalGridTiles <= 12
                    ? 4
                    : totalGridTiles <= 16
                    ? 4
                    : 5;
                const gridRows = Math.ceil(totalGridTiles / gridCols);
                const gridGap = totalGridTiles > 9 ? 4 : 6;
                const gridPad = totalGridTiles > 9 ? 4 : 6;
                return (
                  <Box
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "grid",
                      gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                      gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                      gap: gridGap,
                      padding: gridPad,
                    }}
                  >
                    {/* PDF como primera tile en el grid */}
                    {showPdfAsTile && (
                      <Box
                        style={{
                          position: "relative",
                          width: "100%",
                          height: "100%",
                          minWidth: 0,
                          overflow: "hidden",
                          borderRadius: 8,
                          background: "#fff",
                        }}
                      >
                        <PdfTile
                          url={visualUrl}
                          slide={presentationSlide}
                          mimeType={presentationMimeType}
                          slides={presentationSlides}
                        />
                      </Box>
                    )}
                    {stageTracks.map((t) => (
                      <Box
                        key={`${t.participant?.identity}-${t.source}`}
                        style={{
                          position: "relative",
                          width: "100%",
                          height: "100%",
                          minWidth: 0,
                          overflow: "hidden",
                          borderRadius: 8,
                          background: "#111",
                        }}
                      >
                        <CleanTile
                          trackRef={t as TrackReference}
                          nameTagStyle={nameTags[t.participant?.identity ?? ""]}
                          tileAppearance={tileAppearance}
                          nameTagSize={totalGridTiles > 6 ? "sm" : "md"}
                        />
                      </Box>
                    ))}
                  </Box>
                );
              }

              case "speaker":
                // PDF como foco principal; participantes en strip inferior
                if (showPdfAsTile) {
                  return (
                    <Box style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                      <Box style={{ flex: 1, minHeight: 0, position: "relative" }}>
                        <PdfTile
                          url={visualUrl}
                          slide={presentationSlide}
                          mimeType={presentationMimeType}
                          slides={presentationSlides}
                        />
                      </Box>
                      {stageTracks.length > 0 && (
                        <Box style={{ height: 110, flexShrink: 0, display: "flex", gap: 6, padding: "4px 8px", background: "#111", overflowX: "auto" }}>
                          {stageTracks.map((t) => (
                            <Box
                              key={`${t.participant?.identity}-${t.source}`}
                              style={{ height: "100%", aspectRatio: "16/9", flexShrink: 0, position: "relative", borderRadius: 8, overflow: "hidden", background: "#222" }}
                            >
                              <CleanTile trackRef={t as TrackReference} nameTagSize="sm" nameTagStyle={nameTags[t.participant?.identity ?? ""]} tileAppearance={tileAppearance} />
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  );
                }
                if (focus) {
                  const otherSpeakers = stageTracks.filter((t) => t !== focus);
                  return (
                    <Box style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                      <Box style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Box style={{ width: "100%", maxWidth: "100%", aspectRatio: "16/9", maxHeight: "100%", position: "relative" }}>
                          <CleanTile
                            trackRef={focus as TrackReference}
                            nameTagStyle={nameTags[focus.participant?.identity ?? ""]}
                            tileAppearance={tileAppearance}
                          />
                        </Box>
                      </Box>
                      {otherSpeakers.length > 0 && (
                        <Box style={{ height: 110, flexShrink: 0, display: "flex", gap: 6, padding: "4px 8px", background: "#111", overflowX: "auto" }}>
                          {otherSpeakers.map((t) => (
                            <Box
                              key={`${t.participant?.identity}-${t.source}`}
                              style={{ height: "100%", aspectRatio: "16/9", flexShrink: 0, position: "relative", borderRadius: 8, overflow: "hidden", background: "#222" }}
                            >
                              <CleanTile trackRef={t as TrackReference} nameTagSize="sm" nameTagStyle={nameTags[t.participant?.identity ?? ""]} tileAppearance={tileAppearance} />
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  );
                }
                return (
                  <Center h="100%">
                    <Text c="dimmed">Nadie en escena</Text>
                  </Center>
                );

              case "presentation":
                // PDF a la derecha (área principal), participantes a la izquierda
                if (showPdfAsTile) {
                  return (
                    <Box style={{ width: "100%", height: "100%", display: "flex", flexDirection: "row", overflow: "hidden" }}>
                      {stageTracks.length > 0 && (
                        <Box style={{ flex: 1, height: "100%", minWidth: 200, maxWidth: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflowY: "auto", gap: 6, padding: 6, background: "#111" }}>
                          {stageTracks.map((t) => (
                            <Box key={`${t.participant?.identity}-${t.source}`} style={{ width: "100%", aspectRatio: "16/9", flexShrink: 0, position: "relative", borderRadius: 8, overflow: "hidden" }}>
                              <CleanTile trackRef={t as TrackReference} nameTagSize="sm" nameTagStyle={nameTags[t.participant?.identity ?? ""]} tileAppearance={tileAppearance} />
                            </Box>
                          ))}
                        </Box>
                      )}
                      <Box style={{ flex: 3, height: "100%", minWidth: 0, position: "relative" }}>
                        <PdfTile
                          url={visualUrl}
                          slide={presentationSlide}
                          mimeType={presentationMimeType}
                          slides={presentationSlides}
                        />
                      </Box>
                    </Box>
                  );
                }
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
                                nameTagStyle={nameTags[t.participant?.identity ?? ""]}
                                tileAppearance={tileAppearance}
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
                        <CleanTile
                          trackRef={focus as TrackReference}
                          nameTagStyle={nameTags[focus.participant?.identity ?? ""]}
                          tileAppearance={tileAppearance}
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
                // PDF como contenido principal; participantes en strip horizontal en la parte inferior
                if (showPdfAsTile) {
                  return (
                    <Box style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                      <Box style={{ flex: 1, minHeight: 0, position: "relative" }}>
                        <PdfTile
                          url={visualUrl}
                          slide={presentationSlide}
                          mimeType={presentationMimeType}
                          slides={presentationSlides}
                        />
                      </Box>
                      {stageTracks.length > 0 && (
                        <Box style={{ height: 110, flexShrink: 0, display: "flex", flexDirection: "row", gap: 6, padding: "4px 8px", background: "#111", overflowX: "auto" }}>
                          {stageTracks.map((t) => (
                            <Box
                              key={`${t.participant?.identity}-${t.source}`}
                              style={{ height: "100%", aspectRatio: "16/9", flexShrink: 0, position: "relative", borderRadius: 8, overflow: "hidden", background: "#222", boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
                            >
                              <CleanTile trackRef={t as TrackReference} nameTagSize="sm" nameTagStyle={nameTags[t.participant?.identity ?? ""]} tileAppearance={tileAppearance} />
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  );
                }
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
                      <CleanTile
                        trackRef={focus as TrackReference}
                        nameTagStyle={nameTags[focus.participant?.identity ?? ""]}
                        tileAppearance={tileAppearance}
                      />
                    </Box>

                    <Box
                      style={{
                        position: "absolute",
                        bottom: 16,
                        left: 12,
                        right: 12,
                        display: "flex",
                        gap: 6,
                        overflowX: "auto",
                        overflowY: "hidden",
                        maxHeight: 100,
                      }}
                    >
                      {stageTracks
                        .filter((t) => t !== focus)
                        .map((t) => (
                          <Box
                            key={t.participant?.identity}
                            style={{
                              width: 140,
                              height: 86,
                              flexShrink: 0,
                              background: "#222",
                              borderRadius: 8,
                              overflow: "hidden",
                              position: "relative",
                            }}
                          >
                            <CleanTile
                              trackRef={t as TrackReference}
                              nameTagSize="sm"
                              nameTagStyle={nameTags[t.participant?.identity ?? ""]}
                              tileAppearance={tileAppearance}
                            />
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
                // PDF + primer participante lado a lado
                if (showPdfAsTile) {
                  const [firstTrack] = stageTracks;
                  return (
                    <Box style={{ width: "100%", height: "100%", display: "flex" }}>
                      <Box style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative" }}>
                        <PdfTile
                          url={visualUrl}
                          slide={presentationSlide}
                          mimeType={presentationMimeType}
                          slides={presentationSlides}
                        />
                      </Box>
                      {firstTrack && (
                        <Box style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Box style={{ width: "100%", maxWidth: "100%", aspectRatio: "16/9", maxHeight: "100%", position: "relative" }}>
                            <CleanTile trackRef={firstTrack as TrackReference} nameTagStyle={nameTags[firstTrack.participant?.identity ?? ""]} tileAppearance={tileAppearance} />
                          </Box>
                        </Box>
                      )}
                    </Box>
                  );
                }
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
                        <CleanTile
                          trackRef={first as TrackReference}
                          nameTagStyle={nameTags[first.participant?.identity ?? ""]}
                          tileAppearance={tileAppearance}
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
                          position: "relative",
                        }}
                      >
                        <CleanTile
                          trackRef={second as TrackReference}
                          nameTagStyle={nameTags[second.participant?.identity ?? ""]}
                          tileAppearance={tileAppearance}
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
                        position: "relative",
                      }}
                    >
                      <CleanTile
                        trackRef={first as TrackReference}
                        nameTagStyle={nameTags[first.participant?.identity ?? ""]}
                        tileAppearance={tileAppearance}
                      />
                    </Box>
                  </Box>
                ) : (
                  <Center h="100%">
                    <Text c="dimmed">Nadie en escena</Text>
                  </Center>
                );
              }

              case "solo":
                // Speaker pineado (o PDF) a pantalla completa, sin miniaturas
                if (showPdfAsTile) {
                  return (
                    <PdfTile
                      url={visualUrl}
                      slide={presentationSlide}
                      mimeType={presentationMimeType}
                      slides={presentationSlides}
                    />
                  );
                }
                return focus ? (
                  <Box style={{ width: "100%", height: "100%", position: "relative" }}>
                    <CleanTile
                      trackRef={focus as TrackReference}
                      nameTagStyle={nameTags[focus.participant?.identity ?? ""]}
                      tileAppearance={tileAppearance}
                    />
                  </Box>
                ) : (
                  <Center h="100%">
                    <Text c="dimmed">Nadie en escena</Text>
                  </Center>
                );

              default:
                return showPdfAsTile ? (
                  <PdfTile
                    url={visualUrl}
                    slide={presentationSlide}
                    mimeType={presentationMimeType}
                    slides={presentationSlides}
                  />
                ) : (
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
