/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { getLivekitToken } from "../../api/livekit-service";
import { useMediaQuery } from "@mantine/hooks";

/**
 * Página para speakers invitados
 * URL: /studio/:eventSlug/join (genérica, sin token)
 * URL: /studio/:eventSlug/speaker/:inviteToken (legacy, con token)
 * 
 * El speaker ingresa su nombre y se genera el token dinámicamente
 */
export const SpeakerInvitePage: React.FC = () => {
  const { eventSlug, inviteToken } = useParams<{
    eventSlug: string;
    inviteToken?: string;
  }>();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [inputName, setInputName] = useState("");
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Validar token al montar (solo si viene token en URL)
  useEffect(() => {
    const validateInvite = async () => {
      if (!eventSlug) {
        setError("Evento no válido");
        setIsValidating(false);
        return;
      }

      // Si no hay token en la URL, es acceso genérico - solo verificar si hay nombre guardado
      if (!inviteToken) {
        const savedName = localStorage.getItem(`speaker_name_${eventSlug}`);
        const savedToken = localStorage.getItem(`speaker_token_${eventSlug}`);
        if (savedName && savedToken) {
          setDisplayName(savedName);
          setGeneratedToken(savedToken);
        }
        setIsValidating(false);
        return;
      }

      try {
        // TODO: Validar el token contra el backend (legacy flow)
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

  const handleJoin = async () => {
    if (!inputName.trim()) {
      setError("Por favor ingresa tu nombre");
      return;
    }

    // Si no hay token en URL, generar dinámicamente
    if (!inviteToken) {
      setIsGeneratingToken(true);
      setError(null);
      
      try {
        // Generar token desde el backend
        const { token } = await getLivekitToken({
          eventSlug: eventSlug!,
          role: "speaker",
          name: inputName.trim(),
        });

        // Guardar nombre y token localmente
        localStorage.setItem(`speaker_name_${eventSlug}`, inputName.trim());
        localStorage.setItem(`speaker_token_${eventSlug}`, token);
        
        setDisplayName(inputName.trim());
        setGeneratedToken(token);
      } catch (err: any) {
        console.error("Error generando token:", err);
        setError(
          err?.response?.data?.message ||
          "Error al unirse al estudio. Verifica que el evento esté activo."
        );
      } finally {
        setIsGeneratingToken(false);
      }
    } else {
      // Flujo legacy con token en URL
      localStorage.setItem(`speaker_name_${eventSlug}`, inputName.trim());
      setDisplayName(inputName.trim());
    }
  };

  const handleChangeName = () => {
    localStorage.removeItem(`speaker_name_${eventSlug}`);
    localStorage.removeItem(`speaker_token_${eventSlug}`);
    setDisplayName("");
    setInputName("");
    setGeneratedToken(null);
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
      <Container size="sm" py={{ base: "md", sm: "xl" }} px={{ base: "sm", sm: "md" }}>
        <Paper radius="md" p={{ base: "lg", sm: "xl" }} withBorder>
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
              loading={isGeneratingToken}
            >
              {isGeneratingToken ? "Generando acceso..." : "Unirme al Studio"}
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
    <div style={{marginTop: "100px", marginInline: isMobile ? "10px" : "300px" }}>
      <StudioView
        eventSlug={eventSlug!}
        role="speaker"
        displayName={displayName}
        identity={inviteToken ? `speaker-${inviteToken}` : undefined}
        token={generatedToken || undefined}
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
        styles={{
          root: {
            '@media (max-width: 768px)': {
              fontSize: '0.7rem',
              padding: '4px 8px',
            },
          },
        }}
      >
        Cambiar nombre
      </Button>
    </div>
  );
};
