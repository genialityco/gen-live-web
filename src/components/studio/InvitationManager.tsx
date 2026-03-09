// src/components/studio/InvitationManager.tsx
import React from "react";
import {
  Stack,
  Text,
  Group,
  CopyButton,
  Button,
  Code,
  Badge,
} from "@mantine/core";
import {
  IconCopy,
  IconCheck,
  IconLink,
} from "@tabler/icons-react";

interface InvitationManagerProps {
  eventSlug: string;
  disabled?: boolean;
}

export const InvitationManager: React.FC<InvitationManagerProps> = ({
  eventSlug,
  disabled = false,
}) => {
  const inviteUrl = `${window.location.origin}/studio/${eventSlug}/join`;

  return (
    <Stack gap="xs">
      <Group gap="xs">
        <IconLink size={15} color="var(--mantine-color-blue-6)" />
        <Text size="sm" fw={600}>Enlace para Speakers</Text>
        <Badge size="xs" color="green" variant="light">Activo</Badge>
      </Group>

      <Text size="xs" c="dimmed">
        Comparte este enlace. Cada speaker ingresa su nombre y obtiene acceso automáticamente.
      </Text>

      <Code block style={{ fontSize: 11, wordBreak: "break-all", padding: "8px 10px" }}>
        {inviteUrl}
      </Code>

      <CopyButton value={inviteUrl}>
        {({ copied, copy }) => (
          <Button
            size="xs"
            fullWidth
            variant={copied ? "filled" : "light"}
            color={copied ? "green" : "blue"}
            leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            onClick={copy}
            disabled={disabled}
          >
            {copied ? "¡Enlace copiado!" : "Copiar enlace"}
          </Button>
        )}
      </CopyButton>
    </Stack>
  );
};
