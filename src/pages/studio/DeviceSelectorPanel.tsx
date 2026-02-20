import { Select, Stack, Text, Group, Alert } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCamera,
  IconMicrophone,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { useMediaDeviceSelect } from "@livekit/components-react";

// Patrones comunes de cámaras virtuales para advertir al usuario
const VIRTUAL_CAM_PATTERNS = [
  "obs",
  "manycam",
  "snap camera",
  "droidcam",
  "iriun",
  "xsplit",
  "mmhmm",
  "ecamm",
  "streamlabs",
  "virtual",
  "prism live",
  "nvidia broadcast",
  "amd link",
];

function isLikelyVirtualCamera(label: string): boolean {
  const lower = label.toLowerCase();
  return VIRTUAL_CAM_PATTERNS.some((p) => lower.includes(p));
}

export function DeviceSelectorPanel() {
  const {
    devices: cameras,
    activeDeviceId: activeCamId,
    setActiveMediaDevice: setCamera,
  } = useMediaDeviceSelect({ kind: "videoinput" });

  const {
    devices: mics,
    activeDeviceId: activeMicId,
    setActiveMediaDevice: setMic,
  } = useMediaDeviceSelect({ kind: "audioinput" });

  const activeCamera = cameras.find((c) => c.deviceId === activeCamId);
  const isVirtualCam = activeCamera
    ? isLikelyVirtualCamera(activeCamera.label)
    : false;

  const handleCameraChange = async (deviceId: string) => {
    await setCamera(deviceId);
    // El procesador de fondo virtual no se transfiere automáticamente al cambiar cámara
    notifications.show({
      message:
        "Cámara cambiada. Si tenías fondo virtual activo, volvé a aplicarlo.",
      color: "blue",
      autoClose: 5000,
    });
  };

  const cameraData = cameras.map((d) => ({
    value: d.deviceId,
    label: d.label || `Cámara ${d.deviceId.slice(0, 8)}`,
  }));

  const micData = mics.map((d) => ({
    value: d.deviceId,
    label: d.label || `Micrófono ${d.deviceId.slice(0, 8)}`,
  }));

  return (
    <Stack gap="xs">
      <Text size="xs" fw={600} tt="uppercase" c="dimmed">
        Dispositivos
      </Text>

      {/* Selector de cámara */}
      <Group gap="xs" align="center" wrap="nowrap">
        <IconCamera size={14} style={{ flexShrink: 0 }} />
        <Select
          size="xs"
          style={{ flex: 1 }}
          placeholder="Seleccionar cámara"
          value={activeCamId || null}
          onChange={(val) => val && void handleCameraChange(val)}
          data={cameraData}
          disabled={cameras.length === 0}
        />
      </Group>

      {/* Alerta de cámara virtual */}
      {isVirtualCam && (
        <Alert
          icon={<IconAlertTriangle size={14} />}
          color="yellow"
          p="xs"
          radius="sm"
        >
          <Text size="xs">
            Cámara virtual detectada. Los efectos de fondo (blur/imagen) pueden
            no funcionar. Si los usás, desactiválos primero.
          </Text>
        </Alert>
      )}

      {/* Selector de micrófono */}
      <Group gap="xs" align="center" wrap="nowrap">
        <IconMicrophone size={14} style={{ flexShrink: 0 }} />
        <Select
          size="xs"
          style={{ flex: 1 }}
          placeholder="Seleccionar micrófono"
          value={activeMicId || null}
          onChange={(val) => val && void setMic(val)}
          data={micData}
          disabled={mics.length === 0}
        />
      </Group>
    </Stack>
  );
}
