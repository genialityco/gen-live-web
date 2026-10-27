import {
  getDatabase,
  ref,
  set,
  update,
  push,
  remove,
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

export type AnnouncementTemplate = "bar" | "lowerThird" | "breaking" | "pill" | "glass";
export type AnnouncementAnimation = "slide" | "fade" | "wipe" | "pop";
export type AnnouncementFont = "system" | "inter" | "montserrat" | "oswald";

/** Apariencia de un anuncio (todos los campos opcionales → ver DEFAULT_ANNOUNCEMENT_STYLE) */
export type AnnouncementStyle = {
  template?: AnnouncementTemplate;
  position?: "top" | "bottom";
  align?: "left" | "center" | "right"; // solo plantillas que no ocupan todo el ancho
  mode?: "static" | "ticker"; // ticker = texto desplazándose de derecha a izquierda
  size?: "sm" | "md" | "lg";
  animation?: AnnouncementAnimation;
  font?: AnnouncementFont;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
};

// Los defaults reproducen el banner original para anuncios guardados antes de
// que existieran las plantillas.
export const DEFAULT_ANNOUNCEMENT_STYLE: Required<AnnouncementStyle> = {
  template: "bar",
  position: "bottom",
  align: "left",
  mode: "static",
  size: "md",
  animation: "slide",
  font: "system",
  bgColor: "rgba(0, 0, 0, 0.75)",
  textColor: "#ffffff",
  accentColor: "#3b82f6",
};

/** Anuncio preparado en el publicador del estudio (/live/{eventSlug}/announcements/{id}) */
export type Announcement = {
  id: string;
  text: string;
  label?: string | null; // etiqueta corta opcional: "AVISO", "EN VIVO"...
  style?: AnnouncementStyle;
  durationSec?: number | null; // null/0 = sin límite
  order: number;
  createdAt: number;
};

/**
 * Banner de anuncios al aire, sincronizado via RTDB (aparece en monitor, egress
 * y opcionalmente sobre el reproductor del asistente). Los campos extra son
 * opcionales para seguir leyendo banners antiguos { visible, text }.
 */
export type BannerState = {
  visible: boolean;
  text: string;
  label?: string | null;
  style?: AnnouncementStyle;
  announcementId?: string | null;
  publishedAt?: number | null;
  // Hora del servidor (ms) en la que el banner deja de mostrarse. Cada cliente
  // lo oculta localmente al llegar ese momento, aunque el estudio esté cerrado.
  expiresAt?: number | null;
};

export type AnnouncementSettings = {
  // Mostrar el banner también como overlay HTML sobre el reproductor de la
  // página del asistente (para transmisiones que no salen del estudio/egress).
  showOnAttend?: boolean;
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

/** RTDB rechaza valores undefined: los quitamos antes de escribir */
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function setBanner(eventSlug: string, banner: BannerState) {
  const db = getDatabase();
  return set(ref(db, `/live/${eventSlug}/banner`), stripUndefined(banner));
}

// ── Reloj del servidor ────────────────────────────────────────────────────
// expiresAt se calcula con la hora del servidor de Firebase para que el estudio,
// el egress y los asistentes oculten el banner al mismo tiempo aunque sus relojes
// locales difieran.
let serverTimeOffset = 0;
let offsetSubscribed = false;

export function getServerNow(): number {
  if (!offsetSubscribed) {
    offsetSubscribed = true;
    onValue(ref(getDatabase(), ".info/serverTimeOffset"), (snap) => {
      serverTimeOffset = Number(snap.val()) || 0;
    });
  }
  return Date.now() + serverTimeOffset;
}

/** ¿El banner debe verse ahora mismo? (visible, con texto y sin expirar) */
export function isBannerActive(banner: BannerState | undefined | null, now = getServerNow()) {
  if (!banner?.visible || !banner.text?.trim()) return false;
  return !banner.expiresAt || now < banner.expiresAt;
}

export function publishAnnouncement(
  eventSlug: string,
  a: Pick<Announcement, "id" | "text" | "label" | "style" | "durationSec">,
) {
  const now = getServerNow();
  return setBanner(eventSlug, {
    visible: true,
    text: a.text,
    label: a.label || null,
    style: a.style,
    announcementId: a.id,
    publishedAt: now,
    expiresAt: a.durationSec ? now + a.durationSec * 1000 : null,
  });
}

export function hideBanner(eventSlug: string) {
  const db = getDatabase();
  return set(ref(db, `/live/${eventSlug}/banner/visible`), false);
}

/** Actualiza texto/estilo del banner al aire sin reiniciar su duración */
export function updateBannerContent(
  eventSlug: string,
  patch: Pick<BannerState, "text" | "label" | "style">,
) {
  const db = getDatabase();
  return update(ref(db, `/live/${eventSlug}/banner`), {
    text: patch.text,
    label: patch.label || null,
    style: patch.style ? stripUndefined(patch.style) : null,
  });
}

export async function saveAnnouncement(
  eventSlug: string,
  data: Omit<Announcement, "id" | "order" | "createdAt">,
  id?: string,
): Promise<string> {
  const db = getDatabase();
  if (id) {
    await update(ref(db, `/live/${eventSlug}/announcements/${id}`), {
      text: data.text,
      label: data.label || null,
      style: data.style ? stripUndefined(data.style) : null,
      durationSec: data.durationSec || null,
    });
    return id;
  }
  const newRef = push(ref(db, `/live/${eventSlug}/announcements`));
  const now = Date.now();
  await set(
    newRef,
    stripUndefined({
      ...data,
      label: data.label || null,
      durationSec: data.durationSec || null,
      order: now,
      createdAt: now,
    }),
  );
  return newRef.key!;
}

export function deleteAnnouncement(eventSlug: string, id: string) {
  const db = getDatabase();
  return remove(ref(db, `/live/${eventSlug}/announcements/${id}`));
}

/** Intercambia el orden de dos anuncios en una sola escritura */
export function swapAnnouncementOrder(eventSlug: string, a: Announcement, b: Announcement) {
  const db = getDatabase();
  return update(ref(db, `/live/${eventSlug}/announcements`), {
    [`${a.id}/order`]: b.order,
    [`${b.id}/order`]: a.order,
  });
}

export function subscribeAnnouncements(
  eventSlug: string,
  cb: (list: Announcement[]) => void,
) {
  const db = getDatabase();
  const listRef = ref(db, `/live/${eventSlug}/announcements`);
  const handler = (snap: DataSnapshot) => {
    const val = (snap.val() ?? {}) as Record<string, Omit<Announcement, "id">>;
    cb(
      Object.entries(val)
        .map(([id, a]) => ({ ...a, id }))
        .sort((x, y) => x.order - y.order),
    );
  };
  onValue(listRef, handler);
  return () => off(listRef, "value", handler);
}

export function setAnnouncementSettings(eventSlug: string, settings: AnnouncementSettings) {
  const db = getDatabase();
  return update(ref(db, `/live/${eventSlug}/announcementSettings`), stripUndefined(settings));
}

/**
 * Suscripción liviana para la página del asistente: solo lee el banner y los
 * ajustes, no todo /live/{eventSlug} (que incluye estado interno del estudio).
 */
export function subscribeBannerOverlay(
  eventSlug: string,
  cb: (s: { banner: BannerState | null; settings: AnnouncementSettings }) => void,
) {
  const db = getDatabase();
  const bannerRef = ref(db, `/live/${eventSlug}/banner`);
  const settingsRef = ref(db, `/live/${eventSlug}/announcementSettings`);
  let banner: BannerState | null = null;
  let settings: AnnouncementSettings = {};

  const onBanner = (snap: DataSnapshot) => {
    banner = (snap.val() as BannerState) ?? null;
    cb({ banner, settings });
  };
  const onSettings = (snap: DataSnapshot) => {
    settings = (snap.val() as AnnouncementSettings) ?? {};
    cb({ banner, settings });
  };

  onValue(bannerRef, onBanner);
  onValue(settingsRef, onSettings);
  return () => {
    off(bannerRef, "value", onBanner);
    off(settingsRef, "value", onSettings);
  };
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
    banner?: BannerState;
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
      banner: (val.banner as BannerState) ?? undefined,
    });
  };

  onValue(liveRef, handler);
  return () => off(liveRef, "value", handler);
}
