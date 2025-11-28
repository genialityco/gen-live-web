/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "../core/api";

export interface OrgAttendee {
  _id: string;
  organizationId: string;
  email: string;
  name: string;
  phone?: string;
  createdAt: string;
  registrationData?: Record<string, any>;
}

export async function fetchOrgAttendeeByEmail(
  organizationId: string,
  email: string
) {
  const { data } = await api.get(
    `/org-attendees/by-email/${encodeURIComponent(email)}/org/${organizationId}`
  );

  return data as OrgAttendee | null;
}

// 👇 NUEVO: recuperar acceso por identificadores
export async function recoverOrgAccess(
  organizationId: string,
  identifierFields: Record<string, any>,
  accessUrl?: string
) {
  const payload: any = {
    organizationId,
    identifierFields,
  };

  // Sólo lo mandamos si lo quieres usar, por ahora lo dejamos vacío
  if (accessUrl) {
    payload.accessUrl = accessUrl;
  }

  const { data } = await api.post("/org-attendees/recover-access", payload);

  // backend devuelve { ok, sent, message }
  return data as {
    ok: boolean;
    sent: boolean;
    message?: string;
  };
}
