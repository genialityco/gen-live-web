/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
  PasswordInput,
  Divider,
  NumberInput,
  Box,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import {
  getLiveConfig,
  updateLiveConfig,
  getPlayback,
} from "../../api/livekit-service";
import { IconAlertCircle } from "@tabler/icons-react";

type Props = {
  eventSlug: string;
  disabled?: boolean;
  defaultOpened?: boolean; // opcional
};

export const LiveConfigPanel: React.FC<Props> = ({
  eventSlug,
  disabled,
  defaultOpened = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

      playbackHlsUrl: (v) => (!v ? "Playback HLS URL requerida" : null),
    },
  });

  const ingestProtocol = form.values.ingestProtocol;

  const maskedRtmpKey = useMemo(
    () => form.values.rtmpStreamKey === "****",
    [form.values.rtmpStreamKey]
  );
  const maskedSrt = useMemo(
    () => form.values.srtIngestUrl === "****",
    [form.values.srtIngestUrl]
  );

  useEffect(() => {
    const run = async () => {
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
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug]);

  const onSave = form.onSubmit(async (values) => {
    setSaving(true);
    try {
      const payload: any = { eventSlug, ...values };
      if (payload.rtmpStreamKey === "****") delete payload.rtmpStreamKey;
      if (payload.srtIngestUrl === "****") delete payload.srtIngestUrl;

      await updateLiveConfig(payload);

      showNotification({
        color: "green",
        title: "Guardado",
        message: "Configuración del live actualizada",
      });
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
              <Badge variant="light" style={{ whiteSpace: "nowrap" }}>
                {eventSlug}
              </Badge>
            </Group>
          </Accordion.Control>

          <Accordion.Panel>
            <Stack gap="sm" pt="xs">
              {ingestProtocol === "rtmp" ? (
                <>
                  <TextInput
                    disabled={disabled}
                    label="RTMP Server"
                    placeholder="rtmp://global-live.mux.com:5222/app"
                    {...form.getInputProps("rtmpServerUrl")}
                  />
                  <PasswordInput
                    disabled={disabled}
                    label="RTMP Stream Key"
                    placeholder={maskedRtmpKey ? "****" : "stream_key..."}
                    description={
                      maskedRtmpKey
                        ? "Guardada (enmascarada). Escribe para reemplazar."
                        : undefined
                    }
                    {...form.getInputProps("rtmpStreamKey")}
                  />
                </>
              ) : (
                <PasswordInput
                  disabled={disabled}
                  label="SRT Ingest URL"
                  placeholder={maskedSrt ? "****" : "srt://..."}
                  description={
                    maskedSrt
                      ? "Guardada (enmascarada). Escribe para reemplazar."
                      : undefined
                  }
                  {...form.getInputProps("srtIngestUrl")}
                />
              )}

              <Divider />

              <TextInput
                disabled={disabled}
                label="Playback HLS URL"
                placeholder="https://stream.mux.com/<playbackId>.m3u8"
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
                Tip: si la key aparece enmascarada (****), ya está guardada; solo
                escribe si quieres reemplazarla.
              </Text>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Paper>
  );
};
