/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/studio/SpeakerInvitePage.tsx
import React, { useState, useEffect, useRef } from "react";
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
  AspectRatio,
  ActionIcon,
  Select,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { IconAlertCircle, IconVideo, IconVideoOff, IconRefresh } from "@tabler/icons-react";
import { StudioView } from "./StudioView";
import { getLivekitToken } from "../../api/livekit-service";

// Componente para vista previa de cámara local
function LocalCameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("");
  const [micLevel, setMicLevel] = useState<number>(0);
  const [devicesLoaded, setDevicesLoaded] = useState(false);

  const startCamera = async (cameraId?: string, micId?: string) => {
    setIsLoading(true);
    setError(null);

    // Detener stream anterior si existe
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    // Detener análisis de audio anterior
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: cameraId
          ? { deviceId: { exact: cameraId }, width: 1280, height: 720 }
          : { width: 1280, height: 720 },
        audio: micId
          ? { deviceId: { exact: micId } }
          : true,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Configurar análisis de audio para visualizar nivel de micrófono
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(mediaStream);

      analyser.fftSize = 256;
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Actualizar nivel de micrófono
      const updateMicLevel = () => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setMicLevel(Math.min(100, (average / 255) * 100 * 2)); // Amplificar un poco

        animationFrameRef.current = requestAnimationFrame(updateMicLevel);
      };

      updateMicLevel();
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setError("No se pudo acceder a la cámara o micrófono. Verifica los permisos.");
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
  if (stream && videoRef.current) {
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(e => console.log("Auto-play falló:", e));
  }
}, [stream]);

  // Cargar dispositivos inicialmente
  useEffect(() => {
    const initDevices = async () => {
      try {
        // Primero solicitar permisos
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        // Obtener lista de dispositivos
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        setDevices(deviceList);

        // Seleccionar dispositivos por defecto
        const defaultCamera = deviceList.find(d => d.kind === "videoinput");
        const defaultMic = deviceList.find(d => d.kind === "audioinput");

        if (defaultCamera) {
          setSelectedCamera(defaultCamera.deviceId);
        }
        if (defaultMic) {
          setSelectedMicrophone(defaultMic.deviceId);
        }

        // Detener el stream temporal
        tempStream.getTracks().forEach(track => track.stop());

        setDevicesLoaded(true);
      } catch (err) {
        console.error("Error loading devices:", err);
        setError("No se pudo acceder a los dispositivos. Verifica los permisos.");
        setIsLoading(false);
      }
    };

    void initDevices();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Iniciar cámara cuando los dispositivos estén cargados
  useEffect(() => {
    if (devicesLoaded && selectedCamera && selectedMicrophone) {
      void startCamera(selectedCamera, selectedMicrophone);
    }
  }, [devicesLoaded, selectedCamera, selectedMicrophone]);

  const handleRetry = () => {
    void startCamera(selectedCamera, selectedMicrophone);
  };

  const cameras = devices.filter(d => d.kind === "videoinput");
  const microphones = devices.filter(d => d.kind === "audioinput");

  if (isLoading) {
    return (
      <Box>
        <AspectRatio ratio={16 / 9} style={{ width: "100%", borderRadius: 8, overflow: "hidden" }}>
          <Box
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--mantine-color-dark-6)",
            }}
          >
            <Stack align="center" gap="xs">
              <Loader size="md" />
              <Text size="sm" c="dimmed">
                Cargando dispositivos...
              </Text>
            </Stack>
          </Box>
        </AspectRatio>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <AspectRatio ratio={16 / 9} style={{ width: "100%", borderRadius: 8, overflow: "hidden" }}>
          <Box
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--mantine-color-dark-6)",
              gap: 12,
              padding: 16,
            }}
          >
            <IconVideoOff size={32} color="var(--mantine-color-gray-6)" />
            <Text size="sm" c="dimmed" ta="center">
              {error}
            </Text>
            <ActionIcon onClick={handleRetry} variant="light" size="lg">
              <IconRefresh size={20} />
            </ActionIcon>
          </Box>
        </AspectRatio>
      </Box>
    );
  }

  return (
    <Stack gap="xs">
      <AspectRatio ratio={16 / 9} style={{ width: "100%", borderRadius: 8, overflow: "hidden" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            background: "#000",
            transform: "scaleX(-1)", // Efecto espejo
          }}
        />
      </AspectRatio>

      {/* Selectores de dispositivos */}
      <Stack gap="xs">
        <Select
          label="Cámara"
          placeholder="Selecciona una cámara"
          value={selectedCamera}
          onChange={(value) => setSelectedCamera(value || "")}
          data={cameras.map(cam => ({
            value: cam.deviceId,
            label: cam.label || `Cámara ${cameras.indexOf(cam) + 1}`,
          }))}
          size="sm"
        />

        <Box>
          <Select
            label="Micrófono"
            placeholder="Selecciona un micrófono"
            value={selectedMicrophone}
            onChange={(value) => setSelectedMicrophone(value || "")}
            data={microphones.map(mic => ({
              value: mic.deviceId,
              label: mic.label || `Micrófono ${microphones.indexOf(mic) + 1}`,
            }))}
            size="sm"
          />

          {/* Indicador de nivel de micrófono */}
          <Box mt="xs">
            <Text size="xs" c="dimmed" mb={4}>
              Nivel de audio
            </Text>
            <Box
              style={{
                width: "100%",
                height: 6,
                background: "var(--mantine-color-dark-5)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <Box
                style={{
                  width: `${micLevel}%`,
                  height: "100%",
                  background: micLevel > 70
                    ? "var(--mantine-color-green-6)"
                    : micLevel > 30
                    ? "var(--mantine-color-yellow-6)"
                    : "var(--mantine-color-gray-6)",
                  transition: "width 0.1s ease-out",
                }}
              />
            </Box>
          </Box>
        </Box>
      </Stack>
    </Stack>
  );
}


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

            {/* Vista previa de la cámara */}
            <Box>
              <Text size="sm" fw={500} mb="xs">
                Configura tu cámara y micrófono
              </Text>
              <LocalCameraPreview />
              <Text size="xs" c="dimmed" mt="xs" ta="center">
                Selecciona tus dispositivos y verifica que funcionen correctamente
              </Text>
            </Box>

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
