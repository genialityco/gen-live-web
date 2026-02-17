import { api } from "../core/api";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmailTemplate {
  _id: string;
  orgId: string;
  eventId?: string;
  type: string;
  name: string;
  subject: string;
  body: string;
  enabled: boolean;
  isInherited?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableVariable {
  key: string;
  label: string;
  section: string;
  hasDisplayVariant?: boolean;
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function fetchEventTemplates(
  orgId: string,
  eventId: string
): Promise<EmailTemplate[]> {
  const { data } = await api.get(
    `/event-email/org/${orgId}/event/${eventId}/templates`
  );
  return data;
}

export async function upsertEmailTemplate(payload: {
  orgId: string;
  eventId?: string;
  type: string;
  name: string;
  subject: string;
  body: string;
  enabled?: boolean;
}): Promise<EmailTemplate> {
  const { data } = await api.put("/event-email/templates", payload);
  return data;
}

export async function deleteEmailTemplate(
  templateId: string
): Promise<void> {
  await api.delete(`/event-email/templates/${templateId}`);
}

// ─── Variables ──────────────────────────────────────────────────────────────

export async function fetchEmailVariables(
  orgId: string,
  eventId?: string
): Promise<AvailableVariable[]> {
  const { data } = await api.get(`/event-email/org/${orgId}/variables`, {
    params: { eventId },
  });
  return data;
}

// ─── Preview & Test ─────────────────────────────────────────────────────────

export async function previewTemplate(params: {
  orgId: string;
  eventId?: string;
  subject: string;
  body: string;
  sampleAttendeeId?: string;
}): Promise<{ renderedSubject: string; renderedBody: string }> {
  const { data } = await api.post("/event-email/preview", params);
  return data;
}

export async function sendTestEmail(
  orgId: string,
  eventId: string,
  params: { templateId?: string; subject?: string; body?: string; to: string; sampleAttendeeId?: string }
): Promise<void> {
  await api.post(
    `/event-email/org/${orgId}/event/${eventId}/send-test`,
    params
  );
}
