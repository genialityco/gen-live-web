/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from "react";
import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Container,
  Stack,
  Title,
  Text,
  Button,
  Card,
  Group,
  Loader,
  Center,
  Badge,
  Box,
  Grid,
  Image,
  MantineProvider,
} from "@mantine/core";
import { fetchOrgBySlug, type Org } from "../../api/orgs";
import {
  fetchEventsByOrg,
  checkIfRegistered,
  checkIfRegisteredByUID,
  associateFirebaseUID,
  type EventItem,
} from "../../api/events";
import { useAuth } from "../../auth/AuthProvider";
import { useEventRealtime } from "../../hooks/useEventRealtime";
import UserSession from "../../components/auth/UserSession";
import { useMediaQuery } from "@mantine/hooks";
import { markEventUserAsAttended } from "../../api/event-users";

// --------------------------------------------------------------
// Branding Helpers (mismos que en OrganizationLanding)
// --------------------------------------------------------------
const DEFAULTS = {
  primary: "#228BE6",
  secondary: "#7C3AED",
  accent: "#14B8A6",
  background: "#F8FAFC",
  text: "#0F172A",
};

function resolveBrandingColors(org?: Org | null) {
  const c = org?.branding?.colors || ({} as any);
  return {
    primary: c.primary || DEFAULTS.primary,
    secondary: c.secondary || DEFAULTS.secondary,
    accent: c.accent || DEFAULTS.accent,
    background: c.background || DEFAULTS.background,
    text: c.text || DEFAULTS.text,
  };
}

function makeTheme(brand: ReturnType<typeof resolveBrandingColors>) {
  const toScale = (hex: string) =>
    new Array(10).fill(hex) as [
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

  return {
    colors: {
      brand: toScale(brand.primary),
      accent: toScale(brand.accent),
    },
    primaryColor: "brand" as const,
    fontFamily:
      'Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    headings: { fontWeight: "800" },
    defaultRadius: "md" as const,
    components: {
      Card: {
        styles: {
          root: {
            border: "1px solid var(--mantine-color-gray-3)",
            boxShadow: "0 10px 24px rgba(2,6,23,0.06)",
          },
        },
      },
      Button: { defaultProps: { radius: "md", color: "brand" } },
    },
  };
}

function cssVars(
  brand: ReturnType<typeof resolveBrandingColors>
): React.CSSProperties {
  return {
    ["--primary-color" as any]: brand.primary,
    ["--secondary-color" as any]: brand.secondary,
    ["--accent-color" as any]: brand.accent,
    ["--bg-color" as any]: brand.background,
    ["--text-color" as any]: brand.text,
  } as React.CSSProperties;
}

// --------------------------------------------------------------
// Status helpers (reutilizados)
// --------------------------------------------------------------
const getStatusColor = (status: string) => {
  switch (status) {
    case "live":
      return "red";
    case "upcoming":
      return "brand";
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
      return "En vivo";
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

// --------------------------------------------------------------
// Header reutilizable para la página de asistencia
// --------------------------------------------------------------
function EventAttendHeader({
  org,
  slug,
  eventSlug,
  isOwner,
  orgId,
  eventId,
}: {
  org: Org | null;
  slug?: string;
  eventSlug?: string;
  eventTitle?: string;
  isOwner: boolean;
  orgId?: string;
  eventId?: string;
}) {
  return (
    <Box
      style={{
        borderBottom: "1px solid var(--mantine-color-gray-3)",
        background: "white",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <Container size="xl" py="sm">
        <Group justify="space-between" align="center">
          <Group gap="md">
            {org?.branding?.logoUrl ? (
              <Image
                src={org.branding.logoUrl}
                alt={org.name}
                h={48}
                w="auto"
                fit="contain"
              />
            ) : (
              <Title order={3} size="h3" c="var(--mantine-color-brand-9)">
                {org?.name || "Evento"}
              </Title>
            )}
          </Group>
          <Group gap="sm">
            {slug && eventSlug && (
              <Button
                component={Link}
                to={`/org/${slug}/event/${eventSlug}`}
                variant="subtle"
                size="xs"
              >
                ← Volver a la info
              </Button>
            )}
            {isOwner && slug && (
              <Button
                component={Link}
                to={`/org/${slug}/admin`}
                variant="light"
                size="xs"
              >
                ⚙️ Admin
              </Button>
            )}
            <UserSession
              orgId={orgId}
              eventId={eventId}
              showLoginButton={true}
            />
          </Group>
        </Group>
      </Container>
    </Box>
  );
}

// --------------------------------------------------------------
// Página de asistencia al evento
// --------------------------------------------------------------
export default function EventAttend() {
  const { slug, eventSlug } = useParams<{ slug: string; eventSlug: string }>();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { user, sessionName } = useAuth();

  const [org, setOrg] = useState<Org | null>(null);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [attendeeId, setAttendeeId] = useState<string | null>(null);

  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [checkingRegistration, setCheckingRegistration] =
    useState<boolean>(true);

  const eventSlugToUse = eventSlug || "";
  const {
    resolved: realtimeEvent,
    status,
    // nowCount,
    loading: eventLoading,
  } = useEventRealtime(eventSlugToUse);

  const [timeLeft, setTimeLeft] = useState<string>("");

  const isOwner = !!(user && org && org.ownerUid === user.uid);

  // Branding: aunque org sea null, usamos defaults
  const brand = resolveBrandingColors(org);
  const theme = useMemo(() => makeTheme(brand), [brand]);

  // 1) Cargar datos de organización y evento
  useEffect(() => {
    const loadData = async () => {
      if (!slug || !eventSlug) {
        setError("Parámetros de URL inválidos");
        setLoading(false);
        return;
      }

      try {
        setError(null);

        const orgData = await fetchOrgBySlug(slug);
        setOrg(orgData);

        const eventsData = await fetchEventsByOrg(orgData._id);
        const foundEvent =
          eventsData.find((e) => e.slug === eventSlug || e._id === eventSlug) ||
          null;

        if (!foundEvent) {
          setError("Evento no encontrado");
          setLoading(false);
          return;
        }

        setEvent(foundEvent);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Error al cargar los datos del evento");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [slug, eventSlug]);

  // 2) Verificar registro cuando tenemos evento y (potencialmente) usuario
  useEffect(() => {
    const checkRegistration = async () => {
      if (!event) return;

      if (!user) {
        setIsRegistered(false);
        setCheckingRegistration(false);
        return;
      }

      try {
        // PRIORIDAD 1: email
        let userEmail: string | null = user.email || null;

        if (!userEmail) {
          if (user.uid) {
            userEmail =
              localStorage.getItem(`uid-${user.uid}-email`) ||
              localStorage.getItem("user-email");
          } else {
            userEmail = localStorage.getItem("user-email");
          }
        }

        if (userEmail) {
          const result = await checkIfRegistered(event._id, userEmail);

          if (result.isRegistered && user.uid) {
            try {
              await associateFirebaseUID(event._id, userEmail, user.uid);
            } catch (syncError) {
              console.warn(
                "⚠️ EventAttend: Could not sync UID, but user is registered:",
                syncError
              );
            }
          }

          if (result.orgAttendee?._id) {
            setAttendeeId(result.orgAttendee._id);
          }

          setIsRegistered(!!result.isRegistered);
          return;
        }

        // PRIORIDAD 2: Firebase UID
        if (user.uid && !user.email) {
          const result = await checkIfRegisteredByUID(event._id, user.uid);
          setIsRegistered(!!result.isRegistered);
          return;
        }

        // PRIORIDAD 3: fallback viejo (last-registered-email)
        const storedEmail = localStorage.getItem("last-registered-email");
        if (storedEmail) {
          const result = await checkIfRegistered(event._id, storedEmail);
          setIsRegistered(!!result.isRegistered);
          localStorage.removeItem("last-registered-email");
          return;
        }
        setIsRegistered(false);
      } catch (err) {
        console.error("❌ EventAttend: Error checking registration:", err);
        setIsRegistered(false);
        setAttendeeId(null);
      } finally {
        setCheckingRegistration(false);
      }
    };

    void checkRegistration();
  }, [event, user]);

  // 3) Redirigir a la landing si NO está registrado (y no es owner)
  useEffect(() => {
    if (!slug || !eventSlug) return;

    if (!checkingRegistration && !loading && !eventLoading) {
      if (!isRegistered && !isOwner) {
        console.log(
          "🔒 EventAttend: User not registered, redirecting to event landing"
        );
        navigate(`/org/${slug}/event/${eventSlug}`, { replace: true });
      }
    }
  }, [
    checkingRegistration,
    loading,
    eventLoading,
    isRegistered,
    isOwner,
    slug,
    eventSlug,
    navigate,
  ]);

  const finalEvent = realtimeEvent || event;

  // Contador para upcoming
  useEffect(() => {
    if (status !== "upcoming") {
      setTimeLeft("");
      return;
    }

    const startsAt = finalEvent?.schedule?.startsAt || null;

    if (!startsAt) {
      setTimeLeft("");
      return;
    }

    const startTs = new Date(startsAt).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = startTs - now;

      if (diff <= 0) {
        setTimeLeft("¡El evento está comenzando!");
        return;
      }

      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      parts.push(`${hours}h`, `${minutes}m`, `${seconds}s`);

      setTimeLeft(parts.join(" "));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status, finalEvent?.schedule?.startsAt]);

  useEffect(() => {
    // Necesitamos:
    // - que exista el evento
    // - que tengamos attendeeId
    // - que ya sepamos que está registrado
    if (!event || !attendeeId || !isRegistered) return;

    const syncTracking = async () => {
      try {
        // 1) Siempre: actualizar último login cuando entra a /attend
        // await updateEventUserLastLogin(attendeeId, event._id);
        // console.log("✅ Updated EventUser lastLoginAt");
        // 2) Si el evento está EN VIVO en este momento, marcar asistencia
        if (status === "live") {
          console.log("✅ Marking EventUser as attended");
          await markEventUserAsAttended(attendeeId, event._id);
        }

        // Si quieres marcar solo la primera vez que pasa a live,
        // puedes controlar con un flag local para no spamear el endpoint.
      } catch (err) {
        console.error("❌ Error syncing EventUser tracking:", err);
      }
    };

    void syncTracking();
  }, [event?._id, attendeeId, isRegistered, status]);

  // ----------------------------------------------------------
  // Render con MantineProvider + branding
  // ----------------------------------------------------------
  const contentLoading =
    loading || eventLoading || checkingRegistration || (!finalEvent && !error);

  const effectiveChatName =
    sessionName ||
    user?.displayName ||
    (user?.email ? user.email.split("@")[0] : null) ||
    "Usuario";

  return (
    <MantineProvider theme={theme} withCssVariables>
      <Box style={cssVars(brand)} bg="var(--bg-color)" c="var(--text-color)">
        {/* HEADER con branding */}
        <EventAttendHeader
          org={org}
          slug={slug}
          eventSlug={eventSlug}
          isOwner={isOwner}
          orgId={org?._id}
          eventId={event?._id}
        />

        {/* ESTADO CARGANDO */}
        {contentLoading && !error && (
          <Container size="sm">
            <Center h={400}>
              <Stack align="center" gap="lg">
                <Loader size="lg" />
                <Text>Verificando acceso al evento...</Text>
              </Stack>
            </Center>
          </Container>
        )}

        {/* ERROR / NO EVENTO */}
        {!contentLoading && (error || !org || !finalEvent) && (
          <Container size="sm">
            <Center h={400}>
              <Stack align="center" gap="md">
                <Text c="red" size="lg">
                  {error || "Evento no encontrado"}
                </Text>
                <Group>
                  {slug && eventSlug && (
                    <Button
                      component={Link}
                      to={`/org/${slug}/event/${eventSlug}`}
                    >
                      ← Volver al evento
                    </Button>
                  )}
                  {slug && (
                    <Button
                      component={Link}
                      to={`/org/${slug}`}
                      variant="light"
                    >
                      Ver organización
                    </Button>
                  )}
                </Group>
              </Stack>
            </Center>
          </Container>
        )}

        {/* CONTENIDO PRINCIPAL (cuando todo está ok) */}
        {!contentLoading && !error && org && finalEvent && (
          <Container size="xl" py="xl">
            <Stack gap="lg">
              {/* Header del evento (status + info básica) */}
              <Card shadow="sm" padding="lg" radius="lg" withBorder>
                <Stack gap="xs">
                  {/* Fila 1: TÍTULO (sin org, adaptativo) */}
                  <Title
                    order={2}
                    size={isMobile ? "h4" : "h3"}
                    style={{
                      lineHeight: 1.2,
                      ...(isMobile
                        ? {
                            // En mobile: puede saltar líneas
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                          }
                        : {
                            // En desktop: una línea con …
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }),
                    }}
                  >
                    {finalEvent.title}
                  </Title>

                  {/* Fila 2: estado + viewers */}
                  <Group
                    justify="space-between"
                    align="center"
                    wrap="wrap"
                    gap="xs"
                    style={{ rowGap: 4 }}
                  >
                    <Group gap="sm" align="center" wrap="wrap">
                      <Badge
                        color={getStatusColor(status)}
                        size="md"
                        variant={status === "live" ? "filled" : "light"}
                      >
                        {status === "live" && "🔴 "}
                        {getStatusText(status)}
                      </Badge>
                    </Group>

                    {/* {nowCount > 0 && (
                      <Badge variant="light" color="gray" size="sm">
                        👥 {nowCount}{" "}
                        {nowCount === 1 ? "persona viendo" : "personas viendo"}
                      </Badge>
                    )} */}
                  </Group>

                  {/* Fila 3: botón de control (solo owner) */}
                  {isOwner && slug && eventSlug && (
                    <Group justify="flex-end">
                      <Button
                        component={Link}
                        to={`/org/${slug}/event/${eventSlug}/admin`}
                        variant="filled"
                        size="xs"
                      >
                        🎛️ Control
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Card>

              {/* Layout principal: video + chat */}
              <Grid gutter="lg">
                <Grid.Col span={{ base: 12, md: 8 }}>
                  {/* CONTENEDOR FULL PARA LA TRANSMISIÓN (sin bordes visibles) */}
                  <Box
                    style={{
                      borderRadius: 16,
                      overflow: "hidden",
                      backgroundColor: "#000",
                    }}
                  >
                    <Box
                      style={{
                        position: "relative",
                        width: "100%",
                        paddingTop: "56.25%", // 16:9
                      }}
                    >
                      {status === "live" &&
                      finalEvent.stream &&
                      "url" in finalEvent.stream &&
                      finalEvent.stream.url ? (
                        <iframe
                          src={
                            "url" in finalEvent.stream!
                              ? finalEvent.stream.url
                              : ""
                          }
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            border: "none",
                          }}
                          title="Transmisión en vivo"
                          frameBorder={0}
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                        />
                      ) : status === "replay" &&
                        finalEvent.stream &&
                        "url" in finalEvent.stream &&
                        finalEvent.stream.url ? (
                        <iframe
                          src={
                            "url" in finalEvent.stream!
                              ? finalEvent.stream.url
                              : ""
                          }
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            border: "none",
                          }}
                          title="Repetición del evento"
                          frameBorder={0}
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                        />
                      ) : status === "upcoming" ? (
                        <Box
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 24,
                            backgroundColor: "#ffffff", // fondo blanco, sin degradado
                          }}
                        >
                          <Stack
                            align="center"
                            gap="sm"
                            style={{ maxWidth: 480, textAlign: "center" }}
                          >
                            {/* Título principal */}
                            <Text size="xl" fw={800}>
                              🕒 El evento comenzará pronto
                            </Text>

                            {/* Contador destacado */}
                            {timeLeft && (
                              <Box
                                style={{
                                  padding: "8px 16px",
                                  borderRadius: 999,
                                  backgroundColor:
                                    "var(--mantine-color-gray-0)",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                <Text size="lg" fw={700}>
                                  Comienza en {timeLeft}
                                </Text>
                              </Box>
                            )}

                            {/* Texto secundario */}
                            <Text size="sm" c="dimmed">
                              Mantén esta ventana abierta. La transmisión se
                              iniciará automáticamente cuando el anfitrión
                              comience el evento.
                            </Text>
                          </Stack>
                        </Box>
                      ) : (
                        <Box
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 24,
                            backgroundColor: "#ffffff", // también blanco para el estado finalizado
                          }}
                        >
                          <Stack
                            align="center"
                            gap="sm"
                            style={{ maxWidth: 480, textAlign: "center" }}
                          >
                            {/* Pill superior */}
                            <Box
                              style={{
                                padding: "4px 12px",
                                borderRadius: 999,
                                border: "1px solid var(--mantine-color-gray-3)",
                                fontSize: 12,
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                fontWeight: 600,
                              }}
                            >
                              Evento finalizado
                            </Box>

                            {/* Título principal */}
                            <Text size="xl" fw={800}>
                              📝 Gracias por asistir
                            </Text>

                            {/* Texto secundario */}
                            <Text size="sm" c="dimmed">
                              Este evento ha terminado y en este momento no hay
                              transmisión disponible.
                            </Text>

                            {/* Call to action */}
                            {slug && eventSlug && (
                              <Group gap="xs" mt="xs" justify="center">
                                <Button
                                  component={Link}
                                  to={`/org/${slug}/event/${eventSlug}`}
                                  size="xs"
                                  variant="light"
                                >
                                  Ver detalles del evento
                                </Button>
                              </Group>
                            )}
                          </Stack>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Stack gap="lg">
                    {/* Chat */}
                    <Card shadow="md" padding="lg" radius="lg" withBorder>
                      <Stack gap="md">
                        <Title order={4}>💬 Chat del evento</Title>
                        {event?._id ? (
                          <Box
                            style={{
                              height: 400,
                              borderRadius: "12px",
                              overflow: "hidden",
                              border: "1px solid var(--mantine-color-gray-3)",
                            }}
                          >
                            <iframe
                              src={`https://chat-geniality.netlify.app?${new URLSearchParams(
                                {
                                  nombre: effectiveChatName,
                                  chatid: event._id,
                                  iduser: "",
                                  eventid: event._id,
                                  // anonimo: user?.isAnonymous ? "true" : "false",
                                  message_highlighted: "",
                                }
                              ).toString()}`}
                              width="100%"
                              height="100%"
                              style={{
                                border: "none",
                                borderRadius: "12px",
                              }}
                              title="Chat del evento"
                              sandbox="allow-scripts allow-same-origin allow-forms"
                            />
                          </Box>
                        ) : (
                          <Center h={200}>
                            <Text size="sm" c="dimmed" ta="center">
                              El chat estará disponible cuando se cargue
                              completamente el evento.
                            </Text>
                          </Center>
                        )}
                      </Stack>
                    </Card>

                    {/* Tablón de anuncios */}
                    {/* <Card shadow="sm" padding="md" radius="lg" withBorder>
                      <Stack gap="sm">
                        <Title order={5}>📌 Tablón de anuncios</Title>
                        {event?.description ? (
                          <Text size="sm" c="dimmed" lineClamp={4}>
                            {event.description}
                          </Text>
                        ) : (
                          <Text size="xs" c="dimmed">
                            Aquí verás mensajes importantes, enlaces o
                            instrucciones que el anfitrión comparta durante el
                            evento.
                          </Text>
                        )}
                        {(event?.startDate || event?.schedule?.startsAt) && (
                          <Text size="xs" c="dimmed">
                            📅{" "}
                            {new Date(
                              event.startDate || event.schedule?.startsAt || ""
                            ).toLocaleDateString("es-ES", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        )}
                      </Stack>
                    </Card> */}
                  </Stack>
                </Grid.Col>
              </Grid>
            </Stack>
          </Container>
        )}
      </Box>
    </MantineProvider>
  );
}
