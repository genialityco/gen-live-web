import { useState, useEffect } from "react";
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
  Alert,
  Box,
  Grid,
} from "@mantine/core";
import { fetchOrgBySlug, type Org } from "../../api/orgs";
import { fetchEventsByOrg, checkIfRegistered, checkIfRegisteredByUID, associateFirebaseUID, type EventItem } from "../../api/events";
import { useAuth } from "../../auth/AuthProvider";
import { useEventRealtime } from "../../hooks/useEventRealtime";
import UserSession from "../../components/auth/UserSession";

export default function EventAttend() {
  const { slug, eventSlug } = useParams<{ slug: string; eventSlug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [org, setOrg] = useState<Org | null>(null);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [checkingRegistration, setCheckingRegistration] = useState(true);

  // Usar el hook de tiempo real para el estado del evento
  const eventSlugToUse = eventSlug || '';
  const { resolved: realtimeEvent, status, nowCount, loading: eventLoading } = useEventRealtime(eventSlugToUse);

  // Verificar si el usuario actual es propietario de la organización
  const isOwner = user && org && org.ownerUid === user.uid;

  useEffect(() => {
    const loadData = async () => {
      if (!slug || !eventSlug) {
        setError("Parámetros de URL inválidos");
        setLoading(false);
        return;
      }

      try {
        setError(null);
        
        // Cargar datos de organización
        const orgData = await fetchOrgBySlug(slug);
        setOrg(orgData);

        // Cargar evento específico
        const eventsData = await fetchEventsByOrg(orgData._id);
        const foundEvent = eventsData.find(e => e.slug === eventSlug || e._id === eventSlug);
        
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

    loadData();
  }, [slug, eventSlug]);

  // Verificar registro cuando tenemos el evento y usuario
  useEffect(() => {
    const checkRegistration = async () => {
      if (!event) {
        console.log("🔍 EventAttend: No event, skipping registration check");
        setCheckingRegistration(false);
        return;
      }

      // PRIORIDAD 1: Buscar por email (método estable basado en attendeeId)
      // Este método busca: email → OrgAttendee → EventUser (por attendeeId + eventId)
      // Es el método correcto porque attendeeId no cambia entre sesiones
      
      // Obtener email de múltiples fuentes
      let userEmail = user?.email;
      
      // Si no hay email en user (sesión anónima), buscar en localStorage
      if (!userEmail) {
        // Intentar obtener email asociado al UID actual
        if (user?.uid) {
          userEmail = localStorage.getItem(`uid-${user.uid}-email`);
        }
        // Fallback: email genérico guardado
        if (!userEmail) {
          userEmail = localStorage.getItem('user-email');
        }
      }
      
      if (userEmail) {
        console.log("🎯 EventAttend: [PRIORITY 1] Checking registration by EMAIL (stable method)", { 
          eventId: event._id, 
          userEmail: userEmail,
          userUID: user?.uid,
          isAnonymous: user?.isAnonymous,
          emailSource: user?.email ? 'user.email' : 'localStorage'
        });

        try {
          const result = await checkIfRegistered(event._id, userEmail);
          console.log("✅ EventAttend: Registration check by email result", { 
            isRegistered: result.isRegistered,
            result 
          });
          
          // Si está registrado por email, sincronizar UID para optimización futura
          if (result.isRegistered && user?.uid) {
            try {
              await associateFirebaseUID(event._id, userEmail, user.uid);
              console.log("🔄 EventAttend: Synced Firebase UID for existing registration");
            } catch (syncError) {
              console.warn("⚠️ EventAttend: Could not sync UID, but user is registered:", syncError);
            }
          }
          
          setIsRegistered(result.isRegistered);
          return;
        } catch (err) {
          console.error("❌ EventAttend: Error checking registration by email:", err);
        }
      }

      // PRIORIDAD 2: Fallback a Firebase UID (puede fallar con sesiones anónimas nuevas)
      // Solo usar si no hay email disponible
      if (user?.uid && !user?.email) {
        console.log("🎯 EventAttend: [PRIORITY 2] Checking registration by Firebase UID (fallback)", { 
          eventId: event._id, 
          userUID: user.uid,
          isAnonymous: user.isAnonymous
        });

        try {
          const result = await checkIfRegisteredByUID(event._id, user.uid);
          console.log("✅ EventAttend: Registration check by UID result", { 
            isRegistered: result.isRegistered,
            result 
          });
          setIsRegistered(result.isRegistered);
          return;
        } catch (err) {
          console.error("❌ EventAttend: Error checking registration by UID:", err);
        }
      }

      // PRIORIDAD 3: Último fallback a localStorage (compatibilidad temporal)
      const storedEmail = localStorage.getItem('last-registered-email');
      if (storedEmail) {
        console.log("🎯 EventAttend: [PRIORITY 3] Last fallback - checking by stored email", { 
          eventId: event._id, 
          storedEmail
        });

        try {
          const result = await checkIfRegistered(event._id, storedEmail);
          console.log("✅ EventAttend: Registration check by stored email result", { 
            isRegistered: result.isRegistered,
            result 
          });
          setIsRegistered(result.isRegistered);
          
          // Limpiar localStorage ya que tenemos el resultado
          localStorage.removeItem('last-registered-email');
          return;
        } catch (err) {
          console.error("❌ EventAttend: Error checking registration by stored email:", err);
        }
      }

      // Si llegamos aquí, no se pudo verificar el registro
      console.log("⚠️ EventAttend: Could not verify registration - no user, UID, email, or stored email");
      setIsRegistered(isOwner || false);
    };

    checkRegistration().finally(() => {
      setCheckingRegistration(false);
    });
  }, [event, user, isOwner]);

  const handleRegisterRedirect = () => {
    navigate(`/org/${slug}/event/${eventSlug}/register`);
  };

  const finalEvent = realtimeEvent || event;

  if (loading || eventLoading || checkingRegistration) {
    return (
      <Container size="sm">
        <Center h={400}>
          <Stack align="center" gap="lg">
            <Loader size="lg" />
            <Text>Verificando acceso al evento...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  if (error || !org || !finalEvent) {
    return (
      <Container size="sm">
        <Center h={400}>
          <Stack align="center" gap="md">
            <Text c="red" size="lg">{error || "Evento no encontrado"}</Text>
            <Group>
              <Button component={Link} to={`/org/${slug}/event/${eventSlug}`}>
                ← Volver al evento
              </Button>
              <Button component={Link} to={`/org/${slug}`} variant="light">
                Ver organización
              </Button>
            </Group>
          </Stack>
        </Center>
      </Container>
    );
  }

  // Si no está registrado y no es owner, mostrar página de acceso denegado
  if (!isRegistered && !isOwner) {
    return (
      <Container size="sm">
        <Stack gap="xl">
          {/* Header con UserSession */}
          <Group justify="space-between" align="center">
            <Button
              component={Link}
              to={`/org/${slug}/event/${eventSlug}`}
              variant="subtle"
              size="sm"
              leftSection="←"
            >
              {finalEvent.title}
            </Button>
            <UserSession 
              eventId={event?._id}
              orgId={org?._id}
            />
          </Group>

          <Center h={400}>
            <Card shadow="lg" padding="xl" radius="lg" withBorder maw={500}>
              <Stack align="center" gap="lg">
                <Box ta="center">
                  <Title order={2} c="orange" mb="sm">
                    🔒 Registro requerido
                  </Title>
                  <Text c="dimmed" size="md" lh={1.6}>
                    Para acceder al contenido de este evento, primero debes registrarte.
                  </Text>
                </Box>

                <Alert color="blue" variant="light" w="100%">
                  <Text size="sm">
                    El registro es gratuito y solo toma unos minutos. Una vez registrado, 
                    podrás acceder a la transmisión en vivo, chat, y todos los contenidos del evento.
                  </Text>
                </Alert>

                <Stack gap="md" w="100%">
                  <Button 
                    size="lg" 
                    onClick={handleRegisterRedirect}
                    leftSection="📝"
                  >
                    Registrarme ahora
                  </Button>
                  
                  <Button 
                    component={Link} 
                    to={`/org/${slug}/event/${eventSlug}`}
                    variant="light"
                    size="sm"
                  >
                    ← Volver a información del evento
                  </Button>
                </Stack>
              </Stack>
            </Card>
          </Center>
        </Stack>
      </Container>
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
      case 'live': return 'En vivo';
      case 'upcoming': return 'Próximamente';
      case 'ended': return 'Finalizado';
      case 'replay': return 'Repetición disponible';
      default: return 'Estado desconocido';
    }
  };

  // Contenido principal del evento (para usuarios registrados)
  return (
    <Container size="xl">
      <Stack gap="lg">
        {/* Header con UserSession */}
        <Group justify="space-between" align="center">
          <Button
            component={Link}
            to={`/org/${slug}/event/${eventSlug}`}
            variant="subtle"
            size="sm"
            leftSection="←"
          >
            {finalEvent.title}
          </Button>
          <UserSession 
            eventId={event?._id}
            orgId={org?._id}
          />
        </Group>

        {/* Header del evento */}
        <Card shadow="sm" padding="lg" radius="lg" withBorder>
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="md" align="center" style={{ flex: 1 }}>
              <Badge 
                color={getStatusColor(status)}
                size="lg"
                variant={status === 'live' ? 'filled' : 'light'}
              >
                {status === 'live' && '🔴 '}
                {getStatusText(status)}
              </Badge>
              
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Title order={2} size="h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {finalEvent.title}
                </Title>
                <Text size="sm" c="dimmed">
                  {org.name}
                </Text>
              </Stack>

              {nowCount > 0 && (
                <Badge variant="light" color="gray" size="md">
                  👥 {nowCount} {nowCount === 1 ? 'persona viendo' : 'personas viendo'}
                </Badge>
              )}
            </Group>

            <Group gap="sm" wrap="nowrap">
              {isOwner && (
                <Button 
                  component={Link} 
                  to={`/org/${slug}/event/${eventSlug}/admin`}
                  variant="filled"
                  size="sm"
                >
                  🎛️ Control
                </Button>
              )}
              <Button 
                component={Link} 
                to={`/org/${slug}/event/${eventSlug}`}
                variant="subtle"
                size="sm"
              >
                ℹ️ Info
              </Button>
            </Group>
          </Group>
        </Card>

        {/* Contenido principal */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            {/* Área de transmisión */}
            <Card shadow="md" padding="lg" radius="lg" withBorder h="100%">
              <Stack gap="lg" h="100%">
                
                {status === 'live' && finalEvent.stream && 'url' in finalEvent.stream && finalEvent.stream.url ? (
                  <Box 
                    style={{ 
                      aspectRatio: '16/9',
                      backgroundColor: '#000',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      flex: 1
                    }}
                  >
                    <iframe
                      src={'url' in finalEvent.stream! ? finalEvent.stream.url : ''}
                      width="100%"
                      height="100%"
                      style={{ 
                        border: 'none',
                        borderRadius: '8px'
                      }}
                      title="Transmisión en vivo"
                      frameBorder="0"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  </Box>
                ) : status === 'replay' && finalEvent.stream && 'url' in finalEvent.stream && finalEvent.stream.url ? (
                  <Box 
                    style={{ 
                      aspectRatio: '16/9',
                      backgroundColor: '#000',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      flex: 1
                    }}
                  >
                    <iframe
                      src={'url' in finalEvent.stream! ? finalEvent.stream.url : ''}
                      width="100%"
                      height="100%"
                      style={{ 
                        border: 'none',
                        borderRadius: '8px'
                      }}
                      title="Repetición del evento"
                      frameBorder="0"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  </Box>
                ) : status === 'upcoming' ? (
                  <Alert color="blue" variant="light" style={{ flex: 1 }}>
                    <Stack align="center" gap="md">
                      <Text size="lg">🕒 El evento comenzará pronto</Text>
                      <Text size="sm" c="dimmed">
                        La transmisión aparecerá aquí cuando el evento comience.
                      </Text>
                    </Stack>
                  </Alert>
                ) : (
                  <Alert color="gray" variant="light" style={{ flex: 1 }}>
                    <Stack align="center" gap="md">
                      <Text size="lg">📝 Evento finalizado</Text>
                      <Text size="sm" c="dimmed">
                        Este evento ha terminado y no está disponible para reproducir.
                      </Text>
                    </Stack>
                  </Alert>
                )}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            {/* Área de chat e interacciones */}
            <Stack gap="lg">
              <Card shadow="md" padding="lg" radius="lg" withBorder>
                <Stack gap="md">
                  <Title order={4}>💬 Chat del evento</Title>
                  {event?._id ? (
                    <Box
                      style={{ 
                        height: '400px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid var(--mantine-color-gray-3)'
                      }}
                    >
                      <iframe
                        src={`https://chat-geniality.netlify.app?${new URLSearchParams({
                          nombre: user?.email?.split('@')[0] || user?.displayName || 'Usuario',
                          chatid: event._id,
                          iduser: '', // vacío para chat público
                          eventid: event._id,
                          anonimo: user?.isAnonymous ? 'true' : 'false',
                          message_highlighted: ''
                        }).toString()}`}
                        width="100%"
                        height="100%"
                        style={{ 
                          border: 'none',
                          borderRadius: '8px'
                        }}
                        title="Chat del evento"
                        sandbox="allow-scripts allow-same-origin allow-forms"
                      />
                    </Box>
                  ) : (
                    <Alert color="gray" variant="light">
                      <Text size="sm" ta="center">
                        El chat estará disponible cuando se cargue completamente el evento
                      </Text>
                    </Alert>
                  )}
                </Stack>
              </Card>

              {/* Información adicional */}
              <Card shadow="sm" padding="md" radius="lg" withBorder>
                <Stack gap="sm">
                  <Title order={5}>📋 Información del evento</Title>
                  {event?.description && (
                    <Text size="sm" c="dimmed" lineClamp={3}>
                      {event.description}
                    </Text>
                  )}
                  {(event?.startDate || event?.schedule?.startsAt) && (
                    <Text size="xs" c="dimmed">
                      📅 {new Date(event.startDate || event.schedule?.startsAt || '').toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  )}
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}