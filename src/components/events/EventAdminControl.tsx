import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Stack,
  Title,
  Card,
  Group,
  Text,
  Button,
  Alert,
  Grid,
  Modal,
  Loader,
  Box,
  Badge,
  Center,
  Divider,
  SegmentedControl,
  Switch,
  Tabs,
} from "@mantine/core";
import {
  IconPlayerPlay,
  IconRefresh,
  IconStethoscope,
  IconUsers,
  IconVideo,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMediaQuery } from "@mantine/hooks";
import {
  type EventItem,
  setEventStatus,
  updateEventStreams,
  setEmergencyMode,
  updateEventCertificatesConfig,
  backfillEventCertificates,
} from "../../api/events";
import {
  getLiveConfig,
  getMuxReplayByAsset,
  listMuxAssets,
  updateLiveConfig,
  type MuxAsset,
  type StreamProvider,
} from "../../api/livekit-service";
import { providerInfo } from "../../pages/studio/streamProviders";
import EventStreamForm from "./EventStreamForm";
import { StreamPlayer } from "./StreamPlayer";
import { resolveStreams } from "./streamUtils";
import { useEventEmergency } from "../../hooks/useEventEmergency";
import type { FormField } from "../../types";
import { HerdAnnouncementsCard } from "./HerdAnnouncementsCard";
import { NetworkBlocksCard } from "./NetworkBlocksCard";

const STATUS_OPTIONS = [
  { label: "📅 Próximamente", value: "upcoming" },
  { label: "🔴 En vivo", value: "live" },
  { label: "⏹️ Finalizado", value: "ended" },
  { label: "▶️ Repetición", value: "replay" },
];

type ControlTab = "video" | "audience" | "diagnostics";
const TAB_STORAGE_KEY = "eventControl.tab";

function readStoredTab(): ControlTab {
  try {
    const v = localStorage.getItem(TAB_STORAGE_KEY);
    if (v === "video" || v === "audience" || v === "diagnostics") return v;
  } catch {
    // almacenamiento bloqueado (modo privado, etc.)
  }
  return "video";
}

interface EventAdminControlProps {
  event: EventItem;
  orgSlug: string;
  formFields?: FormField[];
  onEventUpdate: (event: EventItem) => void;
}

export default function EventAdminControl({
  event,
  orgSlug,
  formFields = [],
  onEventUpdate,
}: EventAdminControlProps) {
  const emergency = useEventEmergency(orgSlug, event.slug);

  // En celular los 4 estados no caben en una fila
  const narrow = useMediaQuery("(max-width: 36em)");

  // Pestaña de ajustes (se recuerda por navegador)
  const [tab, setTab] = useState<ControlTab>(readStoredTab);
  const changeTab = (value: string | null) => {
    if (!value) return;
    setTab(value as ControlTab);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, value);
    } catch {
      // sin almacenamiento: solo no se recuerda
    }
  };
  const [emergencyToggling, setEmergencyToggling] = useState(false);

  const handleToggleEmergency = async (active: boolean) => {
    setEmergencyToggling(true);
    try {
      await setEmergencyMode(event._id, active);
      notifications.show({
        title: active ? "Modo emergencia activado" : "Modo emergencia desactivado",
        message: active
          ? "Los asistentes ahora ven solo transmisión + chat, sin depender de Mongo."
          : "Los asistentes volvieron al flujo normal.",
        color: active ? "orange" : "green",
      });
    } catch (err) {
      console.error("Error toggling emergency mode:", err);
      notifications.show({
        title: "Error",
        message: "No se pudo cambiar el modo emergencia. Intenta de nuevo.",
        color: "red",
      });
    } finally {
      setEmergencyToggling(false);
    }
  };

  const [certificatesToggling, setCertificatesToggling] = useState(false);

  const handleToggleCertificates = async (enabled: boolean) => {
    setCertificatesToggling(true);
    try {
      const updated = await updateEventCertificatesConfig(event._id, enabled);
      onEventUpdate(updated);
      notifications.show({
        title: enabled ? "Certificados habilitados" : "Certificados deshabilitados",
        message: enabled
          ? "Los asistentes que asistieron en vivo podrán descargar su certificado."
          : "Se ocultó la sección de certificado para los asistentes.",
        color: enabled ? "green" : "gray",
      });
    } catch (err) {
      console.error("Error toggling certificates config:", err);
      notifications.show({
        title: "Error",
        message: "No se pudo cambiar la configuración de certificados. Intenta de nuevo.",
        color: "red",
      });
    } finally {
      setCertificatesToggling(false);
    }
  };

  // "Solicitar unirme al estudio": vive en la config en vivo (por eventSlug)
  const [joinRequestsEnabled, setJoinRequestsEnabled] = useState<boolean | null>(null);
  const [joinToggling, setJoinToggling] = useState(false);
  // Proveedor configurado en el estudio: define cómo se arma la repetición
  const [liveProvider, setLiveProvider] = useState<StreamProvider | null>(null);
  // URL que ven los asistentes en vivo (la del estudio, no event.streams)
  const [livePlaybackUrl, setLivePlaybackUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getLiveConfig(event.slug)
      .then((cfg) => {
        if (!alive) return;
        setJoinRequestsEnabled(cfg.joinRequestsEnabled !== false);
        setLiveProvider(cfg.provider ?? null);
        setLivePlaybackUrl(cfg.playbackHlsUrl || null);
      })
      .catch((err) => console.error("Error cargando config en vivo:", err));
    return () => {
      alive = false;
    };
  }, [event.slug]);

  const handleToggleJoinRequests = async (enabled: boolean) => {
    setJoinToggling(true);
    try {
      await updateLiveConfig({ eventSlug: event.slug, joinRequestsEnabled: enabled });
      setJoinRequestsEnabled(enabled);
      notifications.show({
        title: enabled ? "Solicitudes al estudio activadas" : "Solicitudes al estudio desactivadas",
        message: enabled
          ? "Los asistentes ven el botón «Solicitar unirme al estudio»."
          : "Se ocultó el botón para unirse al estudio en la página del asistente.",
        color: enabled ? "green" : "gray",
      });
    } catch (err) {
      console.error("Error cambiando solicitudes al estudio:", err);
      notifications.show({
        title: "Error",
        message: "No se pudo cambiar la configuración. Intenta de nuevo.",
        color: "red",
      });
    } finally {
      setJoinToggling(false);
    }
  };

  const [certificatesBackfilling, setCertificatesBackfilling] = useState(false);

  const handleBackfillCertificates = async () => {
    setCertificatesBackfilling(true);
    try {
      const result = await backfillEventCertificates(event._id);
      if (result.error) {
        notifications.show({
          title: "Error",
          message: result.error,
          color: "red",
        });
        return;
      }
      notifications.show({
        title: "Sincronización de certificados completa",
        message:
          result.total === 0
            ? "No había asistentes pendientes por sincronizar."
            : `${result.synced} de ${result.total} asistentes sincronizados` +
              (result.failed > 0 ? `, ${result.failed} con error.` : "."),
        color: result.failed > 0 ? "yellow" : "green",
      });
    } catch (err) {
      console.error("Error backfilling certificates:", err);
      notifications.show({
        title: "Error",
        message: "No se pudo sincronizar a los asistentes con certificados. Intenta de nuevo.",
        color: "red",
      });
    } finally {
      setCertificatesBackfilling(false);
    }
  };

  const [streamOpen, setStreamOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<EventItem["status"]>(
    event.status
  );

  // Repetición desde las grabaciones del proveedor (Mux o Cloudflare)
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayStatus, setReplayStatus] = useState<string | null>(null);

  // Estado para lista de assets (grabaciones)
  const [assets, setAssets] = useState<MuxAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetsProvider, setAssetsProvider] = useState<StreamProvider | null>(null);
  // Error del proveedor al listar (p. ej. Cloudflare sin credenciales)
  const [assetsError, setAssetsError] = useState<string | null>(null);

  // Más reciente primero (Mux las devuelve de la más vieja a la más nueva)
  const sortAssets = (list: MuxAsset[]) =>
    [...list].sort(
      (a, b) =>
        (b.createdAt ? new Date(b.createdAt).getTime() : 0) -
        (a.createdAt ? new Date(a.createdAt).getTime() : 0),
    );

  // Mantener el estado local sincronizado si cambia desde fuera
  useEffect(() => {
    setLocalStatus(event.status);
  }, [event.status]);

  // Cargar lista de grabaciones al montar
  useEffect(() => {
    const loadAssets = async () => {
      setAssetsLoading(true);
      try {
        const result = await listMuxAssets(event.slug);
        setAssetsProvider(result.provider ?? null);
        setAssetsError(result.ok ? null : result.message || null);
        if (result.ok && result.assets.length > 0) {
          const sorted = sortAssets(result.assets);
          setAssets(sorted);
          // Seleccionar el más reciente por defecto
          setSelectedAssetId(sorted[0].id);
        }
      } catch (err) {
        console.error("Error loading assets:", err);
      } finally {
        setAssetsLoading(false);
      }
    };
    void loadAssets();
  }, [event.slug]);

  // Función para refrescar la lista de grabaciones
  const handleRefreshAssets = async () => {
    setAssetsLoading(true);
    try {
      const result = await listMuxAssets(event.slug);
      setAssetsProvider(result.provider ?? null);
        setAssetsError(result.ok ? null : result.message || null);
      if (result.ok) {
        const sorted = sortAssets(result.assets);
        setAssets(sorted);
        if (sorted.length > 0 && !selectedAssetId) {
          setSelectedAssetId(sorted[0].id);
        }
        notifications.show({
          title: "Lista actualizada",
          message: result.message,
          color: "green",
        });
      } else {
        notifications.show({
          title: "Sin grabaciones",
          message: result.message,
          color: "orange",
        });
      }
    } catch (err) {
      console.error("Error refreshing assets:", err);
      notifications.show({
        title: "Error",
        message: "No se pudo actualizar la lista de grabaciones.",
        color: "red",
      });
    } finally {
      setAssetsLoading(false);
    }
  };

  // Función para activar repetición con el asset seleccionado
  const handleEnableReplay = async () => {
    if (!selectedAssetId) {
      notifications.show({
        title: "Selecciona una grabación",
        message: "Debes seleccionar una grabación de la lista.",
        color: "orange",
      });
      return;
    }

    setReplayLoading(true);
    setReplayStatus(null);

    try {
      const result = await getMuxReplayByAsset(event.slug, selectedAssetId);

      if (result.status === "ready" && result.replayUrl) {
        // Reemplazar (o agregar) la fuente del proveedor (mux/cloudflare)
        // dentro del arreglo de streams, como primera opción
        const provider = result.provider ?? assetsProvider ?? "mux";
        const currentStreams = resolveStreams(event.streams, event.stream);
        const nextStreams = [
          { provider, url: result.replayUrl },
          ...currentStreams.filter((s) => s.provider !== provider),
        ];
        await updateEventStreams(event._id, nextStreams);

        // Cambiar estado a "replay"
        await setEventStatus(event._id, "replay");

        // Actualizar el evento local
        const updatedEvent = {
          ...event,
          streams: nextStreams,
          status: "replay" as const,
        };
        onEventUpdate(updatedEvent);
        setLocalStatus("replay");

        notifications.show({
          title: "Repetición activada",
          message: "El evento ahora muestra la grabación seleccionada.",
          color: "green",
        });

        setReplayStatus("ready");
      } else if (result.status === "preparing") {
        setReplayStatus("preparing");
        notifications.show({
          title: "Procesando",
          message: result.message,
          color: "yellow",
        });
      } else {
        setReplayStatus("not_available");
        notifications.show({
          title: "No disponible",
          message: result.message,
          color: "orange"
        });
      }
    } catch (err: unknown) {
      console.error("Error enabling replay:", err);
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      notifications.show({
        title: "Error",
        message: errorMessage,
        color: "red",
      });
      setReplayStatus("error");
    } finally {
      setReplayLoading(false);
    }
  };

  const handleStatusChange = async (status: EventItem["status"]) => {
    if (!status || status === localStatus) return;

    // Cambios que afectan a quien está viendo: pedir confirmación
    if (
      status === "live" &&
      !livePlaybackUrl &&
      !window.confirm(
        "El estudio no tiene URL de reproducción: los asistentes verán «Cargando transmisión…». ¿Poner en vivo igual?",
      )
    )
      return;
    if (
      localStatus === "live" &&
      !window.confirm(
        `El evento está EN VIVO. ¿Cambiar a «${getStatusLabel(status)}»? Los asistentes dejarán de ver la transmisión en vivo.`,
      )
    )
      return;

    try {
      setStatusError(null);
      setStatusLoading(true);
      setLocalStatus(status); // actualización optimista

      await setEventStatus(event._id, status);
      const updatedEvent = { ...event, status };
      onEventUpdate(updatedEvent);
    } catch (err) {
      console.error("Error updating event status:", err);
      setStatusError("No se pudo actualizar el estado. Intenta de nuevo.");
      // Revertir al estado real
      setLocalStatus(event.status);
    } finally {
      setStatusLoading(false);
    }
  };

  const getStatusHelperText = (status: EventItem["status"]) => {
    switch (status) {
      case "upcoming":
        return "Pantalla de espera hasta que lo pongas en vivo.";
      case "live":
        return "Los asistentes ven la transmisión en tiempo real.";
      case "ended":
        return "Evento marcado como finalizado, sin transmisión.";
      case "replay":
        return "Muestra una grabación usando la URL configurada.";
      default:
        return "";
    }
  };

  const getStatusColor = (status: EventItem["status"]) => {
    switch (status) {
      case "live":
        return "red";
      case "upcoming":
        return "blue";
      case "ended":
        return "gray";
      case "replay":
        return "orange";
      default:
        return "gray";
    }
  };

  const getStatusLabel = (status: EventItem["status"]) => {
    switch (status) {
      case "live":
        return "En vivo";
      case "upcoming":
        return "Próximamente";
      case "ended":
        return "Finalizado";
      case "replay":
        return "Repetición";
      default:
        return "Sin estado";
    }
  };

  const streamList = resolveStreams(event.streams, event.stream);
  const hasStream = streamList.length > 0;
  const studioPath = `/org/${orgSlug}/event/${event.slug}/admin/studio`;
  const hasRecordings = liveProvider === "mux" || liveProvider === "cloudflare";

  // -------- Vista previa del evento para asistentes ----------
  const renderAudiencePreview = () => (
    <Card withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Title order={3}>Vista previa para asistentes</Title>
            <Text size="sm" c="dimmed">
              Simulación de lo que verán según el estado actual.
            </Text>
          </div>

          <Badge
            color={getStatusColor(localStatus)}
            variant={localStatus === "live" ? "filled" : "light"}
            size="md"
          >
            {localStatus === "live" && "🔴 "}
            {getStatusLabel(localStatus)}
          </Badge>
        </Group>

        <Box
          style={{
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: "#000",
            border: "1px solid var(--mantine-color-gray-3)",
          }}
        >
          <Box
            style={{
              position: "relative",
              width: "100%",
              paddingTop: "56.25%", // 16:9
            }}
          >
            {/* LIVE: la URL de reproducción del estudio */}
            {localStatus === "live" && livePlaybackUrl && (
              <StreamPlayer
                streams={[{ provider: liveProvider ?? "live", url: livePlaybackUrl }]}
                title="Preview transmisión en vivo"
              />
            )}

            {/* REPLAY: las fuentes del evento, en orden */}
            {localStatus === "replay" && hasStream && (
              <StreamPlayer
                streams={event.streams}
                legacyStream={event.stream}
                title="Preview repetición"
              />
            )}

            {/* LIVE / REPLAY sin video configurado */}
            {((localStatus === "live" && !livePlaybackUrl) ||
              (localStatus === "replay" && !hasStream)) && (
              <Center
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: 24,
                  backgroundColor: "#ffffff",
                }}
              >
                <Stack align="center" gap="xs" maw={420} ta="center">
                  <Text fw={700} size="lg">
                    {localStatus === "live"
                      ? "El estudio no tiene URL de reproducción"
                      : "No hay fuentes de repetición"}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {localStatus === "live"
                      ? "Los asistentes verán «Cargando transmisión…». Configúrala en el estudio (Configuración del Live)."
                      : "Los asistentes no verán video. Agrega una fuente o activa una grabación."}
                  </Text>
                  {localStatus === "live" ? (
                    <Button component={Link} to={studioPath} size="xs" variant="light">
                      Ir al estudio
                    </Button>
                  ) : (
                    <Button size="xs" variant="light" onClick={() => setStreamOpen(true)}>
                      Configurar fuentes
                    </Button>
                  )}
                </Stack>
              </Center>
            )}

            {/* UPCOMING */}
            {localStatus === "upcoming" && (
              <Center
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: 24,
                  backgroundColor: "#ffffff",
                }}
              >
                <Stack align="center" gap="xs" maw={420} ta="center">
                  <Text fw={800} size="lg">
                    🕒 El evento comenzará pronto
                  </Text>
                  <Text size="sm" c="dimmed">
                    Los asistentes verán una pantalla de espera hasta que lo
                    pongas <strong>En vivo</strong>.
                  </Text>
                </Stack>
              </Center>
            )}

            {/* ENDED */}
            {localStatus === "ended" && (
              <Center
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: 24,
                  backgroundColor: "#ffffff",
                }}
              >
                <Stack align="center" gap="xs" maw={420} ta="center">
                  <Box
                    style={{
                      padding: "4px 12px",
                      borderRadius: 999,
                      border: "1px solid var(--mantine-color-gray-3)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontWeight: 600,
                    }}
                  >
                    Evento finalizado
                  </Box>
                  <Text fw={800} size="lg">
                    📝 Gracias por asistir
                  </Text>
                  <Text size="sm" c="dimmed">
                    No se muestra transmisión. Puedes cambiar a{" "}
                    <strong>Repetición</strong> para usar una grabación.
                  </Text>
                </Stack>
              </Center>
            )}
          </Box>
        </Box>

        {/* De dónde sale el video que ve el asistente en este estado */}
        {localStatus === "live" && (
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Text size="xs" c="dimmed" truncate>
              Fuente en vivo:{" "}
              <b>{providerInfo(liveProvider)?.label ?? liveProvider ?? "—"}</b>
              {livePlaybackUrl ? ` · ${livePlaybackUrl}` : " · sin URL"}
            </Text>
            <Button component={Link} to={studioPath} size="compact-xs" variant="subtle">
              Estudio
            </Button>
          </Group>
        )}
        {localStatus === "replay" && hasStream && (
          <Text size="xs" c="dimmed" truncate>
            Fuente principal:{" "}
            <b>{providerInfo(streamList[0].provider)?.label ?? streamList[0].provider}</b>
            {streamList.length > 1 && ` (+${streamList.length - 1} de respaldo)`}
          </Text>
        )}
      </Stack>
    </Card>
  );

  return (
    <Stack gap="lg">
      {/* Encabezado + estado: la acción principal de la página */}
      <Card withBorder radius="lg" p="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <div style={{ minWidth: 0 }}>
            <Title order={2}>Control del evento</Title>
            <Text c="dimmed" size="sm" truncate>
              {event.title}
            </Text>
          </div>

          <Stack gap={6} style={{ flex: "1 1 360px", maxWidth: 560 }}>
            <Group justify="space-between" align="center">
              <Text fw={600} size="sm">
                Estado del evento
              </Text>
              {statusLoading && (
                <Group gap={6}>
                  <Loader size="xs" />
                  <Text size="xs" c="dimmed">
                    Guardando...
                  </Text>
                </Group>
              )}
            </Group>
            <SegmentedControl
              fullWidth
              orientation={narrow ? "vertical" : "horizontal"}
              value={localStatus}
              onChange={(value) =>
                void handleStatusChange(value as EventItem["status"])
              }
              disabled={statusLoading}
              color={getStatusColor(localStatus)}
              data={STATUS_OPTIONS}
            />
            <Text size="xs" c="dimmed">
              {getStatusHelperText(localStatus)}
            </Text>
            {statusError && (
              <Alert color="red" variant="light">
                {statusError}
              </Alert>
            )}
          </Stack>
        </Group>

        {emergency.active && (
          <Alert variant="light" color="orange" mt="sm" p="xs">
            <Text size="sm">
              🆘 <b>Modo emergencia activo:</b> los asistentes ven solo
              transmisión + chat. Se desactiva en la pestaña Diagnóstico.
            </Text>
          </Alert>
        )}
      </Card>

      <Grid gutter="lg">
        {/* Izquierda: lo que ve el asistente */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          {renderAudiencePreview()}
        </Grid.Col>

        {/* Derecha: ajustes agrupados por tema */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Tabs value={tab} onChange={changeTab} radius="md">
            <Tabs.List grow mb="md">
              <Tabs.Tab value="video" leftSection={<IconVideo size={14} />}>
                Video
              </Tabs.Tab>
              <Tabs.Tab value="audience" leftSection={<IconUsers size={14} />}>
                Asistentes
              </Tabs.Tab>
              <Tabs.Tab
                value="diagnostics"
                leftSection={<IconStethoscope size={14} />}
                rightSection={
                  emergency.active ? (
                    <Badge size="xs" circle color="orange">
                      !
                    </Badge>
                  ) : undefined
                }
              >
                Diagnóstico
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="video">
              <Stack gap="lg">
                {/* Configuración de transmisión */}
                <Card withBorder radius="lg" p="lg">
                  <Stack gap="md">
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <div>
                        <Title order={3}>Fuentes de video</Title>
                        <Text size="xs" c="dimmed">
                          Lo que se ve en repetición, en orden: ★ es la
                          principal y, si falla, pasa a la siguiente.
                        </Text>
                      </div>
                      <Button
                        onClick={() => setStreamOpen(true)}
                        size="xs"
                        style={{ flexShrink: 0 }}
                      >
                        Configurar
                      </Button>
                    </Group>
                    <Text size="xs" c="dimmed">
                      En vivo se usa la URL del estudio. Ojo: antes de que el
                      evento termine, si la primera fuente es Vimeo, Cloudflare
                      o Bunny, al guardar también se copia al estudio.
                    </Text>

                    {streamList.length > 0 ? (
                      <Alert variant="light" color="green">
                        <Text size="sm" fw={500}>
                          ✅ Stream configurado ({streamList.length}{" "}
                          {streamList.length === 1 ? "fuente" : "fuentes"})
                        </Text>
                        <Stack gap={4} mt={4}>
                          {streamList.map((s, i) => (
                            <Text size="xs" key={i}>
                              {i === 0 && streamList.length > 1 ? "★ " : ""}
                              {providerInfo(s.provider)?.label ?? s.provider}:{" "}
                              <a href={s.url} target="_blank" rel="noopener noreferrer">
                                {s.url}
                              </a>
                            </Text>
                          ))}
                        </Stack>
                      </Alert>
                    ) : (
                      <Alert variant="light" color="blue">
                        <Text size="sm" fw={500}>
                          ℹ️ No hay stream configurado
                        </Text>
                        <Text size="xs" mt={4}>
                          Configura una URL antes de poner el evento en vivo o en
                          repetición.
                        </Text>
                      </Alert>
                    )}
                  </Stack>
                </Card>

                {/* Repetición: grabaciones del proveedor del estudio */}
                <Card withBorder radius="lg" p="lg">
                  <Stack gap="md">
                    <Group justify="space-between" align="center">
                      <div>
                        <Group gap={6}>
                          <Title order={3}>Repetición</Title>
                          {liveProvider && (
                            <Badge variant="light" color={providerInfo(liveProvider)?.color ?? "gray"}>
                              {providerInfo(liveProvider)?.label ?? liveProvider}
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          {providerInfo(liveProvider)?.replay ??
                            "Configura el proveedor en el estudio para saber cómo se arma la repetición."}
                        </Text>
                      </div>
                      {hasRecordings && (
                        <Button
                          onClick={handleRefreshAssets}
                          loading={assetsLoading}
                          variant="subtle"
                          size="xs"
                          leftSection={<IconRefresh size={14} />}
                        >
                          Actualizar
                        </Button>
                      )}
                    </Group>

                    {/* Lista de grabaciones (solo Mux y Cloudflare las exponen) */}
                    {hasRecordings && (
                    <>
                    {assetsLoading ? (
                      <Center py="md">
                        <Loader size="sm" />
                      </Center>
                    ) : assets.length === 0 ? (
                      <Alert variant="light" color="gray">
                        <Text size="sm">
                          {assetsError ??
                            "No hay grabaciones disponibles. Transmite al menos una vez para generar una grabación."}
                        </Text>
                      </Alert>
                    ) : (
                      <Stack gap="xs">
                        <Text size="sm" fw={500}>
                          Grabaciones disponibles ({assets.length}):
                        </Text>
                        {assets.map((asset, index) => {
                          const isSelected = selectedAssetId === asset.id;
                          const durationMin = asset.duration
                            ? Math.round(asset.duration / 60)
                            : null;
                          const createdDate = asset.createdAt
                            ? new Date(asset.createdAt).toLocaleString("es-CO", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Fecha desconocida";

                          return (
                            <Box
                              key={asset.id}
                              onClick={() => setSelectedAssetId(asset.id)}
                              style={{
                                padding: "10px 12px",
                                borderRadius: 8,
                                border: isSelected
                                  ? "2px solid var(--mantine-color-blue-5)"
                                  : "1px solid var(--mantine-color-gray-3)",
                                backgroundColor: isSelected
                                  ? "var(--mantine-color-blue-0)"
                                  : "transparent",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <Group justify="space-between" wrap="nowrap">
                                <Group gap="sm" wrap="nowrap">
                                  <IconVideo
                                    size={18}
                                    color={
                                      isSelected
                                        ? "var(--mantine-color-blue-5)"
                                        : "var(--mantine-color-gray-5)"
                                    }
                                  />
                                  <div>
                                    <Text size="sm" fw={isSelected ? 600 : 400}>
                                      Grabación #{index + 1}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      {createdDate}
                                      {durationMin !== null && ` • ${durationMin} min`}
                                    </Text>
                                  </div>
                                </Group>
                                <Badge
                                  size="xs"
                                  color={
                                    asset.status === "ready"
                                      ? "green"
                                      : asset.status === "preparing"
                                      ? "yellow"
                                      : "gray"
                                  }
                                  variant="light"
                                >
                                  {asset.status === "ready"
                                    ? "Lista"
                                    : asset.status === "preparing"
                                    ? "Procesando"
                                    : asset.status}
                                </Badge>
                              </Group>
                            </Box>
                          );
                        })}
                      </Stack>
                    )}

                    {replayStatus === "preparing" && (
                      <Alert variant="light" color="yellow">
                        <Text size="sm" fw={500}>
                          ⏳ Procesando
                        </Text>
                        <Text size="xs" mt={4}>
                          La grabación se está procesando. Intenta de nuevo en unos
                          minutos.
                        </Text>
                      </Alert>
                    )}

                    {replayStatus === "ready" && (
                      <Alert variant="light" color="green">
                        <Text size="sm" fw={500}>
                          ✅ Repetición configurada
                        </Text>
                        <Text size="xs" mt={4}>
                          La grabación seleccionada se ha configurado correctamente.
                        </Text>
                      </Alert>
                    )}

                    <Button
                      onClick={handleEnableReplay}
                      loading={replayLoading}
                      disabled={!selectedAssetId || assets.length === 0}
                      size="sm"
                      leftSection={<IconPlayerPlay size={16} />}
                    >
                      Activar repetición
                    </Button>
                    </>
                    )}
                  </Stack>
                </Card>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="audience">
              <Stack gap="lg">
                {/* Interruptores de la página del asistente */}
                <Card withBorder radius="lg" p="lg">
                  <Stack gap="md">
                    <Title order={3}>Opciones para el asistente</Title>

                    <Group justify="space-between" align="center" wrap="nowrap">
                      <div>
                        <Text fw={600} size="sm">
                          🎙️ Solicitar unirse al estudio
                        </Text>
                        <Text size="xs" c="dimmed">
                          Botón durante el vivo. Apagado, nadie puede enviar
                          solicitudes. Se aplica en unos segundos.
                        </Text>
                      </div>
                      <Switch
                        checked={!!joinRequestsEnabled}
                        onChange={(e) =>
                          void handleToggleJoinRequests(e.currentTarget.checked)
                        }
                        disabled={joinToggling || joinRequestsEnabled === null}
                      />
                    </Group>

                    <Divider />

                    <Group justify="space-between" align="center" wrap="nowrap">
                      <div>
                        <Text fw={600} size="sm">
                          🎓 Certificados de asistencia
                        </Text>
                        <Text size="xs" c="dimmed">
                          Sección para descargar el certificado. Solo para
                          quienes vieron el vivo (reproducción real).
                        </Text>
                      </div>
                      <Switch
                        checked={!!event.certificatesConfig?.enabled}
                        onChange={(e) =>
                          void handleToggleCertificates(e.currentTarget.checked)
                        }
                        disabled={certificatesToggling}
                        color="teal"
                      />
                    </Group>
                    {event.certificatesConfig?.enabled &&
                      (event.status === "live" ||
                        event.status === "ended" ||
                        event.status === "replay") && (
                        <Group justify="flex-end">
                          <Button
                            variant="light"
                            size="xs"
                            leftSection={<IconRefresh size={14} />}
                            loading={certificatesBackfilling}
                            onClick={() => void handleBackfillCertificates()}
                          >
                            Sincronizar asistentes con certificados
                          </Button>
                        </Group>
                      )}
                  </Stack>
                </Card>

                {/* Anuncios de manada sobre el video del asistente */}
                <HerdAnnouncementsCard
                  event={event}
                  orgSlug={orgSlug}
                  formFields={formFields}
                  onEventUpdate={onEventUpdate}
                />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="diagnostics">
              <Stack gap="lg">
                {/* Asistentes cuya red bloquea el video (firewall, inspección SSL…) */}
                <NetworkBlocksCard eventId={event._id} />

                {/* Modo emergencia: fallback ante Mongo lento/caído */}
                <Card withBorder radius="lg" p="lg">
                  <Stack gap="sm">
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <div>
                        <Title order={3}>🆘 Modo emergencia</Title>
                        <Text size="xs" c="dimmed">
                          Reduce la página de asistencia a solo transmisión + chat,
                          sin depender de Mongo. Invisible para el asistente.
                        </Text>
                      </div>
                      <Switch
                        checked={emergency.active}
                        onChange={(e) =>
                          void handleToggleEmergency(e.currentTarget.checked)
                        }
                        disabled={emergencyToggling}
                        color="orange"
                      />
                    </Group>

                    {emergency.active && (
                      <Alert variant="light" color="orange">
                        <Text size="sm" fw={500}>
                          🆘 Modo emergencia activo
                        </Text>
                        <Text size="xs" mt={4}>
                          Los asistentes están viendo la versión reducida
                          (transmisión + chat en caché). Actívalo solo si Mongo
                          está lento o caído.
                        </Text>
                      </Alert>
                    )}
                  </Stack>
                </Card>

              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Grid.Col>
      </Grid>

      {/* Modal para configurar stream */}
      <Modal
        opened={streamOpen}
        onClose={() => setStreamOpen(false)}
        title="Configurar transmisión"
        centered
      >
        <EventStreamForm
          eventId={event._id}
          initialStreams={streamList}
          onSaved={(updated) => {
            setStreamOpen(false);
            if (updated) onEventUpdate(updated);
          }}
        />
      </Modal>
    </Stack>
  );
}
