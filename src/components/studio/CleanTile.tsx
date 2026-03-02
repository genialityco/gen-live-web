import { TrackRefContext, type TrackReference } from "@livekit/components-react";
import { VideoTrack } from "@livekit/components-react";
import { Track } from "livekit-client";
import { NameTag } from "./NameTag";
import { Box } from "@mantine/core";
import type { NameTagStyle } from "../../api/live-stage-service";

type Props = {
  trackRef: TrackReference;
  nameTagSize?: "sm" | "md";
  accentColor?: string;
  nameTagStyle?: NameTagStyle;
};

export function CleanTile({ trackRef, nameTagSize = "md", accentColor, nameTagStyle }: Props) {
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;

  return (
    <Box style={{ position: "relative", width: "100%", height: "100%" }}>
      <TrackRefContext.Provider value={trackRef}>
        <VideoTrack />
      </TrackRefContext.Provider>

      {!isScreenShare && (
        <NameTag
          trackRef={trackRef}
          size={nameTagSize}
          accentColor={nameTagStyle?.accentColor ?? accentColor}
          bgColor={nameTagStyle?.bgColor}
          textColor={nameTagStyle?.textColor}
          fontFamily={nameTagStyle?.fontFamily}
        />
      )}
    </Box>
  );
}
