// src/components/live/StudioToolbar.tsx
import {
  Badge,
  Button,
  Group,
  SegmentedControl,
  Switch,
  Stack,
  Text,
} from "@mantine/core";
import type { StageState } from "../../hooks/useStage";
import type { ProgramMode } from "../../api/live-stage-service";
import type { LayoutMode } from "../../types";

function statusLabel(egressId: string | null, status: string | null) {
  if (!egressId) return { text: "Offline", color: "gray" as const };
  if (!status) return { text: "Conectando…", color: "yellow" as const };

  // Normalizar status a string
  const normalizedStatus = String(status).toLowerCase();

  // Estado 1 o "1" significa que está en vivo
  if (
    String(status) === "1" ||
    ["started", "running", "active"].includes(normalizedStatus)
  )
    return { text: "En vivo", color: "green" as const };
  if (["starting", "pending", "0"].includes(normalizedStatus) || String(status) === "0")
    return { text: "Iniciando…", color: "yellow" as const };
  if (["failed", "aborted"].includes(normalizedStatus))
    return { text: "Error", color: "red" as const };
  if (["complete", "completed", "ended", "stopped"].includes(normalizedStatus))
    return { text: "Finalizado", color: "gray" as const };
  return { text: normalizedStatus, color: "blue" as const };
}

type Props = {
  role: "host" | "speaker";
  egressId: string | null;
  isBusy: boolean;
  egressStatus: string | null;
  stage: StageState;
  showFrame: boolean;
  onToggleFrame: (next: boolean) => void;
  onStart: () => void;
  onStop: () => void;
  onMode: (m: ProgramMode) => void;
  layoutMode: LayoutMode;
  onLayoutMode: (m: LayoutMode) => void;
};

export function StudioToolbar({
  role,
  egressId,
  isBusy,
  egressStatus,
  showFrame,
  onToggleFrame,
  onStart,
  onStop,
  layoutMode,
  onLayoutMode,
}: Props) {
  const st = statusLabel(egressId, egressStatus);
  const isSpeaker = role === "speaker";

  return (
    <Group justify="space-between" align="center" style={{ width: "100%" }}>
      <Group gap="md">
        <Stack gap={0}>
          <Badge color={st.color} variant="filled" radius="xl" size="lg">
            {st.text}
          </Badge>
          {egressId ? (
            <Text size="xs" c="dimmed" mt={4}>
              {st.color === "green"
                ? "La transmisión ha iniciado"
                : st.color === "yellow"
                ? "Preparando transmisión..."
                : st.color === "red"
                ? "Error en la transmisión"
                : "Transmisión finalizada"}
            </Text>
          ) : (
            !isSpeaker && (
              <Text size="xs" c="dimmed" mt={4}>
                Listo para iniciar transmisión
              </Text>
            )
          )}
        </Stack>

        {!isSpeaker &&
          (!egressId ? (
            <Button size="sm" onClick={onStart} loading={isBusy}>
              Iniciar Transmisión
            </Button>
          ) : (
            <Button
              size="sm"
              color="red"
              variant="filled"
              onClick={onStop}
              loading={isBusy}
            >
              Detener Transmisión
            </Button>
          ))}
      </Group>

      {!isSpeaker && (
        <Group gap="md">
          <SegmentedControl
            size="sm"
            value={layoutMode}
            onChange={(v) => onLayoutMode(v as LayoutMode)}
            data={[
              { label: "Grid", value: "grid" },
              { label: "Speaker", value: "speaker" },
              { label: "Pres", value: "presentation" },
              { label: "PiP", value: "pip" },
              { label: "2-Up", value: "side_by_side" },
            ]}
          />

          <Switch
            checked={showFrame}
            onChange={(e) => onToggleFrame(e.currentTarget.checked)}
            label="Marco"
          />
        </Group>
      )}
    </Group>
  );
}
