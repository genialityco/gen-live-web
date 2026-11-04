// src/components/events/MilestoneOverlay.tsx
import { useEffect, useRef, useState } from "react";
import { getServerNow, type BannerState } from "../../api/live-stage-service";
import { herdBannerStyle } from "../../api/herd";
import {
  DEFAULT_MILESTONE_PRIVATE,
  DEFAULT_MILESTONE_PUBLIC,
  subscribeMilestonesConfig,
  subscribeMilestonesPrivate,
  subscribeMilestonesPublic,
  type MilestonesLiveConfig,
} from "../../api/milestones";
import { AnnouncementBanner } from "../studio/AnnouncementBanner";
import { EXIT_MS } from "../studio/announcement-templates";
import { trackEvent } from "../../lib/utmTracking";

// Una felicitación más vieja que esto no se muestra (recargas, llegar tarde)
const PRIVATE_FRESH_MS = 60_000;
const PUBLIC_FRESH_MS = 15_000;
// Pausa entre una felicitación y la siguiente
const GAP_MS = 600;

type Item = { kind: "private" | "public"; text: string; milestoneId: string };

/**
 * Felicitaciones por logros sobre el reproductor del asistente. El backend
 * decide quién cumplió cada hito y manda el texto ya armado; aquí solo se
 * pintan, una a la vez, con el mismo banner de los anuncios del estudio.
 */
export function MilestoneOverlay({
  eventId,
  enabled,
  uid,
}: {
  eventId: string | null | undefined;
  enabled: boolean;
  uid?: string | null;
}) {
  const [config, setConfig] = useState<MilestonesLiveConfig | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const queue = useRef<Item[]>([]);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const active = enabled && !!eventId;
  const on = active && !!config?.enabled;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!active) return;
    const unsub = subscribeMilestonesConfig(eventId!, setConfig);
    return () => {
      unsub();
      setConfig(null);
    };
  }, [active, eventId]);

  const pump = () => {
    if (busy.current) return;
    const next = queue.current.shift();
    if (!next) return;
    busy.current = true;
    const cfg = configRef.current;
    const channel =
      next.kind === "private"
        ? { ...DEFAULT_MILESTONE_PRIVATE, ...(cfg?.privateMessage ?? {}) }
        : { ...DEFAULT_MILESTONE_PUBLIC, ...(cfg?.publicMessage ?? {}) };
    setBanner({
      visible: true,
      text: next.text,
      label: channel.label?.trim() || null,
      style: herdBannerStyle(channel, cfg?.accentColor),
      publishedAt: Date.now(),
    });
    trackEvent("milestone_shown", {
      event_id: eventId,
      milestone_id: next.milestoneId,
      kind: next.kind,
    });
    timers.current.push(
      setTimeout(() => {
        setBanner(null);
        timers.current.push(
          setTimeout(() => {
            busy.current = false;
            pump();
          }, EXIT_MS + GAP_MS),
        );
      }, Math.max(3, channel.durationSec) * 1000),
    );
  };

  const enqueue = (item: Item) => {
    queue.current.push(item);
    pump();
  };

  // Privadas: solo las recientes (onChildAdded también entrega las ya existentes)
  useEffect(() => {
    if (!on || !uid) return;
    const seen = new Set<string>();
    const unsub = subscribeMilestonesPrivate(eventId!, uid, (n) => {
      if (seen.has(n.id) || !n.text) return;
      seen.add(n.id);
      if (getServerNow() - Number(n.at) > PRIVATE_FRESH_MS) return;
      enqueue({ kind: "private", text: n.text, milestoneId: n.milestoneId });
    });
    return () => unsub();
  }, [on, eventId, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pública: cada nueva escritura de /public (la última vigente al entrar)
  useEffect(() => {
    if (!on) return;
    let lastAt = 0;
    const unsub = subscribeMilestonesPublic(eventId!, (n) => {
      if (!n?.text || Number(n.at) === lastAt) return;
      lastAt = Number(n.at);
      if (getServerNow() - lastAt > PUBLIC_FRESH_MS) return;
      enqueue({ kind: "public", text: n.text, milestoneId: n.milestoneId });
    });
    return () => unsub();
  }, [on, eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!on) return null;
  return <AnnouncementBanner banner={banner} zIndex={8} />;
}
