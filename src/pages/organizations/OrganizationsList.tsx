import { useState, useEffect } from "react";
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
} from "@mantine/core";
import { Link } from "react-router-dom";
import { fetchMyOrgs, type Org } from "../../api/orgs";
import { useAuth } from "../../auth/AuthProvider";

export default function OrganizationsList() {
  const { user, loading: authLoading } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOrganizations = async () => {
      if (!user || user.isAnonymous) {
        setError("Debes iniciar sesión para ver tus organizaciones");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const list = await fetchMyOrgs();
        setOrgs(list);
      } catch (err) {
        console.error("Error loading organizations:", err);
        setError("No se pudieron cargar las organizaciones");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      loadOrganizations();
    }
  }, [authLoading, user]);

  const refetchOrganizations = async () => {
    if (!user || user.isAnonymous) return;
    
    try {
      setLoading(true);
      setError(null);
      const list = await fetchMyOrgs();
      setOrgs(list);
    } catch (err) {
      console.error("Error loading organizations:", err);
      setError("No se pudieron cargar las organizaciones");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (error) {
    return (
      <Container size="sm">
        <Center h={400}>
          <Stack align="center" gap="md">
            <Text c="red" size="lg">{error}</Text>
            <Button onClick={refetchOrganizations}>Reintentar</Button>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="lg">
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <div>
            <Title order={1} mb="xs">Mis Organizaciones</Title>
            <Text c="dimmed" size="lg">
              Gestiona tus organizaciones y eventos
            </Text>
          </div>
          <Button 
            component={Link} 
            to="/org/admin"
            variant="filled"
          >
            ➕ Crear Organización
          </Button>
        </Group>

        {orgs.length === 0 ? (
          <Center h={300}>
            <Stack align="center" gap="md">
              <Text size="lg" c="dimmed">No tienes organizaciones creadas</Text>
              <Text size="sm" c="dimmed">¡Crea tu primera organización para comenzar!</Text>
              <Button 
                component={Link} 
                to="/org/admin"
                variant="filled"
                size="md"
              >
                ➕ Crear mi primera organización
              </Button>
            </Stack>
          </Center>
        ) : (
          <Grid>
            {orgs.map((org) => (
              <Grid.Col key={org._id} span={{ base: 12, sm: 6, md: 4 }}>
                <Card 
                  shadow="sm" 
                  padding="lg" 
                  radius="lg" 
                  withBorder
                  h="100%"
                >
                  <Stack gap="md" h="100%">
                    <Group justify="space-between" align="flex-start">
                      <Title order={3} lineClamp={2}>
                        {org.name}
                      </Title>
                      <Badge variant="light" color="blue" size="sm">
                        {org.domainSlug}
                      </Badge>
                    </Group>

                    {org.description && (
                      <Text size="sm" c="dimmed" lineClamp={3} style={{ flex: 1 }}>
                        {org.description}
                      </Text>
                    )}

                    <Group gap="sm" mt="auto">
                      <Button 
                        component={Link}
                        to={`/org/${org.domainSlug}`}
                        variant="light"
                        size="sm"
                        style={{ flex: 1 }}
                      >
                        👀 Visitar
                      </Button>
                      <Button 
                        component={Link}
                        to={`/org/${org.domainSlug}/admin`}
                        variant="filled"
                        size="sm"
                        style={{ flex: 1 }}
                      >
                        ⚙️ Administrar
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        )}
      </Stack>
    </Container>
  );
}