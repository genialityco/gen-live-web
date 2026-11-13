// src/hooks/useMyContacts.ts
import { useCallback, useEffect, useState } from "react";
import { CONTACTS_REFRESH_EVENT, getMyContacts, type MyContacts } from "../api/contacts";
import { subscribeHerdGreetReplies } from "../api/herd";
import { getServerNow } from "../api/live-stage-service";

const POLL_MS = 60_000;

/**
 * Estado de «🤝 Contactos» en la página del asistente. Lo decide el API (se
 * muestra si el evento tiene el intercambio activo o si ya tiene colegas).
 * Se recarga al recibir la devolución de un saludo (nace un par), tras
 * devolver uno (CONTACTS_REFRESH_EVENT) y, con la pestaña abierta, cada minuto.
 */
export function useMyContacts({
  eventId,
  uid,
  enabled,
  active,
}: {
  eventId: string | null | undefined;
  uid: string | null | undefined;
  enabled: boolean;
  active: boolean;
}) {
  const [data, setData] = useState<MyContacts | null>(null);
  const on = enabled && !!eventId && !!uid;

  const refresh = useCallback(async () => {
    if (!eventId) return;
    try {
      setData(await getMyContacts(eventId));
    } catch (err) {
      console.warn("[contacts] mis contactos:", (err as Error).message);
    }
  }, [eventId]);

  useEffect(() => {
    if (!on) {
      setData(null);
      return;
    }
    void refresh();
  }, [on, refresh]);

  // Alguien devolvió mi saludo → nuevo par
  useEffect(() => {
    if (!on || !data?.enabled) return;
    const since = getServerNow() - 5_000;
    const unsub = subscribeHerdGreetReplies(eventId!, uid!, (r) => {
      if (Number(r.at) >= since) window.setTimeout(() => void refresh(), 800);
    });
    return () => unsub();
  }, [on, data?.enabled, eventId, uid, refresh]);

  // Yo devolví un saludo (lo avisa el overlay de manada)
  useEffect(() => {
    if (!on) return;
    const h = () => window.setTimeout(() => void refresh(), 800);
    window.addEventListener(CONTACTS_REFRESH_EVENT, h);
    return () => window.removeEventListener(CONTACTS_REFRESH_EVENT, h);
  }, [on, refresh]);

  // Pestaña abierta: al entrar y cada minuto
  const shown = on && !!data?.visible;
  useEffect(() => {
    if (!active || !shown) return;
    void refresh();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [active, shown, refresh]);

  // Pendientes que esperan mi respuesta (para el contador de la pestaña)
  const pending =
    data?.pairs.filter((p) => p.status === "pending" && !p.dismissed).length ?? 0;

  return { data, refresh, pending, visible: shown };
}
