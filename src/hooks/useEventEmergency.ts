import { useEffect, useState } from "react";
import { ref as r, onValue } from "firebase/database";
import { rtdb } from "../core/firebase";
import type { BrandingConfig } from "../api/orgs";

export type EventEmergencyData = {
  eventId: string;
  title: string;
  status: "upcoming" | "live" | "ended" | "replay";
  playbackHlsUrl: string | null;
  streamUrl: string | null;
  streamProvider: string | null;
  orgBranding: BrandingConfig | null;
  eventBranding: BrandingConfig | null;
};

/**
 * Modo emergencia (fallback ante Mongo lento/caído): escucha en tiempo real
 * /eventEmergency/{orgSlug}/{eventSlug} en RTDB. No hace ninguna llamada a la
 * API (Mongo) — orgSlug/eventSlug ya vienen de la URL, así que esto debe
 * poder resolverse incluso si el backend está completamente caído.
 */
export function useEventEmergency(
  orgSlug: string | undefined,
  eventSlug: string | undefined,
) {
  const [active, setActive] = useState(false);
  const [data, setData] = useState<EventEmergencyData | null>(null);

  useEffect(() => {
    if (!orgSlug || !eventSlug) {
      setActive(false);
      setData(null);
      return;
    }

    const activePath = `/eventEmergency/${orgSlug}/${eventSlug}/active`;
    const dataPath = `/eventEmergency/${orgSlug}/${eventSlug}/data`;
    const activeRef = r(rtdb, activePath);
    const dataRef = r(rtdb, dataPath);

    const unsubActive = onValue(
      activeRef,
      (snap) => {
        console.log(`[useEventEmergency] ${activePath} =`, snap.val());
        setActive(!!snap.val());
      },
      (err) => {
        console.error(
          `[useEventEmergency] No se pudo leer ${activePath} (¿faltan reglas de RTDB para /eventEmergency?):`,
          err,
        );
      },
    );
    const unsubData = onValue(
      dataRef,
      (snap) => {
        console.log(`[useEventEmergency] ${dataPath} =`, snap.val());
        setData((snap.val() as EventEmergencyData | null) ?? null);
      },
      (err) => {
        console.error(
          `[useEventEmergency] No se pudo leer ${dataPath} (¿faltan reglas de RTDB para /eventEmergency?):`,
          err,
        );
      },
    );

    return () => {
      unsubActive();
      unsubData();
    };
  }, [orgSlug, eventSlug]);

  return { active, data };
}
