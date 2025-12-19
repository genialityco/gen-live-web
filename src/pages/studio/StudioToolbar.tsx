// src/components/live/StudioToolbar.tsx
import {
  Badge,
  Button,
  Group,
  SegmentedControl,
  Switch,
  Text,
} from "@mantine/core";
import type { StageState } from "../../hooks/useStage";
import type { ProgramMode } from "../../api/live-stage-service";

type Props = {
  egressId: string | null;
  isBusy: boolean;
  egressStatus: string | null;
  stage: StageState;
  showFrame: boolean;
  onToggleFrame: (next: boolean) => void;
  onStart: () => void;
  onStop: () => void;
  onMode: (m: ProgramMode) => void;
};

export function StudioToolbar({
  egressId,
  isBusy,
  egressStatus,
  stage,
  showFrame,
  onToggleFrame,
  onStart,
  onStop,
  onMode,
}: Props) {
  return (
    <Group justify="space-between" align="center">
      <Group>
        {egressId ? (
          <>
            <Badge color="green">Transmisión activa</Badge>
            <Button size="xs" color="red" onClick={onStop} loading={isBusy}>
              Detener
            </Button>
            <Badge variant="light">Estado: {egressStatus ?? "…"}</Badge>
          </>
        ) : (
          <Button size="xs" onClick={onStart} loading={isBusy}>
            Iniciar transmisión
          </Button>
        )}
      </Group>

      <Group>
        <SegmentedControl
          size="xs"
          value={stage.programMode ?? "speaker"}
          onChange={(v) => onMode(v as ProgramMode)}
          data={[
            { label: "Speaker", value: "speaker" },
            { label: "Grid", value: "grid" },
          ]}
        />

        <Switch
          checked={showFrame}
          onChange={(e) => onToggleFrame(e.currentTarget.checked)}
          label="Marco"
        />

        <Text size="xs" c="dimmed">
          Pin: {stage.activeUid ? stage.activeUid : "—"}
        </Text>
      </Group>
    </Group>
  );
}
