// src/hooks/useMyMilestones.ts
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMyMilestones,
  subscribeMilestonesConfig,
  subscribeMilestonesPrivate,
  type MyMilestones,
} from "../api/milestones";
import { getServerNow } from "../api/live-stage-service";

// Mientras la pestaña está abierta se refresca el avance cada tanto
const POLL_MS = 60_000;

export type MyMilestonesShown = Extract<MyMilestones, { visible: true }>;

/**
 * Estado de «Mis logros» para la página del asistente. Se muestra solo si el
 * admin la activó (espejo en /milestones/{eventId}/config) y el backend dice
 * que este asistente puede verla (el grupo de control no). Se recarga al
 * recibir una felicitación privada y, con la pestaña abierta, cada minuto.
 */
export function useMyMilestones({
  eventId,
  uid,
  enabled,
  active,
}: {
  eventId: string | null | undefined;
  uid: string | null | undefined;
  enabled: boolean;
  active: boolean; // la pestaña está abierta
}) {
  const [cfgStamp, setCfgStamp] = useState(0);
  const [data, setData] = useState<MyMilestonesShown | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [unseen, setUnseen] = useState(0);
  const [fresh, setFresh] = useState<string[]>([]); // recién conseguidos (para celebrar)
  const known = useRef<Set<string> | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const on = enabled && !!eventId && !!uid;

  // El espejo de RTDB solo avisa que el admin cambió algo: quien decide si
  // se muestra es el API (si la lectura de RTDB falla, igual se consulta)
  useEffect(() => {
    if (!enabled || !eventId) return;
    const unsub = subscribeMilestonesConfig(eventId, (c) => setCfgStamp(Number(c?.updatedAt ?? 0)));
    return () => unsub();
  }, [enabled, eventId]);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    try {
      const r = await getMyMilestones(eventId);
      if (!r?.visible) {
        console.info("[milestones] «Mis logros» no disponible para esta sesión", r);
        setData(null);
        return;
      }
      const got = r.items.filter((i) => i.achieved).map((i) => i.id);
      // La primera carga no cuenta como "nuevo"
      if (known.current) {
        const prev = known.current;
        const added = got.filter((id) => !prev.has(id));
        if (added.length) {
          setFresh(added);
          if (!activeRef.current) setUnseen((n) => n + added.length);
        }
      }
      known.current = new Set(got);
      setData(r);
      setFetchedAt(Date.now());
    } catch (err) {
      console.warn("[milestones] mis logros:", (err as Error).message);
    }
  }, [eventId]);

  // Carga inicial y al cambiar la configuración del admin
  useEffect(() => {
    if (!on) {
      setData(null);
      known.current = null;
      return;
    }
    void refresh();
  }, [on, cfgStamp, refresh]);

  // Felicitación privada nueva → hay un logro más (las viejas se ignoran)
  const shown = on && !!data;
  useEffect(() => {
    if (!shown) return;
    const since = getServerNow() - 5_000;
    const unsub = subscribeMilestonesPrivate(eventId!, uid!, (n) => {
      if (Number(n.at) < since) return;
      void refresh();
    });
    return () => unsub();
  }, [shown, eventId, uid, refresh]);

  // Con la pestaña abierta: refresco periódico y se dan por vistos
  const hasData = !!data;
  useEffect(() => {
    if (!active || !hasData) return;
    setUnseen(0);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [active, hasData, refresh]);

  const clearFresh = useCallback(() => setFresh([]), []);

  return { data, fetchedAt, unseen, fresh, clearFresh, visible: shown };
}
