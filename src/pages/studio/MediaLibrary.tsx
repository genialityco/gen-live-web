/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Stack,
  Button,
  Group,
  TextInput,
  Select,
  SimpleGrid,
  Card,
  Image,
  Text,
  Badge,
  ActionIcon,
  Menu,
  Box,
  Loader,
  Center,
  Paper,
  Switch,
  Slider,
  SegmentedControl,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconSearch,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconPlayerPlay,
  IconPlayerStop,
  IconPhoto,
  IconVideo,
  IconMusic,
} from "@tabler/icons-react";
import {
  listMediaItems,
  uploadMediaItem,
  deleteMediaItem,
  activateMediaItem,
  deactivateMedia,
  type MediaItem,
  type CreateMediaItemDto,
} from "../../api/media-library-service";
import { UploadMediaDialog } from "./UploadMediaDialog";

interface MediaLibraryProps {
  eventSlug: string;
  activeVisualId?: string;
  activeAudioId?: string;
  onConfigChange?: () => void; // Callback para refrescar config en parent
  disabled?: boolean;
}

export function MediaLibrary({
  eventSlug,
  activeVisualId,
  activeAudioId,
  onConfigChange,
  disabled,
}: MediaLibraryProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  // Quick controls para item seleccionado
  const [quickMode, setQuickMode] = useState<"overlay" | "full">("full");
  const [quickLoop, setQuickLoop] = useState(false);
  const [quickMuted, setQuickMuted] = useState(true);
  const [quickFit, setQuickFit] = useState<"cover" | "contain">("cover");
  const [quickOpacity, setQuickOpacity] = useState(1);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await listMediaItems(eventSlug);
      setItems(data);
    } catch (err) {
      console.error("Error loading media items:", err);
      notifications.show({
        message: "Error al cargar biblioteca de media",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug]);

  // Debug: ver qué props se están recibiendo
  useEffect(() => {
    console.log("📚 MediaLibrary - activeVisualId:", activeVisualId);
    console.log("📚 MediaLibrary - activeAudioId:", activeAudioId);
  }, [activeVisualId, activeAudioId]);

  // Sincronizar quick controls con item seleccionado
  useEffect(() => {
    if (selectedItem) {
      setQuickMode(selectedItem.defaultMode);
      setQuickLoop(selectedItem.defaultLoop);
      setQuickMuted(selectedItem.defaultMuted);
      setQuickFit(selectedItem.defaultFit);
      setQuickOpacity(selectedItem.defaultOpacity);
    }
  }, [selectedItem]);

  const handleUpload = async (file: File, metadata: CreateMediaItemDto) => {
    try {
      setUploading(true);
      await uploadMediaItem(eventSlug, file, metadata);
      notifications.show({
        message: "Media subida exitosamente",
        color: "green",
      });
      await loadItems();
    } catch (err: any) {
      console.error("Error uploading:", err);
      notifications.show({
        message: err?.response?.data?.message || "Error al subir media",
        color: "red",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este archivo de media?")) return;

    try {
      await deleteMediaItem(id);
      notifications.show({ message: "Media eliminada", color: "blue" });
      if (selectedItem?._id === id) setSelectedItem(null);
      await loadItems();
    } catch (err: any) {
      console.error("Error deleting:", err);
      notifications.show({
        message: err?.response?.data?.message || "Error al eliminar",
        color: "red",
      });
    }
  };

  const handleActivate = async (item: MediaItem) => {
    try {
      await activateMediaItem(item._id, eventSlug, {
        mode: quickMode,
        loop: quickLoop,
        muted: quickMuted,
        fit: quickFit,
        opacity: quickOpacity,
      });
      notifications.show({
        message: `"${item.name}" activado en monitor`,
        color: "green",
      });
      
      // Notificar al parent PRIMERO para que actualice los IDs
      onConfigChange?.();
      
      // Esperar un momento para que el backend y parent actualicen
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Recargar items locales
      await loadItems();
    } catch (err: any) {
      console.error("Error activating:", err);
      notifications.show({
        message: err?.response?.data?.message || "Error al activar",
        color: "red",
      });
    }
  };

  const handleDeactivate = async () => {
    if (!selectedItem) return;

    try {
      // Determinar qué tipo desactivar según el item seleccionado
      const typeToDeactivate = selectedItem.type === "audio" ? "audio" : "visual";
      
      await deactivateMedia(eventSlug, typeToDeactivate);
      notifications.show({ 
        message: `${selectedItem.type === "audio" ? "Audio" : "Visual"} desactivado`, 
        color: "blue" 
      });
      
      // Notificar al parent PRIMERO
      onConfigChange?.();
      
      // Esperar un momento para que el backend y parent actualicen
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Recargar items locales
      await loadItems();
    } catch (err: any) {
      console.error("Error deactivating:", err);
      notifications.show({
        message: err?.response?.data?.message || "Error al desactivar",
        color: "red",
      });
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType =
      filterType === "all" || item.type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  return (
    <Stack gap="md">
      {/* Header con búsqueda y filtros */}
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Biblioteca de Media
        </Text>
        <Group gap="xs">
          {(activeVisualId || activeAudioId) && (
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconPlayerStop size={16} />}
              onClick={async () => {
                try {
                  await deactivateMedia(eventSlug, "all");
                  notifications.show({ 
                    message: "Toda la media desactivada", 
                    color: "blue" 
                  });
                  await new Promise(resolve => setTimeout(resolve, 300));
                  onConfigChange?.();
                  await loadItems();
                } catch (err: any) {
                  notifications.show({ 
                    message: err?.response?.data?.message || "Error", 
                    color: "red" 
                  });
                }
              }}
              disabled={disabled}
            >
              Desactivar Todo
            </Button>
          )}
          <Button
            size="xs"
            leftSection={<IconPlus size={16} />}
            onClick={() => setUploadOpen(true)}
            disabled={disabled}
            loading={uploading}
          >
            Upload
          </Button>
        </Group>
      </Group>

      <Group grow>
        <TextInput
          placeholder="Buscar..."
          leftSection={<IconSearch size={16} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.currentTarget.value)}
          size="xs"
        />
        <Select
          size="xs"
          value={filterType}
          onChange={(v) => setFilterType(v || "all")}
          data={[
            { value: "all", label: "Todos" },
            { value: "image", label: "Imágenes" },
            { value: "gif", label: "GIFs" },
            { value: "video", label: "Videos" },
            { value: "audio", label: "Audio" },
          ]}
        />
      </Group>

      {/* Grid de items */}
      {filteredItems.length === 0 ? (
        <Paper p="xl" withBorder>
          <Center>
            <Stack align="center" gap="xs">
              <Text c="dimmed">No hay media en esta biblioteca</Text>
              <Button
                size="xs"
                variant="light"
                onClick={() => setUploadOpen(true)}
              >
                Subir primer archivo
              </Button>
            </Stack>
          </Center>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
          {filteredItems.map((item) => {
            const isVisualActive =
              item.type !== "audio" &&
              activeVisualId &&
              item._id === activeVisualId;
            const isAudioActive =
              item.type === "audio" &&
              activeAudioId &&
              item._id === activeAudioId;
            const isActive = isVisualActive || isAudioActive;
            const isSelected = selectedItem?._id === item._id;

            return (
              <Card
                key={item._id}
                padding="xs"
                withBorder
                style={{
                  cursor: "pointer",
                  borderColor: isActive
                    ? "var(--mantine-color-green-6)"
                    : isSelected
                      ? "var(--mantine-color-blue-6)"
                      : undefined,
                  borderWidth: isActive || isSelected ? 2 : 1,
                }}
                onClick={() => setSelectedItem(item)}
              >
                <Card.Section>
                  <Box
                    style={{
                      width: "100%",
                      aspectRatio: "16/9",
                      background: "#000",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {item.type === "video" ? (
                      <>
                        <video
                          src={item.url}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                        <Badge
                          size="xs"
                          style={{ position: "absolute", top: 4, left: 4 }}
                          leftSection={<IconVideo size={12} />}
                        >
                          Video
                        </Badge>
                      </>
                    ) : item.type === "audio" ? (
                      <>
                        <Box
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          }}
                        >
                          <IconMusic size={64} color="white" opacity={0.5} />
                        </Box>
                        <Badge
                          size="xs"
                          style={{ position: "absolute", top: 4, left: 4 }}
                          leftSection={<IconMusic size={12} />}
                        >
                          Audio
                        </Badge>
                      </>
                    ) : (
                      <>
                        <Image
                          src={item.url}
                          alt={item.name}
                          fit="cover"
                          style={{ width: "100%", height: "100%" }}
                        />
                        <Badge
                          size="xs"
                          style={{ position: "absolute", top: 4, left: 4 }}
                          leftSection={<IconPhoto size={12} />}
                        >
                          {item.type === "gif" ? "GIF" : "Imagen"}
                        </Badge>
                      </>
                    )}

                    {isActive && (
                      <Badge
                        size="sm"
                        color="green"
                        style={{ position: "absolute", top: 4, right: 4 }}
                      >
                        ● {isVisualActive ? "Visual" : "Audio"}
                      </Badge>
                    )}
                  </Box>
                </Card.Section>

                <Group justify="space-between" mt="xs">
                  <Text size="sm" fw={500} lineClamp={1}>
                    {item.name}
                  </Text>

                  <Menu position="bottom-end">
                    <Menu.Target>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconDotsVertical size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconEdit size={16} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: edit dialog
                          notifications.show({
                            message: "Edición próximamente",
                            color: "blue",
                          });
                        }}
                      >
                        Editar
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconTrash size={16} />}
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(item._id);
                        }}
                      >
                        Eliminar
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>

                {item.tags.length > 0 && (
                  <Group gap={4} mt="xs">
                    {item.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} size="xs" variant="dot">
                        {tag}
                      </Badge>
                    ))}
                  </Group>
                )}
              </Card>
            );
          })}
        </SimpleGrid>
      )}

      {/* Quick controls para item seleccionado */}
      {selectedItem && (
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={600} size="sm">
                {selectedItem.name}
              </Text>
              {selectedItem && (
                selectedItem._id === activeVisualId ||
                selectedItem._id === activeAudioId
              ) && (
                <Badge color="green">Activo</Badge>
              )}
            </Group>

            <Group grow>
              <SegmentedControl
                size="xs"
                value={quickMode}
                onChange={(v) => setQuickMode(v as any)}
                data={[
                  { label: "Overlay", value: "overlay" },
                  { label: "Full", value: "full" },
                ]}
              />

              <Select
                size="xs"
                value={quickFit}
                onChange={(v) => setQuickFit((v as any) || "cover")}
                data={[
                  { value: "cover", label: "Cover" },
                  { value: "contain", label: "Contain" },
                ]}
              />
            </Group>

            <Group grow>
              <Switch
                label="Loop"
                size="xs"
                checked={quickLoop}
                onChange={(e) => setQuickLoop(e.currentTarget.checked)}
              />
              <Switch
                label="Muted"
                size="xs"
                checked={quickMuted}
                onChange={(e) => setQuickMuted(e.currentTarget.checked)}
              />
            </Group>

            <Box>
              <Text size="xs" fw={500} mb={4}>
                Opacidad: {Math.round(quickOpacity * 100)}%
              </Text>
              <Slider
                size="xs"
                min={0}
                max={1}
                step={0.05}
                value={quickOpacity}
                onChange={setQuickOpacity}
              />
            </Box>

            <Group grow mt="xs">
              {selectedItem &&
              (selectedItem._id === activeVisualId ||
                selectedItem._id === activeAudioId) ? (
                <Button
                  size="sm"
                  color="red"
                  leftSection={<IconPlayerStop size={16} />}
                  onClick={() => void handleDeactivate()}
                  disabled={disabled}
                >
                  Desactivar
                </Button>
              ) : (
                <Button
                  size="sm"
                  color="green"
                  leftSection={<IconPlayerPlay size={16} />}
                  onClick={() => void handleActivate(selectedItem)}
                  disabled={disabled}
                >
                  Activar en Monitor
                </Button>
              )}
            </Group>
          </Stack>
        </Paper>
      )}

      {/* Badges para items activos */}
      {(activeVisualId || activeAudioId) && !selectedItem && (
        <Stack gap="xs">
          {activeVisualId && (
            <Paper p="sm" withBorder style={{ background: "var(--mantine-color-green-0)" }}>
              <Group justify="space-between">
                <Group gap="xs">
                  <Badge color="green">● Visual activo</Badge>
                  <Text size="sm" fw={500}>
                    {items.find(i => i._id === activeVisualId)?.name || "Desconocido"}
                  </Text>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  onClick={async () => {
                    try {
                      await deactivateMedia(eventSlug, "visual");
                      notifications.show({ message: "Visual desactivado", color: "blue" });
                      onConfigChange?.();
                      await new Promise(resolve => setTimeout(resolve, 400));
                      await loadItems();
                    } catch (err: any) {
                      notifications.show({ 
                        message: err?.response?.data?.message || "Error", 
                        color: "red" 
                      });
                    }
                  }}
                  disabled={disabled}
                >
                  Desactivar
                </Button>
              </Group>
            </Paper>
          )}
          {activeAudioId && (
            <Paper p="sm" withBorder style={{ background: "var(--mantine-color-blue-0)" }}>
              <Group justify="space-between">
                <Group gap="xs">
                  <Badge color="blue">● Audio activo</Badge>
                  <Text size="sm" fw={500}>
                    {items.find(i => i._id === activeAudioId)?.name || "Desconocido"}
                  </Text>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  onClick={async () => {
                    try {
                      await deactivateMedia(eventSlug, "audio");
                      notifications.show({ message: "Audio desactivado", color: "blue" });
                      onConfigChange?.();
                      await new Promise(resolve => setTimeout(resolve, 400));
                      await loadItems();
                    } catch (err: any) {
                      notifications.show({ 
                        message: err?.response?.data?.message || "Error", 
                        color: "red" 
                      });
                    }
                  }}
                  disabled={disabled}
                >
                  Desactivar
                </Button>
              </Group>
            </Paper>
          )}
        </Stack>
      )}

      <UploadMediaDialog
        opened={uploadOpen}
        onClose={() => setUploadOpen(false)}
        eventSlug={eventSlug}
        onSuccess={handleUpload}
      />
    </Stack>
  );
}
