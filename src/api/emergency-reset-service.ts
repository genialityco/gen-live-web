/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/emergency-reset-service.ts
import { api } from "../core/api";
import { getDatabase, ref, remove } from "firebase/database";

/**
 * Servicio de emergencia para resetear estados desincronizados
 */

export interface ResetStateResponse {
  success: boolean;
  message: string;
  details?: {
    rtdbCleared: boolean;
    configCleared: boolean;
    egressStopped: boolean;
  };
}

/**
 * Resetea completamente el estado del evento
 * - Limpia RTDB (egress state)
 * - Para egress activos si existen
 * - Limpia configuración en backend
 */
export async function emergencyResetEventState(
  eventSlug: string
): Promise<ResetStateResponse> {
  try {
    // Llamar al backend para limpiar todo (incluye RTDB)
    const { data } = await api.post<ResetStateResponse>(
      `/events/emergency-reset/${eventSlug}`
    );

    return data;
  } catch (err: any) {
    console.error("Error in emergency reset:", err);
    return {
      success: false,
      message: err?.response?.data?.message || err.message || "Error al resetear estado",
    };
  }
}

/**
 * Verifica si existe un egress válido en LiveKit
 */
export async function validateEgressState(
  egressId: string | null
): Promise<{ valid: boolean; exists: boolean }> {
  if (!egressId) return { valid: false, exists: false };

  try {
    const { data } = await api.get(`/events/validate-egress/${egressId}`);
    return {
      valid: data.valid ?? false,
      exists: data.exists ?? false,
    };
  } catch {
    return { valid: false, exists: false };
  }
}

/**
 * Limpia solo el estado de RTDB (sin tocar backend)
 */
export async function clearRTDBState(eventSlug: string): Promise<void> {
  const db = getDatabase();
  const egressRef = ref(db, `/live/${eventSlug}/egress`);
  await remove(egressRef);
}
