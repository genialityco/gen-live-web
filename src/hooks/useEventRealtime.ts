/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** Estado de reproducción real reportado por el reproductor hacia la presencia. */
export type PlaybackMode = "live" | "replay" | null;

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

  // Estado de reproducción real (lo escribe el reproductor vía reportPlayback).
  // El heartbeat de presencia lee este ref para incluir playing/pmode en cada write.
  const playbackRef = useRef<{ playing: boolean; mode: PlaybackMode }>({
    playing: false,
    mode: null,
  });

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

      // Función para escribir presencia — incluye el estado de reproducción real
      // (playing/pmode) para que el backend acumule tiempo de visualización solo
      // mientras el video se reproduce de verdad, y lo atribuya a vivo/diferido.
      const writePresence = async () => {
        await set(pRef, {
          on: true,
          ts: serverTimestamp(),
          playing: playbackRef.current.playing,
          pmode: playbackRef.current.mode,
        }).catch(() => {});
      };

      // online inicial
      await writePresence();
      
      // Remover al desconectar
      try {
        await onDisconnect(pRef).remove();
      } catch {
        // Algunos entornos bloquean onDisconnect, se ignora
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
      cancelled = true;
      
      // CRÍTICO: Eliminar presencia manualmente al desmontar componente
      if (presenceRef.current) {
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

  // El reproductor llama esto en cada transición play/pause/ended. Actualiza el
  // ref (que lee el heartbeat) y escribe presencia de inmediato para capturar la
  // transición sin esperar al próximo heartbeat de 15s.
  const reportPlayback = useCallback(
    (playing: boolean, mode: PlaybackMode) => {
      playbackRef.current = { playing, mode };
      const pRef = presenceRef.current;
      if (!pRef) return;
      void set(pRef, {
        on: true,
        ts: serverTimestamp(),
        playing,
        pmode: mode,
      }).catch(() => {});
    },
    []
  );

  return useMemo(
    () => ({
      resolved,
      status,
      nowCount,
      loading,
      reportPlayback,
    }),
    [resolved, status, nowCount, loading, reportPlayback]
  );
}
