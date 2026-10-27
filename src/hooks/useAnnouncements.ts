// src/hooks/useAnnouncements.ts
import { useEffect, useRef, useState } from "react";
import { notifications } from "@mantine/notifications";
import {
  getServerNow,
  hideBanner,
  isBannerActive,
  subscribeAnnouncements,
  subscribeBannerOverlay,
  type Announcement,
  type AnnouncementSettings,
  type BannerState,
} from "../api/live-stage-service";

/**
 * Estado del publicador de anuncios del estudio: lista preparada, banner al
 * aire, ajustes y reloj del servidor para la cuenta regresiva.
 */
export function useAnnouncements(eventSlug: string) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [settings, setSettings] = useState<AnnouncementSettings>({});
  const [now, setNow] = useState(() => getServerNow());

  useEffect(() => {
    if (!eventSlug) return;
    const unsubList = subscribeAnnouncements(eventSlug, setAnnouncements);
    const unsubBanner = subscribeBannerOverlay(eventSlug, (s) => {
      setBanner(s.banner);
      setSettings(s.settings);
    });
    return () => {
      unsubList();
      unsubBanner();
    };
  }, [eventSlug]);

  // Tick de 1 s solo mientras hay un anuncio con duración al aire (cuenta regresiva)
  const expiresAt = banner?.visible ? banner.expiresAt : null;
  useEffect(() => {
    setNow(getServerNow());
    if (!expiresAt) return;
    const t = setInterval(() => setNow(getServerNow()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  // Al expirar, apagar el banner en RTDB (best effort; los visores ya lo ocultan solos)
  const expiredHandled = useRef<number | null>(null);
  useEffect(() => {
    if (!banner?.visible || !banner.expiresAt || now < banner.expiresAt) return;
    if (expiredHandled.current === banner.expiresAt) return;
    expiredHandled.current = banner.expiresAt;
    hideBanner(eventSlug).catch(() => {});
  }, [banner, now, eventSlug]);

  const onAir = isBannerActive(banner, now);
  return {
    announcements,
    banner,
    settings,
    now,
    onAir,
    onAirId: onAir ? banner?.announcementId ?? null : null,
  };
}

/**
 * Ejecuta una acción asíncrona del publicador mostrando notificación de
 * éxito/error y un flag `busy` para deshabilitar botones mientras corre.
 */
export function useAsyncAction() {
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, errorMsg: string, okMsg?: string) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) notifications.show({ message: okMsg, color: "blue" });
    } catch (err) {
      console.error(errorMsg, err);
      notifications.show({ message: errorMsg, color: "red" });
    } finally {
      setBusy(false);
    }
  };

  return { run, busy };
}
