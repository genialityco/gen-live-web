import { useEffect, useState } from "react";
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
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  updateMediaItem,
  type MediaItem,
  type UpdateMediaItemDto,
} from "../../api/media-library-service";

interface EditMediaDialogProps {
  item: MediaItem | null;
  onClose: () => void;
  onSuccess: (updated: MediaItem) => void;
}

export function EditMediaDialog({ item, onClose, onSuccess }: EditMediaDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [defaultMode, setDefaultMode] = useState<"overlay" | "full">("full");
  const [defaultLoop, setDefaultLoop] = useState(true);
  const [defaultMuted, setDefaultMuted] = useState(false);
  const [defaultFit, setDefaultFit] = useState<"cover" | "contain">("cover");
  const [defaultOpacity, setDefaultOpacity] = useState(1);
  const [saving, setSaving] = useState(false);

  // Pre-rellenar cuando se abre
  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setDescription(item.description ?? "");
    setTags(item.tags ?? []);
    setDefaultMode(item.defaultMode ?? "full");
    setDefaultLoop(item.defaultLoop ?? true);
    setDefaultMuted(item.defaultMuted ?? false);
    setDefaultFit(item.defaultFit ?? "cover");
    setDefaultOpacity(item.defaultOpacity ?? 1);
  }, [item]);

  const handleSubmit = async () => {
    if (!item) return;
    if (!name.trim()) {
      notifications.show({ message: "El nombre es obligatorio", color: "red" });
      return;
    }

    const updates: UpdateMediaItemDto = {
      name: name.trim(),
      description: description.trim() || undefined,
      tags: tags.length > 0 ? tags : [],
      defaultMode,
      defaultLoop,
      defaultMuted,
      defaultFit,
      defaultOpacity,
    };

    try {
      setSaving(true);
      const updated = await updateMediaItem(item._id, updates);
      notifications.show({ message: "Media actualizada", color: "green" });
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error("Error updating media item:", err);
      notifications.show({
        message: err?.response?.data?.message || "Error al guardar cambios",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={!!item}
      onClose={onClose}
      title="Editar Media"
      size="lg"
      centered
    >
      <Stack gap="md">
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

        <Text size="sm" fw={600} mt="xs">
          Configuración por defecto
        </Text>

        <Group grow>
          <Select
            label="Modo"
            value={defaultMode}
            onChange={(v) => setDefaultMode((v as "overlay" | "full") || "full")}
            data={[
              { value: "overlay", label: "Overlay" },
              { value: "full", label: "Full Screen" },
            ]}
          />
          <Select
            label="Fit"
            value={defaultFit}
            onChange={(v) => setDefaultFit((v as "cover" | "contain") || "cover")}
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

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} loading={saving} disabled={!name.trim()}>
            Guardar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
