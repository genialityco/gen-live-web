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

export type NameTagStyle = {
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  fontFamily?: string;
};

/** Estilo individual de un recuadro (nombre o subtítulo) en el tile */
export type TileBoxStyle = {
  show?: boolean;        // false = ocultar este recuadro
  bgColor?: string;      // color de fondo (rgba o hex)
  textColor?: string;    // color de texto
  fontSize?: number;     // px
  fontFamily?: string;
  fontWeight?: number;   // 400 normal, 700 bold
  borderColor?: string;
  borderWidth?: number;  // px, 0 = sin borde
  borderRadius?: number; // px
  paddingX?: number;     // px horizontal
  paddingY?: number;     // px vertical
  fullWidth?: boolean;   // expandir al ancho del tile
};

/** Apariencia global de todos los tiles (nombre + subtítulo), sincronizada via RTDB */
export type TileAppearance = {
  position?: "bottom-left" | "bottom-center" | "bottom-right" | "top-left" | "top-center" | "top-right";
  nameBox?: TileBoxStyle;
  subtitleBox?: TileBoxStyle;
  showAccentBar?: boolean;
  accentColor?: string;
};

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

export function setNameTagStyle(
  eventSlug: string,
  identity: string,
  style: NameTagStyle
) {
  const db = getDatabase();
  return set(ref(db, `/live/${eventSlug}/nameTags/${identity}`), style);
}

export function setPresentationSlide(eventSlug: string, slide: number) {
  const db = getDatabase();
  return set(ref(db, `/live/${eventSlug}/presentationSlide`), slide);
}

export function setTileAppearance(eventSlug: string, appearance: TileAppearance) {
  const db = getDatabase();
  return set(ref(db, `/live/${eventSlug}/tileAppearance`), appearance);
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
    nameTags: Record<string, NameTagStyle>;
    presentationSlide?: number;
    tileAppearance?: TileAppearance;
  }) => void
) {
  const db = getDatabase();
  const liveRef = ref(db, `/live/${eventSlug}`);

  const handler = (snap: DataSnapshot) => {
    const val = snap.val() ?? {};
    const stage = val.stage ?? {};
    const egress = val.egress ?? {};
    cb({
      onStage: stage.onStage ?? {},
      programMode: (stage.programMode as ProgramMode) ?? "speaker",
      activeUid: String(stage.activeUid ?? ""),
      layoutMode: (stage.layoutMode as LayoutMode) ?? "speaker",
      egressId: egress.egressId ?? null,
      egressStatus: egress.status ?? null,
      nameTags: (val.nameTags as Record<string, NameTagStyle>) ?? {},
      presentationSlide: typeof val.presentationSlide === "number" ? val.presentationSlide : 0,
      tileAppearance: (val.tileAppearance as TileAppearance) ?? undefined,
    });
  };

  onValue(liveRef, handler);
  return () => off(liveRef, "value", handler);
}
