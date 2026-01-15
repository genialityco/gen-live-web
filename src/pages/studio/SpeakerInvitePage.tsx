// src/pages/studio/SpeakerInvitePage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  Button,
  Stack,
  Alert,
  Center,
  Loader,
} from "@mantine/core";
import { IconAlertCircle, IconVideo } from "@tabler/icons-react";
import { StudioView } from "./StudioView";

/**
 * Página para speakers invitados
 * URL: /studio/:eventSlug/speaker/:inviteToken
 * 
 * El speaker ingresa con un link de invitación y solo necesita
 * proporcionar su nombre para unirse al studio
 */
export const SpeakerInvitePage: React.FC = () => {
  const { eventSlug, inviteToken } = useParams<{
    eventSlug: string;
    inviteToken: string;
  }>();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [inputName, setInputName] = useState("");
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validar token al montar
  useEffect(() => {
    const validateInvite = async () => {
      if (!eventSlug || !inviteToken) {
        setError("Link de invitación inválido");
        setIsValidating(false);
        return;
      }

      try {
        // TODO: Validar el token contra el backend
        // Por ahora, aceptamos cualquier token (MVP)
        // const response = await api.get(`/studio/validate-invite/${eventSlug}/${inviteToken}`);
        
        // Verificar si ya hay nombre guardado localmente
        const savedName = localStorage.getItem(`speaker_name_${eventSlug}`);
        if (savedName) {
          setDisplayName(savedName);
        }
        
        setIsValidating(false);
      } catch (err: unknown) {
        setError((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || "Token de invitación inválido o expirado");
        setIsValidating(false);
      }
    };

    void validateInvite();
  }, [eventSlug, inviteToken]);

  const handleJoin = () => {
    if (!inputName.trim()) {
      setError("Por favor ingresa tu nombre");
      return;
    }

    // Guardar el nombre localmente
    localStorage.setItem(`speaker_name_${eventSlug}`, inputName.trim());
    setDisplayName(inputName.trim());
  };

  const handleChangeName = () => {
    localStorage.removeItem(`speaker_name_${eventSlug}`);
    setDisplayName("");
    setInputName("");
  };

  // Validando token
  if (isValidating) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  // Error en validación
  if (error && !displayName) {
    return (
      <Container size="sm" py="xl">
        <Paper radius="md" p="lg" withBorder>
          <Alert icon={<IconAlertCircle size={24} />} title="Error" color="red">
            {error}
          </Alert>
          <Button
            fullWidth
            mt="md"
            variant="light"
            onClick={() => navigate("/")}
          >
            Volver al inicio
          </Button>
        </Paper>
      </Container>
    );
  }

  // Modal de bienvenida - solicitar nombre
  if (!displayName) {
    return (
      <Container size="sm" py="xl">
        <Paper radius="md" p="xl" withBorder>
          <Stack gap="md">
            <div style={{ textAlign: "center" }}>
              <IconVideo size={48} style={{ marginBottom: 16 }} />
              <Title order={2}>Bienvenido al Studio</Title>
              <Text c="dimmed" mt="xs">
                Has sido invitado como speaker para el evento
              </Text>
              <Text fw={600} size="lg" mt="xs">
                {eventSlug}
              </Text>
            </div>

            <TextInput
              label="Tu nombre"
              placeholder="Ingresa tu nombre completo"
              value={inputName}
              onChange={(e) => setInputName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputName.trim()) {
                  handleJoin();
                }
              }}
              size="md"
              required
              error={error}
            />

            <Button
              fullWidth
              size="md"
              onClick={handleJoin}
              disabled={!inputName.trim()}
            >
              Unirme al Studio
            </Button>

            <Text size="xs" c="dimmed" ta="center">
              Al unirte, aceptas que tu cámara y micrófono serán activados.
              <br />
              El organizador del evento controla quien aparece en vivo.
            </Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  // Ya tiene nombre - mostrar el studio
  return (
    <div>
      <StudioView
        eventSlug={eventSlug!}
        role="speaker"
        displayName={displayName}
        identity={`speaker-${inviteToken}`}
      />
      
      {/* Botón pequeño para cambiar nombre */}
      <Button
        size="xs"
        variant="subtle"
        onClick={handleChangeName}
        style={{
          position: "fixed",
          bottom: 16,
          left: 16,
          zIndex: 1000,
        }}
      >
        Cambiar nombre
      </Button>
    </div>
  );
};
