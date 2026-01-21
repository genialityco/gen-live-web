import { useState, useRef } from "react";
import { Stack, Switch, Button, Group, Text, Image, Box } from "@mantine/core";
import { uploadFrame, deleteFrame, updateLiveConfig } from "../../api/livekit-service";
import { notifications } from "@mantine/notifications";

interface FrameControlsProps {
  eventSlug: string;
  showFrame: boolean;
  frameUrl: string;
  onUpdate: () => void;
}

export function FrameControls({ eventSlug, showFrame, frameUrl, onUpdate }: FrameControlsProps) {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggle = async (checked: boolean) => {
    try {
      setLoading(true);
      await updateLiveConfig({ eventSlug, showFrame: checked });
      notifications.show({ message: checked ? "Marco activado" : "Marco desactivado", color: "blue" });
      onUpdate();
    } catch (err) {
      console.error("Error toggling frame:", err);
      notifications.show({ message: "Error al cambiar estado del marco", color: "red" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!file.type.match(/image\/(png|jpeg)/)) {
      notifications.show({ message: "Solo PNG o JPEG", color: "red" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notifications.show({ message: "Archivo muy grande (máx 5MB)", color: "red" });
      return;
    }

    try {
      setLoading(true);
      await uploadFrame(eventSlug, file);
      notifications.show({ message: "Marco subido correctamente", color: "green" });
      onUpdate();
    } catch (err) {
      console.error("Error uploading frame:", err);
      notifications.show({ message: "Error al subir marco", color: "red" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await deleteFrame(eventSlug);
      notifications.show({ message: "Marco eliminado", color: "blue" });
      onUpdate();
    } catch (err) {
      console.error("Error deleting frame:", err);
      notifications.show({ message: "Error al eliminar marco", color: "red" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="sm">
      <Switch
        label="Marco activo"
        checked={showFrame}
        onChange={(e) => handleToggle(e.currentTarget.checked)}
        disabled={loading || !frameUrl}
      />

      <Group>
        <input
          type="file"
          accept="image/png,image/jpeg"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        <Button
          size="xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          {frameUrl ? "Reemplazar marco" : "Subir marco"}
        </Button>
        {frameUrl && (
          <Button size="xs" color="red" onClick={handleDelete} disabled={loading}>
            Eliminar marco
          </Button>
        )}
      </Group>

      {frameUrl && (
        <Box>
          <Text size="xs" c="dimmed" mb="xs">
            Vista previa:
          </Text>
          <Image src={frameUrl} alt="Frame preview" maw={200} />
        </Box>
      )}
    </Stack>
  );
}
