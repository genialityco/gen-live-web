// src/components/live/StudioToolbar.tsx
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import type { StageState } from "../../hooks/useStage";
import type { ProgramMode } from "../../api/live-stage-service";
import type { LayoutMode } from "../../types";

// ── Layout diagram SVGs ──────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg width="38" height="26" viewBox="0 0 38 26" fill="none">
      <rect x="1" y="1" width="16" height="11" rx="2" fill="currentColor" opacity="0.75" />
      <rect x="21" y="1" width="16" height="11" rx="2" fill="currentColor" opacity="0.75" />
      <rect x="1" y="14" width="16" height="11" rx="2" fill="currentColor" opacity="0.75" />
      <rect x="21" y="14" width="16" height="11" rx="2" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

function IconSpeaker() {
  return (
    <svg width="38" height="26" viewBox="0 0 38 26" fill="none">
      <rect x="1" y="1" width="36" height="17" rx="2" fill="currentColor" opacity="0.75" />
      <rect x="1" y="20" width="10" height="5" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="14" y="20" width="10" height="5" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="27" y="20" width="10" height="5" rx="1.5" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

function IconPresentation() {
  return (
    <svg width="38" height="26" viewBox="0 0 38 26" fill="none">
      <rect x="1" y="1" width="8" height="11" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="1" y="14" width="8" height="11" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="12" y="1" width="25" height="24" rx="2" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

function IconPip() {
  return (
    <svg width="38" height="26" viewBox="0 0 38 26" fill="none">
      <rect x="1" y="1" width="36" height="24" rx="2" fill="currentColor" opacity="0.45" />
      <rect x="3" y="14" width="14" height="9" rx="1.5" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

function IconSideBySide() {
  return (
    <svg width="38" height="26" viewBox="0 0 38 26" fill="none">
      <rect x="1" y="1" width="17" height="24" rx="2" fill="currentColor" opacity="0.75" />
      <rect x="20" y="1" width="17" height="24" rx="2" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

function IconSolo() {
  return (
    <svg width="38" height="26" viewBox="0 0 38 26" fill="none">
      <rect x="1" y="1" width="36" height="24" rx="2" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

const LAYOUTS: Array<{
  value: LayoutMode;
  label: string;
  desc: string;
  Icon: React.FC;
}> = [
  {
    value: "grid",
    label: "Grid",
    desc: "Todos los participantes en cuadrículas iguales",
    Icon: IconGrid,
  },
  {
    value: "speaker",
    label: "Speaker",
    desc: "Un presentador principal grande con miniaturas debajo",
    Icon: IconSpeaker,
  },
  {
    value: "presentation",
    label: "Pres.",
    desc: "Pantalla compartida grande con participantes al costado",
    Icon: IconPresentation,
  },
  {
    value: "pip",
    label: "PiP",
    desc: "Vista principal con miniaturas superpuestas en la esquina",
    Icon: IconPip,
  },
  {
    value: "side_by_side",
    label: "2-Up",
    desc: "Dos participantes lado a lado con igual espacio",
    Icon: IconSideBySide,
  },
  {
    value: "solo",
    label: "Solo",
    desc: "El speaker pineado ocupa toda la pantalla sin miniaturas",
    Icon: IconSolo,
  },
];

export function LayoutPicker({
  value,
  onChange,
}: {
  value: LayoutMode;
  onChange: (m: LayoutMode) => void;
}) {
  return (
    <Group gap={4} wrap="nowrap">
      {LAYOUTS.map(({ value: lv, desc, Icon }) => {
        const isActive = value === lv;
        return (
          <Tooltip key={lv} label={desc} position="bottom" withArrow fz="xs" multiline maw={180}>
            <ActionIcon
              variant={isActive ? "light" : "default"}
              color={isActive ? "blue" : "gray"}
              size={56}
              radius="md"
              onClick={() => onChange(lv)}
            >
              <Icon />
            </ActionIcon>
          </Tooltip>
        );
      })}
    </Group>
  );
}

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
  onStart: () => void;
  onStop: () => void;
  onMode: (m: ProgramMode) => void;
  /** Modo compacto para mobile: solo muestra badge de estado + botón de transmisión */
  compact?: boolean;
};

export function StudioToolbar({
  role,
  egressId,
  isBusy,
  egressStatus,
  onStart,
  onStop,
  compact = false,
}: Props) {
  const st = statusLabel(egressId, egressStatus);
  const isSpeaker = role === "speaker";

  // Versión compacta para mobile: solo estado + botón de transmisión
  if (compact) {
    return (
      <Group gap="xs" wrap="nowrap">
        <Badge color={st.color} variant="filled" radius="xl" size="md">
          {st.text}
        </Badge>
        {!isSpeaker &&
          (!egressId ? (
            <Button size="xs" onClick={onStart} loading={isBusy} variant="filled">
              Iniciar
            </Button>
          ) : (
            <Button size="xs" color="red" variant="filled" onClick={onStop} loading={isBusy}>
              Detener
            </Button>
          ))}
      </Group>
    );
  }

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

    </Group>
  );
}
