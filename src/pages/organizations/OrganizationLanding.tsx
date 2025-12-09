/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Stack,
  Title,
  Card,
  Group,
  Text,
  Button,
  Grid,
  Badge,
  Loader,
  Center,
  Container,
  Box,
  MantineProvider,
  Image,
  ScrollArea,
  ThemeIcon,
  Spoiler,
} from "@mantine/core";
import {
  IconCalendar,
  IconClock,
  IconArrowRight,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { fetchOrgBySlug, type Org } from "../../api/orgs";
import { fetchEventsByOrg, type EventItem } from "../../api/events";
import { useAuth } from "../../auth/AuthProvider";
import { BrandedFooter } from "../../components/branding";
import UserSession from "../../components/auth/UserSession";
import { useMediaQuery } from "@mantine/hooks";

// --------------------------------------------------------------
// Helpers de Branding y Accesibilidad
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
// Badges/Gradients/Formatters reutilizables
// --------------------------------------------------------------
const getEventStatusBadge = (status: string) => {
  switch (status) {
    case "live":
      return { color: "red", label: "🔴 EN VIVO" };
    case "upcoming":
      return { color: "brand", label: "📅 Próximamente" };
    case "replay":
      return { color: "orange", label: "📀 Grabación" };
    case "ended":
      return { color: "gray", label: "Finalizado" };
    default:
      return { color: "gray", label: status };
  }
};

const getEventGradient = (status: string) => {
  switch (status) {
    case "live":
      return "linear-gradient(135deg, var(--mantine-color-red-4), var(--mantine-color-red-6))";
    case "replay":
      return "linear-gradient(135deg, var(--mantine-color-accent-2), var(--mantine-color-accent-4))";
    case "upcoming":
      return "linear-gradient(135deg, var(--mantine-color-brand-1), var(--mantine-color-brand-3))";
    default:
      return "linear-gradient(135deg, var(--mantine-color-gray-2), var(--mantine-color-gray-4))";
  }
};

// Zona horaria detectada del navegador del usuario
const userTimeZone =
  typeof Intl !== "undefined" &&
  Intl.DateTimeFormat().resolvedOptions().timeZone
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC";

const parseDateSafe = (value?: string | Date | null) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatShortDate = (value: string | Date) => {
  const d = parseDateSafe(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: userTimeZone,
  }).format(d);
};

const formatTime = (value: string | Date) => {
  const d = parseDateSafe(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("es-ES", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: userTimeZone,
  }).format(d);
};

// const formatLongDate = (date: Date) =>
//   date.toLocaleDateString("es-ES", {
//     weekday: "long",
//     day: "numeric",
//     month: "long",
//   });

// --------------------------------------------------------------
// UI Subcomponentes
// --------------------------------------------------------------
function EventStatusBadgeComp({
  status,
  size = "md",
}: {
  status: string;
  size?: "md" | "lg";
}) {
  // Solo visible en EN VIVO y GRABACIÓN
  if (status !== "live" && status !== "replay") return null;

  const badge = getEventStatusBadge(status);
  const isLg = size === "lg";

  return (
    <Box
      style={{
        position: "absolute",
        bottom: isLg ? 4 : 2,
        right: isLg ? 4 : 2,
        zIndex: 2,
      }}
    >
      <Badge
        size={isLg ? "lg" : "md"}
        color={badge.color as any}
        variant="filled"
        radius="xl"
        style={{
          fontSize: isLg ? "0.95rem" : "0.9rem",
          fontWeight: 800,
          letterSpacing: 0.2,
          textTransform: "uppercase",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          backdropFilter: "saturate(1.2) blur(1px)",
          paddingInline: isLg ? 14 : 12,
        }}
      >
        {badge.label}
      </Badge>
    </Box>
  );
}

/**
 * Banner de evento con imagen responsive (desktop/mobile) o gradiente de fallback
 */
function EventBanner({
  imageUrl,
  imageUrlMobile,
  height,
  status,
  showOverlay = true,
  preferMobile = false,
}: {
  imageUrl?: string;
  imageUrlMobile?: string; // variante mobile (cuadrada/rectangular)
  height?: number;
  status: string;
  showOverlay?: boolean;
  /** Si es true, usa siempre la imagen mobile (en desktop y mobile). */
  preferMobile?: boolean;
}) {
  // Detecta si es mobile (max-width: 768px)
  const isMobile = useMediaQuery("(max-width: 768px)");
  const src = preferMobile
    ? imageUrlMobile || imageUrl
    : isMobile
    ? imageUrlMobile || imageUrl
    : imageUrl;
  return (
    <Box style={{ position: "relative", overflow: "hidden" }}>
      {src ? (
        <Image
          src={src}
          h={height}
          fit="contain"
          style={{ transition: "transform 0.3s ease" }}
        />
      ) : (
        <Box h={height} style={{ background: getEventGradient(status) }} />
      )}
      {showOverlay && (
        <Box
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: (height ?? 0) > 250 ? "40%" : "30%",
            background: "linear-gradient(to top, rgba(0,0,0,0.3), transparent)",
          }}
        />
      )}
    </Box>
  );
}

// Hero con imagen de header del org o gradiente de fallback
function Hero({
  org,
  nextEvent,
  orgSlug,
  onScrollToUpcoming,
}: {
  org: Org;
  nextEvent: EventItem | null;
  orgSlug: string;
  onScrollToUpcoming: () => void;
}) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const heroImg = org.branding?.header?.backgroundImageUrl || undefined;
  const heroImgMobile =
    org.branding?.header?.backgroundImageMobileUrl || undefined;
  const title = org.name;
  const brandColor =
    org.branding?.colors?.background || "var(--mantine-color-brand-6)";

  // 🔽 Nuevo: alturas/paddings compactos para mobile
  const heroMinHeight = isMobile ? 220 : 420;
  const cardMaxWidth = isMobile ? "92vw" : 760;
  const cardFixedWidth = isMobile ? "100%" : 500;

  return (
    <Box
      style={{
        position: "relative",
        borderBottom: "1px solid var(--mantine-color-gray-3)",
        background: isMobile ? brandColor : "transparent",
        color: isMobile ? "white" : "inherit",
        minHeight: heroMinHeight, // 🔽 limita la altura en mobile
        display: "grid", // 🔽 evita crecer de más
      }}
    >
      {/* Banner solo desktop */}
      {!isMobile && (
        <EventBanner
          imageUrl={heroImg}
          imageUrlMobile={heroImgMobile}
          status={nextEvent?.status || "upcoming"}
          showOverlay
        />
      )}

      {/* Contenido principal */}
      <Container
        size="xl"
        // 🔽 menos padding vertical en mobile
        py={isMobile ? 12 : 0}
        m="sm"
        style={{
          position: isMobile ? "relative" : "absolute",
          inset: isMobile ? "auto" : 0,
          display: "grid",
          placeItems: isMobile ? "center" : "end start",
          padding: isMobile ? "8px 0" : "clamp(12px, 2vw, 24px)", // 🔽 reduce padding en mobile
        }}
      >
        <Card
          radius={isMobile ? "md" : "lg"} // 🔽 radio menor en mobile
          p={isMobile ? "md" : "lg"} // 🔽 padding menor en mobile
          mb={isMobile ? "sm" : "lg"} // 🔽 margen menor en mobile
          style={{
            backdropFilter: isMobile ? "blur(2px)" : "blur(6px)", // 🔽 menos blur
            background: isMobile
              ? "rgba(255,255,255,0.80)"
              : "rgba(255,255,255,0.85)",
            maxWidth: cardMaxWidth,
            width: cardFixedWidth,
            minWidth: isMobile ? "auto" : 500,
          }}
        >
          <Stack gap={isMobile ? 4 : "xs"}>
            {" "}
            {/* 🔽 gaps más chicos */}
            <Title
              order={isMobile ? 2 : 1} // 🔽 baja jerarquía en mobile
              style={{ lineHeight: 1.1, fontSize: isMobile ? 22 : 32 }} // 🔽 fuente menor
            >
              {title}
            </Title>
            {org.description && (
              <Spoiler
                maxHeight={isMobile ? 30 : 50} // ~2-3 líneas
                showLabel="Ver más"
                hideLabel="Ver menos"
                transitionDuration={200}
              >
                <Text c="dimmed" size={isMobile ? "sm" : "md"}>
                  {org.description}
                </Text>
              </Spoiler>
            )}
            <Group gap={isMobile ? 6 : "sm"} wrap="wrap">
              {nextEvent ? (
                <Button
                  size={isMobile ? "sm" : "md"} // 🔽 botón más pequeño
                  fullWidth={isMobile} // 🔽 ocupa ancho en mobile
                  onClick={() =>
                    navigate(
                      `/org/${orgSlug}/event/${nextEvent.slug || nextEvent._id}`
                    )
                  }
                  rightSection={<IconArrowRight size={16} />} // 🔽 ícono más chico
                  variant="gradient"
                  gradient={{ from: "brand.7", to: "accent.6", deg: 135 }}
                >
                  Ver próximo evento
                </Button>
              ) : (
                <Button
                  size={isMobile ? "sm" : "md"}
                  fullWidth={isMobile}
                  variant="light"
                  onClick={onScrollToUpcoming}
                >
                  Explorar eventos
                </Button>
              )}
            </Group>
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}

function InfoRow({ date }: { date?: string | null }) {
  if (!date) return null;

  return (
    <Group gap={8} wrap="nowrap">
      <ThemeIcon variant="light" size="sm">
        <IconCalendar size={16} />
      </ThemeIcon>
      <Text size="sm" fw={600}>
        {formatShortDate(date)}
      </Text>
      <ThemeIcon variant="light" size="sm">
        <IconClock size={16} />
      </ThemeIcon>
      <Text size="sm" c="var(--mantine-color-brand-7)" fw={700}>
        {formatTime(date)}
      </Text>
    </Group>
  );
}

function NextEventSection({
  event,
  orgSlug,
}: {
  event: EventItem;
  orgSlug: string;
}) {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState<string>("");
  const isLive = event.status === "live";

  useEffect(() => {
    // Si está en vivo, no mostramos contador
    if (isLive) {
      setTimeLeft("");
      return;
    }

    const tick = () => {
      if (!event.schedule?.startsAt) return;
      const startDate = parseDateSafe(event.schedule.startsAt);
      if (!startDate) return;

      const now = Date.now();
      const start = startDate.getTime();
      const diff = start - now;

      if (diff <= 0) {
        setTimeLeft("¡El evento ha comenzado!");
        return;
      }

      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [event.schedule?.startsAt, isLive]);

  return (
    <Card
      withBorder
      p={0}
      radius="lg"
      style={{ overflow: "hidden", cursor: "pointer" }}
      onClick={() =>
        navigate(`/org/${orgSlug}/event/${event.slug || event._id}`)
      }
      // onClick={() =>
      //   (window.location.href =
      //     "https://liveevents.geniality.com.co/68fcf6db6d9f9db64809e042")
      // }
    >
      {/* Imagen + badge visible */}
      <EventBanner
        imageUrl={event.branding?.header?.backgroundImageUrl}
        imageUrlMobile={event.branding?.header?.backgroundImageMobileUrl}
        status={event.status}
        showOverlay
      />

      {/* Contenido */}
      <Box p="lg" bg="white">
        <Grid gutter="md" align="center">
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap={6}>
              <Title
                order={2}
                size="h3"
                style={{ fontWeight: 800, lineHeight: 1.25 }}
              >
                {event.title}
              </Title>
              <InfoRow date={event.schedule?.startsAt || null} />
              <Text size="xs" c="dimmed">
                Hora según tu zona horaria ({userTimeZone})
              </Text>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="sm" align="stretch">
              {isLive ? (
                // Modo EN VIVO: sin contador, botón único y llamativo
                <Button
                  size="md"
                  variant="filled"
                  color="red"
                  leftSection={<IconPlayerPlay size={18} />}
                >
                  Ver EN VIVO
                </Button>
              ) : (
                <>
                  <Box
                    p="sm"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--mantine-color-brand-0), var(--mantine-color-accent-0))",
                      border: "2px solid var(--mantine-color-brand-2)",
                      borderRadius: "var(--mantine-radius-md)",
                      textAlign: "center",
                    }}
                  >
                    <Text size="xs" tt="uppercase" fw={700} mb={4} c="white">
                      Comienza en
                    </Text>
                    <Text
                      fw={800}
                      style={{
                        fontSize: "1.3rem",
                        fontVariantNumeric: "tabular-nums",
                      }}
                      c="white"
                    >
                      {timeLeft}
                    </Text>
                  </Box>
                  <Button
                    size="md"
                    rightSection={<IconPlayerPlay size={18} />}
                    variant="gradient"
                    gradient={{ from: "brand.7", to: "accent.6", deg: 135 }}
                  >
                    Ver evento
                  </Button>
                </>
              )}
            </Stack>
          </Grid.Col>
        </Grid>
      </Box>
    </Card>
  );
}

function PastEventCard({
  event,
  orgSlug,
}: {
  event: EventItem;
  orgSlug: string;
}) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const bannerHeight = isMobile ? 300 : 240; // más alto en mobile

  return (
    <Card
      withBorder
      p={0}
      radius="lg"
      style={{
        cursor: "pointer",
        transition: "transform .2s ease",
        overflow: "hidden",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.transform = "translateY(-2px)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
      onClick={() =>
        navigate(`/org/${orgSlug}/event/${event.slug || event._id}`)
      }
      // onClick={() => (window.location.href = event.stream?.url as string)}
    >
      <EventBanner
        imageUrl={event.branding?.header?.backgroundImageMobileUrl}
        imageUrlMobile={event.branding?.header?.backgroundImageMobileUrl}
        height={bannerHeight}
        status={event.status}
        showOverlay
        preferMobile
      />

      <Box
        p="md"
        style={{
          minHeight: 130,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <Title
          order={4}
          lineClamp={2}
          mb="xs"
          style={{
            flex: 1,
            fontWeight: 700,
            fontSize: "1rem",
            lineHeight: 1.3,
          }}
        >
          {event.title}
        </Title>
        {event.schedule?.startsAt && (
          <Group gap="xs" align="center">
            <Text size="md">📅</Text>
            <Text size="xs" c="dimmed" fw={500}>
              {formatShortDate(new Date(event.schedule.startsAt))}
            </Text>
          </Group>
        )}
        <EventStatusBadgeComp status={event.status} size="md" />
      </Box>
    </Card>
  );
}

// Item de "Próximos" (forzado a imagen mobile)
function UpcomingEventCard({
  event,
  orgSlug,
}: {
  event: EventItem;
  orgSlug: string;
}) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const bannerHeight = isMobile ? 310 : 250; // más alto en mobile

  return (
    <Card
      withBorder
      p={0}
      radius="lg"
      style={{
        cursor: "pointer",
        transition: "transform .2s ease",
        overflow: "hidden",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.transform = "translateY(-2px)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
      onClick={() =>
        navigate(`/org/${orgSlug}/event/${event.slug || event._id}`)
      }
      // onClick={() => (window.location.href = event.stream?.url as string)}
    >
      <Box style={{ position: "relative" }}>
        <EventBanner
          imageUrl={event.branding?.header?.backgroundImageMobileUrl}
          imageUrlMobile={event.branding?.header?.backgroundImageMobileUrl}
          height={bannerHeight}
          status={event.status}
          showOverlay
          preferMobile
        />
        <EventStatusBadgeComp status={event.status} size="md" />
      </Box>

      <Box
        p="md"
        style={{ minHeight: 130, display: "flex", flexDirection: "column" }}
      >
        <Title
          order={4}
          lineClamp={2}
          mb="xs"
          style={{
            flex: 1,
            fontWeight: 700,
            fontSize: "1rem",
            lineHeight: 1.3,
          }}
        >
          {event.title}
        </Title>
        <InfoRow date={event.schedule?.startsAt || null} />
      </Box>
    </Card>
  );
}
// --------------------------------------------------------------
// Página Principal
// --------------------------------------------------------------
export default function OrganizationLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [org, setOrg] = useState<Org | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwner = user && org && org.ownerUid === user.uid;

  const brand = resolveBrandingColors(org);
  const theme = useMemo(() => makeTheme(brand), [brand]);

  const upcomingSectionRef = useRef<HTMLDivElement | null>(null);

  const handleScrollToUpcoming = () => {
    if (upcomingSectionRef.current) {
      upcomingSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const loadOrganization = async () => {
    if (!slug) {
      setError("Organización no encontrada");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const orgData = await fetchOrgBySlug(slug);
      setOrg(orgData);
      const eventsData = await fetchEventsByOrg(orgData._id);
      setEvents(eventsData);
    } catch (err) {
      console.error("Error loading organization:", err);
      setError("No se pudo cargar la organización");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (org) {
      document.title = `${org.name}`;
    }
    return () => {
      document.title = "Gen Live";
    };
  }, [org]);

  if (loading) {
    return (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (error || !org) {
    return (
      <Container size="sm">
        <Center h={400}>
          <Stack align="center" gap="md">
            <Text c="red" size="lg">
              {error || "Organización no encontrada"}
            </Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  const now = Date.now();

  // 1) Eventos activos (no pasados tipo replay/ended)
  const activeEvents = events.filter(
    (e) => !["replay", "ended"].includes(e.status)
  );

  // 2) Eventos LIVE (deben seguir saliendo como "Próximo evento" aunque la hora ya haya pasado)
  const liveEvents = activeEvents
    .filter((e) => e.status === "live")
    .sort(
      (a, b) =>
        new Date(a.schedule?.startsAt || 0).getTime() -
        new Date(b.schedule?.startsAt || 0).getTime()
    );

  // 3) Eventos UPCOMING futuros
  const upcomingBase = activeEvents
    .filter((e) => {
      if (!e.schedule?.startsAt) return false;
      const ts = new Date(e.schedule.startsAt).getTime();
      if (Number.isNaN(ts)) return false;
      return ts >= now && e.status === "upcoming";
    })
    .sort(
      (a, b) =>
        new Date(a.schedule!.startsAt!).getTime() -
        new Date(b.schedule!.startsAt!).getTime()
    );

  // 4) Próximo evento:
  //    - Si hay LIVE: tomamos el live más "cercano" (o el primero)
  //    - Si no hay LIVE: tomamos el primer UPCOMING
  const nextEvent = liveEvents[0] ?? upcomingBase[0] ?? null;

  // 5) "Próximos Eventos": sólo UPCOMING, sin repetir el nextEvent
  const upcomingEvents = upcomingBase.filter(
    (e) =>
      !nextEvent ||
      (e._id ?? e.slug) !== (nextEvent._id ?? (nextEvent as any).slug)
  );

  // 6) Eventos pasados (puedes dejarlo igual que ya lo tenías)
  const pastEvents = events
    .filter((e) => e.status === "ended" || e.status === "replay")
    .sort(
      (a, b) =>
        new Date(b.schedule?.startsAt || b.createdAt || 0).getTime() -
        new Date(a.schedule?.startsAt || a.createdAt || 0).getTime()
    );

  return (
    <MantineProvider theme={theme} withCssVariables>
      {/* Aplica fondo y color de texto del branding */}
      <Box style={cssVars(brand)} bg="var(--bg-color)" c="var(--text-color)">
        {/* HEADER */}
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
          <Container size="xl">
            <Group justify="space-between">
              <Group gap="md">
                {org.branding?.logoUrl ? (
                  <Image
                    src={org.branding.logoUrl}
                    alt={org.name}
                    h={60}
                    w="auto"
                    fit="contain"
                  />
                ) : (
                  <Title order={3} size="h3" c="var(--mantine-color-brand-9)">
                    {org.name}
                  </Title>
                )}
              </Group>
              <Group gap="sm">
                <UserSession orgId={org._id} showLoginButton={true} />
                {isOwner && (
                  <Button
                    component={Link}
                    to={`/org/${slug}/admin`}
                    variant="light"
                    size="sm"
                  >
                    ⚙️ Admin
                  </Button>
                )}
              </Group>
            </Group>
          </Container>
        </Box>

        {/* HERO (header responsive con imagen mobile/desktop) */}
        <Hero
          org={org}
          nextEvent={nextEvent}
          orgSlug={slug!}
          onScrollToUpcoming={handleScrollToUpcoming}
        />

        {/* PROXIMO EVENTO DESTACADO */}
        {nextEvent && (
          <Container size="xl" my={32}>
            <Title order={2} size="h2" mb="md">
              Próximo evento
            </Title>
            <NextEventSection event={nextEvent} orgSlug={slug!} />
          </Container>
        )}

        {/* PRÓXIMOS EVENTOS */}
        <Container size="xl" my={40}>
          <div ref={upcomingSectionRef}>
            <Title order={2} size="h2" mb="md">
              Próximos Eventos
            </Title>

            {upcomingEvents.length === 0 ? (
              <Card withBorder p="xl">
                <Text c="dimmed" ta="center">
                  No hay eventos programados próximamente
                </Text>
              </Card>
            ) : (
              <ScrollArea
                type="auto"
                scrollbarSize={8}
                offsetScrollbars
                style={{ minWidth: 0, width: "100%", overflowX: "auto" }}
              >
                <Group gap={24} wrap="nowrap" pb="md" style={{ minWidth: 0 }}>
                  {upcomingEvents.map((e) => (
                    <Box
                      key={e._id}
                      style={{
                        minWidth: 320,
                        maxWidth: 320,
                        width: 320,
                        flex: "0 0 320px",
                      }}
                    >
                      <UpcomingEventCard event={e} orgSlug={slug!} />
                    </Box>
                  ))}
                </Group>
              </ScrollArea>
            )}
          </div>
        </Container>

        {pastEvents.length > 0 && (
          <Container size="xl" my={40}>
            <Group justify="space-between" mb="md">
              <Title order={2} size="h2">
                Eventos Anteriores
              </Title>
            </Group>
            <ScrollArea
              type="auto"
              scrollbarSize={8}
              offsetScrollbars
              style={{ minWidth: 0, width: "100%", overflowX: "auto" }}
            >
              <Group gap={24} wrap="nowrap" pb="md" style={{ minWidth: 0 }}>
                {pastEvents.map((event) => (
                  <Box
                    key={event._id}
                    style={{
                      minWidth: 320,
                      maxWidth: 320,
                      width: 320,
                      flex: "0 0 320px",
                    }}
                  >
                    <PastEventCard event={event} orgSlug={slug!} />
                  </Box>
                ))}
              </Group>
            </ScrollArea>
          </Container>
        )}

        {/* FOOTER */}
        <BrandedFooter config={org.branding?.footer} />
      </Box>
    </MantineProvider>
  );
}
