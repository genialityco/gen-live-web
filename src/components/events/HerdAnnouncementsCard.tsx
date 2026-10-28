// src/components/events/HerdAnnouncementsCard.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Grid,
  Group,
  Loader,
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
  getHerdExperiment,
  HERD_MAX_FIRST,
  HERD_POSITIONS,
  herdBannerStyle,
  herdGroupForms,
  herdKey,
  herdOrdinal,
  pluralizeEs,
  singularizeEs,
  renderHerdTemplate,
  subscribeHerdCounts,
  updateHerdConfig,
  type EventHerdConfig,
  type HerdCounts,
  type HerdExperimentArm,
  type HerdExperimentReport,
  type HerdMessageConfig,
  type HerdMessageResolved,
  type HerdOrdinalGender,
  type HerdPosition,
  type HerdPrivateMessageConfig,
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
    excludedGroups: c?.excludedGroups ?? [],
    holdoutPercent: c?.holdoutPercent ?? 0,
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
 * registro agrupa a los asistentes, plantillas de los mensajes individual
 * (privado) y grupal (público), su diseño y en qué parte del video aparece cada uno.
 */
export function HerdAnnouncementsCard({
  event,
  orgSlug,
  formFields,
  onEventUpdate,
}: {
  event: EventItem;
  orgSlug: string;
  formFields: FormField[];
  onEventUpdate: (event: EventItem) => void;
}) {
  const [open, setOpen] = useState(false);
  // Al activar sin campo configurado se abre el modal ya con el switch encendido
  const [openEnabling, setOpenEnabling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const saved = useMemo(() => withDefaults(event, formFields), [event, formFields]);
  const field = formFields.find((f) => f.id === saved.fieldId);
  const optionCount = field?.type === "select" ? field.options?.length ?? 0 : 0;
  const excludedCount = saved.excludedGroups?.length ?? 0;

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
              Individual {saved.privateMessage?.enabled ? `(${positionLabel(saved.privateMessage.position)})` : "desactivado"}
              {" · "}
              Grupal {saved.publicMessage?.enabled ? `(${positionLabel(saved.publicMessage.position)})` : "desactivado"}
            </Text>
            {(excludedCount > 0 || !!saved.holdoutPercent) && (
              <Text size="xs" c="dimmed">
                {excludedCount > 0 && `Anuncia a ${optionCount - excludedCount} de ${optionCount} grupos`}
                {excludedCount > 0 && !!saved.holdoutPercent && " · "}
                {!!saved.holdoutPercent && `🧪 Grupo de control: ${saved.holdoutPercent}% sin mensajes`}
              </Text>
            )}
          </Stack>
        )}

        {saved.enabled && saved.fieldId && (
          <HerdQuickAnnounce eventId={event._id} config={saved} field={field} />
        )}

        <Group justify="flex-end">
          <Button
            size="xs"
            variant="subtle"
            onClick={() => setReportOpen(true)}
            title="Compara la retención de quienes ven los mensajes contra el grupo de control"
          >
            📊 Medir impacto
          </Button>
          <Button
            size="xs"
            variant="subtle"
            component="a"
            href={`/org/${orgSlug}/event/${event.slug}/attend?herdDemo=1`}
            target="_blank"
            rel="noopener"
            title="Abre la página del asistente con un panel para disparar los mensajes. Solo lo ves tú."
          >
            🧪 Probar sobre el video
          </Button>
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

      <Modal
        opened={reportOpen}
        onClose={() => setReportOpen(false)}
        title={<Text fw={700}>📊 Impacto de los anuncios de manada</Text>}
        size="lg"
        radius="md"
        centered
      >
        {reportOpen && <HerdExperimentView eventId={event._id} />}
      </Modal>
    </Card>
  );
}

/**
 * Lanzar un anuncio ya, sin esperar al automático: grupal (todos ven el
 * conteo de un grupo) o individual (cada conectado ve otra vez el suyo).
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
    const custom = config.groupLabels?.find((g) => g.value === o.value);
    labelByKey.set(herdKey(o.value), herdGroupForms(custom, o.label).plural);
  }
  const excludedKeys = new Set((config.excludedGroups ?? []).map(herdKey));
  const groups = Object.entries(counts?.counts ?? {})
    .filter(([key, n]) => n > 0 && !excludedKeys.has(key))
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
            ? `Mensaje grupal lanzado: ${r.label ?? r.key} (${r.count})`
            : `Mensaje individual enviado a ${r.count} conectado(s)`,
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
          { value: "public", label: "👥 Grupal" },
          { value: "private", label: "👋 Individual" },
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
          ? "Todos ven el conteo del grupo, aunque el grupal automático esté apagado."
          : "Cada asistente ve su propio mensaje (con su nombre y grupo), aunque ya lo haya visto."}
      </Text>
      <Button size="xs" onClick={() => void handleSend()} loading={sending} disabled={!groups.length}>
        Lanzar {type === "public" ? "mensaje grupal" : "mensaje individual"}
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

  const customFor = (value: string) => config.groupLabels?.find((g) => g.value === value);

  const excluded = new Set(config.excludedGroups ?? []);
  const setIncluded = (values: string[], included: boolean) =>
    setConfig((c) => {
      const next = new Set(c.excludedGroups ?? []);
      for (const v of values) {
        if (included) next.delete(v);
        else next.add(v);
      }
      return { ...c, excludedGroups: [...next] };
    });

  // label = plural; singular aparte. La forma vacía se deduce de la otra.
  const setGroupLabel = (value: string, patch: { label?: string; singular?: string }) =>
    setConfig((c) => {
      const prev = c.groupLabels?.find((g) => g.value === value);
      return {
        ...c,
        groupLabels: [
          ...(c.groupLabels ?? []).filter((g) => g.value !== value),
          { value, label: prev?.label ?? "", singular: prev?.singular ?? "", ...patch },
        ],
      };
    });

  const setPriv = (patch: Partial<HerdPrivateMessageConfig>) =>
    setConfig((c) => ({ ...c, privateMessage: { ...priv, ...patch } }));
  const setPub = (patch: Partial<HerdPublicMessageConfig>) =>
    setConfig((c) => ({ ...c, publicMessage: { ...pub, ...patch } }));

  // Vista previa con el primer grupo (o uno de ejemplo)
  const sample = options[0];
  const sampleForms = sample
    ? herdGroupForms(customFor(sample.value), sample.label)
    : { plural: "endocrinólogos", singular: "endocrinólogo" };
  const sampleGroup = sampleForms.plural;
  const sampleSingular = sampleForms.singular;

  const fieldOptions = formFields
    .filter((f) => f.type === "select" || f.type === "text")
    .map((f) => ({ value: f.id, label: f.label || f.id }));

  return (
    <Stack gap="md">
      <Tabs defaultValue="general" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="general">General</Tabs.Tab>
          <Tabs.Tab value="private">
            👋 Mensaje individual{" "}
            {!priv.enabled && <Badge size="xs" color="gray" variant="light">off</Badge>}
          </Tabs.Tab>
          <Tabs.Tab value="public">
            👥 Mensaje grupal{" "}
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
              // Las exclusiones son opciones del campo anterior: se descartan
              onChange={(v) => setConfig((c) => ({ ...c, fieldId: v ?? undefined, excludedGroups: [] }))}
              searchable
            />

            {options.length > 0 && (
              <div>
                <Group justify="space-between" align="flex-end">
                  <Text size="sm" fw={500}>Grupos y nombre de cada uno en los mensajes</Text>
                  <Group gap={4}>
                    <Text size="xs" c="dimmed">
                      Anuncia a {options.filter((o) => !excluded.has(o.value)).length} de {options.length}
                    </Text>
                    <Button size="compact-xs" variant="subtle" onClick={() => setIncluded(options.map((o) => o.value), true)}>
                      Todos
                    </Button>
                    <Button size="compact-xs" variant="subtle" onClick={() => setIncluded(options.map((o) => o.value), false)}>
                      Ninguno
                    </Button>
                  </Group>
                </Group>
                <Text size="xs" c="dimmed" mb={6}>
                  Desmarca «Anunciar» para que los asistentes de ese grupo no vean
                  ningún mensaje (ni individual ni grupal) y para que el grupal
                  nunca hable de ese grupo.{" "}
                  Opcional. Escribe una sola forma (singular o plural) y la otra
                  se completa sola (en gris); escríbela solo si la sugerencia no
                  queda bien. «Endocrinología» → «endocrinólogo» / «endocrinólogos».
                  En los mensajes, {"{grupo}"} usa el singular con 1 conectado y el plural con más.
                </Text>
                <ScrollArea.Autosize mah={320}>
                  <Table verticalSpacing={4} withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w={70}>Anunciar</Table.Th>
                        <Table.Th>Opción del formulario</Table.Th>
                        <Table.Th>Singular (1)</Table.Th>
                        <Table.Th>Plural (2 o más)</Table.Th>
                        <Table.Th w={110}>Conectados / inscritos</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {options.map((o) => {
                        const custom = customFor(o.value);
                        const typedSingular = custom?.singular?.trim() ?? "";
                        const typedPlural = custom?.label?.trim() ?? "";
                        return (
                          <Table.Tr key={o.value} style={{ opacity: excluded.has(o.value) ? 0.5 : 1 }}>
                            <Table.Td>
                              <Checkbox
                                size="xs"
                                checked={!excluded.has(o.value)}
                                onChange={(e) => setIncluded([o.value], e.currentTarget.checked)}
                                aria-label={`Anunciar a ${o.label}`}
                              />
                            </Table.Td>
                            <Table.Td><Text size="xs">{o.label}</Text></Table.Td>
                            <Table.Td>
                              <TextInput
                                size="xs"
                                placeholder={typedPlural ? singularizeEs(typedPlural) : o.label}
                                value={custom?.singular ?? ""}
                                onChange={(e) => setGroupLabel(o.value, { singular: e.currentTarget.value })}
                              />
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                size="xs"
                                placeholder={typedSingular ? pluralizeEs(typedSingular) : o.label}
                                value={custom?.label ?? ""}
                                onChange={(e) => setGroupLabel(o.value, { label: e.currentTarget.value })}
                              />
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="light" size="sm">
                                {counts?.counts[herdKey(o.value)] ?? 0} / {counts?.registered[herdKey(o.value)] ?? 0}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </ScrollArea.Autosize>
              </div>
            )}

            <Stack gap={6} p="sm" style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: 8 }}>
              <Text size="sm" fw={600}>🧪 Experimento: grupo de control</Text>
              <Text size="xs" c="dimmed">
                Un porcentaje de los asistentes, sorteado al azar al conectarse por
                primera vez, no ve ningún mensaje. Así puedes comparar su retención
                contra quienes sí los ven en «📊 Medir impacto». Cada asistente
                conserva su sorteo aunque salga y vuelva. 0 = todos ven los mensajes.
              </Text>
              <Group align="flex-end" gap="xs">
                <NumberInput
                  w={140}
                  label="Sin mensajes"
                  suffix="%"
                  min={0}
                  max={90}
                  step={5}
                  value={config.holdoutPercent ?? 0}
                  onChange={(v) =>
                    setConfig((c) => ({ ...c, holdoutPercent: Math.round(Math.min(90, Math.max(0, Number(v) || 0))) }))
                  }
                />
                {[0, 10, 20, 50].map((n) => (
                  <Button
                    key={n}
                    size="xs"
                    variant={config.holdoutPercent === n ? "filled" : "default"}
                    onClick={() => setConfig((c) => ({ ...c, holdoutPercent: n }))}
                  >
                    {n}%
                  </Button>
                ))}
              </Group>
              {!!config.holdoutPercent && (
                <Text size="xs" c="dimmed">
                  50% da la medición más rápida; 10–20% sacrifica menos audiencia
                  pero necesita más asistentes para concluir.
                </Text>
              )}
            </Stack>
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
              grupoSingular: sampleSingular,
              inscritos: 50,
              inscritosTotal: 300,
              total: 120,
            })}
          >
            <Stack gap={6} p="sm" style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: 8 }}>
              <Text size="sm" fw={600}>🥇 Primeros en conectarse</Text>
              <Text size="xs" c="dimmed">
                Los primeros de cada grupo ven este mensaje en lugar del de arriba.
                Desde el siguiente en llegar, todos ven el mensaje normal.
              </Text>
              <Group grow align="flex-start">
                <NumberInput
                  label="Personalizar para los primeros"
                  description="0 = desactivado"
                  min={0}
                  max={HERD_MAX_FIRST}
                  value={priv.firstCount}
                  onChange={(v) => setPriv({ firstCount: Math.min(HERD_MAX_FIRST, Math.max(0, Number(v) || 0)) })}
                  disabled={!priv.enabled}
                />
                <Select
                  label="{posicion} se escribe"
                  data={[
                    { value: "f", label: "primera, segunda… (persona)" },
                    { value: "m", label: "primer, segundo… (médico)" },
                  ]}
                  value={priv.ordinalGender}
                  onChange={(v) => v && setPriv({ ordinalGender: v as HerdOrdinalGender })}
                  allowDeselect={false}
                  disabled={!priv.enabled || !priv.firstCount}
                />
              </Group>
              <Textarea
                label="Mensaje para los primeros"
                description="Variables: {posicion}, {nombre}, {cantidad} del grupo, {grupo}, {grupo_singular}, {grupo_plural}, {total} conectados, {inscritos} del grupo, {inscritos_total}"
                autosize
                minRows={2}
                maxLength={280}
                value={priv.firstTemplate}
                onChange={(e) => setPriv({ firstTemplate: e.currentTarget.value })}
                disabled={!priv.enabled || !priv.firstCount}
              />
              {!!priv.firstCount && (
                <Text size="xs" c="dimmed">
                  Ej. para quien llega de segundo:{" "}
                  <i>
                    {renderHerdTemplate(priv.firstTemplate, {
                      nombre: "Ana",
                      cantidad: 2,
                      grupo: sampleGroup,
                      grupoSingular: sampleSingular,
                      inscritos: 50,
                      inscritosTotal: 300,
                      total: 15,
                      posicion: herdOrdinal(2, priv.ordinalGender),
                    })}
                  </i>
                </Text>
              )}
            </Stack>
          </HerdMessageEditor>
        </Tabs.Panel>

        <Tabs.Panel value="public" pt="md">
          <HerdMessageEditor
            kind="public"
            msg={pub}
            onChange={setPub}
            previewText={renderHerdTemplate(pub.template, {
              cantidad: 35,
              grupo: sampleGroup,
              grupoSingular: sampleSingular,
              inscritos: 50,
              inscritosTotal: 300,
              total: 121,
            })}
          >
            <Switch
              label="Anunciar también cuando crece un grupo"
              description="Apagado: el grupal solo sale cada «Repetir cada» minutos, con un grupo al azar (sin repetir hasta que salgan todos)"
              checked={pub.announceOnGrowth}
              onChange={(e) => setPub({ announceOnGrowth: e.currentTarget.checked })}
              disabled={!pub.enabled}
            />
            {pub.enabled && !pub.announceOnGrowth && !pub.repeatEverySec && (
              <Alert color="yellow" variant="light" p="xs">
                Sin anuncio al crecer y sin «Repetir cada», el grupal solo saldrá cuando lo lances a mano.
              </Alert>
            )}
            <Group grow align="flex-start">
              <NumberInput
                label="Intervalo mínimo (s)"
                description="Entre mensajes grupales"
                min={5}
                max={600}
                value={pub.minIntervalSec}
                onChange={(v) => setPub({ minIntervalSec: Number(v) || DEFAULT_HERD_PUBLIC.minIntervalSec })}
                disabled={!pub.enabled || !pub.announceOnGrowth}
              />
              <NumberInput
                label="Anunciar cada"
                description="1 = cada llegada; 10 = 10, 20, 30…"
                min={1}
                max={1000}
                value={pub.milestoneEvery}
                onChange={(v) => setPub({ milestoneEvery: Number(v) || 1 })}
                disabled={!pub.enabled || !pub.announceOnGrowth}
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
 * Editor de un mensaje (individual o grupal): vista previa animada a la
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
                ? "Solo lo ve el asistente al conectarse (una vez por sesión) y, si se repite, cada cierto tiempo."
                : "Lo ven todos cuando crece la conexión de un grupo y, si se repite, cada cierto tiempo."}
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
            label={kind === "private" ? "Mostrar mensaje individual" : "Mostrar mensaje grupal"}
            checked={msg.enabled}
            onChange={(e) => onChange({ enabled: e.currentTarget.checked })}
          />
          <Textarea
            label="Mensaje"
            description={
              kind === "private"
                ? "Variables: {nombre}, {cantidad} del grupo, {grupo} (singular con 1, plural con más), {grupo_singular}, {grupo_plural}, {total} conectados, {inscritos} del grupo, {inscritos_total} en el evento. Concordancia: {es|son}, {conectado|conectados}…"
                : "Variables: {cantidad} del grupo, {grupo} (singular con 1, plural con más), {grupo_singular}, {grupo_plural}, {total} conectados, {inscritos} del grupo, {inscritos_total} en el evento. Concordancia: {es|son}, {conectado|conectados}…"
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
          <NumberInput
            label="Repetir cada (minutos)"
            description={
              kind === "private"
                ? "Cada asistente vuelve a ver su mensaje con los conectados de ese momento. 0 = no repetir"
                : "Se anuncia el estado actual de un grupo (rotando entre grupos) aunque nadie nuevo llegue. 0 = no repetir"
            }
            min={0}
            max={60}
            value={msg.repeatEverySec / 60}
            onChange={(v) => onChange({ repeatEverySec: Math.round(Math.min(60, Math.max(0, Number(v) || 0)) * 60) })}
            disabled={off}
          />
          {msg.repeatEverySec > 0 && (
            <Textarea
              label="Mensaje al repetir (opcional)"
              description="Vacío = el mismo mensaje de arriba"
              placeholder="Ej: Ahora mismo hay {cantidad} {grupo} conectados"
              autosize
              minRows={1}
              maxLength={280}
              value={msg.repeatTemplate}
              onChange={(e) => onChange({ repeatTemplate: e.currentTarget.value })}
              disabled={off}
            />
          )}
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

const fmtMin = (n: number) => `${n.toLocaleString("es")} min`;
const fmtPct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("es")}%`);

const ARM_ROWS: Array<{ label: string; get: (a: HerdExperimentArm) => string }> = [
  { label: "Asistentes", get: (a) => a.attendees.toLocaleString("es") },
  { label: "Reproducción promedio", get: (a) => fmtMin(a.avgPlaybackMin) },
  { label: "Reproducción mediana", get: (a) => fmtMin(a.medianPlaybackMin) },
  { label: "Conectado promedio", get: (a) => fmtMin(a.avgPresenceMin) },
  { label: "Vio ≥ 15 min", get: (a) => fmtPct(a.watched15Pct) },
  { label: "Vio ≥ 30 min", get: (a) => fmtPct(a.watched30Pct) },
  { label: "Vio ≥ 60 min", get: (a) => fmtPct(a.watched60Pct) },
  { label: "Se quedó hasta el final", get: (a) => fmtPct(a.untilEndPct) },
  { label: "Sesiones por asistente", get: (a) => a.avgSessions.toLocaleString("es") },
];

/**
 * Reporte del experimento: quienes vieron los mensajes (tratamiento) contra
 * el grupo de control sorteado. Los grupos excluidos van aparte porque no se
 * eligieron al azar.
 */
function HerdExperimentView({ eventId }: { eventId: string }) {
  const [report, setReport] = useState<HerdExperimentReport | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      setReport(await getHerdExperiment(eventId));
    } catch (err) {
      console.error("Error cargando el experimento de manada:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (loading && !report) return <Group justify="center" p="lg"><Loader size="sm" /></Group>;
  if (error || !report) return <Alert color="red" variant="light">No se pudo cargar el reporte.</Alert>;

  const { treatment, control, excluded, lift } = report;
  const hasControl = control.attendees > 0;
  const significant = lift.pValue !== null && lift.pValue < 0.05;
  const verdictColor =
    !hasControl || lift.pValue === null ? "gray" : significant ? (lift.playbackMin > 0 ? "green" : "red") : "yellow";

  return (
    <Stack gap="md">
      {!hasControl ? (
        <Alert color="gray" variant="light">
          Aún no hay grupo de control. Configura un porcentaje en «⚙️ Configurar →
          🧪 Experimento» antes de que se conecten los asistentes.
        </Alert>
      ) : (
        <Alert color={verdictColor} variant="light">
          {lift.pValue === null ? (
            "Todavía no hay datos suficientes para comparar."
          ) : (
            <>
              Quienes ven los mensajes reproducen{" "}
              <b>{lift.playbackMin > 0 ? "+" : ""}{fmtMin(lift.playbackMin)}</b>
              {lift.playbackPct !== null && <> ({lift.playbackPct > 0 ? "+" : ""}{lift.playbackPct}%)</>} en
              promedio frente al grupo de control.{" "}
              {significant
                ? `La diferencia es estadísticamente significativa (p = ${lift.pValue}).`
                : `Aún puede ser azar (p = ${lift.pValue}; se busca p < 0.05): hacen falta más asistentes o un efecto mayor.`}
            </>
          )}
        </Alert>
      )}

      <Table withTableBorder verticalSpacing={4} fz="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th />
            <Table.Th>👥 Ven mensajes</Table.Th>
            <Table.Th>🧪 Control</Table.Th>
            {excluded.attendees > 0 && <Table.Th>🚫 Grupos excluidos</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {ARM_ROWS.map((r) => (
            <Table.Tr key={r.label}>
              <Table.Td>{r.label}</Table.Td>
              <Table.Td>{r.get(treatment)}</Table.Td>
              <Table.Td>{r.get(control)}</Table.Td>
              {excluded.attendees > 0 && <Table.Td>{r.get(excluded)}</Table.Td>}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Text size="xs" c="dimmed">
        Solo cuenta a los asistentes con grupo que estuvieron conectados con el
        evento en vivo (en diferido no se muestran los mensajes)
        {!!report.notLive && ` · ${report.notLive.toLocaleString("es")} sorteados que no llegaron al vivo quedan fuera`}
        . «Reproducción» es tiempo real de video (sin pausas ni pestañas de
        fondo). {!report.eventEnded && "«Se quedó hasta el final» aparece cuando el evento termina. "}
        Los grupos excluidos no se eligieron al azar: compáralos solo como referencia.
      </Text>

      <Group justify="flex-end">
        <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} loading={loading} onClick={() => void load()}>
          Actualizar
        </Button>
      </Group>
    </Stack>
  );
}
