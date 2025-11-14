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
import { useAuth } from "../auth/AuthProvider";
import { signInAnonymously, signOut } from "firebase/auth";
import { auth } from "../core/firebase";
import { notifications } from "@mantine/notifications";

interface UserSessionProps {
  compact?: boolean; // Para versión compacta en móviles
  eventId?: string; // Para verificar registro en evento específico
  orgId?: string; // Para verificar attendee en organización
  showLoginButton?: boolean; // Si mostrar botón de login cuando no hay sesión (default: true)
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
  showLoginButton = true 
}: UserSessionProps) {
  const { user, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  
  // Datos del sistema de referencias
  const [orgAttendee, setOrgAttendee] = useState<OrgAttendee | null>(null);

  // Cargar datos del usuario desde el backend
  const loadUserData = async () => {
    if (!user?.uid) return;
    
    try {
      // Obtener email del usuario desde localStorage
      let userEmail = user.email;
      if (!userEmail) {
        userEmail = localStorage.getItem(`uid-${user.uid}-email`) || localStorage.getItem('user-email');
      }
      
      // Si hay orgId y email, buscar OrgAttendee
      if (orgId && userEmail) {
        const attendeeResponse = await fetch(`/api/org-attendees/by-email/${encodeURIComponent(userEmail)}/org/${orgId}`);
        if (attendeeResponse.ok) {
          const attendeeData = await attendeeResponse.json();
          setOrgAttendee(attendeeData);
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  // Crear sesión anónima
  const handleAnonymousSignIn = async () => {
    try {
      setSigningIn(true);
      await signInAnonymously(auth);
      
      // Crear UserAccount en el backend
      const response = await fetch('/api/user-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid: auth.currentUser?.uid,
          displayName: 'Usuario Anónimo',
        }),
      });
      
      if (response.ok) {
        notifications.show({
          title: "Sesión iniciada",
          message: "Has iniciado sesión como usuario anónimo",
          color: "green",
        });
        loadUserData();
      }
    } catch (error) {
      console.error("Error signing in anonymously:", error);
      notifications.show({
        title: "Error",
        message: "No se pudo iniciar sesión",
        color: "red",
      });
    } finally {
      setSigningIn(false);
    }
  };

  // Cerrar sesión
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setOrgAttendee(null);
      
      // Limpiar localStorage
      localStorage.removeItem('user-email');
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

  // Cargar datos cuando cambie el usuario
  useEffect(() => {
    if (user?.uid) {
      loadUserData();
    }
  }, [user?.uid, eventId, orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si está cargando
  if (loading) {
    return (
      <ActionIcon variant="subtle" size="lg">
        <Loader size="sm" />
      </ActionIcon>
    );
  }

  // Si no hay usuario
  if (!user) {
    // Si no debe mostrar botón de login, no mostrar nada
    if (!showLoginButton) {
      return null;
    }
    
    // Mostrar botón de login anónimo
    return (
      <Button
        variant="light"
        size={compact ? "sm" : "md"}
        leftSection="👤"
        onClick={handleAnonymousSignIn}
        loading={signingIn}
      >
        {compact ? "Ingresar" : "Iniciar sesión"}
      </Button>
    );
  }

  // Obtener email del usuario (desde múltiples fuentes)
  const getUserEmail = () => {
    // 1. Email de orgAttendee (más confiable)
    if (orgAttendee?.email) return orgAttendee.email;
    
    // 2. Email de Firebase user
    if (user?.email) return user.email;
    
    // 3. Email de localStorage
    if (user?.uid) {
      const storedEmail = localStorage.getItem(`uid-${user.uid}-email`);
      if (storedEmail) return storedEmail;
    }
    
    // 4. Email genérico de localStorage
    const genericEmail = localStorage.getItem('user-email');
    if (genericEmail) return genericEmail;
    
    return null;
  };

  const userEmail = getUserEmail();

  // Usuario autenticado - mostrar menú simple
  return (
    <Menu shadow="md" width={280} position="bottom-end">
      <Menu.Target>
        <Button
          variant="subtle"
          leftSection={
            <Avatar
              size="sm"
              radius="xl"
              color="blue"
            >
              {userEmail ? userEmail[0]?.toUpperCase() : "U"}
            </Avatar>
          }
          styles={{
            inner: { justifyContent: "flex-start" },
            section: { marginInlineStart: 0 },
          }}
        >
          {compact ? "" : (userEmail || "Usuario")}
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
          </Stack>
        </Card>

        <Menu.Divider />

        <Menu.Item
          leftSection="🚪"
          color="red"
          onClick={handleSignOut}
        >
          Cerrar sesión
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}