import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  ColorInput,
  Collapse,
  Divider,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronRight,
  IconEyeOff,
  IconPencil,
  IconPlayerPlay,
  IconTrash,
} from "@tabler/icons-react";
import {
  DEFAULT_ANNOUNCEMENT_STYLE,
  deleteAnnouncement,
  getServerNow,
  hideBanner,
  isBannerActive,
  publishAnnouncement,
  saveAnnouncement,
  setAnnouncementSettings,
  subscribeAnnouncements,
  subscribeBannerOverlay,
  swapAnnouncementOrder,
  updateBannerContent,
  type Announcement,
  type AnnouncementSettings,
  type AnnouncementStyle,
  type BannerState,
} from "../../api/live-stage-service";
import { AnnouncementBanner } from "../../components/studio/AnnouncementBanner";

interface AnnouncementPublisherProps {
  eventSlug: string;
  disabled?: boolean;
}

const MAX_LEN = 280;

const DURATION_OPTIONS = [
  { value: "0", label: "Sin límite" },
  { value: "10", label: "10 segundos" },
  { value: "30", label: "30 segundos" },
  { value: "60", label: "1 minuto" },
  { value: "120", label: "2 minutos" },
  { value: "300", label: "5 minutos" },
  { value: "600", label: "10 minutos" },
];

const BG_SWATCHES = [
  "rgba(0, 0, 0, 0.75)",
  "rgba(220, 38, 38, 0.9)",
  "rgba(37, 99, 235, 0.9)",
  "rgba(22, 163, 74, 0.9)",
  "rgba(234, 179, 8, 0.95)",
  "rgba(255, 255, 255, 0.92)",
];
const TEXT_SWATCHES = ["#ffffff", "#000000", "#facc15", "#f87171", "#60a5fa"];

type Draft = {
  text: string;
  style: Required<AnnouncementStyle>;
  durationSec: number;
};

const emptyDraft = (): Draft => ({
  text: "",
  style: { ...DEFAULT_ANNOUNCEMENT_STYLE },
  durationSec: 0,
});

function formatRemaining(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, "0")}` : `${s}s`;
}

function durationLabel(sec?: number | null) {
  if (!sec) return null;
  return sec >= 60 ? `${sec / 60} min` : `${sec}s`;
}

export function AnnouncementPublisher({ eventSlug, disabled }: AnnouncementPublisherProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [banner, setBannerState] = useState<BannerState | null>(null);
  const [settings, setSettings] = useState<AnnouncementSettings>({});
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showStyle, setShowStyle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => getServerNow());

  useEffect(() => {
    if (!eventSlug) return;
    const unsubList = subscribeAnnouncements(eventSlug, setAnnouncements);
    const unsubBanner = subscribeBannerOverlay(eventSlug, (s) => {
      setBannerState(s.banner);
      setSettings(s.settings);
    });
    return () => {
      unsubList();
      unsubBanner();
    };
  }, [eventSlug]);

  const onAir = isBannerActive(banner, now);
  const onAirId = onAir ? banner?.announcementId ?? null : null;

  // Tick de 1 s solo mientras hay un anuncio con duración al aire (cuenta regresiva)
  const expiresAt = banner?.visible ? banner.expiresAt : null;
  useEffect(() => {
    setNow(getServerNow());
    if (!expiresAt) return;
    const t = setInterval(() => setNow(getServerNow()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  // Al expirar, apagar el banner en RTDB (best effort; los visores ya lo ocultan solos)
  const expiredHandled = useRef<number | null>(null);
  useEffect(() => {
    if (!banner?.visible || !banner.expiresAt || now < banner.expiresAt) return;
    if (expiredHandled.current === banner.expiresAt) return;
    expiredHandled.current = banner.expiresAt;
    hideBanner(eventSlug).catch(() => {});
  }, [banner, now, eventSlug]);

  const run = async (fn: () => Promise<unknown>, errorMsg: string, okMsg?: string) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) notifications.show({ message: okMsg, color: "blue" });
    } catch (err) {
      console.error(errorMsg, err);
      notifications.show({ message: errorMsg, color: "red" });
    } finally {
      setBusy(false);
    }
  };

  const trimmed = draft.text.trim();
  const draftData = () => ({
    text: trimmed,
    style: draft.style,
    durationSec: draft.durationSec || null,
  });

  const resetForm = () => {
    setDraft(emptyDraft());
    setEditingId(null);
  };

  const handleSave = () =>
    run(
      async () => {
        const id = await saveAnnouncement(eventSlug, draftData(), editingId ?? undefined);
        // Si se edita el anuncio que está al aire, reflejar el cambio en vivo
        if (editingId && editingId === onAirId) {
          await updateBannerContent(eventSlug, { text: trimmed, style: draft.style });
        }
        resetForm();
        return id;
      },
      "Error al guardar el anuncio",
      editingId ? "Anuncio actualizado" : "Anuncio guardado",
    );

  const handlePublishDraft = () =>
    run(
      async () => {
        const id = await saveAnnouncement(eventSlug, draftData(), editingId ?? undefined);
        await publishAnnouncement(eventSlug, { ...draftData(), id });
        resetForm();
      },
      "Error al publicar el anuncio",
      "Anuncio al aire",
    );

  const handlePublish = (a: Announcement) =>
    run(() => publishAnnouncement(eventSlug, a), "Error al publicar el anuncio", "Anuncio al aire");

  const handleHide = () => run(() => hideBanner(eventSlug), "Error al quitar el anuncio");

  const handleEdit = (a: Announcement) => {
    setEditingId(a.id);
    setDraft({
      text: a.text,
      style: { ...DEFAULT_ANNOUNCEMENT_STYLE, ...(a.style ?? {}) },
      durationSec: a.durationSec ?? 0,
    });
  };

  const handleDelete = (a: Announcement) =>
    run(async () => {
      if (a.id === onAirId) await hideBanner(eventSlug);
      await deleteAnnouncement(eventSlug, a.id);
      if (editingId === a.id) resetForm();
    }, "Error al eliminar el anuncio");

  const handleMove = (index: number, dir: -1 | 1) => {
    const other = announcements[index + dir];
    if (!other) return;
    return run(
      () => swapAnnouncementOrder(eventSlug, announcements[index], other),
      "Error al reordenar",
    );
  };

  const setStyle = (patch: Partial<AnnouncementStyle>) =>
    setDraft((d) => ({ ...d, style: { ...d.style, ...patch } }));

  const off = disabled || busy;

  return (
    <Stack gap="md">
      {/* ── AL AIRE ───────────────────────────────────────────── */}
      <Card withBorder radius="md" p="sm" bg={onAir ? "var(--mantine-color-red-light)" : undefined}>
        {onAir && banner ? (
          <Stack gap={6}>
            <Group justify="space-between" wrap="nowrap">
              <Group gap={6}>
                <Badge color="red" variant="filled" size="sm">Al aire</Badge>
                {banner.expiresAt && (
                  <Text size="xs" c="dimmed">
                    se oculta en {formatRemaining(banner.expiresAt - now)}
                  </Text>
                )}
              </Group>
              <Button
                size="compact-xs"
                variant="light"
                color="red"
                leftSection={<IconEyeOff size={14} />}
                onClick={handleHide}
                disabled={off}
              >
                Quitar
              </Button>
            </Group>
            <Text size="sm" lineClamp={3} style={{ whiteSpace: "pre-wrap" }}>
              {banner.text}
            </Text>
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">Ningún anuncio al aire</Text>
        )}
      </Card>

      {/* ── EDITOR ────────────────────────────────────────────── */}
      <Stack gap="xs">
        <Textarea
          label={editingId ? "Editando anuncio" : "Nuevo anuncio"}
          placeholder="Ej: ¡Próximo sorteo en 5 minutos!"
          value={draft.text}
          onChange={(e) => {
            const text = e.currentTarget.value.slice(0, MAX_LEN);
            setDraft((d) => ({ ...d, text }));
          }}
          autosize
          minRows={2}
          maxRows={5}
          disabled={disabled}
        />
        <Text size="xs" c="dimmed" ta="right" mt={-4}>
          {draft.text.length}/{MAX_LEN}
        </Text>

        <UnstyledButton onClick={() => setShowStyle((v) => !v)}>
          <Group gap={4}>
            {showStyle ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            <Text size="xs" fw={600}>Estilo y duración</Text>
          </Group>
        </UnstyledButton>

        <Collapse in={showStyle}>
          <Stack gap="xs">
            <Box>
              <Text size="xs" fw={500} mb={4}>Tipo</Text>
              <SegmentedControl
                fullWidth
                size="xs"
                value={draft.style.mode}
                onChange={(v) => setStyle({ mode: v as AnnouncementStyle["mode"] })}
                data={[
                  { value: "static", label: "Fijo" },
                  { value: "ticker", label: "Desplazable" },
                ]}
              />
            </Box>
            <Group grow gap="xs">
              <Box>
                <Text size="xs" fw={500} mb={4}>Posición</Text>
                <SegmentedControl
                  fullWidth
                  size="xs"
                  value={draft.style.position}
                  onChange={(v) => setStyle({ position: v as AnnouncementStyle["position"] })}
                  data={[
                    { value: "bottom", label: "Abajo" },
                    { value: "top", label: "Arriba" },
                  ]}
                />
              </Box>
              <Box>
                <Text size="xs" fw={500} mb={4}>Tamaño</Text>
                <SegmentedControl
                  fullWidth
                  size="xs"
                  value={draft.style.size}
                  onChange={(v) => setStyle({ size: v as AnnouncementStyle["size"] })}
                  data={[
                    { value: "sm", label: "S" },
                    { value: "md", label: "M" },
                    { value: "lg", label: "L" },
                  ]}
                />
              </Box>
            </Group>
            <Group grow gap="xs">
              <ColorInput
                size="xs"
                label="Fondo"
                format="rgba"
                value={draft.style.bgColor}
                onChange={(v) => setStyle({ bgColor: v })}
                swatches={BG_SWATCHES}
                swatchesPerRow={6}
              />
              <ColorInput
                size="xs"
                label="Texto"
                format="hex"
                value={draft.style.textColor}
                onChange={(v) => setStyle({ textColor: v })}
                swatches={TEXT_SWATCHES}
                swatchesPerRow={5}
              />
            </Group>
            <Select
              size="xs"
              label="Ocultar automáticamente después de"
              data={DURATION_OPTIONS}
              value={String(draft.durationSec)}
              onChange={(v) => setDraft((d) => ({ ...d, durationSec: Number(v) || 0 }))}
              allowDeselect={false}
            />

            {/* Vista previa con el mismo componente que usa el monitor/egress */}
            <Box
              style={{
                position: "relative",
                aspectRatio: "16 / 9",
                borderRadius: 6,
                overflow: "hidden",
                background: "linear-gradient(135deg, #2b2f3a, #14161c)",
              }}
            >
              <AnnouncementBanner
                banner={{
                  visible: true,
                  text: trimmed || "Vista previa del anuncio",
                  style: draft.style,
                }}
                zIndex={1}
              />
            </Box>
          </Stack>
        </Collapse>

        <Group gap="xs" grow>
          <Button
            size="xs"
            leftSection={<IconPlayerPlay size={14} />}
            onClick={handlePublishDraft}
            disabled={off || !trimmed}
          >
            {editingId ? "Guardar y publicar" : "Publicar ahora"}
          </Button>
          <Button size="xs" variant="light" onClick={handleSave} disabled={off || !trimmed}>
            {editingId ? "Guardar cambios" : "Guardar en lista"}
          </Button>
        </Group>
        {editingId && (
          <Button size="xs" variant="subtle" color="gray" onClick={resetForm}>
            Cancelar edición
          </Button>
        )}
      </Stack>

      {/* ── LISTA ─────────────────────────────────────────────── */}
      <Divider label={`Anuncios preparados (${announcements.length})`} labelPosition="center" />

      {announcements.length === 0 ? (
        <Text size="xs" c="dimmed" ta="center">
          Guarda anuncios para publicarlos con un clic durante la transmisión.
        </Text>
      ) : (
        <Stack gap={6}>
          {announcements.map((a, i) => {
            const isLive = a.id === onAirId;
            const style = { ...DEFAULT_ANNOUNCEMENT_STYLE, ...(a.style ?? {}) };
            return (
              <Card
                key={a.id}
                withBorder
                radius="sm"
                p="xs"
                style={{
                  borderLeft: `4px solid ${style.bgColor}`,
                  outline: editingId === a.id ? "2px solid var(--mantine-color-blue-5)" : undefined,
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                  <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" lineClamp={2} style={{ whiteSpace: "pre-wrap" }}>
                      {a.text}
                    </Text>
                    <Group gap={4}>
                      {isLive && <Badge size="xs" color="red" variant="filled">Al aire</Badge>}
                      {style.mode === "ticker" && <Badge size="xs" variant="light">Desplazable</Badge>}
                      {style.position === "top" && <Badge size="xs" variant="light">Arriba</Badge>}
                      {durationLabel(a.durationSec) && (
                        <Badge size="xs" variant="light" color="gray">
                          {durationLabel(a.durationSec)}
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                  <Group gap={2} wrap="nowrap">
                    {isLive ? (
                      <Tooltip label="Quitar del aire">
                        <ActionIcon size="sm" color="red" variant="light" onClick={handleHide} disabled={off}>
                          <IconEyeOff size={14} />
                        </ActionIcon>
                      </Tooltip>
                    ) : (
                      <Tooltip label="Publicar">
                        <ActionIcon size="sm" variant="filled" onClick={() => handlePublish(a)} disabled={off}>
                          <IconPlayerPlay size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    <Tooltip label="Editar">
                      <ActionIcon size="sm" variant="subtle" onClick={() => handleEdit(a)} disabled={off}>
                        <IconPencil size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => handleMove(i, -1)} disabled={off || i === 0}>
                      <IconArrowUp size={14} />
                    </ActionIcon>
                    <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => handleMove(i, 1)} disabled={off || i === announcements.length - 1}>
                      <IconArrowDown size={14} />
                    </ActionIcon>
                    <Tooltip label="Eliminar">
                      <ActionIcon size="sm" variant="subtle" color="red" onClick={() => handleDelete(a)} disabled={off}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}

      <Divider />

      <Switch
        label="Mostrar también sobre el reproductor del asistente"
        description="Actívalo si la transmisión no sale del estudio (OBS, Vimeo u otra fuente externa). Si sale del estudio, el anuncio ya va dentro del video y se vería doble."
        checked={!!settings.showOnAttend}
        onChange={(e) => {
          const showOnAttend = e.currentTarget.checked;
          void run(
            () => setAnnouncementSettings(eventSlug, { showOnAttend }),
            "Error al guardar la configuración",
          );
        }}
        disabled={off}
      />

      <Text size="xs" c="dimmed">
        En el monitor el anuncio aparece al instante; en la transmisión llega con el
        retraso normal del video (unos segundos).
      </Text>
    </Stack>
  );
}
