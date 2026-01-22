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
  Box,
  Modal,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { IconAlertCircle, IconVideo } from "@tabler/icons-react";
import { StudioView } from "./StudioView";
import { getLivekitToken } from "../../api/livekit-service";

/**
 * Página para speakers invitados
 * URL: /studio/:eventSlug/join (genérica, sin token)
 * URL: /studio/:eventSlug/speaker/:inviteToken (legacy, con token)
 *
 * El speaker ingresa su nombre y se genera el token dinámicamente (solo en flujo genérico)
 */
export const SpeakerInvitePage: React.FC = () => {
  const { eventSlug, inviteToken } = useParams<{
    eventSlug: string;
    inviteToken?: string;
  }>();
  const navigate = useNavigate();

  const isMobile = useMediaQuery("(max-width: 768px)");

  const [displayName, setDisplayName] = useState("");
  const [inputName, setInputName] = useState("");
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  // Modal para cambiar nombre cuando ya estás dentro
  const [nameModalOpen, nameModal] = useDisclosure(false);
  const [nameDraft, setNameDraft] = useState("");

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

        // Verificar si ya hay nombre guardado localmente
        const savedName = localStorage.getItem(`speaker_name_${eventSlug}`);
        if (savedName) {
          setDisplayName(savedName);
        }

        setIsValidating(false);
      } catch (err: unknown) {
        setError(
          (err as { response?: { data?: { message?: string } }; message?: string })
            ?.response?.data?.message || "Token de invitación inválido o expirado",
        );
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
            "Error al unirse al estudio. Verifica que el evento esté activo.",
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
    // abrir modal y prellenar
    setNameDraft(displayName || "");
    nameModal.open();
  };

  const applyChangeName = () => {
    const clean = nameDraft.trim();
    if (!clean) return;

    // Guardar SOLO el nombre; el token no se invalida (en flujo genérico lo tenemos en localStorage)
    localStorage.setItem(`speaker_name_${eventSlug}`, clean);

    setDisplayName(clean);
    setInputName(clean);
    nameModal.close();

    // OJO: StudioView usa el token ya generado; cambiar displayName no requiere regenerar token
    // (Si quieres que el nombre en LiveKit cambie, sí requeriría reconectar/regenerar token.
    // Por ahora mantenemos la funcionalidad sin romper nada.)
  };

  const handleForgetAndRejoin = () => {
    // Si el usuario quiere que realmente cambie el nombre “dentro de LiveKit”, la forma segura es reingresar.
    localStorage.removeItem(`speaker_name_${eventSlug}`);
    localStorage.removeItem(`speaker_token_${eventSlug}`);
    setDisplayName("");
    setInputName("");
    setGeneratedToken(null);
    setError(null);
    nameModal.close();
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
          <Button fullWidth mt="md" variant="light" onClick={() => navigate("/")}>
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
                  void handleJoin();
                }
              }}
              size="md"
              required
              error={error}
            />

            <Button
              fullWidth
              size="md"
              onClick={() => void handleJoin()}
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

  // Ya tiene nombre - mostrar el studio (FULL RESPONSIVE ✅)
  return (
    <Box style={{ minHeight: "100dvh", marginInline: isMobile ? "30px" : "300px", marginTop: "100px" }}>
      {/* StudioView full width/height (sin márgenes fijos) */}
      <StudioView
        eventSlug={eventSlug!}
        role="speaker"
        displayName={displayName}
        identity={inviteToken ? `speaker-${inviteToken}` : undefined}
        token={generatedToken || undefined}
      />

      {/* Botón flotante (subido para no chocar con el FAB del chat en StudioView) */}
      <Button
        size="xs"
        variant="light"
        onClick={handleChangeName}
        style={{
          position: "fixed",
          bottom: 84,
          left: 16,
          zIndex: 1100,
          boxShadow: "0 10px 30px rgba(0,0,0,.18)",
        }}
        styles={{
          root: {
            "@media (max-width: 768px)": {
              fontSize: "0.7rem",
              padding: "4px 8px",
            },
          },
        }}
      >
        Cambiar nombre
      </Button>

      <Modal
        opened={nameModalOpen}
        onClose={nameModal.close}
        centered
        title="Cambiar nombre"
      >
        <Stack>
          <TextInput
            label="Nombre a mostrar"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.currentTarget.value)}
            placeholder="Ej: Juan / Invitado"
            autoFocus
          />

          <Button onClick={applyChangeName} disabled={!nameDraft.trim()}>
            Guardar
          </Button>

          <Button variant="light" color="red" onClick={handleForgetAndRejoin}>
            Cambiar nombre y volver a unirme
          </Button>

          <Text size="xs" c="dimmed">
            Nota: si quieres que el nombre cambie también dentro de LiveKit (en la sala),
            lo más seguro es “volver a unirte” para regenerar/reconectar con el nombre nuevo.
          </Text>
        </Stack>
      </Modal>
    </Box>
  );
};
