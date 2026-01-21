/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef } from "react";
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  TagsInput,
  Select,
  Switch,
  Slider,
  Button,
  Group,
  Text,
  Box,
  Paper,
  Image,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconUpload, IconMusic } from "@tabler/icons-react";
import type { CreateMediaItemDto } from "../../api/media-library-service";

interface UploadMediaDialogProps {
  opened: boolean;
  onClose: () => void;
  eventSlug: string;
  onSuccess: (file: File, metadata: CreateMediaItemDto) => void;
}

const ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/mpeg",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
].join(",");

export function UploadMediaDialog({
  opened,
  onClose,
  onSuccess,
}: UploadMediaDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [defaultMode, setDefaultMode] = useState<"overlay" | "full">("full");
  const [defaultLoop, setDefaultLoop] = useState(false);
  const [defaultMuted, setDefaultMuted] = useState(true);
  const [defaultFit, setDefaultFit] = useState<"cover" | "contain">("cover");
  const [defaultOpacity, setDefaultOpacity] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null);
      setPreview("");
      return;
    }

    // Validaciones
    const okMime =
      selectedFile.type === "image/png" ||
      selectedFile.type === "image/jpeg" ||
      selectedFile.type === "image/gif" ||
      selectedFile.type === "video/mp4" ||
      selectedFile.type === "video/webm" ||
      selectedFile.type === "video/mpeg" ||
      selectedFile.type === "audio/mpeg" ||
      selectedFile.type === "audio/mp3" ||
      selectedFile.type === "audio/wav" ||
      selectedFile.type === "audio/ogg";

    if (!okMime) {
      notifications.show({
        message: "Solo PNG/JPEG/GIF, MP4/WEBM/MPEG o MP3/WAV/OGG",
        color: "red",
      });
      return;
    }

    const maxImage = 10 * 1024 * 1024;
    const maxVideo = 60 * 1024 * 1024;
    const maxAudio = 20 * 1024 * 1024;
    const isVideo = selectedFile.type.startsWith("video/");
    const isAudio = selectedFile.type.startsWith("audio/");
    const maxSize = isVideo ? maxVideo : isAudio ? maxAudio : maxImage;
    
    if (selectedFile.size > maxSize) {
      notifications.show({
        message: isVideo
          ? "Video muy grande (máx 60MB)"
          : isAudio
          ? "Audio muy grande (máx 20MB)"
          : "Imagen/GIF muy grande (máx 10MB)",
        color: "red",
      });
      return;
    }

    setFile(selectedFile);

    // Auto-generar nombre si está vacío
    if (!name) {
      const filename = selectedFile.name.replace(/\.[^/.]+$/, "");
      setName(filename);
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleSubmit = () => {
    if (!file) {
      notifications.show({ message: "Selecciona un archivo", color: "red" });
      return;
    }
    if (!name.trim()) {
      notifications.show({ message: "El nombre es obligatorio", color: "red" });
      return;
    }

    const metadata: CreateMediaItemDto = {
      name: name.trim(),
      description: description.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      defaultMode,
      defaultLoop,
      defaultMuted,
      defaultFit,
      defaultOpacity,
    };

    onSuccess(file, metadata);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setPreview("");
    setName("");
    setDescription("");
    setTags([]);
    setDefaultMode("full");
    setDefaultLoop(false);
    setDefaultMuted(true);
    setDefaultFit("cover");
    setDefaultOpacity(1);
    onClose();
  };

  const isVideo = file?.type.startsWith("video/");
  const isAudio = file?.type.startsWith("audio/");

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Subir Media"
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* File input */}
        <Paper
          p="xl"
          withBorder
          style={{
            borderStyle: "dashed",
            cursor: "pointer",
            textAlign: "center",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            accept={ACCEPT}
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={(e) => {
              const selectedFile = e.target.files?.[0];
              handleFileChange(selectedFile || null);
            }}
          />

          {!file ? (
            <Stack gap="xs" align="center">
              <IconUpload size={32} />
              <Text size="sm">Click para seleccionar archivo</Text>
              <Text size="xs" c="dimmed">
                PNG, JPEG, GIF (max 10MB), MP4/WEBM/MPEG (max 60MB) o MP3/WAV/OGG (max 20MB)
              </Text>
            </Stack>
          ) : (
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                {file.name}
              </Text>
              <Text size="xs" c="dimmed">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </Text>
            </Stack>
          )}
        </Paper>

        {/* Preview */}
        {preview && (
          <Box
            style={{
              width: "100%",
              aspectRatio: "16/9",
              background: "#000",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {isVideo ? (
              <video
                src={preview}
                controls
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : isAudio ? (
              <Box
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  gap: 16,
                }}
              >
                <IconMusic size={64} color="white" opacity={0.5} />
                <audio
                  src={preview}
                  controls
                  style={{ width: "80%", maxWidth: 400 }}
                />
              </Box>
            ) : (
              <Image
                src={preview}
                alt="Preview"
                fit="contain"
                style={{ width: "100%", height: "100%" }}
              />
            )}
          </Box>
        )}

        {/* Metadata */}
        <TextInput
          label="Nombre"
          placeholder="Ej: Intro, Cortinilla, Pausa..."
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />

        <Textarea
          label="Descripción"
          placeholder="Descripción opcional del archivo"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          rows={2}
        />

        <TagsInput
          label="Tags"
          placeholder="Presiona Enter para agregar"
          value={tags}
          onChange={setTags}
          clearable
          description="Ej: intro, cortinilla, pausa, cierre"
        />

        {/* Configuración por defecto */}
        <Text size="sm" fw={600} mt="xs">
          Configuración por defecto
        </Text>

        <Group grow>
          <Select
            label="Modo"
            value={defaultMode}
            onChange={(v) => setDefaultMode((v as any) || "full")}
            data={[
              { value: "overlay", label: "Overlay" },
              { value: "full", label: "Full Screen" },
            ]}
          />

          <Select
            label="Fit"
            value={defaultFit}
            onChange={(v) => setDefaultFit((v as any) || "cover")}
            data={[
              { value: "cover", label: "Cover" },
              { value: "contain", label: "Contain" },
            ]}
          />
        </Group>

        <Group grow>
          <Switch
            label="Loop"
            checked={defaultLoop}
            onChange={(e) => setDefaultLoop(e.currentTarget.checked)}
          />
          <Switch
            label="Muted (autoplay)"
            checked={defaultMuted}
            onChange={(e) => setDefaultMuted(e.currentTarget.checked)}
          />
        </Group>

        <Box>
          <Text size="sm" fw={500} mb="xs">
            Opacidad
          </Text>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={defaultOpacity}
            onChange={setDefaultOpacity}
            marks={[
              { value: 0, label: "0%" },
              { value: 0.5, label: "50%" },
              { value: 1, label: "100%" },
            ]}
          />
        </Box>

        {/* Actions */}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!file || !name.trim()}>
            Subir
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
