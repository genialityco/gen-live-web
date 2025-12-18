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
    if (!eventSlug) return;
    return subscribeStageState(eventSlug, (s) => {
      setStage({
        onStage: s?.onStage ?? {},
        programMode: (s?.programMode as ProgramMode) ?? "speaker",
        activeUid: s?.activeUid ?? "",
      });
    });
  }, [eventSlug]);

  return stage;
}
