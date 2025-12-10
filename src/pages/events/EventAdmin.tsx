import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import {
  Stack,
  Loader,
  Center,
  Container,
  Alert,
  Group,
  Button,
} from "@mantine/core";
import { fetchOrgBySlugForAdmin, type Org } from "../../api/orgs";
import { fetchEventsByOrgPrivate, type EventItem } from "../../api/events";
import {
  EventAdminLayout,
  EventAdminOverview,
  EventAdminControl,
  EventAdminAttendees,
  EventAdminSettings,
  EventAdminMetrics,
} from "../../components/events";
import { EventAdminChat } from "../../components/events/EventAdminChat";
import EventAdminPolls from "../../components/events/EventAdminPolls";

export default function EventAdmin() {
  const { slug, eventSlug } = useParams<{ slug: string; eventSlug: string }>();
  const location = useLocation();
  const [org, setOrg] = useState<Org | null>(null);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEventData = async () => {
    if (!slug || !eventSlug) {
      setError("Evento no encontrado");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Cargar organización con permisos de admin
      const orgData = await fetchOrgBySlugForAdmin(slug);
      setOrg(orgData);

      // Cargar eventos y encontrar el específico
      const eventsData = await fetchEventsByOrgPrivate(orgData._id);
      const foundEvent = eventsData.find(
        (e) => e.slug === eventSlug || e._id === eventSlug
      );

      if (!foundEvent) {
        setError("Evento no encontrado");
        return;
      }

      setEvent(foundEvent);
    } catch (err) {
      console.error("Error loading event data:", err);
      setError("No se pudo cargar el evento o no tienes permisos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEventData();
  }, [slug, eventSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determinar qué vista mostrar basado en la ruta (ordenado por flujo de uso)
  const getCurrentView = () => {
    if (!org || !event) return null;

    const path = location.pathname;

    if (path.endsWith("/control")) {
      return <EventAdminControl event={event} onEventUpdate={setEvent} />;
    }

    if (path.endsWith("/metrics")) {
      return <EventAdminMetrics event={event} />;
    }

    if (path.endsWith("/attendees")) {
      return <EventAdminAttendees org={org} event={event} />;
    }

    if (path.endsWith("/polls")) {
      return <EventAdminPolls />;
    }

    if (path.endsWith("/chat")) {
      return <EventAdminChat event={event} />;
    }

    if (path.endsWith("/settings")) {
      return <EventAdminSettings event={event} />;
    }

    // Ruta base: /org/:slug/event/:eventSlug/admin
    return <EventAdminOverview org={org} event={event} />;
  };

  // Loading state
  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Center>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  // Error state
  if (error || !org || !event) {
    return (
      <Container size="lg" py="xl">
        <Center>
          <Stack align="center" gap="md">
            <Alert variant="filled" color="red" title="Error">
              {error || "Evento no encontrado"}
            </Alert>
            <Group>
              <Button component={Link} to={`/org/${slug}/admin/events`}>
                ← Eventos
              </Button>
              <Button
                component={Link}
                to={`/org/${slug}/admin`}
                variant="light"
              >
                Panel admin
              </Button>
            </Group>
          </Stack>
        </Center>
      </Container>
    );
  }

  // Render con el EventAdminLayout
  return (
    <EventAdminLayout org={org} event={event}>
      {getCurrentView()}
    </EventAdminLayout>
  );
}
