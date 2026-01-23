// src/pages/studio/VirtualBackgroundControl.tsx
import { useState } from "react";
import {
  Stack,
  Group,
  Text,
  Slider,
  SimpleGrid,
  Paper,
  Image,
  Loader,
  Alert,
  FileButton,
  Button,
  Box,
  Collapse,
  UnstyledButton,
} from "@mantine/core";
import {
  IconPhoto,
  IconBlur,
  IconX,
  IconUpload,
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useVirtualBackground } from "../../hooks/useVirtualBackground";

// Fondos predefinidos - URLs de imágenes gratuitas de alta calidad
// Puedes reemplazar estas URLs con imágenes locales en /public/virtual-backgrounds/
const PRESET_BACKGROUNDS = [
  {
    id: "office",
    url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80",
    label: "Oficina",
  },
  {
    id: "library",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1280&q=80",
    label: "Librería",
  },
  {
    id: "nature",
    url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1280&q=80",
    label: "Naturaleza",
  },
  {
    id: "city",
    url: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1280&q=80",
    label: "Ciudad",
  },
  {
    id: "abstract",
    url: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1280&q=80",
    label: "Abstracto",
  },
  {
    id: "studio",
    url: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1280&q=80",
    label: "Estudio",
  },
];

interface VirtualBackgroundControlProps {
  eventSlug: string;
  disabled?: boolean;
  onUploadImage?: (file: File) => Promise<string>;
}

export function VirtualBackgroundControl({
  eventSlug,
  disabled,
  onUploadImage,
}: VirtualBackgroundControlProps) {
  const { state, setBlur, setImage, clear } = useVirtualBackground(eventSlug);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!state.isSupported) {
    return (
      <Stack gap="xs">
        <Group gap="xs">
          <IconPhoto size={18} />
          <Text fw={600} size="sm">
            Fondo Virtual
          </Text>
        </Group>
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="yellow"
          title="Navegador no compatible"
          p="xs"
        >
          <Stack gap={4}>
            <Text size="xs">
              Tu navegador no soporta fondos virtuales porque no tiene WebGL habilitado.
            </Text>
            <Text size="xs" c="dimmed">
              Prueba con Chrome, Firefox o Edge en su versión más reciente.
            </Text>
          </Stack>
        </Alert>
      </Stack>
    );
  }

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;

    // Validar tipo
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      notifications.show({
        message: "Solo se permiten imágenes JPG, PNG o WebP",
        color: "red",
      });
      return;
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      notifications.show({
        message: "La imagen es muy grande (máx 5MB)",
        color: "red",
      });
      return;
    }

    if (onUploadImage) {
      // Si hay función de upload, usarla
      setUploading(true);
      try {
        const url = await onUploadImage(file);
        await setImage(url);
        notifications.show({ message: "Fondo aplicado", color: "green" });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Error al subir imagen";
        notifications.show({
          message: errorMessage,
          color: "red",
        });
      } finally {
        setUploading(false);
      }
    } else {
      // Crear URL local temporal
      const localUrl = URL.createObjectURL(file);
      await setImage(localUrl);
      notifications.show({ message: "Fondo aplicado", color: "green" });
    }
  };

  const handlePresetClick = async (url: string) => {
    if (disabled || state.isProcessing) return;
    await setImage(url);
  };

  const handleBlurClick = async () => {
    if (disabled || state.isProcessing) return;
    if (state.type === "blur") {
      await clear();
    } else {
      await setBlur(state.blurIntensity);
    }
  };

  const handleClearClick = async () => {
    if (disabled || state.isProcessing) return;
    await clear();
  };

  const isActive = state.type !== "none";

  return (
    <Stack gap="xs">
      {/* Header colapsable */}
      <UnstyledButton onClick={() => setExpanded(!expanded)}>
        <Group justify="space-between">
          <Group gap="xs">
            <IconPhoto size={18} />
            <Text fw={600} size="sm">
              Fondo Virtual
            </Text>
            {isActive && (
              <Text size="xs" c="green" fw={500}>
                {state.type === "blur" ? "Blur activo" : "Imagen activa"}
              </Text>
            )}
          </Group>

          <Group gap="xs">
            {state.isProcessing && <Loader size="xs" />}
            {expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </Group>
        </Group>
      </UnstyledButton>

      <Collapse in={expanded}>
        <Stack gap="sm" pt="xs">
          {state.error && (
            <Alert color="red" p="xs">
              <Text size="xs">{state.error}</Text>
            </Alert>
          )}

          {/* Opciones principales */}
          <Group gap="xs">
            <Paper
              p="xs"
              withBorder
              style={{
                cursor: disabled || state.isProcessing ? "not-allowed" : "pointer",
                borderColor:
                  state.type === "none"
                    ? "var(--mantine-color-blue-6)"
                    : "var(--mantine-color-dark-4)",
                borderWidth: state.type === "none" ? 2 : 1,
                opacity: disabled ? 0.6 : 1,
              }}
              onClick={handleClearClick}
            >
              <Stack gap={4} align="center" style={{ minWidth: 50 }}>
                <IconX size={20} />
                <Text size="xs">Ninguno</Text>
              </Stack>
            </Paper>

            <Paper
              p="xs"
              withBorder
              style={{
                cursor: disabled || state.isProcessing ? "not-allowed" : "pointer",
                borderColor:
                  state.type === "blur"
                    ? "var(--mantine-color-blue-6)"
                    : "var(--mantine-color-dark-4)",
                borderWidth: state.type === "blur" ? 2 : 1,
                opacity: disabled ? 0.6 : 1,
              }}
              onClick={handleBlurClick}
            >
              <Stack gap={4} align="center" style={{ minWidth: 50 }}>
                <IconBlur size={20} />
                <Text size="xs">Blur</Text>
              </Stack>
            </Paper>
          </Group>

          {/* Slider de intensidad para blur */}
          {state.type === "blur" && (
            <Box px="xs">
              <Text size="xs" c="dimmed" mb={4}>
                Intensidad: {state.blurIntensity}
              </Text>
              <Slider
                size="sm"
                min={1}
                max={20}
                step={1}
                value={state.blurIntensity}
                onChange={(val) => setBlur(val)}
                disabled={disabled || state.isProcessing}
              />
            </Box>
          )}

          {/* Grid de fondos predefinidos */}
          <Text size="xs" fw={500}>
            Fondos predefinidos
          </Text>
          <SimpleGrid cols={3} spacing="xs">
            {PRESET_BACKGROUNDS.map((bg) => (
              <Paper
                key={bg.id}
                p={2}
                withBorder
                style={{
                  cursor: disabled || state.isProcessing ? "not-allowed" : "pointer",
                  borderColor:
                    state.imageUrl === bg.url
                      ? "var(--mantine-color-blue-6)"
                      : "var(--mantine-color-dark-4)",
                  borderWidth: state.imageUrl === bg.url ? 2 : 1,
                  opacity: disabled ? 0.6 : 1,
                }}
                onClick={() => handlePresetClick(bg.url)}
              >
                <Box
                  style={{
                    height: 50,
                    borderRadius: 4,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <Image
                    src={bg.url}
                    alt={bg.label}
                    h={50}
                    fit="cover"
                    radius="sm"
                  />
                  <Box
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                      padding: "2px 4px",
                    }}
                  >
                    <Text size="xs" c="white" fw={500}>
                      {bg.label}
                    </Text>
                  </Box>
                </Box>
              </Paper>
            ))}
          </SimpleGrid>

          {/* Upload personalizado */}
          <FileButton
            onChange={handleFileUpload}
            accept="image/png,image/jpeg,image/webp"
            disabled={disabled || uploading || state.isProcessing}
          >
            {(props) => (
              <Button
                {...props}
                variant="light"
                size="xs"
                leftSection={<IconUpload size={14} />}
                loading={uploading}
                fullWidth
              >
                Subir imagen personalizada
              </Button>
            )}
          </FileButton>

          <Text size="xs" c="dimmed">
            El fondo virtual usa WebGL y puede consumir más CPU/GPU.
          </Text>
        </Stack>
      </Collapse>
    </Stack>
  );
}
