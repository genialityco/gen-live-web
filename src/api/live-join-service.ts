/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "../core/api";
import { auth } from "../core/firebase";
import {
  getDatabase,
  onValue,
  ref,
  off,
  DataSnapshot,
} from "firebase/database";

export type JoinDecisionStatus = "approved" | "rejected" | "kicked";

export interface JoinDecision {
  status: JoinDecisionStatus;
  token?: string; // si approved
  role?: "speaker";
  message?: string;
  updatedAt?: number;
}

export interface JoinRequest {
  requestId: string;
  uid: string;
  name?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt?: number;
}

/**
 * Viewer -> solicita unirse
 */
export async function requestToJoin(eventSlug: string, name?: string) {
  const { data } = await api.post("/livekit/join-request", { eventSlug, name });
  return data as { ok: boolean; requestId: string };
}

/**
 * Host -> aprobar
 */
export async function approveJoin(eventSlug: string, requestId: string) {
  const { data } = await api.post("/livekit/join-approve", {
    eventSlug,
    requestId,
  });
  return data as { ok: boolean };
}

/**
 * Host -> rechazar
 */
export async function rejectJoin(
  eventSlug: string,
  requestId: string,
  message?: string
) {
  const { data } = await api.post("/livekit/join-reject", {
    eventSlug,
    requestId,
    message,
  });
  return data as { ok: boolean };
}

/**
 * Host -> expulsar (kicker)
 */
export async function kickSpeaker(eventSlug: string, uid: string) {
  const { data } = await api.post("/livekit/kick", { eventSlug, uid });
  return data as { ok: boolean };
}

/**
 * Viewer: escucha decisión en RTDB
 * /live/{eventSlug}/joinDecisions/{uid}
 */
export function subscribeJoinDecision(
  eventSlug: string,
  onDecision: (d: JoinDecision | null) => void
) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("No hay usuario autenticado");

  const db = getDatabase();
  const decisionRef = ref(db, `/live/${eventSlug}/joinDecisions/${uid}`);

  const handler = (snap: DataSnapshot) => {
    onDecision((snap.val() as JoinDecision) ?? null);
  };

  onValue(decisionRef, handler);

  return () => off(decisionRef, "value", handler);
}

/**
 * Host: escucha requests en RTDB
 * /live/{eventSlug}/joinRequests
 */
export function subscribeJoinRequests(
  eventSlug: string,
  onRequests: (items: JoinRequest[]) => void
) {
  const db = getDatabase();
  const requestsRef = ref(db, `/live/${eventSlug}/joinRequests`);

  const handler = (snap: DataSnapshot) => {
    const val = snap.val() ?? {};
    const items: JoinRequest[] = Object.entries(val).map(([requestId, v]) => ({
      requestId,
      ...(v as any),
    }));
    // orden por createdAt desc
    items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    onRequests(items);
  };

  onValue(requestsRef, handler);

  return () => off(requestsRef, "value", handler);
}
