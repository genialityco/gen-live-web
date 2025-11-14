import {
  Card,
  Stack,
  Title,
  Text,
  Button,
  Group,
  Box,
  SimpleGrid,
} from "@mantine/core";

interface RegistrationAccessCardProps {
  formTitle?: string;
  formDescription?: string;
  onSelectLogin: () => void;
  onSelectRegister: () => void;
  onCancel: () => void;
}

export function RegistrationAccessCard({
  formTitle,
  formDescription,
  onSelectLogin,
  onSelectRegister,
  onCancel,
}: RegistrationAccessCardProps) {
  return (
    <Card shadow="md" padding="xl" radius="lg" withBorder>
      <Stack gap="xl" align="center">
        <Box ta="center">
          <Title order={2} mb="sm">
            {formTitle || "¿Cómo deseas continuar?"}
          </Title>
          <Text c="dimmed" size="md" maw={500} mx="auto" lh={1.5}>
            {formDescription || "Selecciona una opción para acceder al evento"}
          </Text>
        </Box>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" w="100%" maw={600}>
          {/* Opción: Ya registrado */}
          <Card withBorder shadow="sm" padding="lg" radius="md" style={{ cursor: 'pointer' }} onClick={onSelectLogin}>
            <Stack gap="md" align="center" ta="center">
              <Text size="2rem">🔑</Text>
              <Stack gap="xs">
                <Title order={4} size="h5">
                  Ya estoy registrado
                </Title>
                <Text size="sm" c="dimmed" lh={1.4}>
                  Buscar mi registro existente usando mi información
                </Text>
              </Stack>
              <Button fullWidth variant="filled">
                Buscar mi registro
              </Button>
            </Stack>
          </Card>

          {/* Opción: Primera vez */}
          <Card withBorder shadow="sm" padding="lg" radius="md" style={{ cursor: 'pointer' }} onClick={onSelectRegister}>
            <Stack gap="md" align="center" ta="center">
              <Text size="2rem">📝</Text>
              <Stack gap="xs">
                <Title order={4} size="h5">
                  Primera vez
                </Title>
                <Text size="sm" c="dimmed" lh={1.4}>
                  Completar el formulario de registro para este evento
                </Text>
              </Stack>
              <Button fullWidth variant="light">
                Registrarme ahora
              </Button>
            </Stack>
          </Card>
        </SimpleGrid>

        <Group gap="sm" mt="md">
          <Button
            variant="subtle"
            size="sm"
            onClick={onCancel}
          >
            ← Volver al evento
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}