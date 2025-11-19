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
  Divider,
  Alert,
  Box,
  MantineProvider,
} from "@mantine/core";
import { fetchOrgBySlug, type Org } from "../../api/orgs";
import { fetchEventsByOrg, type EventItem } from "../../api/events";
import { useAuth } from "../../auth/AuthProvider";
import { useEventRealtimeData } from "../../hooks/useEventRealtimeData";
import { useAnonymousAuth } from "../../hooks/useAnonymousAuth";
import { BrandedHeader, BrandedFooter } from "../../components/branding";
import UserSession from "../../components/UserSession";

export default function EventLanding() {
  const { slug, eventSlug } = useParams<{ slug: string; eventSlug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Auto-inicializar sesión anónima
  useAnonymousAuth();
  
  const [org, setOrg] = useState<Org | null>(null);
  const [eventData, setEventData] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Usar el hook de tiempo real para el estado del evento (SOLO LECTURA, sin escribir presencia)
  const eventSlugToUse = eventSlug || '';
  const { resolved: event, status, nowCount, loading: eventLoading } = useEventRealtimeData(eventSlugToUse);

  // Verificar si el usuario actual es propietario de la organización
  const isOwner = user && org && org.ownerUid === user.uid;

  // Cargar información del evento
  const loadData = async () => {
    if (!slug || !eventSlug) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Cargar organización
      const orgData = await fetchOrgBySlug(slug);
      setOrg(orgData);
      
      // Cargar eventos para obtener datos completos del evento específico
      const eventsData = await fetchEventsByOrg(orgData._id);
      const foundEvent = eventsData.find(e => e.slug === eventSlug || e._id === eventSlug);
      setEventData(foundEvent || null);
      
    } catch (err) {
      console.error("Error loading data:", err);
      setError("No se pudo cargar la información del evento");
    } finally {
      setLoading(false);
    }
  };

  // Manejar el click en el botón principal
  const handleMainAction = async () => {
    // VALIDACIÓN PREVIA: Si el usuario tiene sesión, verificar si ya está registrado
    // Obtener email de múltiples fuentes
    let userEmail = user?.email;
    
    // Si no hay email en user (sesión anónima), buscar en localStorage
    if (!userEmail && user?.uid) {
      userEmail = localStorage.getItem(`uid-${user.uid}-email`);
    }
    if (!userEmail) {
      userEmail = localStorage.getItem('user-email');
    }
    
    // Si hay email, UID y evento, intentar auto-registro
    if (userEmail && user?.uid && eventData?._id && org?._id) {
      console.log("🔍 EventLanding: Validating existing session before redirecting", {
        userEmail,
        eventId: eventData._id,
        orgId: org._id,
        hasUID: !!user?.uid
      });
      
      try {
        // 1. Verificar si ya está registrado al evento
        const { checkIfRegistered } = await import("../../api/events");
        const result = await checkIfRegistered(eventData._id, userEmail);
        
        if (result.isRegistered) {
          console.log("✅ EventLanding: User already registered, redirecting to /attend");
          navigate(`/org/${slug}/event/${eventSlug}/attend`);
          return;
        }
        
        // 2. Si tiene OrgAttendee de esta organización, auto-registrar
        if (result.orgAttendee) {
          console.log("🎯 EventLanding: User has OrgAttendee, auto-registering to event");
          
          const { registerToEventWithFirebase } = await import("../../api/events");
          await registerToEventWithFirebase(eventData._id, {
            email: userEmail,
            name: result.orgAttendee.name,
            formData: result.orgAttendee.registrationData,
            firebaseUID: user.uid,
          });
          
          console.log("✅ EventLanding: Auto-registration successful, redirecting to /attend");
          navigate(`/org/${slug}/event/${eventSlug}/attend`);
          return;
        }
        
        console.log("⚠️ EventLanding: User has session but no OrgAttendee for this org");
      } catch (error) {
        console.error("❌ EventLanding: Error in auto-registration flow:", error);
        // Si falla, continuar con el flujo normal
      }
    }
    
    // FLUJO NORMAL: Ir a /register para verificación/registro
    console.log("🎟️ EventLanding: Redirecting to registration flow");
    navigate(`/org/${slug}/event/${eventSlug}/register`);
  };

  useEffect(() => {
    loadData();
  }, [slug, eventSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Estados de carga
  const finalLoading = loading || eventLoading;
  const finalError = error || (!event && !eventLoading ? "Evento no encontrado" : null);

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
      case 'live': return 'green';
      case 'upcoming': return 'blue';
      case 'ended': return 'gray';
      case 'replay': return 'orange';
      default: return 'gray';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'live': return 'En vivo ahora';
      case 'upcoming': return 'Próximamente';
      case 'ended': return 'Finalizado';
      case 'replay': return 'Repetición disponible';
      default: return 'Estado desconocido';
    }
  };

  const getActionButtonText = (status: string) => {
    switch (status) {
      case 'live': return 'Ingresar al evento en vivo';
      case 'upcoming': return 'Registrarme al evento';
      case 'ended': return 'Ver información del evento';
      case 'replay': return 'Ver repetición del evento';
      default: return 'Ingresar al evento';
    }
  };

  // Calcular tiempo restante para eventos próximos
  const getTimeUntilEvent = () => {
    if (status !== 'upcoming' || !eventData?.startDate) return null;
    
    const now = new Date();
    const eventDate = new Date(eventData.startDate || eventData.schedule?.startsAt || '');
    const diffMs = eventDate.getTime() - now.getTime();
    
    if (diffMs <= 0) return null;
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days} día${days > 1 ? 's' : ''}, ${hours} hora${hours > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''}, ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
  };

  const timeUntilEvent = getTimeUntilEvent();

  // Obtener branding del evento con fallback al de la organización
  const eventBranding = eventData?.branding || org?.branding;
  
  // Estilos dinámicos del branding
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

  // Theme personalizado con colores de branding
  const primaryColor = eventBranding?.colors?.primary || "#228BE6";
  const customTheme = {
    ...(eventBranding?.colors?.primary && {
      colors: {
        brand: [
          primaryColor,
          primaryColor,
          primaryColor,
          primaryColor,
          primaryColor,
          primaryColor,
          primaryColor,
          primaryColor,
          primaryColor,
          primaryColor,
        ] as const,
      },
      primaryColor: "brand" as const,
    }),
  };

  return (
    <MantineProvider theme={customTheme}>
      <Box style={brandingStyle}>
        {/* Header personalizado del evento */}
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
            <UserSession 
              eventId={eventData?._id}
              orgId={org?._id}
            />
          </Group>

          <Stack gap="xl" align="center">
        {/* Header principal del evento */}
        <Card 
          shadow="xl" 
          padding="xl" 
          radius="xl" 
          withBorder 
          w="100%" 
          maw={800}
          style={{
            backgroundColor: brandingColors?.background ? `${brandingColors.background}08` : undefined,
            borderColor: brandingColors?.primary ? `${brandingColors.primary}20` : undefined,
          }}
        >
          <Stack gap="xl" align="center">
            {/* Estado del evento */}
            <Group justify="center" gap="md">
              <Badge 
                color={getStatusColor(status)}
                size="xl"
                variant={status === 'live' ? 'filled' : 'light'}
                p="md"
              >
                {status === 'live' && '🔴 '}
                {getStatusText(status)}
              </Badge>
              {nowCount > 0 && (
                <Badge variant="light" color="gray" size="lg" p="md">
                  👥 {nowCount} {nowCount === 1 ? 'persona viendo' : 'personas viendo'}
                </Badge>
              )}
            </Group>
            
            {/* Título del evento */}
            <Box ta="center">
              <Title order={1} size="2.5rem" fw={700} lh={1.2} mb="sm">
                {event.title}
              </Title>
            </Box>

            {/* Fecha y tiempo */}
            {(eventData?.startDate || eventData?.schedule?.startsAt) && (
              <Alert 
                variant="light" 
                color={status === 'live' ? 'green' : 'blue'} 
                radius="md"
                w="100%"
              >
                <Stack gap="xs" align="center">
                  <Text size="lg" fw={600} ta="center">
                    📅 {new Date(eventData.startDate || eventData.schedule?.startsAt || '').toLocaleDateString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                  {timeUntilEvent && (
                    <Text size="md" c="dimmed" ta="center">
                      ⏰ Faltan {timeUntilEvent} para el inicio
                    </Text>
                  )}
                </Stack>
              </Alert>
            )}

            {/* Descripción del evento */}
            {/* {eventData?.description && (
              <>
                <Divider w="100%" />
                <Text size="lg" lh={1.8} ta="center" maw={600}>
                  {eventData.description}
                </Text>
              </>
            )} */}

            {/* Botón principal de acción */}
            <Button 
              onClick={handleMainAction}
              size="xl"
              radius="xl"
              leftSection="🎟️"
              variant={status === 'live' ? 'gradient' : 'filled'}
              gradient={status === 'live' ? { from: 'red', to: 'pink', deg: 90 } : undefined}
              color={status === 'live' ? undefined : (eventBranding?.colors?.primary ? 'brand' : getStatusColor(status))}
              w="100%"
              maw={400}
              h={60}
              fz="lg"
              fw={600}
            >
              {getActionButtonText(status)}
            </Button>

            {/* Información adicional según el estado */}
            {status === 'live' && (
              <Alert color="red" variant="light" w="100%">
                <Text size="sm" ta="center">
                  🔥 ¡El evento está en vivo ahora! Regístrate para unirte a la transmisión.
                </Text>
              </Alert>
            )}

            {status === 'upcoming' && (
              <Alert color="blue" variant="light" w="100%">
                <Text size="sm" ta="center">
                  📝 Regístrate ahora para reservar tu lugar y recibir el enlace de acceso.
                </Text>
              </Alert>
            )}

            {status === 'ended' && (
              <Alert color="gray" variant="light" w="100%">
                <Text size="sm" ta="center">
                  📋 El evento ha finalizado. Puedes ver la información y contenido disponible.
                </Text>
              </Alert>
            )}

            {status === 'replay' && (
              <Alert color="orange" variant="light" w="100%">
                <Text size="sm" ta="center">
                  ▶️ La repetición está disponible. Regístrate o ingresaa para acceder al contenido grabado.
                </Text>
              </Alert>
            )}
          </Stack>
        </Card>

        {/* Botones secundarios */}
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

    {/* Footer personalizado del evento */}
    <BrandedFooter config={eventBranding?.footer} />
  </Box>
</MantineProvider>
  );
}