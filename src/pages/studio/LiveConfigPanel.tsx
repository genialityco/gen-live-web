/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import {
  Accordion,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Divider,
  NumberInput,
  Box,
  Alert,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import {
  getLiveConfig,
  updateLiveConfig,
  getPlayback,
  provisionStream,
  type StreamProvider,
} from "../../api/livekit-service";
import { IconAlertCircle, IconCloud } from "@tabler/icons-react";

type Props = {
  eventSlug: string;
  disabled?: boolean;
  defaultOpened?: boolean;
};

const PROVIDER_LABELS: Record<string, string> = {
  vimeo: "Vimeo",
  mux: "Mux",
  gcore: "Gcore",
  cloudflare: "Cloudflare",
  bunny: "Bunny",
};

const PROVIDER_COLORS: Record<string, string> = {
  vimeo: "blue",
  mux: "orange",
  gcore: "teal",
  cloudflare: "grape",
  bunny: "yellow",
};

/**
 * RTMP server por defecto de cada proveedor seleccionable en el estudio.
 * El stream key sigue siendo manual (es específico de cada evento).
 */
const RTMP_SERVER_BY_PROVIDER: Record<string, string> = {
  vimeo: "rtmp://rtmp-global.cloud.vimeo.com/live",
  cloudflare: "rtmps://live.cloudflare.com:443/live",
  bunny: "rtmp://global.rtmp.mediadelivery.net/live",
};

/**
 * SRT ingest por defecto de los proveedores que lo soportan. Un proveedor
 * que no aparece acá (ej. Vimeo) no ofrece SRT, así que no se muestra el
 * toggle de protocolo para él y queda fijo en RTMP.
 */
const SRT_SERVER_BY_PROVIDER: Record<string, string> = {
  cloudflare: "srt://live.cloudflare.com:778",
};

const PROVIDER_SELECT_OPTIONS = [
  { value: "vimeo", label: "Vimeo" },
  { value: "cloudflare", label: "Cloudflare" },
  { value: "bunny", label: "Bunny" },
];

export const LiveConfigPanel: React.FC<Props> = ({
  eventSlug,
  disabled,
  defaultOpened = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<StreamProvider>("vimeo");
  const [providerStreamId, setProviderStreamId] = useState("");

  const form = useForm({
    initialValues: {
      ingestProtocol: "rtmp" as "rtmp" | "srt",
      rtmpServerUrl: "",
      rtmpStreamKey: "",
      srtIngestUrl: "",
      playbackHlsUrl: "",
      maxParticipants: 20,
    },
    validate: {
      rtmpServerUrl: (v, values) =>
        values.ingestProtocol === "rtmp" && !v ? "RTMP server requerido" : null,

      rtmpStreamKey: (v, values) => {
        if (values.ingestProtocol !== "rtmp") return null;
        if (!v) return "Stream key requerida";
        if (v === "****") return null;
        return null;
      },

      srtIngestUrl: (v, values) => {
        if (values.ingestProtocol !== "srt") return null;
        if (!v) return "SRT ingest URL requerida";
        if (v === "****") return null;
        return null;
      },

      playbackHlsUrl: (v) => (!v ? "Playback URL requerida" : null),
    },
  });

  const ingestProtocol = form.values.ingestProtocol;

  const loadConfig = async () => {
    setLoading(true);
    try {
      const cfg = await getLiveConfig(eventSlug);
      form.setValues({
        ingestProtocol: cfg.ingestProtocol ?? "rtmp",
        rtmpServerUrl: cfg.rtmpServerUrl ?? "",
        rtmpStreamKey: cfg.rtmpStreamKey ?? "",
        srtIngestUrl: cfg.srtIngestUrl ?? "",
        playbackHlsUrl: cfg.playbackHlsUrl ?? "",
        maxParticipants: cfg.maxParticipants ?? 20,
      });
      if (cfg.provider) setCurrentProvider(cfg.provider);
      setProviderStreamId(cfg.providerStreamId ?? "");
    } catch (e: any) {
      showNotification({
        color: "red",
        icon: <IconAlertCircle />,
        title: "No se pudo cargar config",
        message: e?.normalizedMessage || e.message || "Error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug]);

  const handleProviderChange = (value: string | null) => {
    if (!value) return;
    setCurrentProvider(value as StreamProvider);
    // Cambiar de proveedor siempre vuelve a RTMP por defecto; si el nuevo
    // proveedor también soporta SRT, el host puede cambiar el protocolo con
    // el toggle de abajo.
    form.setFieldValue("ingestProtocol", "rtmp");
    const rtmpServerUrl = RTMP_SERVER_BY_PROVIDER[value];
    if (rtmpServerUrl) {
      form.setFieldValue("rtmpServerUrl", rtmpServerUrl);
    }
  };

  const handleIngestProtocolChange = (value: string) => {
    const protocol = value as "rtmp" | "srt";
    form.setFieldValue("ingestProtocol", protocol);
    if (protocol === "srt") {
      const srtServerUrl = SRT_SERVER_BY_PROVIDER[currentProvider];
      if (srtServerUrl) form.setFieldValue("srtIngestUrl", srtServerUrl);
    } else {
      const rtmpServerUrl = RTMP_SERVER_BY_PROVIDER[currentProvider];
      if (rtmpServerUrl) form.setFieldValue("rtmpServerUrl", rtmpServerUrl);
    }
  };

  const onSave = form.onSubmit(async (values) => {
    setSaving(true);
    try {
      const payload: any = { eventSlug, provider: currentProvider, ...values };
      if (payload.rtmpStreamKey === "****") delete payload.rtmpStreamKey;
      if (payload.srtIngestUrl === "****") delete payload.srtIngestUrl;

      await updateLiveConfig(payload);

      showNotification({
        color: "green",
        title: "Guardado",
        message: "Configuración del live actualizada",
      });
      // Recargar para reflejar provider detectado automáticamente por el backend
      await loadConfig();
    } catch (e: any) {
      showNotification({
        color: "red",
        icon: <IconAlertCircle />,
        title: "Error guardando",
        message: e?.normalizedMessage || e.message || "Error",
      });
    } finally {
      setSaving(false);
    }
  });

  const handleAutoFillFromCurrentPlayback = async () => {
    try {
      const { playbackUrl } = await getPlayback(eventSlug);
      form.setFieldValue("playbackHlsUrl", playbackUrl);
      showNotification({
        color: "green",
        title: "Listo",
        message: "Playback URL cargada",
      });
    } catch (e: any) {
      showNotification({
        color: "red",
        icon: <IconAlertCircle />,
        title: "No se pudo cargar playback",
        message: e?.normalizedMessage || e.message || "Error",
      });
    }
  };

  const handleProvisionMux = async () => {
    setProvisioning(true);
    try {
      await provisionStream(eventSlug, "mux");
      showNotification({
        color: "green",
        title: "Provisionado con Mux",
        message: "Credenciales RTMP y URL de playback listas.",
      });
      await loadConfig();
    } catch (e: any) {
      showNotification({
        color: "red",
        icon: <IconAlertCircle />,
        title: "Error al provisionar Mux",
        message:
          e?.response?.data?.message ||
          e?.normalizedMessage ||
          e.message ||
          "Error",
      });
    } finally {
      setProvisioning(false);
    }
  };

  if (loading) {
    return (
      <Paper p="sm" radius="md" withBorder>
        <Group justify="space-between">
          <Text fw={500}>Configuración</Text>
          <Loader size="sm" />
        </Group>
      </Paper>
    );
  }

  return (
    <Paper p="sm" radius="md" withBorder>
      <Accordion
        variant="contained"
        defaultValue={defaultOpened ? "live-config" : null}
      >
        <Accordion.Item value="live-config">
          <Accordion.Control>
            <Group justify="space-between" w="100%" wrap="nowrap">
              <Box style={{ minWidth: 0 }}>
                <Text fw={600} truncate>
                  Configuración del Live
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  RTMP/SRT · Playback · Límites
                </Text>
              </Box>
              <Group gap="xs" style={{ whiteSpace: "nowrap" }}>
                <Badge
                  variant="light"
                  color={PROVIDER_COLORS[currentProvider] ?? "gray"}
                >
                  {PROVIDER_LABELS[currentProvider] ?? currentProvider}
                </Badge>
                <Badge variant="light">{eventSlug}</Badge>
              </Group>
            </Group>
          </Accordion.Control>

          <Accordion.Panel>
            <Stack gap="sm" pt="xs">

              <Select
                disabled={disabled}
                label="Proveedor de Live"
                description="Selecciona el destino del RTMP. Precarga el RTMP Server; el Stream Key sigue siendo manual."
                data={PROVIDER_SELECT_OPTIONS}
                value={
                  PROVIDER_SELECT_OPTIONS.some((o) => o.value === currentProvider)
                    ? currentProvider
                    : null
                }
                onChange={handleProviderChange}
              />

              <Divider />

              {/* Provisionar con Mux */}
              <Box>
                <Text size="sm" fw={500} mb={4}>
                  Auto-provisionar con Mux
                </Text>
                <Button
                  variant="filled"
                  color="orange"
                  leftSection={<IconCloud size={14} />}
                  loading={provisioning}
                  disabled={disabled}
                  onClick={handleProvisionMux}
                  size="sm"
                >
                  {currentProvider === "mux" && providerStreamId
                    ? "Re-provisionar con Mux"
                    : "Provisionar con Mux"}
                </Button>

                {currentProvider === "mux" && providerStreamId && (
                  <Alert
                    mt="xs"
                    variant="light"
                    color="orange"
                    icon={<IconAlertCircle size={14} />}
                  >
                    <Text size="xs">
                      Ya provisionado con Mux. "Re-provisionar" creará un nuevo
                      live stream y reemplazará las credenciales actuales.
                    </Text>
                  </Alert>
                )}

                {currentProvider === "vimeo" && (
                  <Alert
                    mt="xs"
                    variant="light"
                    color="blue"
                    icon={<IconAlertCircle size={14} />}
                  >
                    <Text size="xs">
                      Proveedor: <strong>Vimeo</strong>. El RTMP Server ya está
                      precargado; solo falta el Stream Key (de tu evento en
                      Vimeo Live) y la URL embed del video
                      (<code>https://player.vimeo.com/video/...</code>) como
                      Playback URL.
                    </Text>
                  </Alert>
                )}

                {currentProvider === "cloudflare" && (
                  <Alert
                    mt="xs"
                    variant="light"
                    color="grape"
                    icon={<IconAlertCircle size={14} />}
                  >
                    <Text size="xs">
                      Proveedor: <strong>Cloudflare</strong>. Soporta RTMP o
                      SRT (elegí el protocolo abajo) — el server ya está
                      precargado; solo falta el Stream Key / streamid (del
                      Live Input en Cloudflare Stream) y la URL de playback
                      (<code>https://customer-xxx.cloudflarestream.com/.../manifest/video.m3u8</code>).
                    </Text>
                  </Alert>
                )}

                {currentProvider === "bunny" && (
                  <Alert
                    mt="xs"
                    variant="light"
                    color="yellow"
                    icon={<IconAlertCircle size={14} />}
                  >
                    <Text size="xs">
                      Proveedor: <strong>Bunny</strong>. El RTMP Server ya
                      está precargado; solo falta el Stream Key (de tu Live
                      Stream en Bunny Stream) y la URL de playback (el
                      manifest HLS que te da Bunny para ese live, ej.
                      <code> https://vz-xxx.b-cdn.net/{"{videoId}"}/playlist.m3u8</code>).
                    </Text>
                  </Alert>
                )}
              </Box>

              <Divider />

              {SRT_SERVER_BY_PROVIDER[currentProvider] && (
                <SegmentedControl
                  disabled={disabled}
                  fullWidth
                  data={[
                    { label: "RTMP", value: "rtmp" },
                    { label: "SRT", value: "srt" },
                  ]}
                  value={ingestProtocol}
                  onChange={handleIngestProtocolChange}
                />
              )}

              {ingestProtocol === "rtmp" ? (
                <>
                  <TextInput
                    disabled={disabled}
                    label="RTMP Server"
                    placeholder="rtmp://global-live.mux.com:5222/app"
                    {...form.getInputProps("rtmpServerUrl")}
                  />
                  <TextInput
                    disabled={disabled}
                    label="RTMP Stream Key"
                    placeholder="stream_key..."
                    {...form.getInputProps("rtmpStreamKey")}
                  />
                </>
              ) : (
                <TextInput
                  disabled={disabled}
                  label="SRT Ingest URL"
                  placeholder="srt://live.cloudflare.com:778?streamid=..."
                  description="El server ya está precargado; agregale el streamid/passphrase del Live Input (va todo en una sola URL, a diferencia de RTMP que separa server y key)."
                  {...form.getInputProps("srtIngestUrl")}
                />
              )}

              <Divider />

              <TextInput
                disabled={disabled}
                label="Playback URL"
                placeholder="https://stream.mux.com/xxx.m3u8 o https://player.vimeo.com/video/..."
                description="HLS .m3u8 (Mux) → player nativo. Vimeo embed URL → iframe en el viewer."
                {...form.getInputProps("playbackHlsUrl")}
              />

              <Group grow>
                <NumberInput
                  disabled={disabled}
                  label="Max participantes"
                  min={1}
                  {...form.getInputProps("maxParticipants")}
                />
              </Group>

              <form onSubmit={onSave}>
                <Group justify="space-between">
                  <Button
                    variant="default"
                    disabled={disabled}
                    onClick={handleAutoFillFromCurrentPlayback}
                  >
                    Usar playback actual
                  </Button>

                  <Button loading={saving} type="submit" disabled={disabled}>
                    Guardar
                  </Button>
                </Group>
              </form>

              <Text size="xs" c="dimmed">
                La RTMP Stream Key y la SRT Ingest URL se muestran en texto
                plano para poder verificarlas.
              </Text>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Paper>
  );
};
