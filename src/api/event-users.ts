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