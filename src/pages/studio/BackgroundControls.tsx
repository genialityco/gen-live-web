/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Stack, Group, Button, FileButton, Text, Box, ActionIcon } from "@mantine/core";
import { IconUpload, IconTrash, IconPhoto } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { uploadBackground, deleteBackground } from "../../api/livekit-service";

interface BackgroundControlsProps {
  eventSlug: string;
  backgroundUrl: string;
  backgroundType: "image" | "gif" | "video";
  onUpdate: () => void;
  disabled?: boolean;
}

export function BackgroundControls({
  eventSlug,
  backgroundUrl,
  backgroundType,
  onUpdate,
  disabled,
}: BackgroundControlsProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleUpload = async (file: File | null) => {
    if (!file) return;

    // Validar tipo
    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "video/mp4",
      "video/webm",
    ];

    if (!validTypes.includes(file.type)) {
      notifications.show({
        message: "Solo se permiten PNG, JPEG, GIF, MP4, WEBM",
        color: "red",
      });
      return;
    }

    // Validar tamaño (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      notifications.show({
        message: "El archivo es muy grande (máx 20MB)",
        color: "red",
      });
      return;
    }

    try {
      setUploading(true);
      await uploadBackground(eventSlug, file);
      notifications.show({
        message: "Fondo cargado exitosamente",
        color: "green",
      });
      onUpdate();
    } catch (err: any) {
      console.error("Error uploading background:", err);
      notifications.show({
        message: err?.response?.data?.message || "Error al cargar fondo",
        color: "red",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Quitar el fondo actual?")) return;

    try {
      setDeleting(true);
      await deleteBackground(eventSlug);
      notifications.show({
        message: "Fondo eliminado",
        color: "blue",
      });
      onUpdate();
    } catch (err: any) {
      console.error("Error deleting background:", err);
      notifications.show({
        message: err?.response?.data?.message || "Error al eliminar fondo",
        color: "red",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Group gap="xs">
          <IconPhoto size={18} />
          <Text fw={600} size="sm">
            Fondo del Live
          </Text>
        </Group>
      </Group>

      {backgroundUrl ? (
        <Box>
          <Box
            style={{
              width: "100%",
              aspectRatio: "16/9",
              background: "#000",
              borderRadius: 8,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {backgroundType === "video" ? (
              <video
                src={backgroundUrl}
                autoPlay
                muted
                loop
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <img
                src={backgroundUrl}
                alt="Fondo"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )}
          </Box>

          <Group justify="space-between" mt="xs">
            <Text size="xs" c="dimmed">
              Tipo: {backgroundType === "video" ? "Video" : backgroundType === "gif" ? "GIF" : "Imagen"}
            </Text>
            <ActionIcon
              color="red"
              variant="subtle"
              onClick={handleDelete}
              loading={deleting}
              disabled={disabled}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Box>
      ) : (
        <FileButton
          onChange={handleUpload}
          accept="image/png,image/jpeg,image/gif,video/mp4,video/webm"
          disabled={disabled || uploading}
        >
          {(props) => (
            <Button
              {...props}
              leftSection={<IconUpload size={16} />}
              variant="light"
              fullWidth
              loading={uploading}
              disabled={disabled}
            >
              Cargar Fondo
            </Button>
          )}
        </FileButton>
      )}

      <Text size="xs" c="dimmed">
        Soporta imágenes (PNG, JPEG), GIF y videos (MP4, WEBM). Máx 20MB.
      </Text>
    </Stack>
  );
}
