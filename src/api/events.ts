/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "../core/api";

// Tipos de branding para eventos
export interface EventBrandingColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}

export interface EventBrandingHeader {
  enabled?: boolean;
  backgroundImageUrl?: string; // Imagen de fondo desktop
  backgroundImageMobileUrl?: string; // Imagen de fondo mobile
}

export interface EventBrandingFooter {
  enabled?: boolean;
  backgroundImageUrl?: string; // Imagen de fondo desktop
  backgroundImageMobileUrl?: string; // Imagen de fondo mobile
}

export interface EventBrandingConfig {
  // Colores personalizados del evento
  colors?: EventBrandingColors;

  // Header personalizado del evento
  header?: EventBrandingHeader;

  // Footer personalizado del evento
  footer?: EventBrandingFooter;

  // Imagen de portada del evento
  coverImageUrl?: string;
  coverImageMobileUrl?: string;
}

export type EventItem = {
  _id: string;
  orgId: string;
  slug: string;
  title: string;
  description?: string;
  status: "upcoming" | "live" | "ended" | "replay";
  schedule?: { startsAt?: string; endsAt?: string };
  stream?: { url?: string; provider?: string };
  branding?: EventBrandingConfig; // Campo de branding del evento
  createdAt?: string;
  startDate?: string; // Para compatibilidad
};

export async function fetchEventsByOrg(orgId: string): Promise<EventItem[]> {
  const { data } = await api.get(`/events/public/by-org/${orgId}`);
  return data;
}

export async function fetchEventsByOrgPrivate(
  orgId: string
): Promise<EventItem[]> {
  const { data } = await api.get(`/events/by-org/${orgId}`);
  return data;
}

export async function createEvent(payload: {
  orgId: string;
  slug: string;
  title: string;
  schedule?: { startsAt?: string; endsAt?: string };
  stream?: { url?: string; provider?: string };
}) {
  const { data } = await api.post("/events", payload);
  return data as EventItem;
}

export async function updateEvent(
  eventId: string,
  payload: {
    title?: string;
    description?: string;
    schedule?: { startsAt?: string; endsAt?: string };
  }
) {
  const { data } = await api.patch(`/events/${eventId}`, payload);
  return data as EventItem;
}

export async function setEventStatus(
  eventId: string,
  status: EventItem["status"]
) {
  return api.patch(`/events/${eventId}/status`, { status });
}

export async function updateEventStream(
  eventId: string,
  payload: { provider: "vimeo"; url: string; meta?: any }
) {
  const { data } = await api.patch(`/events/${eventId}/stream`, payload);
  return data;
}

// Registro de usuarios a eventos (sin autenticación)
export interface RegisterToEventData {
  email: string; // Campo obligatorio del sistema
  name?: string; // Opcional, extraído del formulario
  formData?: Record<string, any>; // Todos los campos del formulario
  metadata?: Record<string, any>;
  firebaseUID?: string; // Firebase UID para sesión anónima
}

export async function registerToEvent(
  eventId: string,
  data: RegisterToEventData
) {
  const { data: response } = await api.post(
    `/events/${eventId}/register`,
    data
  );
  return response;
}

export async function registerToEventWithFirebase(
  eventId: string,
  data: RegisterToEventData
) {
  if (!data.firebaseUID) {
    throw new Error("Firebase UID is required for this function");
  }
  const { data: response } = await api.post(
    `/events/${eventId}/register-with-firebase`,
    data
  );
  return response;
}

export async function checkIfRegistered(eventId: string, email: string) {
  console.log("🌐 API: Checking if registered", { eventId, email });

  const { data } = await api.get(`/events/${eventId}/is-registered`, {
    params: { email },
  });

  console.log("📡 API: Registration check response", data);
  return data as {
    isRegistered: boolean;
    orgAttendee?: {
      _id: string;
      organizationId: string;
      email: string;
      name: string;
      registrationData?: Record<string, any>;
    };
    eventUser?: any;
  };
}

export async function checkIfRegisteredByUID(
  eventId: string,
  firebaseUID: string
) {
  console.log("🌐 API: Checking if registered by UID", {
    eventId,
    firebaseUID,
  });

  const { data } = await api.get(`/events/${eventId}/is-registered-by-uid`, {
    params: { firebaseUID },
  });

  console.log("📡 API: Registration check by UID response", data);
  return data as { isRegistered: boolean };
}

export async function associateFirebaseUID(
  eventId: string,
  email: string,
  firebaseUID: string
) {
  console.log("🌐 API: Associating Firebase UID", {
    eventId,
    email,
    firebaseUID,
  });

  const { data } = await api.post(`/events/${eventId}/associate-firebase-uid`, {
    email,
    firebaseUID,
  });

  console.log("📡 API: Associate UID response", data);
  return data;
}

export type OrgCheckReason = "USER_NOT_FOUND" | "INVALID_FIELDS";

export type OrgCheckResponse = {
  found: boolean;
  reason?: OrgCheckReason;
  message?: string;
  mismatched?: string[];
  orgAttendee?: any;
};

export async function checkOrgRegistrationByIdentifiers(
  orgId: string,
  identifierFields: Record<string, any>
): Promise<OrgCheckResponse> {
  console.log("🌐 API: Checking ORG registration by identifiers", {
    orgId,
    identifierFields,
  });

  const { data } = await api.post(
    `/events/org/${orgId}/check-registration-by-identifiers`,
    {
      identifierFields,
    }
  );

  console.log("📡 API: ORG registration check by identifiers response", data);
  return data as {
    found: boolean;
    orgAttendee?: {
      _id: string;
      organizationId: string;
      email: string;
      name?: string;
      registrationData?: Record<string, any>;
    };
    message?: string;
  };
}

export async function checkRegistrationByIdentifiers(
  eventId: string,
  identifierFields: Record<string, any>
) {
  console.log("🌐 API: Checking registration by identifiers", {
    eventId,
    identifierFields,
  });

  const { data } = await api.post(
    `/events/${eventId}/check-registration-by-identifiers`,
    {
      identifierFields,
    }
  );

  console.log("📡 API: Registration check by identifiers response", data);
  return data as {
    isRegistered: boolean;
    orgAttendee?: any;
    eventUser?: any;
    message?: string;
  };
}

// Buscar registro existente por campos identificadores
export interface FindRegistrationData {
  eventId: string;
  identifiers: Record<string, string>; // { email: 'test@test.com', numId: '123456' }
}

export interface FoundRegistration {
  found: boolean;
  attendee?: {
    _id: string;
    email: string;
    registrationData: Record<string, any>;
    orgId: string;
    isActive: boolean;
    registeredAt: string;
  };
  eventUser?: {
    _id: string;
    eventId: string;
    attendeeId: string;
    email: string;
    status: string;
    registeredAt: string;
  };
  isRegistered?: boolean;
}

export async function findRegistration(
  data: FindRegistrationData
): Promise<FoundRegistration> {
  const { data: response } = await api.post("/events/find-registration", data);
  return response;
}

// Actualizar registro existente
export interface UpdateRegistrationData {
  attendeeId: string;
  formData: Record<string, any>;
  metadata?: Record<string, any>;
}

export async function updateRegistration(data: UpdateRegistrationData) {
  const { data: response } = await api.patch(
    "/events/update-registration",
    data
  );
  return response;
}

// Crear EventUser para attendee existente
export async function createEventUserForAttendee(
  eventId: string,
  attendeeId: string
) {
  const { data } = await api.post(
    `/events/${eventId}/create-event-user/${attendeeId}`
  );
  return data;
}

// Crear EventUser automáticamente para usuario con sesión (busca OrgAttendee existente)
export async function createEventUserForSession(
  eventId: string,
  firebaseUID: string,
  userEmail: string
) {
  console.log("🔍 API: Creating EventUser for session", {
    eventId,
    firebaseUID,
    userEmail,
  });

  try {
    // Intentar crear/actualizar usando el endpoint con Firebase UID incluido
    const { data } = await api.post(
      `/events/${eventId}/register-with-firebase`,
      {
        email: userEmail,
        firebaseUID: firebaseUID,
        formData: { auto_created_from_session: true },
      }
    );

    console.log("✅ API: EventUser created/updated for session");
    return data;
  } catch (error) {
    console.error("❌ API: Failed to create EventUser for session:", error);
    throw error;
  }
}

// Actualizar branding del evento
export async function updateEventBranding(
  eventId: string,
  branding: EventBrandingConfig
) {
  const { data } = await api.patch(`/events/${eventId}/branding`, branding);
  return data;
}

// Subir imagen para branding del evento
export async function uploadEventImage(
  eventId: string,
  folder: "headers" | "covers" | "footers",
  file: File
): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post(
    `/events/${eventId}/upload/${folder}`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return data;
}
