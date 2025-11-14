/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../core/api";
import {  ensureAnon, rtdb } from "../core/firebase";
import {
  onValue,
  ref as r,
  set,
  serverTimestamp,
  onDisconnect,
  type DatabaseReference,
} from "firebase/database";

type ResolvedEvent = {
  eventId: string;
  slug: string;
  title: string;
  status: "upcoming" | "live" | "ended" | "replay";
  orgId: string;
  schedule?: any;
  stream?: { provider?: string | null };
};

export function useEventRealtime(slug: string) {
  const [resolved, setResolved] = useState<ResolvedEvent | null>(null);
  const [status, setStatus] = useState<ResolvedEvent["status"]>("upcoming");
  const [nowCount, setNowCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const presenceRef = useRef<DatabaseReference | null>(null);
  const unsubFns = useRef<(() => void)[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // 1) Asegurar sesión anónima
      const uid = await ensureAnon();
      if (cancelled) return;

      // 2) Resolver slug
      const { data } = await api.get<ResolvedEvent>(`/public/events/${slug}`);
      if (cancelled) return;
      setResolved(data);

      const evId = data.eventId;

      // 3) Listeners RTDB
      const statusRef = r(rtdb, `/events/${evId}/status`);
      const nowRef = r(rtdb, `/events/${evId}/nowCount`);

      const unsubStatus = onValue(statusRef, (s) => {
        setStatus((s.val() ?? "upcoming") as any);
      });
      const unsubNow = onValue(nowRef, (s) => {
        setNowCount(Number(s.val() ?? 0));
      });
      unsubFns.current.push(unsubStatus, unsubNow);

      // 4) Presencia — set + onDisconnect.remove
      const pRef = r(rtdb, `/presence/${evId}/${uid}`);
      presenceRef.current = pRef;

      // Función para escribir presencia
      const writePresence = async () => {
        await set(pRef, { on: true, ts: serverTimestamp() }).catch(() => {});
      };

      // Escribimos "online" inicialmente
      console.log("✍️ Writing initial presence for event:", evId, "UID:", uid);
      await writePresence();
      console.log("✅ Initial presence written");
      
      // Remover al desconectar
      try {
        await onDisconnect(pRef).remove();
      } catch {
        // Algunos entornos bloquean onDisconnect; ignorar
      }

      // Actualizar presencia cada 15 segundos para mantenerla activa
      const heartbeatInterval = setInterval(() => {
        if (!cancelled) {
          writePresence();
        }
      }, 15000); // 15 segundos (más tiempo real)

      setLoading(false);

      // Agregar limpieza del interval
      unsubFns.current.push(() => clearInterval(heartbeatInterval));
    })();

    return () => {
      console.log("🧹 useEventRealtime cleanup - Removing presence for event:", slug);
      cancelled = true;
      
      // CRÍTICO: Eliminar presencia manualmente al desmontar componente
      if (presenceRef.current) {
        console.log("🗑️ Removing presence node:", presenceRef.current.toString());
        set(presenceRef.current, null)
          .then(() => console.log("✅ Presence removed successfully"))
          .catch((err) => console.error("❌ Error removing presence:", err));
      } else {
        console.warn("⚠️ presenceRef.current is null - cannot remove presence");
      }
      
      // Limpieza de listeners RTDB
      unsubFns.current.forEach((fn) => {
        try {
          fn();
        } catch { /* empty */ }
      });
      unsubFns.current = [];
      // Nota: onDisconnect sigue activo para desconexiones reales (cerrar pestaña, perder internet)
    };
  }, [slug]);

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
