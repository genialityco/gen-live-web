import { useEffect, useState, useMemo } from "react";
import { ref as r, onValue } from "firebase/database";
import { rtdb } from "../core/firebase";
import { api } from "../core/api";

type ResolvedEvent = {
  eventId: string;
  slug: string;
  title: string;
  status: "upcoming" | "live" | "ended" | "replay";
  orgId: string;
  schedule?: any;
  stream?: { provider?: string | null };
};

/**
 * Hook para leer datos del evento en tiempo real SIN escribir presencia
 * 
 * Úsalo en páginas públicas (landing, etc.) que solo necesitan mostrar información
 * NO escribe presencia del usuario
 * 
 * Para marcar presencia activa, usa useEventRealtime (solo en EventAttend)
 */
export function useEventRealtimeData(eventSlug: string | null | undefined) {
  const [resolved, setResolved] = useState<ResolvedEvent | null>(null);
  const [status, setStatus] = useState<string>("upcoming");
  const [nowCount, setNowCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventSlug) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const unsubFns: Array<() => void> = [];

    (async () => {
      try {
        setLoading(true);
        
        // 1) Resolver slug desde el backend
        const { data } = await api.get<ResolvedEvent>(`/public/events/${eventSlug}`);
        if (cancelled) return;
        
        setResolved(data);
        const evId = data.eventId;

        // 2) Escuchar status y nowCount en RTDB (SOLO LECTURA, sin escribir presencia)
        const statusRef = r(rtdb, `/events/${evId}/status`);
        const nowCountRef = r(rtdb, `/events/${evId}/nowCount`);

        const unsubStatus = onValue(statusRef, (s) => {
          if (!cancelled) setStatus(String(s.val() ?? "upcoming"));
        });
        
        const unsubNow = onValue(nowCountRef, (s) => {
          if (!cancelled) setNowCount(Number(s.val() ?? 0));
        });

        unsubFns.push(unsubStatus, unsubNow);
        setLoading(false);
      } catch (error) {
        console.error("Error loading event data:", error);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubFns.forEach((fn) => {
        try {
          fn();
        } catch { /* empty */ }
      });
    };
  }, [eventSlug]);

  return useMemo(
    () => ({
      resolved,
      status,
      nowCount,
      loading,
    }),
    [resolved, status, nowCount, loading]
  );
}
