// src/components/studio/InvitationManager.tsx
import React, { useState } from "react";
import {
  Stack,
  Text,
  Button,
  Paper,
  Group,
  CopyButton,
  ActionIcon,
  Tooltip,
  Alert,
  Code,
  Badge,
} from "@mantine/core";
import {
  IconCopy,
  IconCheck,
  IconPlus,
  IconTrash,
  IconLink,
} from "@tabler/icons-react";

interface InviteLink {
  id: string;
  token: string;
  createdAt: Date;
  expiresAt?: Date;
  usedCount?: number;
}

interface InvitationManagerProps {
  eventSlug: string;
  disabled?: boolean;
}

/**
 * Componente para gestionar invitaciones de speakers
 * Genera links únicos que permiten el acceso directo al studio
 */
export const InvitationManager: React.FC<InvitationManagerProps> = ({
  eventSlug,
  disabled = false,
}) => {
  const [invites, setInvites] = useState<InviteLink[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generar un nuevo link de invitación
  const handleGenerateInvite = async () => {
    setIsGenerating(true);
    try {
      // TODO: Llamar al backend para generar un token válido
      // const response = await api.post(`/studio/generate-invite/${eventSlug}`);
      
      // Por ahora, generar token localmente (MVP)
      const token = generateRandomToken();
      const newInvite: InviteLink = {
        id: crypto.randomUUID(),
        token,
        createdAt: new Date(),
      };

      setInvites((prev) => [newInvite, ...prev]);
    } catch (err) {
      console.error("Error generando invitación:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteInvite = (id: string) => {
    // TODO: Invalidar el token en el backend
    setInvites((prev) => prev.filter((inv) => inv.id !== id));
  };

  const getInviteUrl = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/studio/${eventSlug}/speaker/${token}`;
  };

  return (
    <Stack gap="md">
      <div>
        <Text size="sm" fw={600} mb="xs">
          Links de Invitación para Speakers
        </Text>
        <Text size="xs" c="dimmed">
          Genera links únicos para invitar speakers sin necesidad de registro.
          Los speakers solo necesitarán ingresar su nombre al acceder.
        </Text>
      </div>

      <Button
        leftSection={<IconPlus size={16} />}
        onClick={handleGenerateInvite}
        loading={isGenerating}
        disabled={disabled}
        variant="light"
      >
        Generar nuevo link de invitación
      </Button>

      {invites.length === 0 ? (
        <Alert color="blue" variant="light">
          <Text size="sm">
            No hay invitaciones generadas. Crea una para compartir con tus speakers.
          </Text>
        </Alert>
      ) : (
        <Stack gap="xs">
          {invites.map((invite) => (
            <Paper key={invite.id} p="sm" withBorder radius="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconLink size={16} />
                    <Text size="sm" fw={500}>
                      Invitación #{invite.token.slice(0, 8)}
                    </Text>
                    <Badge size="xs" color="green">
                      Activo
                    </Badge>
                  </Group>
                  <Tooltip label="Eliminar invitación">
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => handleDeleteInvite(invite.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>

                <Code block style={{ fontSize: 11, wordBreak: "break-all" }}>
                  {getInviteUrl(invite.token)}
                </Code>

                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Creado: {invite.createdAt.toLocaleString()}
                  </Text>
                  <CopyButton value={getInviteUrl(invite.token)}>
                    {({ copied, copy }) => (
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={
                          copied ? <IconCheck size={14} /> : <IconCopy size={14} />
                        }
                        onClick={copy}
                      >
                        {copied ? "¡Copiado!" : "Copiar link"}
                      </Button>
                    )}
                  </CopyButton>
                </Group>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

// Función auxiliar para generar tokens aleatorios
function generateRandomToken(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  for (let i = 0; i < length; i++) {
    token += chars[array[i] % chars.length];
  }
  
  return token;
}
