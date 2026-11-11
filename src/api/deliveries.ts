// src/api/deliveries.ts
// Registro de los mensajes que se le mostraron al asistente (anuncios de
// manada, logros, saludos). Sirve para medir los experimentos: "recibió"
// significa "se le mostró", no solo "era elegible".
import { api } from "../core/api";

export type DeliveryFeature = "herd" | "milestone" | "greeting";
export type DeliveryChannel = "private" | "public";
export type DeliverySource = "welcome" | "repeat" | "manual" | "growth" | "received" | "reply";

export type DeliveryReport = {
  feature: DeliveryFeature;
  channel: DeliveryChannel;
  source?: DeliverySource;
  groupKey?: string;
  // Identificador del mensaje: el backend no cuenta dos veces el mismo
  refId?: string;
};

/**
 * Avisa al backend que se pintó un mensaje. No bloquea ni falla: si no se
 * puede registrar, el banner ya se mostró igual. El backend solo lo guarda
 * con el evento en vivo y para espectadores inscritos.
 */
export function reportDelivery(eventId: string, report: DeliveryReport) {
  void api.post(`/events/${eventId}/deliveries`, report).catch(() => {});
}
