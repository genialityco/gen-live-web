import type React from "react";
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Stack,
  Title,
  Card,
  Group,
  Text,
  Button,
  Badge,
  Loader,
  Center,
  Container,
  Alert,
  Box,
  MantineProvider,
} from "@mantine/core";
import { fetchOrgBySlug, type Org } from "../../api/orgs";
import { fetchEventsByOrg, type EventItem } from "../../api/events";
import { useAuth } from "../../auth/AuthProvider";
import { useEventRealtimeData } from "../../hooks/useEventRealtimeData";
import { BrandedHeader, BrandedFooter } from "../../components/branding";
import UserSession from "../../components/auth/UserSession";
import { signOut } from "firebase/auth";
import { auth } from "../../core/firebase";

export default function EventLanding() {
  const { slug, eventSlug } = useParams<{ slug: string; eventSlug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [org, setOrg] = useState<Org | null>(null);
  const [eventData, setEventData] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔹 Saber si el usuario actual está registrado a este evento
  const [isRegisteredForEvent, setIsRegisteredForEvent] = useState<
    boolean | null
  >(null);

  // Hook de tiempo real para estado del evento (solo lectura)
  const eventSlugToUse = eventSlug || "";
  const {
    resolved: event,
    status,
    // nowCount,
    loading: eventLoading,
  } = useEventRealtimeData(eventSlugToUse);

  // Verificar si el usuario actual es propietario de la organización
  const isOwner = user && org && org.ownerUid === user.uid;

  // Cargar organización y datos del evento
  const loadData = async () => {
    if (!slug || !eventSlug) return;

    try {
      setLoading(true);
      setError(null);

      const orgData = await fetchOrgBySlug(slug);
      setOrg(orgData);

      const eventsData = await fetchEventsByOrg(orgData._id);
      const foundEvent =
        eventsData.find((e) => e.slug === eventSlug || e._id === eventSlug) ||
        null;
      setEventData(foundEvent);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("No se pudo cargar la información del evento");
    } finally {
      setLoading(false);
    }
  };

  // Prefetch: saber si el usuario YA está registrado al evento (EventUser existe)
  useEffect(() => {
    const checkExistingRegistration = async () => {
      if (!user || !eventData?._id || !org?._id) {
        setIsRegisteredForEvent(null);
        return;
      }

      let userEmail: string | null = user.email || null;

      if (!userEmail && user.uid) {
        userEmail =
          localStorage.getItem(`uid-${user.uid}-email`) ||
          localStorage.getItem("user-email");
      }

      if (!userEmail) {
        setIsRegisteredForEvent(null);
        return;
      }

      try {
        const { checkIfRegistered } = await import("../../api/events");
        const result = await checkIfRegistered(eventData._id, userEmail);

        console.log("🔍 Prefetch registration state:", {
          email: userEmail,
          eventId: eventData._id,
          isRegistered: result.isRegistered,
        });

        setIsRegisteredForEvent(!!result.isRegistered);
      } catch (e) {
        console.error("❌ Error prefetching registration state:", e);
        setIsRegisteredForEvent(null);
      }
    };

    void checkExistingRegistration();
  }, [user?.uid, eventData?._id, org?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manejar el click en el botón principal
  const handleMainAction = async () => {
    // 🟡 1) Si NO hay sesión → ir siempre al flujo centralizado /access
    if (!user) {
      if (!slug) {
        console.error("No slug found when trying to go to access");
        return;
      }

      const base = `/org/${slug}/access`;
      const url = eventSlug ? `${base}?eventSlug=${eventSlug}` : base;

      console.log("🎟️ EventLanding: No session, going to access:", url);
      navigate(url);
      return;
    }

    // 🟢 2) Si ya sabemos que está registrado → ir directo al attend
    if (isRegisteredForEvent && slug && eventSlug) {
      console.log(
        "✅ User already registered (prefetched), redirecting to /attend"
      );
      navigate(`/org/${slug}/event/${eventSlug}/attend`);
      return;
    }

    // 🟢 3) Usuario con sesión: intentar auto-registro usando email + OrgAttendee
    let userEmail = user.email || undefined;

    if (!userEmail && user.uid) {
      userEmail =
        localStorage.getItem(`uid-${user.uid}-email`) ||
        localStorage.getItem("user-email") ||
        undefined;
    }

    if (userEmail && user.uid && eventData?._id && org?._id) {
      console.log(
        "🔍 EventLanding: Validating existing session before redirecting",
        {
          userEmail,
          eventId: eventData._id,
          orgId: org._id,
          hasUID: !!user.uid,
        }
      );

      try {
        const { checkIfRegistered, registerToEventWithFirebase } = await import(
          "../../api/events"
        );
        const result = await checkIfRegistered(eventData._id, userEmail);

        if (result.isRegistered) {
          console.log(
            "✅ EventLanding: User already registered, redirecting to /attend"
          );
          navigate(`/org/${slug}/event/${eventSlug}/attend`);
          return;
        }

        if (result.orgAttendee) {
          console.log(
            "🎯 EventLanding: User has OrgAttendee, auto-registering to event"
          );

          await registerToEventWithFirebase(eventData._id, {
            email: userEmail,
            name: result.orgAttendee.name,
            formData: result.orgAttendee.registrationData,
            firebaseUID: user.uid,
          });

          console.log(
            "✅ EventLanding: Auto-registration successful, redirecting to /attend"
          );
          navigate(`/org/${slug}/event/${eventSlug}/attend`);
          return;
        }

        console.log(
          "⚠️ EventLanding: User has session but no OrgAttendee for this org"
        );
      } catch (error) {
        console.error(
          "❌ EventLanding: Error in auto-registration flow:",
          error
        );
      }
    }

    // 4) Usuario logueado pero sin OrgAttendee/EventUser → forzar logout y limpiar sesión
    console.log(
      "EventLanding: Logged user but no OrgAttendee/EventUser → forcing logout"
    );

    try {
      // 1) Cerrar sesión en Firebase
      await signOut(auth);

      // 2) Limpiar correos almacenados
      localStorage.removeItem("user-email");

      if (user?.uid) {
        localStorage.removeItem(`uid-${user.uid}-email`);
      }

      // (Opcional) Limpieza extra de llaves relacionadas
      Object.keys(localStorage)
        .filter((k) => k.startsWith("uid-") || k.includes("email"))
        .forEach((k) => localStorage.removeItem(k));

      console.log(
        "✅ EventLanding: Session cleaned, user must go through /access again"
      );
    } catch (error) {
      console.error("❌ EventLanding: Error cleaning session:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, [slug, eventSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const finalLoading = loading || eventLoading;
  const finalError =
    error || (!event && !eventLoading ? "Evento no encontrado" : null);

  if (finalLoading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="lg">
          <Loader size="lg" />
          <Text>Cargando información del evento...</Text>
        </Stack>
      </Center>
    );
  }

  if (finalError || !org || !event) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Text c="red" size="xl" fw={600}>
            {finalError || "Evento no encontrado"}
          </Text>
          <Text c="dimmed" ta="center">
            Lo sentimos, no pudimos cargar la información del evento solicitado.
          </Text>
        </Stack>
      </Center>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live":
        return "green";
      case "upcoming":
        return "blue";
      case "ended":
        return "gray";
      case "replay":
        return "orange";
      default:
        return "gray";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "live":
        return "En vivo ahora";
      case "upcoming":
        return "Próximamente";
      case "ended":
        return "Finalizado";
      case "replay":
        return "Repetición disponible";
      default:
        return "Estado desconocido";
    }
  };

  // 🔹 Ahora recibe si el usuario está registrado o no
  const getActionButtonText = (status: string, isRegistered: boolean) => {
    if (isRegistered) {
      switch (status) {
        case "live":
          return "Ingresar al evento en vivo";
        case "replay":
          return "Ingresar a la repetición";
        case "ended":
          return "Ingresar al contenido del evento";
        case "upcoming":
        default:
          return "Ingresar al evento";
      }
    }

    switch (status) {
      case "live":
        return "Registrarme para ingresar en vivo";
      case "replay":
        return "Registrarme para ver la repetición";
      case "ended":
        return "Registrarme para ver la información";
      case "upcoming":
      default:
        return "Check in al evento";
    }
  };

  // Devuelve la fecha del evento formateada en la hora local del usuario
  const userTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const formatEventDateForUser = (dateInput?: string | null): string | null => {
    if (!dateInput) return null;

    const date = new Date(dateInput);

    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: userTimeZone,
    }).format(date);
  };

  // Tiempo restante para eventos próximos
  const getTimeUntilEvent = () => {
    if (status !== "upcoming" || !eventData?.startDate) return null;

    const now = new Date();
    const eventDate = new Date(
      eventData.startDate || eventData.schedule?.startsAt || ""
    );
    const diffMs = eventDate.getTime() - now.getTime();

    if (diffMs <= 0) return null;

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0)
      return `${days} día${days > 1 ? "s" : ""}, ${hours} hora${
        hours > 1 ? "s" : ""
      }`;
    if (hours > 0)
      return `${hours} hora${hours > 1 ? "s" : ""}, ${minutes} minuto${
        minutes > 1 ? "s" : ""
      }`;
    return `${minutes} minuto${minutes > 1 ? "s" : ""}`;
  };

  const timeUntilEvent = getTimeUntilEvent();

  // Branding del evento con fallback al de la organización
  const eventBranding = eventData?.branding || org?.branding;

  const brandingColors = eventBranding?.colors;
  const brandingStyle = brandingColors
    ? ({
        "--primary-color": brandingColors.primary || undefined,
        "--secondary-color": brandingColors.secondary || undefined,
        "--accent-color": brandingColors.accent || undefined,
        "--bg-color": brandingColors.background || undefined,
        "--text-color": brandingColors.text || undefined,
      } as React.CSSProperties)
    : {};

  const primaryColor = eventBranding?.colors?.primary || "#228BE6";
  // MantineColorsTuple must be an array of exactly 10 color strings
  const brandColors: [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string
  ] = Array(10)
    .fill(primaryColor)
    .map((c, i) => (i === 5 ? eventBranding?.colors?.accent || c : c)) as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string
  ];

  const customTheme = eventBranding?.colors?.primary
    ? {
        colors: {
          brand: brandColors,
        },
        primaryColor: "brand" as const,
      }
    : {};

  console.log(eventBranding);

  return (
    <MantineProvider theme={customTheme}>
      <Box style={brandingStyle}>
        <BrandedHeader config={eventBranding?.header} />

        <Container size="md" py="xl">
          {/* Header con UserSession */}
          <Group justify="space-between" align="center" mb="xl">
            <Button
              component={Link}
              to={`/org/${slug}`}
              variant="subtle"
              size="sm"
              leftSection="←"
            >
              {org.name}
            </Button>
            <UserSession eventId={eventData?._id} orgId={org?._id} />
          </Group>

          <Stack gap="xl" align="center">
            <Card
              shadow="xl"
              padding="xl"
              radius="xl"
              withBorder
              w="100%"
              maw={800}
              style={{
                backgroundColor: brandingColors?.background
                  ? `${brandingColors.background}08`
                  : undefined,
                borderColor: brandingColors?.primary
                  ? `${brandingColors.primary}20`
                  : undefined,
              }}
            >
              <Stack gap="xl" align="center">
                {/* Estado del evento */}
                <Group justify="center" gap="md">
                  <Badge
                    color={getStatusColor(status)}
                    size="xl"
                    variant={status === "live" ? "filled" : "light"}
                    p="md"
                  >
                    {status === "live" && "🔴 "}
                    {getStatusText(status)}
                  </Badge>
                  {/* {nowCount > 0 && (
                    <Badge variant="light" color="gray" size="lg" p="md">
                      👥 {nowCount}{" "}
                      {nowCount === 1 ? "persona viendo" : "personas viendo"}
                    </Badge>
                  )} */}
                </Group>

                {/* Título */}
                <Box ta="center">
                  <Title order={1} size="2.5rem" fw={700} lh={1.2} mb="sm">
                    {event.title}
                  </Title>
                </Box>

                {/* Fecha y tiempo */}
                {(eventData?.startDate || eventData?.schedule?.startsAt) && (
                  <Alert
                    variant="light"
                    color={status === "live" ? "green" : "blue"}
                    radius="md"
                    w="100%"
                  >
                    <Stack gap="xs" align="center">
                      <Text size="lg" fw={600} ta="center">
                        📅{" "}
                        {formatEventDateForUser(
                          eventData.startDate ||
                            eventData.schedule?.startsAt ||
                            null
                        )}
                      </Text>

                      <Text size="xs" c="dimmed" ta="center">
                        Hora mostrada según tu zona horaria ({userTimeZone})
                      </Text>

                      {timeUntilEvent && (
                        <Text size="md" c="dimmed" ta="center">
                          ⏰ Faltan {timeUntilEvent} para el inicio
                        </Text>
                      )}
                    </Stack>
                  </Alert>
                )}

                {/* Botón principal */}
                <Button
                  onClick={handleMainAction}
                  size="xl"
                  radius="xl"
                  leftSection="🎟️"
                  variant={status === "live" ? "gradient" : "filled"}
                  gradient={
                    status === "live"
                      ? { from: "red", to: "pink", deg: 90 }
                      : undefined
                  }
                  color={
                    status === "live"
                      ? undefined
                      : eventBranding?.colors?.primary
                      ? "brand"
                      : getStatusColor(status)
                  }
                  w="100%"
                  maw={400}
                  h={60}
                  fz="lg"
                  fw={600}
                >
                  {getActionButtonText(status, !!isRegisteredForEvent)}
                </Button>

                {/* Mensajes según estado */}
                {status === "live" && (
                  <Alert color="red" variant="light" w="100%">
                    <Text size="sm" ta="center">
                      🔥 El evento está en vivo ahora.{" "}
                      {isRegisteredForEvent
                        ? "Ingresa para ver la transmisión."
                        : "Regístrate para unirte a la transmisión."}
                    </Text>
                  </Alert>
                )}

                {status === "upcoming" && (
                  <Alert color="blue" variant="light" w="100%">
                    <Text size="sm" ta="center">
                      📝{" "}
                      {isRegisteredForEvent
                        ? "Ya estás registrado, presiona en ingresar al evento."
                        : "Regístrate ahora para reservar tu lugar."}
                    </Text>
                  </Alert>
                )}

                {status === "ended" && (
                  <Alert color="gray" variant="light" w="100%">
                    <Text size="sm" ta="center">
                      📋 El evento ha finalizado.{" "}
                      {isRegisteredForEvent
                        ? "Ingresa para ver la información disponible."
                        : "Puedes registrarte para ver la información disponible si el organizador la habilitó."}
                    </Text>
                  </Alert>
                )}

                {status === "replay" && (
                  <Alert color="orange" variant="light" w="100%">
                    <Text size="sm" ta="center">
                      ▶️ La repetición está disponible.{" "}
                      {isRegisteredForEvent
                        ? "Ingresa para ver el contenido grabado."
                        : "Regístrate o ingresa para acceder al contenido grabado."}
                    </Text>
                  </Alert>
                )}
              </Stack>
            </Card>

            {isOwner && (
              <Button
                component={Link}
                to={`/org/${slug}/event/${eventSlug}/admin`}
                variant="light"
                size="sm"
                leftSection="🎛️"
              >
                Panel de administración
              </Button>
            )}
          </Stack>
        </Container>

        <BrandedFooter config={eventBranding?.footer} />
      </Box>
    </MantineProvider>
  );
}
