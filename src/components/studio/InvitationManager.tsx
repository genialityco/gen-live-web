// src/components/studio/InvitationManager.tsx
import React from "react";
import {
  Stack,
  Text,
  Paper,
  Group,
  CopyButton,
  Button,
  Alert,
  Code,
  Badge,
} from "@mantine/core";
import {
  IconCopy,
  IconCheck,
  IconLink,
  IconInfoCircle,
} from "@tabler/icons-react";

interface InvitationManagerProps {
  eventSlug: string;
  disabled?: boolean;
}

/**
 * Componente para gestionar invitaciones de speakers
 * Muestra un enlace genérico reutilizable que genera tokens dinámicamente
 */
export const InvitationManager: React.FC<InvitationManagerProps> = ({
  eventSlug,
  disabled = false,
}) => {
  const getInviteUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/studio/${eventSlug}/join`;
  };

  const inviteUrl = getInviteUrl();

  return (
    <Stack gap="md">
      <div>
        <Text size="sm" fw={600} mb="xs">
          Enlace de Invitación para Speakers
        </Text>
        <Text size="xs" c="dimmed">
          Comparte este enlace con todos tus speakers. Cada uno ingresará su nombre
          y se generará un token de acceso automáticamente.
        </Text>
      </div>

      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        <Text size="sm">
          Este enlace es reutilizable y no expira. Todos los speakers pueden usar el mismo enlace.
        </Text>
      </Alert>

      <Paper p="md" withBorder radius="md" bg="gray.0">
        <Stack gap="md">
          <Group gap="xs">
            <IconLink size={20} color="var(--mantine-color-blue-6)" />
            <Text size="sm" fw={600}>
              Enlace Universal de Speakers
            </Text>
            <Badge size="sm" color="green" variant="light">
              Activo
            </Badge>
          </Group>

          <Code block style={{ fontSize: 12, wordBreak: "break-all", padding: "12px" }}>
            {inviteUrl}
          </Code>

          <Group justify="flex-end">
            <CopyButton value={inviteUrl}>
              {({ copied, copy }) => (
                <Button
                  size="sm"
                  variant="filled"
                  color={copied ? "green" : "blue"}
                  leftSection={
                    copied ? <IconCheck size={16} /> : <IconCopy size={16} />
                  }
                  onClick={copy}
                  disabled={disabled}
                >
                  {copied ? "¡Enlace copiado!" : "Copiar enlace"}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Stack>
      </Paper>

      <Alert color="gray" variant="light">
        <Text size="xs" c="dimmed">
          💡 <strong>Cómo funciona:</strong> Cuando un speaker accede al enlace, ingresa su nombre
          y el sistema genera automáticamente un token de acceso único para esa sesión.
        </Text>
      </Alert>
    </Stack>
  );
};
