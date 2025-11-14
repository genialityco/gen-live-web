import { AppShell, Group, Text, Button, Avatar, Menu, UnstyledButton, Box } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../../auth/AuthProvider";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      notifications.show({
        title: "Sesión cerrada",
        message: "Has cerrado sesión exitosamente",
        color: "green",
      });
      navigate("/");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      notifications.show({
        title: "Error",
        message: "Hubo un problema al cerrar la sesión",
        color: "red",
      });
    }
  };

  const handleLoginRedirect = () => {
    navigate("/admin-auth");
  };

  const handleHomeRedirect = () => {
    navigate("/");
  };

  const getUserDisplayName = () => {
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email;
    return "Usuario";
  };

  const getUserInitials = () => {
    const name = getUserDisplayName();
    return name
      .split(" ")
      .map((n: string) => n.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Text 
              size="lg" 
              fw={600} 
              c="blue"
              style={{ cursor: "pointer" }}
              onClick={handleHomeRedirect}
            >
              LiveEvents
            </Text>
          </Group>

          <Group>
            {loading ? (
              <Text size="sm" c="dimmed">Cargando...</Text>
            ) : user && !user.isAnonymous ? (
              <Menu shadow="md" width={220} position="bottom-end">
                <Menu.Target>
                  <UnstyledButton p="xs" style={{ borderRadius: 8 }}>
                    <Group gap="xs" wrap="nowrap">
                      <Avatar
                        src={user.photoURL}
                        size="sm"
                        radius="xl"
                      >
                        {!user.photoURL && getUserInitials()}
                      </Avatar>
                      <Box visibleFrom="xs" style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={500} truncate>
                          {getUserDisplayName()}
                        </Text>
                        <Text size="xs" c="dimmed" truncate>
                          {user.email}
                        </Text>
                      </Box>
                    </Group>
                  </UnstyledButton>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>Navegación</Menu.Label>
                  <Menu.Item
                    leftSection={<Text size="xs">�</Text>}
                    onClick={handleHomeRedirect}
                  >
                    Inicio
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<Text size="xs">🏢</Text>}
                    onClick={() => navigate("/organizations")}
                  >
                    Ver organizaciones
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Label>Administración</Menu.Label>
                  <Menu.Item
                    leftSection={<Text size="xs">📊</Text>}
                    onClick={() => navigate("/admin")}
                  >
                    Panel general
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<Text size="xs">⚙️</Text>}
                    disabled
                  >
                    Configuración
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<Text size="xs">🚪</Text>}
                    color="red"
                    onClick={handleLogout}
                  >
                    Cerrar sesión
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            ) : (
              <Button
                variant="light"
                size="sm"
                onClick={handleLoginRedirect}
              >
                Iniciar sesión
              </Button>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}