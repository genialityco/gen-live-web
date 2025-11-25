// api/event-users.ts
import { api } from "../core/api";

export async function registerEventUserFromOrgAttendee(
  attendeeId: string,
  eventId: string,
  firebaseUID?: string
) {
  return await api.post("/event-users/register", {
    attendeeId,
    eventId,
    firebaseUID,
  });
}

// Actualizar último login (lastLoginAt)
export async function updateEventUserLastLogin(
  attendeeId: string,
  eventId: string
) {
  return await api.patch("/event-users/update-login", {
    attendeeId,
    eventId,
  });
}

// Marcar como asistió / check-in
export async function markEventUserAsAttended(
  attendeeId: string,
  eventId: string
) {
  return await api.patch("/event-users/mark-attended", {
    attendeeId,
    eventId,
  });
}
