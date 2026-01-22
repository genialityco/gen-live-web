/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
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
  Divider,
  Collapse,
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
  IconChevronDown,
  IconChevronRight,
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

type QuickMode = "overlay" | "full";
type QuickFit = "cover" | "contain";

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

  // Quick controls
  const [quickMode, setQuickMode] = useState<QuickMode>("full");
  const [quickLoop, setQuickLoop] = useState(false);
  const [quickMuted, setQuickMuted] = useState(true);
  const [quickFit, setQuickFit] = useState<QuickFit>("cover");
  const [quickOpacity, setQuickOpacity] = useState(1);

  // UX: secciones
  const [openAudio, setOpenAudio] = useState(true);
  const [openVideo, setOpenVideo] = useState(true);
  const [openImages, setOpenImages] = useState(true);

  // Debounce apply
  const applyTimerRef = useRef<number | null>(null);

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

  // Debug
  useEffect(() => {
    console.log("📚 MediaLibrary - activeVisualId:", activeVisualId);
    console.log("📚 MediaLibrary - activeAudioId:", activeAudioId);
  }, [activeVisualId, activeAudioId]);

  const isItemActive = (item: MediaItem) => {
    if (item.type === "audio") return !!activeAudioId && item._id === activeAudioId;
    return !!activeVisualId && item._id === activeVisualId;
  };

  // Sincronizar quick controls con item seleccionado (solo al seleccionar)
  useEffect(() => {
    if (!selectedItem) return;
    setQuickMode(selectedItem.defaultMode as QuickMode);
    setQuickLoop(!!selectedItem.defaultLoop);
    setQuickMuted(!!selectedItem.defaultMuted);
    setQuickFit(selectedItem.defaultFit as QuickFit);
    setQuickOpacity(
      typeof selectedItem.defaultOpacity === "number" ? selectedItem.defaultOpacity : 1,
    );
  }, [selectedItem]);

  const handleUpload = async (file: File, metadata: CreateMediaItemDto) => {
    try {
      setUploading(true);
      await uploadMediaItem(eventSlug, file, metadata);
      notifications.show({ message: "Media subida exitosamente", color: "green" });
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

  const applyConfigToItem = async (item: MediaItem) => {
    // Re-aplicar “activate” al mismo item para que backend actualice config
    // (sin desmontar el monitor). Asumimos que activateMediaItem es idempotente.
    await activateMediaItem(item._id, eventSlug, {
      mode: quickMode,
      loop: quickLoop,
      muted: quickMuted,
      fit: quickFit,
      opacity: quickOpacity,
    });

    onConfigChange?.();
  };

  const scheduleApplyIfActive = (item: MediaItem | null) => {
    if (!item) return;
    if (!isItemActive(item)) return; // solo aplicamos live si ese item ya está activo

    if (applyTimerRef.current) window.clearTimeout(applyTimerRef.current);
    applyTimerRef.current = window.setTimeout(async () => {
      try {
        await applyConfigToItem(item);
        // no spamear notificaciones cada cambio; lo dejamos silencioso
      } catch (err: any) {
        console.error("Error applying config:", err);
        notifications.show({
          message: err?.response?.data?.message || "Error aplicando configuración",
          color: "red",
        });
      }
    }, 250);
  };

  // Cada vez que cambian controles, si el seleccionado está activo, aplicar live (debounced)
  useEffect(() => {
    scheduleApplyIfActive(selectedItem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickMode, quickLoop, quickMuted, quickFit, quickOpacity]);

  const handleActivate = async (item: MediaItem) => {
    try {
      await applyConfigToItem(item);
      notifications.show({ message: `"${item.name}" activado`, color: "green" });

      // leve delay para que parent refleje IDs, luego recargar
      await new Promise((r) => setTimeout(r, 250));
      await loadItems();
    } catch (err: any) {
      console.error("Error activating:", err);
      notifications.show({
        message: err?.response?.data?.message || "Error al activar",
        color: "red",
      });
    }
  };

  const handleDeactivateByItem = async (item: MediaItem) => {
    try {
      const typeToDeactivate = item.type === "audio" ? "audio" : "visual";
      await deactivateMedia(eventSlug, typeToDeactivate);

      notifications.show({
        message: `${typeToDeactivate === "audio" ? "Audio" : "Visual"} desactivado`,
        color: "blue",
      });

      onConfigChange?.();
      await new Promise((r) => setTimeout(r, 250));
      await loadItems();
    } catch (err: any) {
      console.error("Error deactivating:", err);
      notifications.show({
        message: err?.response?.data?.message || "Error al desactivar",
        color: "red",
      });
    }
  };

  // ✅ Click card => toggle activar/desactivar
  const handleCardClick = async (item: MediaItem) => {
    setSelectedItem(item);

    if (disabled) return;

    const active = isItemActive(item);
    if (active) {
      await handleDeactivateByItem(item);
    } else {
      await handleActivate(item);
    }
  };

  const filteredItems = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(s);
      const matchesType = filterType === "all" || item.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [items, searchTerm, filterType]);

  const groups = useMemo(() => {
    const audio = filteredItems.filter((i) => i.type === "audio");
    const video = filteredItems.filter((i) => i.type === "video");
    const images = filteredItems.filter((i) => i.type === "image" || i.type === "gif");
    return { audio, video, images };
  }, [filteredItems]);

  const renderGrid = (list: MediaItem[]) => (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
      {list.map((item) => {
        const isActive = isItemActive(item);
        const isSelected = selectedItem?._id === item._id;

        return (
          <Card
            key={item._id}
            padding="xs"
            withBorder
            style={{
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
              borderColor: isActive
                ? "var(--mantine-color-green-6)"
                : isSelected
                  ? "var(--mantine-color-blue-6)"
                  : undefined,
              borderWidth: isActive || isSelected ? 2 : 1,
              transition: "transform 120ms ease, box-shadow 120ms ease",
            }}
            onClick={() => void handleCardClick(item)}
            onMouseDown={(e) => {
              // evita selección de texto rara
              e.preventDefault();
            }}
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
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
                        background:
                          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
                    ● Activo
                  </Badge>
                )}

                {/* Hint de acción */}
                {!disabled && (
                  <Badge
                    size="xs"
                    variant="light"
                    style={{ position: "absolute", bottom: 6, right: 6 }}
                    leftSection={
                      isActive ? <IconPlayerStop size={12} /> : <IconPlayerPlay size={12} />
                    }
                  >
                    {isActive ? "Click: apagar" : "Click: activar"}
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

            {item.tags?.length > 0 && (
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
  );

  if (loading) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  const hasAnyActive = !!activeVisualId || !!activeAudioId;

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Biblioteca de Media
        </Text>

        <Group gap="xs">
          {hasAnyActive && (
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
                    color: "blue",
                  });
                  onConfigChange?.();
                  await new Promise((r) => setTimeout(r, 250));
                  await loadItems();
                } catch (err: any) {
                  notifications.show({
                    message: err?.response?.data?.message || "Error",
                    color: "red",
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

      {/* Search + Filter */}
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

      {/* Secciones por tipo */}
      {filteredItems.length === 0 ? (
        <Paper p="xl" withBorder>
          <Center>
            <Stack align="center" gap="xs">
              <Text c="dimmed">No hay media en esta biblioteca</Text>
              <Button size="xs" variant="light" onClick={() => setUploadOpen(true)}>
                Subir primer archivo
              </Button>
            </Stack>
          </Center>
        </Paper>
      ) : (
        <Stack gap="md">
          {/* AUDIO */}
          <Paper p="sm" withBorder>
            <Group justify="space-between">
              <Group gap="xs">
                <ActionIcon
                  variant="subtle"
                  onClick={() => setOpenAudio((v) => !v)}
                >
                  {openAudio ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                </ActionIcon>
                <Badge leftSection={<IconMusic size={12} />}>Audio</Badge>
                <Text size="sm" c="dimmed">
                  {groups.audio.length}
                </Text>
              </Group>
            </Group>
            <Collapse in={openAudio}>
              <Divider my="sm" />
              {groups.audio.length ? renderGrid(groups.audio) : <Text size="sm" c="dimmed">Sin audios.</Text>}
            </Collapse>
          </Paper>

          {/* VIDEO */}
          <Paper p="sm" withBorder>
            <Group justify="space-between">
              <Group gap="xs">
                <ActionIcon
                  variant="subtle"
                  onClick={() => setOpenVideo((v) => !v)}
                >
                  {openVideo ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                </ActionIcon>
                <Badge leftSection={<IconVideo size={12} />}>Videos</Badge>
                <Text size="sm" c="dimmed">
                  {groups.video.length}
                </Text>
              </Group>
            </Group>
            <Collapse in={openVideo}>
              <Divider my="sm" />
              {groups.video.length ? renderGrid(groups.video) : <Text size="sm" c="dimmed">Sin videos.</Text>}
            </Collapse>
          </Paper>

          {/* IMAGES+GIF */}
          <Paper p="sm" withBorder>
            <Group justify="space-between">
              <Group gap="xs">
                <ActionIcon
                  variant="subtle"
                  onClick={() => setOpenImages((v) => !v)}
                >
                  {openImages ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                </ActionIcon>
                <Badge leftSection={<IconPhoto size={12} />}>Imágenes & GIF</Badge>
                <Text size="sm" c="dimmed">
                  {groups.images.length}
                </Text>
              </Group>
            </Group>
            <Collapse in={openImages}>
              <Divider my="sm" />
              {groups.images.length ? renderGrid(groups.images) : <Text size="sm" c="dimmed">Sin imágenes/GIF.</Text>}
            </Collapse>
          </Paper>
        </Stack>
      )}

      {/* Quick controls */}
      {selectedItem && (
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={600} size="sm">
                {selectedItem.name}
              </Text>

              {isItemActive(selectedItem) && <Badge color="green">Activo</Badge>}
            </Group>

            <Group grow>
              <SegmentedControl
                size="xs"
                value={quickMode}
                onChange={(v) => setQuickMode(v as QuickMode)}
                data={[
                  { label: "Overlay", value: "overlay" },
                  { label: "Full", value: "full" },
                ]}
              />

              <Select
                size="xs"
                value={quickFit}
                onChange={(v) => setQuickFit((v as QuickFit) || "cover")}
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
                {isItemActive(selectedItem) ? (
                  <Text span c="dimmed">
                    {" "}
                    (se aplica en vivo)
                  </Text>
                ) : (
                  <Text span c="dimmed">
                    {" "}
                    (se aplicará al activar)
                  </Text>
                )}
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

            {/* Botón opcional (ya no es necesario, pero lo dejo como fallback) */}
            <Group grow mt="xs">
              {isItemActive(selectedItem) ? (
                <Button
                  size="sm"
                  color="red"
                  leftSection={<IconPlayerStop size={16} />}
                  onClick={() => void handleDeactivateByItem(selectedItem)}
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
                  Activar
                </Button>
              )}
            </Group>

            <Text size="xs" c="dimmed">
              Tip: ahora puedes simplemente hacer click en cualquier card para activar/desactivar.
              Y si el item está activo, cualquier cambio de loop/mute/fit/opacidad se aplica sin desmontar.
            </Text>
          </Stack>
        </Paper>
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
