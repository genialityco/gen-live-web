import { useState, useEffect } from "react";
import {
  Menu,
  Button,
  Avatar,
  Text,
  Stack,
  ActionIcon,
  Loader,
  Card,
} from "@mantine/core";
import { useAuth } from "../../auth/AuthProvider";
import { signOut } from "firebase/auth";
import { auth } from "../../core/firebase";
import { notifications } from "@mantine/notifications";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { fetchOrgAttendeeByEmail } from "../../api/org-attendees";

interface UserSessionProps {
  compact?: boolean; // Para versión compacta en móviles
  eventId?: string; // (opcional, ya no imprescindible para el login)
  orgId?: string; // Para cargar OrgAttendee y mostrar email
  showLoginButton?: boolean; // Si mostrar botón de login cuando no hay sesión
}

interface OrgAttendee {
  _id: string;
  organizationId: string;
  email: string;
  name: string;
  createdAt: Date;
}

export default function UserSession({
  compact = false,
  eventId,
  orgId,
  showLoginButton = true,
}: UserSessionProps) {
  const { user, loading, setSessionName } = useAuth();
  const [orgAttendee, setOrgAttendee] = useState<OrgAttendee | null>(null);
  const navigate = useNavigate();
  const { slug, eventSlug: eventSlugParam } = useParams<{
    slug?: string;
    eventSlug?: string;
  }>();
  const [searchParams] = useSearchParams();
  // Soporta eventSlug como parámetro de ruta (:eventSlug) o query string (?eventSlug=)
  const eventSlug =
    eventSlugParam || searchParams.get("eventSlug") || undefined;

  // Cargar datos del usuario desde el backend (solo lectura)
  const loadUserData = async () => {
    if (!user?.uid || !orgId) return;

    try {
      let userEmail = user.email;
      if (!userEmail) {
        userEmail =
          localStorage.getItem(`uid-${user.uid}-email`) ||
          localStorage.getItem("user-email");
      }

      if (userEmail) {
        const attendeeData = await fetchOrgAttendeeByEmail(orgId, userEmail);

        if (attendeeData) {
          setOrgAttendee({
            ...attendeeData,
            createdAt: new Date(attendeeData.createdAt),
          });

          // Actualizamos el nombre global de sesión
          const resolvedName =
            attendeeData.name ||
            user.displayName ||
            userEmail.split("@")[0] ||
            "Usuario";

          setSessionName(resolvedName);
        } else {
          setOrgAttendee(null);

          // Si no hay attendee, intentar al menos un fallback
          const fallbackName =
            user.displayName ||
            (userEmail ? userEmail.split("@")[0] : null) ||
            null;

          setSessionName(fallbackName);
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const goToUpdateInfo = () => {
    if (!slug || !orgId) {
      notifications.show({
        title: "Error",
        message: "No se pudo determinar la organización.",
        color: "red",
      });
      return;
    }

    // Por ejemplo, centralizamos en OrgAccess con un modo update
    navigate(`/org/${slug}/access?mode=update`);
  };

  // Cerrar sesión
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setOrgAttendee(null);
      setSessionName(null); // 👈 limpiamos el nombre de sesión

      localStorage.removeItem("user-email");
      if (user?.uid) {
        localStorage.removeItem(`uid-${user.uid}-email`);
      }

      notifications.show({
        title: "Sesión cerrada",
        message: "Has cerrado sesión correctamente",
        color: "blue",
      });
    } catch (error) {
      console.error("Error signing out:", error);
      notifications.show({
        title: "Error",
        message: "No se pudo cerrar sesión",
        color: "red",
      });
    }
  };

  // Redirigir al flujo central de acceso
  const goToAccess = () => {
    if (!slug) {
      notifications.show({
        title: "Error",
        message: "No se pudo determinar la organización.",
        color: "red",
      });
      return;
    }

    // Usa el eventSlug del contexto actual (ruta o query) o el eventId como fallback
    const eventSlugToUse = eventSlug || eventId;
    const base = `/org/${slug}/access`;
    const url = eventSlugToUse ? `${base}?eventSlug=${eventSlugToUse}` : base;
    console.log("Redirigiendo a acceso centralizado:", url);

    navigate(url);
  };

  // Cargar datos cuando cambie el usuario
  useEffect(() => {
    if (user?.uid) {
      loadUserData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, eventId, orgId]);

  // Si está cargando auth
  if (loading) {
    return (
      <ActionIcon variant="subtle" size="lg">
        <Loader size="sm" />
      </ActionIcon>
    );
  }

  // Si no hay usuario → mostrar acceso centralizado
  if (!user) {
    if (!showLoginButton) return null;

    return (
      <Stack
        gap="xs"
        style={{
          minWidth: compact ? 120 : 200,
          display: "flex",
          flexDirection: "row",
        }}
      >
        <Button
          size={compact ? "xs" : "sm"}
          variant="outline"
          leftSection="👤"
          onClick={goToAccess}
        >
          Ingresar o Registrarse
        </Button>
      </Stack>
    );
  }

  // Obtener email del usuario (desde múltiples fuentes)
  const getUserEmail = () => {
    if (orgAttendee?.email) return orgAttendee.email;
    if (user?.email) return user.email;

    if (user?.uid) {
      const storedEmail = localStorage.getItem(`uid-${user.uid}-email`);
      if (storedEmail) return storedEmail;
    }

    const genericEmail = localStorage.getItem("user-email");
    if (genericEmail) return genericEmail;

    return null;
  };

  const userEmail = getUserEmail();

  // Usuario autenticado - menú simple
  return (
    <Menu shadow="md" width={280} position="bottom-end">
      <Menu.Target>
        <Button
          variant="subtle"
          rightSection={
            <Avatar size="sm" radius="xl">
              {userEmail ? userEmail[0]?.toUpperCase() : "U"}
            </Avatar>
          }
          styles={{
            inner: { justifyContent: "flex-start" },
            section: { marginInlineStart: 15 },
          }}
        >
          {compact ? "" : orgAttendee?.name || userEmail || "Usuario"}
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Sesión activa</Menu.Label>

        <Card p="sm" mb="xs" withBorder>
          <Stack gap="xs">
            {userEmail ? (
              <Text size="sm" fw={500}>
                {userEmail}
              </Text>
            ) : (
              <Text size="sm" c="dimmed">
                Sin email asociado
              </Text>
            )}

            {orgAttendee?.name && (
              <Text size="xs" c="dimmed">
                Nombre: {orgAttendee.name}
              </Text>
            )}
          </Stack>
        </Card>

        <Menu.Divider />

        <Menu.Item leftSection="✏️" onClick={goToUpdateInfo}>
          Actualizar información
        </Menu.Item>

        <Menu.Item leftSection="🚪" color="red" onClick={handleSignOut}>
          Cerrar sesión
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
