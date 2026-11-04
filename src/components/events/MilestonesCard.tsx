// src/components/events/MilestonesCard.tsx
import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Loader,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import type { EventItem } from "../../api/events";
import { HERD_POSITIONS, type HerdPosition } from "../../api/herd";
import {
  DEFAULT_MILESTONE_PRIVATE,
  DEFAULT_MILESTONE_PUBLIC,
  awardMilestone,
  getMilestonesConnected,
  getMilestonesReport,
  MILESTONE_DELIVERIES,
  MILESTONE_TYPES,
  milestoneTypeInfo,
  newMilestoneId,
  renderMilestoneTemplate,
  updateMilestonesConfig,
  type EventMilestonesConfig,
  type MilestoneConnectedAttendee,
  type MilestoneDef,
  type MilestoneDelivery,
  type MilestoneType,
  type MilestonesReport,
} from "../../api/milestones";

const SAMPLE_NAME = "Dr(a). Ana";
const SAMPLE_NAMES = "Dr(a). Ana, Carlos y 4 colegas más";

const DEFAULT_THRESHOLD: Record<MilestoneType, number> = {
  watchMinutes: 60,
  totalMinutes: 90,
  firstToConnect: 20,
  frequentAttendee: 3,
  pollsAnswered: 2,
  pollFirst: 10,
  greetingsSent: 2,
  manual: 1,
};

/** "Minutos seguidos conectado: 60" · "Logro manual" */
const itemLabel = (i: Pick<MilestoneDef, "type" | "threshold">) =>
  i.type === "manual" ? milestoneTypeInfo(i.type).label : `${milestoneTypeInfo(i.type).label}: ${i.threshold}`;

function withDefaults(event: EventItem): EventMilestonesConfig {
  const c = event.milestonesConfig;
  return {
    enabled: !!c?.enabled,
    holdoutPercent: c?.holdoutPercent ?? 0,
    accentColor: c?.accentColor,
    privateMessage: { ...DEFAULT_MILESTONE_PRIVATE, ...(c?.privateMessage ?? {}) },
    publicMessage: { ...DEFAULT_MILESTONE_PUBLIC, ...(c?.publicMessage ?? {}) },
    items: c?.items ?? [],
  };
}

const deliveryLabel = (d: MilestoneDelivery) => MILESTONE_DELIVERIES.find((x) => x.value === d)?.label ?? d;

/**
 * Logros del asistente: el admin define sus propios hitos (tipo + umbral) y
 * cómo felicitar al cumplirlos (privado, público o ambos).
 */
export function MilestonesCard({
  event,
  onEventUpdate,
}: {
  event: EventItem;
  onEventUpdate: (event: EventItem) => void;
}) {
  const saved = useMemo(() => withDefaults(event), [event]);
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const activeItems = saved.items.filter((i) => i.enabled !== false);
  const manualItems = activeItems.filter((i) => i.type === "manual");

  const save = async (config: EventMilestonesConfig) => {
    setSaving(true);
    try {
      const updated = await updateMilestonesConfig(event._id, config);
      onEventUpdate(updated);
      notifications.show({ message: "Logros guardados", color: "green" });
      return true;
    } catch (err) {
      console.error("Error guardando logros:", err);
      notifications.show({ message: "No se pudieron guardar los logros", color: "red" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div>
            <Title order={4}>🏅 Logros del asistente</Title>
            <Text size="sm" c="dimmed">
              Felicita a cada asistente cuando cumple un hito que tú defines: minutos seguidos conectado, encuestas
              respondidas, ser de los primeros en responder o saludar a sus colegas.
            </Text>
          </div>
          <Switch
            checked={saved.enabled}
            disabled={saving}
            onChange={(e) => {
              const enabled = e.currentTarget.checked;
              if (enabled && !saved.items.length) {
                setOpen(true);
                return;
              }
              void save({ ...saved, enabled });
            }}
          />
        </Group>

        {activeItems.length > 0 ? (
          <Group gap={6}>
            {activeItems.map((i) => (
              <Badge key={i.id} variant="light" color={saved.enabled ? "blue" : "gray"}>
                {itemLabel(i)} · {deliveryLabel(i.delivery)}
              </Badge>
            ))}
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            Aún no hay hitos configurados.
          </Text>
        )}

        <Group gap="xs">
          <Button size="xs" variant="light" onClick={() => setOpen(true)}>
            Configurar hitos
          </Button>
          {saved.enabled && manualItems.length > 0 && (
            <Button size="xs" variant="light" color="grape" onClick={() => setManualOpen(true)}>
              🎖️ Felicitar a…
            </Button>
          )}
          <Button size="xs" variant="subtle" onClick={() => setReportOpen(true)}>
            Ver logros otorgados
          </Button>
        </Group>
      </Stack>

      <Modal opened={open} onClose={() => setOpen(false)} title="Logros del asistente" size="xl">
        {open && (
          <MilestonesEditor
            initial={saved}
            saving={saving}
            onCancel={() => setOpen(false)}
            onSave={async (config) => {
              if (await save(config)) setOpen(false);
            }}
          />
        )}
      </Modal>

      <Modal opened={manualOpen} onClose={() => setManualOpen(false)} title="Felicitar a asistentes" size="lg">
        {manualOpen && (
          <ManualAwardView eventId={event._id} live={event.status === "live"} items={manualItems} />
        )}
      </Modal>

      <Modal opened={reportOpen} onClose={() => setReportOpen(false)} title="Logros otorgados" size="xl">
        {reportOpen && <MilestonesReportView eventId={event._id} />}
      </Modal>
    </Card>
  );
}

function MilestonesEditor({
  initial,
  saving,
  onCancel,
  onSave,
}: {
  initial: EventMilestonesConfig;
  saving: boolean;
  onCancel: () => void;
  onSave: (config: EventMilestonesConfig) => void | Promise<void>;
}) {
  const [config, setConfig] = useState<EventMilestonesConfig>(() => ({
    ...initial,
    // Al abrir desde el switch sin hitos, se activa junto con el primero
    enabled: initial.enabled || !initial.items.length,
  }));
  const [newType, setNewType] = useState<MilestoneType>("watchMinutes");
  const priv = { ...DEFAULT_MILESTONE_PRIVATE, ...(config.privateMessage ?? {}) };
  const pub = { ...DEFAULT_MILESTONE_PUBLIC, ...(config.publicMessage ?? {}) };

  const setItem = (id: string, patch: Partial<MilestoneDef>) =>
    setConfig((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));

  const addItem = () =>
    setConfig((c) => {
      const threshold = DEFAULT_THRESHOLD[newType];
      return {
        ...c,
        items: [
          ...c.items,
          {
            id: newMilestoneId(newType, threshold, c.items.map((i) => i.id)),
            enabled: true,
            type: newType,
            threshold,
            delivery: "private",
          },
        ],
      };
    });

  const usesPublic = config.items.some((i) => i.delivery !== "private");
  const usesPrivate = config.items.some((i) => i.delivery !== "public");

  return (
    <Stack gap="md">
      <Switch
        label="Logros activos"
        checked={config.enabled}
        onChange={(e) => setConfig((c) => ({ ...c, enabled: e.currentTarget.checked }))}
      />

      <Text size="sm" fw={600}>
        Hitos
      </Text>
      {config.items.length === 0 && (
        <Alert color="gray" variant="light">
          Agrega el primer hito: elige qué se mide, desde cuánto se felicita y si la felicitación es privada (solo la ve
          el asistente), pública (la ve toda la audiencia, con su nombre) o ambas.
        </Alert>
      )}
      {config.items.map((item) => (
        <MilestoneItemEditor
          key={item.id}
          item={item}
          onChange={(patch) => setItem(item.id, patch)}
          onRemove={() => setConfig((c) => ({ ...c, items: c.items.filter((i) => i.id !== item.id) }))}
        />
      ))}
      <Group gap="xs">
        <Select
          size="xs"
          data={MILESTONE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          value={newType}
          onChange={(v) => v && setNewType(v as MilestoneType)}
          allowDeselect={false}
          w={320}
        />
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={addItem} disabled={config.items.length >= 20}>
          Agregar hito
        </Button>
      </Group>

      <Divider label="Cómo se muestran" labelPosition="left" />
      <Grid>
        {usesPrivate && (
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper withBorder p="sm" radius="md">
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  Privada (solo quien cumplió)
                </Text>
                <ChannelFields
                  position={priv.position}
                  durationSec={priv.durationSec}
                  label={priv.label ?? ""}
                  onChange={(patch) => setConfig((c) => ({ ...c, privateMessage: { ...priv, ...patch } }))}
                />
              </Stack>
            </Paper>
          </Grid.Col>
        )}
        {usesPublic && (
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper withBorder p="sm" radius="md">
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  Pública (toda la audiencia)
                </Text>
                <ChannelFields
                  position={pub.position}
                  durationSec={pub.durationSec}
                  label={pub.label ?? ""}
                  onChange={(patch) => setConfig((c) => ({ ...c, publicMessage: { ...pub, ...patch } }))}
                />
                <Group grow>
                  <NumberInput
                    size="xs"
                    label="Separación mínima (s)"
                    description="Quienes cumplen en ese lapso salen juntos"
                    min={10}
                    max={600}
                    value={pub.minIntervalSec}
                    onChange={(v) =>
                      setConfig((c) => ({ ...c, publicMessage: { ...pub, minIntervalSec: Number(v) || 30 } }))
                    }
                  />
                  <NumberInput
                    size="xs"
                    label="Nombres visibles"
                    description="El resto: «y N colegas más»"
                    min={1}
                    max={10}
                    value={pub.maxNames}
                    onChange={(v) => setConfig((c) => ({ ...c, publicMessage: { ...pub, maxNames: Number(v) || 3 } }))}
                  />
                </Group>
              </Stack>
            </Paper>
          </Grid.Col>
        )}
      </Grid>

      <NumberInput
        label="Grupo de control (%)"
        description="Porcentaje de asistentes, al azar, que cumplen los hitos sin recibir felicitación. Sirve para medir si los logros aumentan la permanencia. 0 = sin medición."
        min={0}
        max={90}
        value={config.holdoutPercent ?? 0}
        onChange={(v) => setConfig((c) => ({ ...c, holdoutPercent: Number(v) || 0 }))}
        w={360}
      />

      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          Cancelar
        </Button>
        <Button loading={saving} onClick={() => void onSave(config)}>
          Guardar
        </Button>
      </Group>
    </Stack>
  );
}

function MilestoneItemEditor({
  item,
  onChange,
  onRemove,
}: {
  item: MilestoneDef;
  onChange: (patch: Partial<MilestoneDef>) => void;
  onRemove: () => void;
}) {
  const info = milestoneTypeInfo(item.type);
  const showPrivate = item.delivery !== "public";
  const showPublic = item.delivery !== "private";
  const privText = item.privateTemplate?.trim() || info.defaults.private;
  const pubText = item.publicTemplate?.trim() || info.defaults.public;

  return (
    <Paper withBorder p="sm" radius="md" opacity={item.enabled === false ? 0.6 : 1}>
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Switch
              size="xs"
              checked={item.enabled !== false}
              onChange={(e) => onChange({ enabled: e.currentTarget.checked })}
            />
            <Text size="sm" fw={600}>
              {info.label}
            </Text>
          </Group>
          <ActionIcon variant="subtle" color="red" onClick={onRemove} aria-label="Quitar hito">
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
        <Text size="xs" c="dimmed">
          {info.hint}
        </Text>
        <Group grow align="flex-end">
          {item.type !== "manual" && (
            <NumberInput
              size="xs"
              label={info.unit === "primeros" ? "Entre los primeros" : `Desde (${info.unit})`}
              min={1}
              max={600}
              value={item.threshold}
              onChange={(v) => onChange({ threshold: Math.max(1, Number(v) || 1) })}
            />
          )}
          <div>
            <Text size="xs" fw={500} mb={4}>
              Felicitación
            </Text>
            <SegmentedControl
              size="xs"
              fullWidth
              data={MILESTONE_DELIVERIES}
              value={item.delivery}
              onChange={(v) => onChange({ delivery: v as MilestoneDelivery })}
            />
          </div>
        </Group>
        {showPrivate && (
          <Textarea
            size="xs"
            label="Texto privado"
            description="Variables: {nombre}, {umbral}, {valor} (lo que alcanzó). Vacío = texto por defecto."
            placeholder={info.defaults.private}
            autosize
            minRows={1}
            maxLength={280}
            value={item.privateTemplate ?? ""}
            onChange={(e) => onChange({ privateTemplate: e.currentTarget.value })}
          />
        )}
        {showPrivate && (
          <Text size="xs" c="dimmed">
            Vista previa:{" "}
            {renderMilestoneTemplate(privText, {
              nombre: SAMPLE_NAME,
              umbral: item.threshold,
              // Ejemplo de "lo alcanzado" para los tipos donde puede superar el umbral
              valor: item.type === "frequentAttendee" ? item.threshold + 2 : item.threshold,
            })}
          </Text>
        )}
        {showPublic && (
          <Textarea
            size="xs"
            label="Texto público"
            description="Variables: {nombres}, {cantidad}, {umbral}, {singular|plural}. Vacío = texto por defecto."
            placeholder={info.defaults.public}
            autosize
            minRows={1}
            maxLength={280}
            value={item.publicTemplate ?? ""}
            onChange={(e) => onChange({ publicTemplate: e.currentTarget.value })}
          />
        )}
        {showPublic && (
          <Text size="xs" c="dimmed">
            Vista previa:{" "}
            {renderMilestoneTemplate(pubText, { nombres: SAMPLE_NAMES, cantidad: 6, umbral: item.threshold })}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function ChannelFields({
  position,
  durationSec,
  label,
  onChange,
}: {
  position: HerdPosition;
  durationSec: number;
  label: string;
  onChange: (patch: { position?: HerdPosition; durationSec?: number; label?: string }) => void;
}) {
  return (
    <>
      <Select
        size="xs"
        label="Posición"
        data={HERD_POSITIONS}
        value={position}
        allowDeselect={false}
        onChange={(v) => v && onChange({ position: v as HerdPosition })}
      />
      <Group grow>
        <NumberInput
          size="xs"
          label="Duración (s)"
          min={3}
          max={30}
          value={durationSec}
          onChange={(v) => onChange({ durationSec: Number(v) || 8 })}
        />
        <TextInput
          size="xs"
          label="Etiqueta"
          maxLength={24}
          value={label}
          onChange={(e) => onChange({ label: e.currentTarget.value })}
        />
      </Group>
    </>
  );
}

/** Logro manual: elegir el logro y a quiénes de los conectados felicitar */
function ManualAwardView({ eventId, live, items }: { eventId: string; live: boolean; items: MilestoneDef[] }) {
  const [milestoneId, setMilestoneId] = useState<string>(items[0]?.id ?? "");
  const [people, setPeople] = useState<MilestoneConnectedAttendee[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const item = items.find((i) => i.id === milestoneId) ?? items[0];

  const load = async () => {
    setLoading(true);
    try {
      setPeople(await getMilestonesConnected(eventId));
    } catch (err) {
      console.error("Error cargando conectados:", err);
      notifications.show({ message: "No se pudo cargar la lista de conectados", color: "red" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!item || !selected.length) return;
    setSending(true);
    try {
      const r = await awardMilestone(eventId, item.id, selected);
      notifications.show({
        color: "green",
        message:
          r.already > 0
            ? `Felicitados: ${r.awarded}. Ya lo tenían: ${r.already}.`
            : `Felicitados: ${r.awarded}.`,
      });
      setSelected([]);
      void load();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      notifications.show({
        color: "red",
        message: message || "No se pudo enviar la felicitación",
      });
    } finally {
      setSending(false);
    }
  };

  if (!live) {
    return <Alert color="orange">Las felicitaciones manuales solo se pueden enviar con el evento en vivo.</Alert>;
  }

  const preview = item
    ? renderMilestoneTemplate(
        item.delivery === "public"
          ? item.publicTemplate?.trim() || milestoneTypeInfo("manual").defaults.public
          : item.privateTemplate?.trim() || milestoneTypeInfo("manual").defaults.private,
        { nombre: SAMPLE_NAME, nombres: SAMPLE_NAME, cantidad: 1, umbral: 1 },
      )
    : "";

  return (
    <Stack gap="sm">
      {items.length > 1 && (
        <Select
          label="Logro"
          data={items.map((i, n) => ({
            value: i.id,
            label: i.privateTemplate?.trim() || i.publicTemplate?.trim() || `Logro manual ${n + 1}`,
          }))}
          value={milestoneId}
          allowDeselect={false}
          onChange={(v) => {
            if (v) setMilestoneId(v);
          }}
        />
      )}
      {item && (
        <Text size="xs" c="dimmed">
          {deliveryLabel(item.delivery)} · Vista previa: {preview}
        </Text>
      )}
      <Group justify="space-between" align="flex-end">
        <MultiSelect
          label={`Asistentes conectados (${people.length})`}
          placeholder="Busca por nombre o correo"
          searchable
          clearable
          nothingFoundMessage="Nadie con ese nombre está conectado"
          data={people.map((p) => {
            const got = !!item && p.awarded.includes(item.id);
            return {
              value: p.attendeeId,
              label: `${p.name || "Sin nombre"}${p.email ? ` · ${p.email}` : ""}${got ? " (ya felicitado)" : ""}`,
              disabled: got,
            };
          })}
          value={selected}
          onChange={setSelected}
          style={{ flex: 1 }}
          maxDropdownHeight={260}
        />
        <ActionIcon variant="subtle" onClick={() => void load()} loading={loading} aria-label="Actualizar conectados">
          <IconRefresh size={16} />
        </ActionIcon>
      </Group>
      <Group justify="flex-end">
        <Button loading={sending} disabled={!selected.length} onClick={() => void send()}>
          Felicitar ({selected.length})
        </Button>
      </Group>
    </Stack>
  );
}

function MilestonesReportView({ eventId }: { eventId: string }) {
  const [report, setReport] = useState<MilestonesReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      setReport(await getMilestonesReport(eventId));
    } catch (err) {
      console.error("Error cargando logros:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !report) return <Loader size="sm" />;
  if (error) return <Alert color="red">No se pudo cargar el informe de logros.</Alert>;
  if (!report) return null;

  const labelOf = (id: string) => {
    const m = report.milestones.find((x) => x.id === id);
    return m ? itemLabel(m) : id;
  };
  const time = (s?: string | null) =>
    s ? new Date(s).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {report.holdoutPercent > 0
            ? `Grupo de control: ${report.holdoutPercent} % (cumplen el hito pero no ven la felicitación).`
            : "Sin grupo de control."}
        </Text>
        <Button size="xs" variant="subtle" leftSection={<IconRefresh size={14} />} loading={loading} onClick={() => void load()}>
          Actualizar
        </Button>
      </Group>

      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Hito</Table.Th>
            <Table.Th>Entrega</Table.Th>
            <Table.Th ta="right">Cumplieron</Table.Th>
            <Table.Th ta="right">Felicitados en privado</Table.Th>
            <Table.Th ta="right">Salieron en público</Table.Th>
            <Table.Th ta="right">Control</Table.Th>
            <Table.Th>Primero · último</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {report.milestones.map((m) => (
            <Table.Tr key={m.id} opacity={m.enabled ? 1 : 0.6}>
              <Table.Td>{itemLabel(m)}</Table.Td>
              <Table.Td>{deliveryLabel(m.delivery)}</Table.Td>
              <Table.Td ta="right">{m.awarded}</Table.Td>
              <Table.Td ta="right">{m.privateSent}</Table.Td>
              <Table.Td ta="right">{m.publicShown}</Table.Td>
              <Table.Td ta="right">{m.holdout}</Table.Td>
              <Table.Td>
                {time(m.first)} · {time(m.last)}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {report.recent.length > 0 && (
        <>
          <Text size="sm" fw={600}>
            Últimos logros
          </Text>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Hora</Table.Th>
                <Table.Th>Asistente</Table.Th>
                <Table.Th>Hito</Table.Th>
                <Table.Th>Felicitación</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {report.recent.map((r, i) => (
                <Table.Tr key={`${r.milestoneId}-${r.createdAt}-${i}`}>
                  <Table.Td>{time(r.createdAt)}</Table.Td>
                  <Table.Td>{r.name || "—"}</Table.Td>
                  <Table.Td>{labelOf(r.milestoneId)}</Table.Td>
                  <Table.Td>
                    {r.holdout
                      ? "Control (sin felicitación)"
                      : [r.privateSent ? "Privada" : null, r.publicAt ? "Pública" : null].filter(Boolean).join(" + ") ||
                        "Pendiente"}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  );
}
