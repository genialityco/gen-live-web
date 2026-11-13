// src/api/contacts.ts
// Intercambio de contactos entre colegas que se saludaron (saludo + devolución).
// Doble consentimiento: los datos solo llegan cuando ambos aceptaron, y solo
// desde el API (nada viaja por RTDB).
import { api } from "../core/api";

export type ContactPairStatus = "pending" | "waiting" | "mutual";

export type ContactPair = {
  id: string;
  status: ContactPairStatus;
  dismissed: boolean; // «Ahora no»
  theyAccepted: boolean; // el otro ya compartió (esperándome)
  inEvent: boolean; // se saludaron en este evento
  groupLabel: string | null;
  name: string; // primer nombre hasta el intercambio; luego el completo
  contact: { email: string | null; whatsapp: string | null; note: string | null } | null;
  since: string | null;
};

export type ContactCard = {
  email: string | null;
  whatsapp: string | null;
  note: string | null;
  consentAt: string;
};

export type MyContacts = {
  visible: boolean;
  enabled: boolean;
  consentText: string;
  card: ContactCard | null;
  defaults: { email: string | null; whatsapp: string | null } | null;
  pairs: ContactPair[];
};

/** Evento de ventana para refrescar «Contactos» (p. ej. tras devolver un saludo) */
export const CONTACTS_REFRESH_EVENT = "gl:contacts-refresh";

export async function getMyContacts(eventId: string): Promise<MyContacts> {
  const { data } = await api.get(`/events/${eventId}/contacts/mine`);
  return data;
}

export async function saveContactCard(
  eventId: string,
  card: { email?: string; whatsapp?: string; note?: string; consent: true },
) {
  const { data } = await api.put(`/events/${eventId}/contacts/card`, card);
  return data as { ok: boolean };
}

export async function deleteContactCard(eventId: string) {
  const { data } = await api.delete(`/events/${eventId}/contacts/card`);
  return data as { ok: boolean };
}

export async function shareContact(eventId: string, pairId: string) {
  await api.post(`/events/${eventId}/contacts/${pairId}/share`);
}

export async function unshareContact(eventId: string, pairId: string) {
  await api.delete(`/events/${eventId}/contacts/${pairId}/share`);
}

export async function dismissContact(eventId: string, pairId: string) {
  await api.post(`/events/${eventId}/contacts/${pairId}/dismiss`);
}

export async function blockContact(eventId: string, pairId: string) {
  await api.post(`/events/${eventId}/contacts/${pairId}/block`);
}

/** Texto de autorización de la organización (panel del dueño) */
export async function getOrgContactConsent(slug: string) {
  const { data } = await api.get(`/orgs/slug/${slug}/contact-exchange`);
  return data as { consentText: string; defaultText: string };
}

export async function updateOrgContactConsent(slug: string, consentText: string) {
  const { data } = await api.put(`/orgs/slug/${slug}/contact-exchange`, { consentText });
  return data as { consentText: string; defaultText: string };
}

/** vCard mínima para «Guardar contacto» */
export function contactVCard(p: ContactPair) {
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${esc(p.name)}`];
  if (p.contact?.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(p.contact.email)}`);
  if (p.contact?.whatsapp) lines.push(`TEL;TYPE=CELL:+${p.contact.whatsapp}`);
  const note = [p.contact?.note, p.groupLabel ? `Colega de ${p.groupLabel}` : null].filter(Boolean).join(" · ");
  if (note) lines.push(`NOTE:${esc(note)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}
