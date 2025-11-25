/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "../core/api";
export interface OrgAttendee {
  _id: string;
  organizationId: string;
  email: string;
  name: string;
  phone?: string;
  createdAt: string; // o Date si luego lo parseas
  registrationData?: Record<string, any>;
}

export async function fetchOrgAttendeeByEmail(
  organizationId: string,
  email: string
) {
  const { data } = await api.get(
    `/org-attendees/by-email/${encodeURIComponent(email)}/org/${organizationId}`
  );

  // El backend devuelve directamente el OrgAttendee
  return data as OrgAttendee | null;
}
