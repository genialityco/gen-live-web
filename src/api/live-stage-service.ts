import {
  getDatabase,
  ref,
  set,
  onValue,
  off,
  DataSnapshot,
} from "firebase/database";

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

export function subscribeStageState(
  eventSlug: string,
  cb: (s: {
    onStage: Record<string, boolean>;
    programMode: ProgramMode;
    activeUid: string;
  }) => void
) {
  const db = getDatabase();
  const stageRef = ref(db, `/live/${eventSlug}/stage`);

  const handler = (snap: DataSnapshot) => {
    const val = snap.val() ?? {};
    cb({
      onStage: val.onStage ?? {},
      programMode: (val.programMode as ProgramMode) ?? "speaker",
      activeUid: String(val.activeUid ?? ""),
    });
  };

  onValue(stageRef, handler);
  return () => off(stageRef, "value", handler);
}
