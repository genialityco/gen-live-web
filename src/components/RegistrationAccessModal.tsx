import { Modal, Stack, Button, Text, Paper, Group } from "@mantine/core";
import { IconLogin, IconUserPlus } from "@tabler/icons-react";

interface RegistrationAccessModalProps {
  opened: boolean;
  onClose: () => void;
  formTitle?: string;
  formDescription?: string;
  onSelectLogin: () => void;
  onSelectRegister: () => void;
}

export function RegistrationAccessModal({
  opened,
  onClose,
  formTitle,
  formDescription,
  onSelectLogin,
  onSelectRegister,
}: RegistrationAccessModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={formTitle || "Acceso al Evento"}
      size="md"
      centered
    >
      <Stack gap="lg">
        {formDescription && (
          <Text size="sm" c="dimmed">
            {formDescription}
          </Text>
        )}

        <Text size="sm" fw={500}>
          Para acceder al evento, por favor selecciona una opción:
        </Text>

        {/* Opción: Ingresar (ya registrado) */}
        <Paper
          shadow="sm"
          p="lg"
          withBorder
          style={{ cursor: "pointer" }}
          onClick={onSelectLogin}
        >
          <Group>
            <IconLogin size={32} stroke={1.5} />
            <Stack gap={4} style={{ flex: 1 }}>
              <Text fw={600} size="lg">
                Ingresar
              </Text>
              <Text size="sm" c="dimmed">
                Ya estoy registrado, quiero acceder al evento
              </Text>
            </Stack>
          </Group>
        </Paper>

        {/* Opción: Registrarse (nuevo usuario) */}
        <Paper
          shadow="sm"
          p="lg"
          withBorder
          style={{ cursor: "pointer" }}
          onClick={onSelectRegister}
        >
          <Group>
            <IconUserPlus size={32} stroke={1.5} />
            <Stack gap={4} style={{ flex: 1 }}>
              <Text fw={600} size="lg">
                Registrarse
              </Text>
              <Text size="sm" c="dimmed">
                Soy nuevo, quiero crear mi registro
              </Text>
            </Stack>
          </Group>
        </Paper>

        <Button variant="subtle" fullWidth onClick={onClose} mt="xs">
          Cerrar (no podré acceder al evento)
        </Button>
      </Stack>
    </Modal>
  );
}
