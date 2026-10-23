// src/components/events/HerdAnnouncementsCard.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import type { EventItem } from "../../api/events";
import type { FormField } from "../../types";
import type { AnnouncementStyle } from "../../api/live-stage-service";
import {
  announceHerd,
  DEFAULT_HERD_PRIVATE,
  DEFAULT_HERD_PUBLIC,
  DEFAULT_HERD_STYLE,
  HERD_POSITIONS,
  herdBannerStyle,
  herdKey,
  renderHerdTemplate,
  subscribeHerdCounts,
  updateHerdConfig,
  type EventHerdConfig,
  type HerdCounts,
  type HerdMessageConfig,
  type HerdMessageResolved,
  type HerdPosition,
  type HerdPublicMessageConfig,
} from "../../api/herd";
import { AnnouncementBanner } from "../studio/AnnouncementBanner";
import { AnnouncementStyleFields } from "../studio/AnnouncementStyleFields";
import { ALIGNABLE_TEMPLATES, ANNOUNCEMENT_PREVIEW_BG } from "../studio/announcement-templates";

const MAX_LABEL_LEN = 24;

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Campo sugerido por defecto: especialidad / sociedad / manada */
function guessField(fields: FormField[]) {
  const candidates = fields.filter((f) => f.type === "select" || f.type === "text");
  const test = (re: RegExp) => candidates.find((f) => re.test(norm(f.id)) || re.test(norm(f.label)));
  return (
    test(/sociedad|manada/) ??
    test(/^(?!.*sub).*(especialidad|specialty)/) ??
    test(/especialidad|specialty/)
  );
}

/** Estilo completo de un mensaje (sin colocación: la da `position`) */
function messageStyle(msg: HerdMessageConfig | undefined, accentColor?: string) {
  const { position: _p, align: _a, ...style } = herdBannerStyle(msg, accentColor);
  void _p;
  void _a;
  return { ...DEFAULT_HERD_STYLE, ...style };
}

function withDefaults(event: EventItem, fields: FormField[]): EventHerdConfig {
  const c = event.herdConfig;
  const privateMessage = { ...DEFAULT_HERD_PRIVATE, ...(c?.privateMessage ?? {}) };
  const publicMessage = { ...DEFAULT_HERD_PUBLIC, ...(c?.publicMessage ?? {}) };
  return {
    enabled: c?.enabled ?? false,
    fieldId: c?.fieldId ?? guessField(fields)?.id,
    groupLabels: c?.groupLabels ?? [],
    // El color de acento global de versiones anteriores pasa al estilo de cada mensaje
    accentColor: c?.accentColor,
    privateMessage: { ...privateMessage, style: messageStyle(privateMessage, c?.accentColor) },
    publicMessage: { ...publicMessage, style: messageStyle(publicMessage, c?.accentColor) },
  };
}

const positionLabel = (p?: HerdPosition) =>
  HERD_POSITIONS.find((x) => x.value === p)?.label.toLowerCase() ?? "";

/**
 * Configuración de los anuncios de manada (Control del evento): qué campo del
 * registro agrupa a los asistentes, plantillas de los mensajes privado y
 * público, su diseño y en qué parte del video aparece cada uno.
 */
export function HerdAnnouncementsCard({
  event,
  formFields,
  onEventUpdate,
}: {
  event: EventItem;
  formFields: FormField[];
  onEventUpdate: (event: EventItem) => void;
}) {
  const [open, setOpen] = useState(false);
  // Al activar sin campo configurado se abre el modal ya con el switch encendido
  const [openEnabling, setOpenEnabling] = useState(false);
  const [saving, setSaving] = useState(false);
  const saved = useMemo(() => withDefaults(event, formFields), [event, formFields]);
  const field = formFields.find((f) => f.id === saved.fieldId);

  const save = async (config: EventHerdConfig) => {
    setSaving(true);
    try {
      const updated = await updateHerdConfig(event._id, config);
      onEventUpdate(updated);
      notifications.show({ message: "Anuncios de manada guardados", color: "green" });
      return true;
    } catch (err) {
      console.error("Error guardando anuncios de manada:", err);
      notifications.show({ message: "No se pudieron guardar los anuncios de manada", color: "red" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (enabled: boolean) => {
    if (enabled && !saved.fieldId) {
      setOpenEnabling(true);
      setOpen(true);
      return;
    }
    void save({ ...saved, enabled });
  };

  return (
    <Card withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="nowrap">
          <div>
            <Title order={3}>👥 Anuncios de manada</Title>
            <Text size="xs" c="dimmed">
              Mensajes sobre el video del asistente con cuántos de su grupo
              (especialidad, sociedad…) están conectados en tiempo real.
            </Text>
          </div>
          <Switch
            checked={saved.enabled}
            onChange={(e) => handleToggle(e.currentTarget.checked)}
            disabled={saving}
          />
        </Group>

        {saved.enabled && (
          <Stack gap={4}>
            <Text size="xs">
              Agrupa por: <b>{field?.label ?? "—"}</b>
            </Text>
            <Text size="xs" c="dimmed">
              Privado {saved.privateMessage?.enabled ? `(${positionLabel(saved.privateMessage.position)})` : "desactivado"}
              {" · "}
              Público {saved.publicMessage?.enabled ? `(${positionLabel(saved.publicMessage.position)})` : "desactivado"}
            </Text>
          </Stack>
        )}

        {saved.enabled && saved.fieldId && (
          <HerdQuickAnnounce eventId={event._id} config={saved} field={field} />
        )}

        <Group justify="flex-end">
          <Button
            size="xs"
            variant="light"
            onClick={() => {
              setOpenEnabling(false);
              setOpen(true);
            }}
          >
            ⚙️ Configurar
          </Button>
        </Group>
      </Stack>

      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title={<Text fw={700}>Anuncios de manada</Text>}
        size={1080}
        radius="md"
        centered
      >
        {open && (
          <HerdConfigForm
            eventId={event._id}
            initial={openEnabling ? { ...saved, enabled: true } : saved}
            formFields={formFields}
            saving={saving}
            onCancel={() => setOpen(false)}
            onSave={async (config) => {
              if (await save(config)) setOpen(false);
            }}
          />
        )}
      </Modal>
    </Card>
  );
}

/**
 * Lanzar un anuncio ya, sin esperar al automático: público (todos ven el
 * conteo de un grupo) o privado (cada conectado ve otra vez el suyo).
 */
function HerdQuickAnnounce({
  eventId,
  config,
  field,
}: {
  eventId: string;
  config: EventHerdConfig;
  field?: FormField;
}) {
  const [type, setType] = useState<"public" | "private">("public");
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [counts, setCounts] = useState<HerdCounts | null>(null);

  useEffect(() => subscribeHerdCounts(eventId, setCounts), [eventId]);

  // Nombre de cada grupo conectado: el configurado en plural, o la opción del formulario
  const labelByKey = new Map<string, string>();
  for (const o of field?.options ?? []) {
    const custom = config.groupLabels?.find((g) => g.value === o.value)?.label;
    labelByKey.set(herdKey(o.value), custom || o.label);
  }
  const groups = Object.entries(counts?.counts ?? {})
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([key, n]) => ({ value: key, label: `${labelByKey.get(key) ?? key} (${n})` }));

  const handleSend = async () => {
    setSending(true);
    try {
      const r = await announceHerd(eventId, {
        type,
        key: groupKey ?? undefined,
        text: text.trim() || undefined,
      });
      notifications.show({
        color: "green",
        message:
          type === "public"
            ? `Anuncio público lanzado: ${r.label ?? r.key} (${r.count})`
            : `Mensaje privado enviado a ${r.count} conectado(s)`,
      });
      setText("");
    } catch (err) {
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      notifications.show({
        color: "red",
        message: apiMsg || "No se pudo lanzar el anuncio",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack gap={6} p="sm" style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: 8 }}>
      <Group justify="space-between">
        <Text size="sm" fw={600}>📣 Lanzar ahora</Text>
        <Text size="xs" c="dimmed">{counts?.total ?? 0} conectados</Text>
      </Group>
      <SegmentedControl
        size="xs"
        fullWidth
        value={type}
        onChange={(v) => setType(v as "public" | "private")}
        data={[
          { value: "public", label: "👥 Público" },
          { value: "private", label: "👋 Privado" },
        ]}
      />
      <Select
        size="xs"
        placeholder={type === "public" ? "Grupo con más conectados" : "Todos los conectados"}
        data={groups}
        value={groupKey}
        onChange={setGroupKey}
        clearable
        nothingFoundMessage="Nadie conectado aún"
      />
      <TextInput
        size="xs"
        placeholder="Texto solo para esta vez (opcional; usa {grupo}, {cantidad}…)"
        value={text}
        onChange={(e) => setText(e.currentTarget.value.slice(0, 280))}
      />
      <Text size="xs" c="dimmed">
        {type === "public"
          ? "Todos ven el conteo del grupo, aunque el público automático esté apagado."
          : "Cada asistente ve su propio mensaje (con su nombre y grupo), aunque ya lo haya visto."}
      </Text>
      <Button size="xs" onClick={() => void handleSend()} loading={sending} disabled={!groups.length}>
        Lanzar {type === "public" ? "anuncio público" : "mensaje privado"}
      </Button>
    </Stack>
  );
}

function HerdConfigForm({
  eventId,
  initial,
  formFields,
  saving,
  onCancel,
  onSave,
}: {
  eventId: string;
  initial: EventHerdConfig;
  formFields: FormField[];
  saving: boolean;
  onCancel: () => void;
  onSave: (config: EventHerdConfig) => void;
}) {
  const [config, setConfig] = useState<EventHerdConfig>(initial);
  const [counts, setCounts] = useState<HerdCounts | null>(null);

  useEffect(() => subscribeHerdCounts(eventId, setCounts), [eventId]);

  const priv = { ...DEFAULT_HERD_PRIVATE, ...config.privateMessage };
  const pub = { ...DEFAULT_HERD_PUBLIC, ...config.publicMessage };
  const field = formFields.find((f) => f.id === config.fieldId);
  const options = field?.type === "select" ? field.options ?? [] : [];

  const labelFor = (value: string) =>
    config.groupLabels?.find((g) => g.value === value)?.label ?? "";

  const setGroupLabel = (value: string, label: string) =>
    setConfig((c) => ({
      ...c,
      groupLabels: [...(c.groupLabels ?? []).filter((g) => g.value !== value), { value, label }],
    }));

  const setPriv = (patch: Partial<HerdMessageConfig>) =>
    setConfig((c) => ({ ...c, privateMessage: { ...priv, ...patch } }));
  const setPub = (patch: Partial<HerdPublicMessageConfig>) =>
    setConfig((c) => ({ ...c, publicMessage: { ...pub, ...patch } }));

  // Vista previa con el primer grupo (o uno de ejemplo)
  const sample = options[0];
  const sampleGroup = sample ? labelFor(sample.value) || sample.label : "endocrinólogos";

  const fieldOptions = formFields
    .filter((f) => f.type === "select" || f.type === "text")
    .map((f) => ({ value: f.id, label: f.label || f.id }));

  return (
    <Stack gap="md">
      <Tabs defaultValue="general" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="general">General</Tabs.Tab>
          <Tabs.Tab value="private">
            👋 Mensaje privado{" "}
            {!priv.enabled && <Badge size="xs" color="gray" variant="light">off</Badge>}
          </Tabs.Tab>
          <Tabs.Tab value="public">
            👥 Mensaje público{" "}
            {!pub.enabled && <Badge size="xs" color="gray" variant="light">off</Badge>}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general" pt="md">
          <Stack gap="md">
            <Switch
              label="Mostrar anuncios de manada a los asistentes"
              checked={config.enabled}
              onChange={(e) => {
                const enabled = e.currentTarget.checked;
                setConfig((c) => ({ ...c, enabled }));
              }}
            />

            {fieldOptions.length === 0 && (
              <Alert color="yellow" variant="light">
                El formulario de registro de la organización no tiene campos de
                selección o texto con los que agrupar a los asistentes.
              </Alert>
            )}

            <Select
              label="Agrupar asistentes por"
              description="Campo del formulario de registro que define la manada (especialidad, sociedad…)"
              data={fieldOptions}
              value={config.fieldId ?? null}
              onChange={(v) => setConfig((c) => ({ ...c, fieldId: v ?? undefined }))}
              searchable
            />

            {options.length > 0 && (
              <div>
                <Text size="sm" fw={500}>Nombre de cada grupo en los mensajes</Text>
                <Text size="xs" c="dimmed" mb={6}>
                  Opcional. Úsalo en plural para que el mensaje suene natural:
                  «Endocrinología» → «endocrinólogos».
                </Text>
                <ScrollArea.Autosize mah={320}>
                  <Table verticalSpacing={4} withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Opción del formulario</Table.Th>
                        <Table.Th>Se muestra como</Table.Th>
                        <Table.Th w={90}>Conectados</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {options.map((o) => (
                        <Table.Tr key={o.value}>
                          <Table.Td><Text size="xs">{o.label}</Text></Table.Td>
                          <Table.Td>
                            <TextInput
                              size="xs"
                              placeholder={o.label}
                              value={labelFor(o.value)}
                              onChange={(e) => setGroupLabel(o.value, e.currentTarget.value)}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" size="sm">
                              {counts?.counts[herdKey(o.value)] ?? 0}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea.Autosize>
              </div>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="private" pt="md">
          <HerdMessageEditor
            kind="private"
            msg={priv}
            onChange={setPriv}
            previewText={renderHerdTemplate(priv.template, {
              nombre: "Ana",
              cantidad: 34,
              grupo: sampleGroup,
              total: 120,
            })}
          />
        </Tabs.Panel>

        <Tabs.Panel value="public" pt="md">
          <HerdMessageEditor
            kind="public"
            msg={pub}
            onChange={setPub}
            previewText={renderHerdTemplate(pub.template, {
              cantidad: 35,
              grupo: sampleGroup,
              total: 121,
            })}
          >
            <Group grow align="flex-start">
              <NumberInput
                label="Intervalo mínimo (s)"
                description="Entre anuncios públicos"
                min={5}
                max={600}
                value={pub.minIntervalSec}
                onChange={(v) => setPub({ minIntervalSec: Number(v) || DEFAULT_HERD_PUBLIC.minIntervalSec })}
                disabled={!pub.enabled}
              />
              <NumberInput
                label="Anunciar cada"
                description="1 = cada llegada; 10 = 10, 20, 30…"
                min={1}
                max={1000}
                value={pub.milestoneEvery}
                onChange={(v) => setPub({ milestoneEvery: Number(v) || 1 })}
                disabled={!pub.enabled}
              />
            </Group>
          </HerdMessageEditor>
        </Tabs.Panel>
      </Tabs>

      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>Cancelar</Button>
        <Button
          loading={saving}
          disabled={config.enabled && !config.fieldId}
          onClick={() => onSave(config)}
        >
          Guardar
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * Editor de un mensaje (privado o público): vista previa animada a la
 * izquierda y texto, colocación y diseño a la derecha, como el editor de
 * anuncios del estudio.
 */
function HerdMessageEditor({
  kind,
  msg,
  onChange,
  previewText,
  children,
}: {
  kind: "private" | "public";
  msg: HerdMessageResolved;
  onChange: (patch: Partial<HerdMessageConfig>) => void;
  previewText: string;
  children?: React.ReactNode;
}) {
  // Cambiar este valor re-reproduce la animación de entrada en la vista previa
  const [previewRun, setPreviewRun] = useState(1);
  const style = { ...DEFAULT_HERD_STYLE, ...msg.style };
  const bannerStyle = herdBannerStyle(msg);
  const off = !msg.enabled;
  const fullWidth = !ALIGNABLE_TEMPLATES.includes(style.template);

  const setStyle = (patch: Partial<AnnouncementStyle>) =>
    onChange({ style: { ...style, ...patch } });

  return (
    <Grid gutter="lg">
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Stack gap="xs" style={{ position: "sticky", top: 0 }}>
          <Box
            style={{
              position: "relative",
              aspectRatio: "16 / 9",
              borderRadius: 8,
              overflow: "hidden",
              background: ANNOUNCEMENT_PREVIEW_BG,
              opacity: off ? 0.5 : 1,
            }}
          >
            <AnnouncementBanner
              zIndex={1}
              banner={{
                visible: true,
                text: previewText || "Vista previa del mensaje",
                label: msg.label?.trim() || null,
                style: bannerStyle,
                publishedAt: previewRun,
              }}
            />
          </Box>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {kind === "private"
                ? "Solo lo ve el asistente al conectarse (una vez por sesión)."
                : "Lo ven todos cuando crece la conexión de un grupo."}
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              leftSection={<IconRefresh size={14} />}
              onClick={() => setPreviewRun((n) => n + 1)}
            >
              Ver animación
            </Button>
          </Group>

          <Switch
            label={kind === "private" ? "Mostrar mensaje privado" : "Mostrar mensaje público"}
            checked={msg.enabled}
            onChange={(e) => onChange({ enabled: e.currentTarget.checked })}
          />
          <Textarea
            label="Mensaje"
            description={
              kind === "private"
                ? "Variables: {nombre}, {cantidad} del grupo, {grupo}, {total} conectados"
                : "Variables: {cantidad} del grupo, {grupo}, {total} conectados"
            }
            autosize
            minRows={2}
            maxLength={280}
            value={msg.template}
            onChange={(e) => onChange({ template: e.currentTarget.value })}
            disabled={off}
          />
          <Group grow align="flex-start">
            <TextInput
              label="Etiqueta (opcional)"
              placeholder="Ej: BIENVENIDA, MANADA"
              value={msg.label ?? ""}
              onChange={(e) => onChange({ label: e.currentTarget.value.slice(0, MAX_LABEL_LEN) })}
              disabled={off}
            />
            <NumberInput
              label="Duración (s)"
              min={2}
              max={60}
              value={msg.durationSec}
              onChange={(v) =>
                onChange({
                  durationSec:
                    Number(v) || (kind === "private" ? DEFAULT_HERD_PRIVATE : DEFAULT_HERD_PUBLIC).durationSec,
                })
              }
              disabled={off}
            />
          </Group>
          {children}
        </Stack>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 5 }}>
        <ScrollArea.Autosize mah="min(62vh, 600px)" offsetScrollbars>
          <Stack gap="sm">
            <Select
              size="xs"
              label="Posición sobre el video"
              description={fullWidth ? "Esta plantilla ocupa todo el ancho: solo cuenta arriba/abajo" : undefined}
              data={HERD_POSITIONS}
              value={msg.position}
              onChange={(v) => {
                if (!v) return;
                onChange({ position: v as HerdPosition });
                setPreviewRun((n) => n + 1);
              }}
              allowDeselect={false}
            />
            <AnnouncementStyleFields
              style={style}
              onChange={setStyle}
              onReplay={() => setPreviewRun((n) => n + 1)}
              showPlacement={false}
            />
          </Stack>
        </ScrollArea.Autosize>
      </Grid.Col>
    </Grid>
  );
}
