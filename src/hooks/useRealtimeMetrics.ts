import { useEffect, useState } from "react";
import { ref, onValue, off } from "firebase/database";
import { rtdb } from "../core/firebase";
import { useAuth } from "../auth/AuthProvider";

export interface RealtimeMetrics {
  currentConcurrentViewers: number;
  peakConcurrentViewers: number;
  totalUniqueViewers: number;
  lastUpdate: number;
}

/**
 * Hook para escuchar métricas del evento en tiempo real desde Firebase RTDB
 * 
 * NO hace polling HTTP - se suscribe directamente a cambios en RTDB
 * El backend publica las métricas consolidadas en /metrics/{eventId}
 * 
 * @param eventId - ID del evento
 * @returns métricas en tiempo real y estado de carga
 */
export function useRealtimeMetrics(eventId: string | null | undefined) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    // Verificar que el usuario esté autenticado
    if (!user) {
      setError("Debes estar autenticado para ver las métricas");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Referencia a las métricas del evento en RTDB
    const metricsRef = ref(rtdb, `/metrics/${eventId}`);

    // Suscribirse a cambios en tiempo real
    const unsubscribe = onValue(
      metricsRef,
      (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
          setMetrics({
            currentConcurrentViewers: data.currentConcurrentViewers ?? 0,
            peakConcurrentViewers: data.peakConcurrentViewers ?? 0,
            totalUniqueViewers: data.totalUniqueViewers ?? 0,
            lastUpdate: data.lastUpdate ?? Date.now(),
          });
        } else {
          // Si no hay datos, inicializar con ceros
          setMetrics({
            currentConcurrentViewers: 0,
            peakConcurrentViewers: 0,
            totalUniqueViewers: 0,
            lastUpdate: Date.now(),
          });
        }
        
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to metrics:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Cleanup: desuscribirse cuando el componente se desmonte
    return () => {
      off(metricsRef, "value", unsubscribe);
    };
  }, [eventId, user]);

  return { metrics, loading, error };
}
