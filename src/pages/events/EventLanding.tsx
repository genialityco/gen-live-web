import { useState, useEffect, useMemo } from "react";
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
import {
  cssVars,
  makeTheme,
  pageBackground,
  resolveBrandingColorsFromBranding,
} from "../../utils/branding";

export default function EventLanding() {
  const { slug, eventSlug } = useParams<{ slug: string; eventSlug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [org, setOrg] = useState<Org | null>(null);
  const [eventData, setEventData] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Branding del evento con fallback al de la organización
  const eventBranding = eventData?.branding || org?.branding;
  const brand = resolveBrandingColorsFromBranding(eventBranding?.colors);
  const theme = useMemo(() => makeTheme(brand), [brand]);

  // Saber si el usuario actual está registrado a este evento
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
        "✅ User already registered (prefetched), redirecting to /attend",
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
        },
      );

      try {
        const { checkIfRegistered, registerToEventWithFirebase } =
          await import("../../api/events");
        const result = await checkIfRegistered(eventData._id, userEmail);

        if (result.isRegistered) {
          console.log(
            "✅ EventLanding: User already registered, redirecting to /attend",
          );
          navigate(`/org/${slug}/event/${eventSlug}/attend`);
          return;
        }

        if (result.orgAttendee) {
          console.log(
            "🎯 EventLanding: User has OrgAttendee, auto-registering to event",
          );

          await registerToEventWithFirebase(eventData._id, {
            email: userEmail,
            name: result.orgAttendee.name,
            formData: result.orgAttendee.registrationData,
            firebaseUID: user.uid,
          });

          console.log(
            "✅ EventLanding: Auto-registration successful, redirecting to /attend",
          );
          navigate(`/org/${slug}/event/${eventSlug}/attend`);
          return;
        }

        console.log(
          "⚠️ EventLanding: User has session but no OrgAttendee for this org",
        );
      } catch (error) {
        console.error(
          "❌ EventLanding: Error in auto-registration flow:",
          error,
        );
      }
    }

    // 4) Usuario logueado pero sin OrgAttendee/EventUser → forzar logout y limpiar sesión
    console.log(
      "EventLanding: Logged user but no OrgAttendee/EventUser → forcing logout",
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
        "✅ EventLanding: Session cleaned, user must go through /access again",
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
      eventData.startDate || eventData.schedule?.startsAt || "",
    );
    const diffMs = eventDate.getTime() - now.getTime();

    if (diffMs <= 0) return null;

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
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
  // const eventBranding = eventData?.branding || org?.branding;

  // const brandingColors = eventBranding?.colors;
  // const brandingStyle = brandingColors
  //   ? ({
  //       "--primary-color": brandingColors.primary || undefined,
  //       "--secondary-color": brandingColors.secondary || undefined,
  //       "--accent-color": brandingColors.accent || undefined,
  //       "--bg-color": brandingColors.background || undefined,
  //       "--text-color": brandingColors.text || undefined,
  //     } as React.CSSProperties)
  //   : {};

  // const primaryColor = eventBranding?.colors?.primary || "#228BE6";
  // const accentColor = eventBranding?.colors?.accent || "#7C3AED";
  // const secondaryColor = eventBranding?.colors?.secondary || "#14B8A6";

  // // MantineColorsTuple must be an array of exactly 10 color strings
  // const brandColors: [
  //   string,
  //   string,
  //   string,
  //   string,
  //   string,
  //   string,
  //   string,
  //   string,
  //   string,
  //   string,
  // ] = Array(10)
  //   .fill(primaryColor)
  //   .map((c, i) => (i === 5 ? eventBranding?.colors?.accent || c : c)) as [
  //   string,
  //   string,
  //   string,
  //   string,
  //   string,
  //   string,
  //   string,
  //   string,
  //   string,
  //   string,
  // ];

  // const customTheme = eventBranding?.colors?.primary
  //   ? {
  //       colors: {
  //         brand: brandColors,
  //       },
  //       primaryColor: "brand" as const,
  //     }
  //   : {};

  return (
    <MantineProvider theme={theme} withCssVariables>
      <Box
        style={{
          ...cssVars(brand),
          ...pageBackground(brand),
          minHeight: "100vh",
        }}
        c="var(--text-color)"
      >
        <BrandedHeader config={eventBranding?.header} />

        {/* Background / Hero */}
        <Container size="md" py={{ base: "lg", sm: "xl" }}>
          {/* Top bar */}
          <Group
            justify="space-between"
            align="center"
            mb={{ base: "md", sm: "xl" }}
            wrap="wrap"
          >
            <Button
              component={Link}
              to={`/org/${slug}`}
              variant="subtle"
              size="sm"
              radius="xl"
              leftSection="←"
              style={{ flexShrink: 0 }}
            >
              {org.name}
            </Button>

            <UserSession eventId={eventData?._id} orgId={org?._id} />
          </Group>

          <Stack gap={"lg"} align="center">
            {/* Main card */}
            <Card
              withBorder
              radius="2xl"
              shadow="xl"
              p={{ base: "lg", sm: "xl" }}
              w="100%"
              maw={860}
            >
              <Stack gap={"lg"} align="center">
                {/* Status */}
                <Group justify="center" gap="sm" wrap="wrap">
                  <Badge
                    color={getStatusColor(status)}
                    size="xl"
                    radius="xl"
                    variant={status === "live" ? "filled" : "light"}
                    styles={{ root: { paddingInline: 14, paddingBlock: 10 } }}
                  >
                    {status === "live" && "🔴 "}
                    {getStatusText(status)}
                  </Badge>

                  {timeUntilEvent && status === "upcoming" && (
                    <Badge color="gray" variant="light" size="xl" radius="xl">
                      ⏰ Faltan {timeUntilEvent}
                    </Badge>
                  )}
                </Group>

                {/* Title */}
                <Stack gap={6} ta="center">
                  <Title
                    order={1}
                    fw={900}
                    style={{
                      fontSize: "clamp(1.7rem, 4vw, 2.7rem)",
                      lineHeight: 1.1,
                      letterSpacing: -0.4,
                    }}
                  >
                    {event.title}
                  </Title>

                  <Text c="dimmed" size="sm">
                    {isRegisteredForEvent
                      ? "✅ Ya estás identificado"
                      : "🎫 Check-in rápido para ingresar"}
                  </Text>
                </Stack>

                {/* Date box */}
                {(eventData?.startDate || eventData?.schedule?.startsAt) && (
                  <Card
                    withBorder
                    radius="xl"
                    p="md"
                    w="100%"
                    styles={{
                      root: {
                        background: "rgba(255,255,255,.55)",
                        borderColor: "rgba(0,0,0,.08)",
                      },
                    }}
                  >
                    <Stack gap={6} align="center">
                      <Text
                        fw={800}
                        ta="center"
                        style={{ fontSize: "clamp(1rem, 2.2vw, 1.2rem)" }}
                      >
                        📅{" "}
                        {formatEventDateForUser(
                          eventData.startDate ||
                            eventData.schedule?.startsAt ||
                            null,
                        )}
                      </Text>

                      <Text size="xs" c="dimmed" ta="center">
                        Hora mostrada según tu zona horaria ({userTimeZone})
                      </Text>
                    </Stack>
                  </Card>
                )}

                {/* Main action */}
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
                  maw={480}
                  styles={{
                    root: {
                      boxShadow: "0 18px 40px rgba(0,0,0,.12)",
                      height: "auto", // 👈 clave
                      paddingTop: 14, // 👈 buen touch target
                      paddingBottom: 14,
                      whiteSpace: "normal", // 👈 permite salto de línea
                    },
                    label: {
                      whiteSpace: "normal", // 👈 permite 2 líneas
                      textAlign: "center",
                      lineHeight: 1.15,
                    },
                    inner: {
                      alignItems: "center",
                    },
                  }}
                >
                  {getActionButtonText(status, !!isRegisteredForEvent)}
                </Button>

                {/* Context message (single consistent alert style) */}
                {status === "live" && (
                  <Alert color="red" variant="light" radius="xl" w="100%">
                    <Text size="sm" ta="center">
                      🔥 El evento está en vivo ahora.{" "}
                      {isRegisteredForEvent
                        ? "Ingresa para ver la transmisión."
                        : "Regístrate para unirte."}
                    </Text>
                  </Alert>
                )}

                {status === "upcoming" && (
                  <Alert color="blue" variant="light" radius="xl" w="100%">
                    <Text size="sm" ta="center">
                      📝{" "}
                      {isRegisteredForEvent
                        ? "Ya estás registrado, presiona ingresar cuando quieras."
                        : "Regístrate ahora para reservar tu lugar."}
                    </Text>
                  </Alert>
                )}

                {status === "ended" && (
                  <Alert color="gray" variant="light" radius="xl" w="100%">
                    <Text size="sm" ta="center">
                      📋 El evento ha finalizado.{" "}
                      {isRegisteredForEvent
                        ? "Ingresa para ver la información disponible."
                        : "Puedes registrarte si el organizador habilitó contenido."}
                    </Text>
                  </Alert>
                )}

                {status === "replay" && (
                  <Alert color="orange" variant="light" radius="xl" w="100%">
                    <Text size="sm" ta="center">
                      ▶️ La repetición está disponible.{" "}
                      {isRegisteredForEvent
                        ? "Ingresa para ver el contenido grabado."
                        : "Regístrate o ingresa para acceder."}
                    </Text>
                  </Alert>
                )}
              </Stack>
            </Card>

            {/* Owner CTA */}
            {isOwner && (
              <Button
                component={Link}
                to={`/org/${slug}/event/${eventSlug}/admin`}
                variant="light"
                radius="xl"
                leftSection="🎛️"
              >
                Panel de administración
              </Button>
            )}
          </Stack>
        </Container>
      </Box>

      <BrandedFooter config={eventBranding?.footer} />
    </MantineProvider>
  );
}
