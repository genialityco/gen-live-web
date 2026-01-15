import {
  getDatabase,
  ref,
  set,
  onValue,
  off,
  DataSnapshot,
} from "firebase/database";
import type { LayoutMode } from "../types";

export type ProgramMode = "speaker" | "grid";

export function setOnStage(eventSlug: string, uid: string, onStage: boolean) {
  const db = getDatabase();
  return set(ref(db, `/live/${eventSlug}/stage/onStage/${uid}`), onStage);
}

export function setProgramMode(eventSlug: string, mode: ProgramMode) {
  const db = getDatabase();
  return set(ref(db, `/live/${eventSlug}/stage/programMode`), mode);
}

export function setActiveUid(eventSlug: string, uid: string | "") {
  const db = getDatabase();
  return set(ref(db, `/live/${eventSlug}/stage/activeUid`), uid || "");
}

export function setLayoutMode(eventSlug: string, layout: LayoutMode) {
  const db = getDatabase();
  return set(ref(db, `/live/${eventSlug}/stage/layoutMode`), layout);
}

export function setEgressState(
  eventSlug: string,
  egressId: string | null,
  status: string | null
) {
  const db = getDatabase();
  return set(ref(db, `/live/${eventSlug}/egress`), {
    egressId: egressId || null,
    status: status || null,
    updatedAt: Date.now(),
  });
}

export function subscribeStageState(
  eventSlug: string,
  cb: (s: {
    onStage: Record<string, boolean>;
    programMode: ProgramMode;
    activeUid: string;
    layoutMode: LayoutMode;
    egressId?: string | null;
    egressStatus?: string | null;
  }) => void
) {
  const db = getDatabase();
  const liveRef = ref(db, `/live/${eventSlug}`);

  const handler = (snap: DataSnapshot) => {
    const val = snap.val() ?? {};
    const stage = val.stage ?? {};
    const egress = val.egress ?? {};
    console.log(`🔥 Firebase RTDB - /live/${eventSlug}:`, val);
    cb({
      onStage: stage.onStage ?? {},
      programMode: (stage.programMode as ProgramMode) ?? "speaker",
      activeUid: String(stage.activeUid ?? ""),
      layoutMode: (stage.layoutMode as LayoutMode) ?? "speaker",
      egressId: egress.egressId ?? null,
      egressStatus: egress.status ?? null,
    });
  };

  onValue(liveRef, handler);
  return () => off(liveRef, "value", handler);
}
