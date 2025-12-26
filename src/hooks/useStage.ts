// src/hooks/useStage.ts
import { useEffect, useState } from "react";
import { subscribeStageState, type ProgramMode } from "../api/live-stage-service";

export type StageState = {
  onStage: Record<string, boolean>;
  programMode: ProgramMode;
  activeUid: string;
};

const DEFAULT_STAGE: StageState = {
  onStage: {},
  programMode: "speaker",
  activeUid: "",
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
      });
    });
    
    return () => {
      console.log("🎭 useStage - Unsubscribing from eventSlug:", eventSlug);
      unsubscribe();
    };
  }, [eventSlug]);

  return stage;
}
