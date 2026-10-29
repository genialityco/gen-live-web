/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  Alert,
  Badge,
  Box,
  Button,
  Group,
  List,
  Loader,
  NumberInput,
  Paper,
  Radio,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconCheck,
  IconCloud,
  IconInfoCircle,
  IconX,
} from "@tabler/icons-react";
import {
  getLiveConfig,
  updateLiveConfig,
  provisionStream,
  type LiveConfig,
  type StreamProvider,
} from "../../api/livekit-service";
import {
  STREAM_PROVIDERS,
  normalizePlaybackUrl,
  providerInfo,
  viewerPlayerFor,
} from "./streamProviders";

type Props = {
  eventSlug: string;
  disabled?: boolean;
  defaultOpened?: boolean;
};

type Values = {
  ingestProtocol: "rtmp" | "srt";
  rtmpServerUrl: string;
  rtmpStreamKey: string;
  srtIngestUrl: string;
  playbackHlsUrl: string;
  maxParticipants: number;
};

const valuesFrom = (cfg: LiveConfig | null): Values => ({
  ingestProtocol: cfg?.ingestProtocol ?? "rtmp",
  rtmpServerUrl: cfg?.rtmpServerUrl ?? "",
  rtmpStreamKey: cfg?.rtmpStreamKey ?? "",
  srtIngestUrl: cfg?.srtIngestUrl ?? "",
  playbackHlsUrl: cfg?.playbackHlsUrl ?? "",
  maxParticipants: cfg?.maxParticipants ?? 20,
});

/** ¿La config guardada tiene todo para transmitir? */
function readiness(cfg: LiveConfig | null) {
  const ingest =
    cfg?.ingestProtocol === "srt"
      ? !!cfg?.srtIngestUrl
      : !!cfg?.rtmpServerUrl && !!cfg?.rtmpStreamKey;
  const playback = !!cfg?.playbackHlsUrl;
  return { ingest, playback, ready: ingest && playback };
}

function StepTitle({ n, title, done }: { n: number; title: string; done?: boolean }) {
  return (
    <Group gap={8} wrap="nowrap">
      <ThemeIcon size={22} radius="xl" color={done ? "teal" : "gray"} variant={done ? "filled" : "light"}>
        {done ? <IconCheck size={14} /> : <Text size="xs" fw={700}>{n}</Text>}
      </ThemeIcon>
      <Text fw={600} size="sm">{title}</Text>
    </Group>
  );
}

/**
 * Configuración de salida del estudio, en pasos: 1) proveedor, 2) clave de
 * ingesta (a donde el estudio u OBS envían la señal), 3) URL de
 * reproducción (lo que ve el asistente; él nunca elige proveedor) y
 * 4) cómo queda la repetición con ese proveedor.
 */
export const LiveConfigPanel: React.FC<Props> = ({
  eventSlug,
  disabled,
  defaultOpened = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [saved, setSaved] = useState<LiveConfig | null>(null);
  const [provider, setProvider] = useState<StreamProvider>("vimeo");
  const [values, setValues] = useState<Values>(valuesFrom(null));
  const [error, setError] = useState<string | null>(null);

  const info = providerInfo(provider);
  const set = <K extends keyof Values>(k: K, v: Values[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const loadConfig = async () => {
    setLoading(true);
    try {
      const cfg = await getLiveConfig(eventSlug);
      setSaved(cfg);
      setProvider(cfg.provider ?? "vimeo");
      setValues(valuesFrom(cfg));
      setError(null);
    } catch (e: any) {
      showNotification({
        color: "red",
        icon: <IconAlertCircle />,
        title: "No se pudo cargar la configuración",
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

  // Cambiar de proveedor: si vuelve al guardado, recupera sus valores; si
  // no, precarga el servidor del nuevo proveedor y limpia clave y URL (son
  // de otro proveedor y no servirían).
  const handleProviderChange = (value: string) => {
    const next = value as StreamProvider;
    setProvider(next);
    setError(null);
    if (saved && next === saved.provider) {
      setValues(valuesFrom(saved));
      return;
    }
    setValues((prev) => ({
      ...prev,
      ingestProtocol: "rtmp",
      rtmpServerUrl: providerInfo(next)?.rtmpServer ?? "",
      rtmpStreamKey: "",
      srtIngestUrl: "",
      playbackHlsUrl: "",
    }));
  };

  const handleIngestProtocolChange = (value: string) => {
    const protocol = value as "rtmp" | "srt";
    setValues((prev) => ({
      ...prev,
      ingestProtocol: protocol,
      ...(protocol === "srt" && !prev.srtIngestUrl && info?.srtServer
        ? { srtIngestUrl: info.srtServer }
        : {}),
      ...(protocol === "rtmp" && !prev.rtmpServerUrl && info?.rtmpServer
        ? { rtmpServerUrl: info.rtmpServer }
        : {}),
    }));
  };

  const validate = (): string | null => {
    if (info?.setup === "auto") {
      if (!values.rtmpServerUrl || !values.rtmpStreamKey || !values.playbackHlsUrl)
        return "Primero crea la transmisión en Mux (paso 2).";
      return null;
    }
    if (values.ingestProtocol === "rtmp") {
      if (!values.rtmpServerUrl) return "Falta el servidor RTMP (paso 2).";
      if (!values.rtmpStreamKey) return "Falta la Stream key (paso 2).";
    } else if (!values.srtIngestUrl) {
      return "Falta la URL SRT (paso 2).";
    }
    if (!values.playbackHlsUrl) return "Falta la URL de reproducción (paso 3).";
    return null;
  };

  const onSave = async () => {
    const msg = validate();
    setError(msg);
    if (msg) return;
    setSaving(true);
    try {
      await updateLiveConfig({
        eventSlug,
        provider,
        ...values,
        playbackHlsUrl: normalizePlaybackUrl(provider, values.playbackHlsUrl),
      });
      showNotification({
        color: "green",
        title: "Guardado",
        message: "Los asistentes verán la nueva URL de reproducción en unos segundos.",
      });
      await loadConfig();
    } catch (e: any) {
      showNotification({
        color: "red",
        icon: <IconAlertCircle />,
        title: "Error guardando",
        message: e?.response?.data?.message || e?.normalizedMessage || e.message || "Error",
      });
    } finally {
      setSaving(false);
    }
  };

  const muxProvisioned = saved?.provider === "mux" && !!saved?.providerStreamId;

  const handleProvisionMux = async () => {
    if (
      muxProvisioned &&
      !window.confirm(
        "Se creará una transmisión NUEVA en Mux y cambiarán la clave y la URL de reproducción. " +
          "Si ya estás transmitiendo, la señal se corta. ¿Continuar?",
      )
    ) {
      return;
    }
    setProvisioning(true);
    try {
      await provisionStream(eventSlug, "mux");
      showNotification({
        color: "green",
        title: "Transmisión creada en Mux",
        message: "Servidor, clave y URL de reproducción listos.",
      });
      await loadConfig();
    } catch (e: any) {
      showNotification({
        color: "red",
        icon: <IconAlertCircle />,
        title: "No se pudo crear la transmisión en Mux",
        message:
          e?.response?.data?.message || e?.normalizedMessage || e.message || "Error",
      });
    } finally {
      setProvisioning(false);
    }
  };

  const savedState = readiness(saved);
  const dirty = useMemo(() => {
    if (!saved) return false;
    const base = valuesFrom(saved);
    return (
      provider !== saved.provider ||
      (Object.keys(base) as Array<keyof Values>).some((k) => base[k] !== values[k])
    );
  }, [saved, provider, values]);

  if (loading) {
    return (
      <Paper p="sm" radius="md" withBorder>
        <Group justify="space-between">
          <Text fw={500}>Configuración del Live</Text>
          <Loader size="sm" />
        </Group>
      </Paper>
    );
  }

  const isAuto = info?.setup === "auto";
  const playbackUrl = values.playbackHlsUrl.trim();
  const player = playbackUrl ? viewerPlayerFor(playbackUrl) : null;
  const playbackLooksWrong = !!playbackUrl && !!info && !info.playbackOk.test(playbackUrl);

  return (
    <Paper p="sm" radius="md" withBorder>
      <Accordion variant="contained" defaultValue={defaultOpened ? "live-config" : null}>
        <Accordion.Item value="live-config">
          <Accordion.Control>
            <Group justify="space-between" w="100%" wrap="nowrap">
              <Box style={{ minWidth: 0 }}>
                <Text fw={600} truncate>Configuración del Live</Text>
                <Text size="xs" c="dimmed" truncate>
                  Proveedor · Clave · Reproducción · Repetición
                </Text>
              </Box>
              <Group gap={6} style={{ whiteSpace: "nowrap" }}>
                <Badge variant="light" color={providerInfo(saved?.provider)?.color ?? "gray"}>
                  {providerInfo(saved?.provider)?.label ?? saved?.provider ?? "—"}
                </Badge>
                <Badge variant="light" color={savedState.ready ? "teal" : "orange"}>
                  {savedState.ready ? "Listo" : "Incompleto"}
                </Badge>
              </Group>
            </Group>
          </Accordion.Control>

          <Accordion.Panel>
            <Stack gap="md" pt="xs">
              {/* Paso 1 */}
              <Stack gap={6}>
                <StepTitle n={1} title="Proveedor de transmisión" done={!!saved?.provider} />
                <Radio.Group value={provider} onChange={handleProviderChange}>
                  <Stack gap={6}>
                    {STREAM_PROVIDERS.map((p) => (
                      <Radio.Card key={p.id} value={p.id} disabled={disabled} radius="md" p="xs">
                        <Group wrap="nowrap" align="flex-start" gap="xs">
                          <Radio.Indicator size="sm" mt={2} />
                          <Box style={{ minWidth: 0 }}>
                            <Group gap={6}>
                              <Text size="sm" fw={600}>{p.label}</Text>
                              <Badge size="xs" variant="light" color={p.setup === "auto" ? "teal" : "gray"}>
                                {p.setup === "auto" ? "Se crea automáticamente" : "Credenciales manuales"}
                              </Badge>
                            </Group>
                            <Text size="xs" c="dimmed">
                              Repetición:{" "}
                              {p.replayMode === "auto"
                                ? "automática"
                                : p.replayMode === "recordings"
                                  ? "eliges la grabación en Control del evento"
                                  : "pegas la URL a mano"}
                            </Text>
                          </Box>
                        </Group>
                      </Radio.Card>
                    ))}
                  </Stack>
                </Radio.Group>
              </Stack>

              {/* Paso 2 */}
              <Stack gap={6}>
                <StepTitle n={2} title="A dónde se envía la señal" done={!dirty && savedState.ingest} />
                <Text size="xs" c="dimmed">
                  El botón de transmitir del estudio envía la señal a este
                  servidor. Si transmites con OBS u otro codificador, usa los
                  mismos datos allí.
                </Text>
                {info && (
                  <Alert variant="light" color={info.color} icon={<IconInfoCircle size={16} />} p="xs">
                    <Text size="xs">{info.where}</Text>
                  </Alert>
                )}

                {isAuto && (
                  <Button
                    variant={muxProvisioned ? "default" : "filled"}
                    color="orange"
                    leftSection={<IconCloud size={14} />}
                    loading={provisioning}
                    disabled={disabled}
                    onClick={handleProvisionMux}
                    size="xs"
                  >
                    {muxProvisioned ? "Crear una nueva (reemplaza la actual)" : "Crear transmisión en Mux"}
                  </Button>
                )}

                {!isAuto && info?.srtServer && (
                  <SegmentedControl
                    disabled={disabled}
                    fullWidth
                    size="xs"
                    data={[
                      { label: "RTMP", value: "rtmp" },
                      { label: "SRT", value: "srt" },
                    ]}
                    value={values.ingestProtocol}
                    onChange={handleIngestProtocolChange}
                  />
                )}

                {values.ingestProtocol === "rtmp" || isAuto ? (
                  <>
                    <TextInput
                      size="xs"
                      disabled={disabled}
                      readOnly={isAuto}
                      label="Servidor RTMP"
                      placeholder={info?.rtmpServer ?? "rtmp://..."}
                      value={values.rtmpServerUrl}
                      onChange={(e) => set("rtmpServerUrl", e.currentTarget.value)}
                    />
                    <TextInput
                      size="xs"
                      disabled={disabled}
                      readOnly={isAuto}
                      label="Stream key"
                      placeholder={isAuto ? "Se genera al crear la transmisión" : "Clave de tu transmisión"}
                      value={values.rtmpStreamKey}
                      onChange={(e) => set("rtmpStreamKey", e.currentTarget.value)}
                    />
                  </>
                ) : (
                  <TextInput
                    size="xs"
                    disabled={disabled}
                    label="URL SRT"
                    placeholder="srt://live.cloudflare.com:778?streamid=..."
                    description="Va todo en una sola URL (servidor + streamid/passphrase)."
                    value={values.srtIngestUrl}
                    onChange={(e) => set("srtIngestUrl", e.currentTarget.value)}
                  />
                )}
              </Stack>

              {/* Paso 3 */}
              <Stack gap={6}>
                <StepTitle n={3} title="Lo que ve el asistente" done={!dirty && savedState.playback} />
                <TextInput
                  size="xs"
                  disabled={disabled}
                  readOnly={isAuto}
                  label="URL de reproducción"
                  description={info?.playbackHint}
                  placeholder={info?.playbackPlaceholder}
                  value={values.playbackHlsUrl}
                  onChange={(e) => set("playbackHlsUrl", e.currentTarget.value)}
                />
                {player && (
                  <Text size="xs" c={player.measured ? "dimmed" : "orange"}>
                    El asistente verá el {player.label}
                    {player.measured
                      ? " y se mide su tiempo de reproducción."
                      : ": no se puede medir la reproducción ni detectar si falla."}
                  </Text>
                )}
                {playbackLooksWrong && (
                  <Text size="xs" c="orange">
                    No parece una URL de {info?.label}. {info?.playbackHint}
                  </Text>
                )}
                <Text size="xs" c="dimmed">
                  El asistente no elige proveedor: siempre ve esta URL mientras
                  el evento está en vivo.
                </Text>
              </Stack>

              {/* Paso 4 */}
              {info && (
                <Stack gap={6}>
                  <StepTitle n={4} title="Repetición" />
                  <Text size="xs">{info.replay}</Text>
                </Stack>
              )}

              <NumberInput
                size="xs"
                disabled={disabled}
                label="Máximo de participantes en el estudio"
                min={1}
                value={values.maxParticipants}
                onChange={(v) => set("maxParticipants", Number(v) || 1)}
              />

              {error && (
                <Alert color="red" variant="light" icon={<IconX size={16} />} p="xs">
                  <Text size="xs">{error}</Text>
                </Alert>
              )}

              <Group justify="space-between">
                <Text size="xs" c={dirty ? "orange" : "dimmed"}>
                  {dirty ? "Cambios sin guardar" : "Sin cambios"}
                </Text>
                <Button size="xs" loading={saving} disabled={disabled || !dirty} onClick={() => void onSave()}>
                  Guardar
                </Button>
              </Group>

              <List size="xs" c="dimmed" spacing={2}>
                <List.Item>
                  La Stream key se muestra en claro solo a quien administra el
                  evento, para poder verificarla o copiarla a OBS.
                </List.Item>
              </List>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Paper>
  );
};
