// src/utils/screen-share-utils.ts
import { Track } from "livekit-client";

/**
 * Suffix used to identify screen share tracks in stage state
 */
export const SCREEN_SHARE_SUFFIX = ":screen";

/**
 * Generates a stage key for a specific track
 * For camera: returns the identity as-is
 * For screen share: returns identity + ":screen"
 */
export function getStageKeyForTrack(
  identity: string,
  source: Track.Source | undefined
): string {
  if (source === Track.Source.ScreenShare || source === Track.Source.ScreenShareAudio) {
    return `${identity}${SCREEN_SHARE_SUFFIX}`;
  }
  return identity;
}

/**
 * Generates the screen share stage key for a participant
 */
export function getScreenShareKey(identity: string): string {
  return `${identity}${SCREEN_SHARE_SUFFIX}`;
}

/**
 * Checks if a stage key represents a screen share
 */
export function isScreenShareKey(stageKey: string): boolean {
  return stageKey.endsWith(SCREEN_SHARE_SUFFIX);
}

/**
 * Parses a stage key to get the identity and whether it's a screen share
 */
export function parseStageKey(stageKey: string): {
  identity: string;
  isScreen: boolean;
} {
  if (stageKey.endsWith(SCREEN_SHARE_SUFFIX)) {
    return {
      identity: stageKey.slice(0, -SCREEN_SHARE_SUFFIX.length),
      isScreen: true,
    };
  }
  return {
    identity: stageKey,
    isScreen: false,
  };
}

/**
 * Gets the display name for a stage item (participant or screen share)
 */
export function getStageItemDisplayName(
  stageKey: string,
  participantName: string,
  customNames?: Record<string, string>
): string {
  const parsed = parseStageKey(stageKey);
  const baseName = customNames?.[parsed.identity] || participantName || parsed.identity;
  
  if (parsed.isScreen) {
    return `🖥️ Pantalla de ${baseName}`;
  }
  return baseName;
}
