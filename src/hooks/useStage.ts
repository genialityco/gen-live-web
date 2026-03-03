// src/hooks/useStage.ts
import { useEffect, useState } from "react";
import { subscribeStageState, type ProgramMode, type NameTagStyle, type TileAppearance } from "../api/live-stage-service";
import type { LayoutMode } from "../types";

export type StageState = {
  onStage: Record<string, boolean>;
  programMode: ProgramMode;
  activeUid: string;
  layoutMode: LayoutMode;
  egressId?: string | null;
  egressStatus?: string | null;
  nameTags: Record<string, NameTagStyle>;
  presentationSlide: number;
  tileAppearance?: TileAppearance;
};

const DEFAULT_STAGE: StageState = {
  onStage: {},
  programMode: "speaker",
  activeUid: "",
  layoutMode: "speaker",
  egressId: null,
  egressStatus: null,
  nameTags: {},
  presentationSlide: 0,
  tileAppearance: undefined,
};

export function useStage(eventSlug: string) {
  const [stage, setStage] = useState<StageState>(DEFAULT_STAGE);

  useEffect(() => {
    console.log("🎭 useStage - Subscribing to eventSlug:", eventSlug);
    if (!eventSlug) return;

    const unsubscribe = subscribeStageState(eventSlug, (s) => {
      console.log("🎭 useStage - Received stage update:", s);
      setStage({
        onStage: s?.onStage ?? {},
        programMode: (s?.programMode as ProgramMode) ?? "speaker",
        activeUid: s?.activeUid ?? "",
        layoutMode: s?.layoutMode ?? "speaker",
        egressId: s?.egressId ?? null,
        egressStatus: s?.egressStatus ?? null,
        nameTags: s?.nameTags ?? {},
        presentationSlide: s?.presentationSlide ?? 0,
        tileAppearance: s?.tileAppearance ?? undefined,
      });
    });

    return () => {
      console.log("🎭 useStage - Unsubscribing from eventSlug:", eventSlug);
      unsubscribe();
    };
  }, [eventSlug]);

  return stage;
}
