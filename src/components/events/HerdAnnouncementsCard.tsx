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
  MultiSelect,
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
  DEFAULT_HERD_FORMAL_TITLE,
  DEFAULT_HERD_GREETING,
  DEFAULT_HERD_PRIVATE,
  DEFAULT_HERD_PUBLIC,
  DEFAULT_HERD_STYLE,
  getHerdExperiment,
  getHerdGreetingReport,
  HERD_MAX_FIRST,
  HERD_POSITIONS,
  herdBannerStyle,
  herdGroupName,
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
  type HerdFieldConfig,
  type HerdFormalTitleConfig,
  type HerdGreetingConfig,
  type HerdGreetingReport,
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
    labelPattern: c?.labelPattern ?? "",
    singularPattern: c?.singularPattern ?? "",
    extraHerds: c?.extraHerds ?? [],
    holdoutPercent: c?.holdoutPercent ?? 0,
    formalTitle: c?.formalTitle,
    // El color de acento global de versiones anteriores pasa al estilo de cada mensaje
    accentColor: c?.accentColor,
    privateMessage: { ...privateMessage, style: messageStyle(privateMessage, c?.accentColor) },
    publicMessage: { ...publicMessage, style: messageStyle(publicMessage, c?.accentColor) },
    greeting: { ...DEFAULT_HERD_GREETING, ...(c?.greeting ?? {}) },
  };
}

// Manadas adicionales como máximo (además de la principal); igual que el backend
const MAX_EXTRA_HERDS = 5;

/** Manadas de la config con el prefijo de sus claves: la principal y las adicionales */
function herdList(config: EventHerdConfig): Array<{ herd: HerdFieldConfig; prefix: string }> {
  if (!config.fieldId) return [];
  return [
    { herd: config, prefix: "" },
    ...(config.extraHerds ?? [])
      .filter((h) => h.fieldId && h.fieldId !== config.fieldId)
      .map((h) => ({ herd: h, prefix: `${h.fieldId}~` })),
  ];
}

/** Nombre (plural) de cada grupo de todas las manadas, por clave, y claves excluidas */
function herdGroupIndex(config: EventHerdConfig, formFields: FormField[]) {
  const labels = new Map<string, string>();
  const excluded = new Set<string>();
  for (const { herd, prefix } of herdList(config)) {
    const field = formFields.find((f) => f.id === herd.fieldId);
    for (const o of field?.options ?? []) {
      const custom = herd.groupLabels?.find((g) => g.value === o.value);
      labels.set(prefix + herdKey(o.value), herdGroupName(custom, herd, o.label).plural);
    }
    for (const v of herd.excludedGroups ?? []) excluded.add(prefix + herdKey(v));
  }
  return { labels, excluded };
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
  // Resumen de todas las manadas: campos y grupos anunciados de los de selección
  const herds = herdList(saved).map(({ herd }) => ({ herd, field: formFields.find((f) => f.id === herd.fieldId) }));
  const optionCount = herds.reduce((n, { field }) => n + (field?.type === "select" ? field.options?.length ?? 0 : 0), 0);
  const excludedCount = herds.reduce((n, { herd }) => n + (herd.excludedGroups?.length ?? 0), 0);

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
              {herds.length > 1 ? "Manadas" : "Agrupa por"}:{" "}
              <b>{herds.map(({ herd, field }) => field?.label ?? herd.fieldId).join(" + ") || "—"}</b>
            </Text>
            <Text size="xs" c="dimmed">
              Individual {saved.privateMessage?.enabled ? `(${positionLabel(saved.privateMessage.position)})` : "desactivado"}
              {" · "}
              Grupal {saved.publicMessage?.enabled ? `(${positionLabel(saved.publicMessage.position)})` : "desactivado"}
            </Text>
            {saved.greeting?.enabled && (
              <Text size="xs" c="dimmed">
                🤝 Saludo entre colegas activo
                {!!saved.greeting.holdoutPercent && ` · 🧪 ${saved.greeting.holdoutPercent}% sin botón`}
              </Text>
            )}
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
          <HerdQuickAnnounce eventId={event._id} config={saved} formFields={formFields} />
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
        {reportOpen && (
          <Tabs defaultValue="retention" keepMounted={false}>
            <Tabs.List mb="md">
              <Tabs.Tab value="retention">👥 Retención</Tabs.Tab>
              <Tabs.Tab value="greeting">🤝 Saludo entre colegas</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="retention">
              <HerdExperimentView eventId={event._id} />
            </Tabs.Panel>
            <Tabs.Panel value="greeting">
              <HerdGreetingView eventId={event._id} />
            </Tabs.Panel>
          </Tabs>
        )}
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
  formFields,
}: {
  eventId: string;
  config: EventHerdConfig;
  formFields: FormField[];
}) {
  const [type, setType] = useState<"public" | "private">("public");
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [counts, setCounts] = useState<HerdCounts | null>(null);

  useEffect(() => subscribeHerdCounts(eventId, setCounts), [eventId]);

  // Nombre de cada grupo conectado (de todas las manadas): el configurado en
  // plural, el del patrón o la opción del formulario
  const { labels: labelByKey, excluded: excludedKeys } = herdGroupIndex(config, formFields);
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

/**
 * Una manada: campo del formulario, patrón de nombre y, si es de selección,
 * nombre de cada opción y cuáles anuncia. `keyPrefix` ubica sus grupos en los
 * conteos ("" en la principal, "campo~" en las adicionales).
 */
function HerdFieldEditor({
  title,
  herd,
  keyPrefix,
  formFields,
  fieldOptions,
  counts,
  onChange,
  onRemove,
}: {
  title?: string;
  herd: HerdFieldConfig;
  keyPrefix: string;
  formFields: FormField[];
  fieldOptions: Array<{ value: string; label: string }>;
  counts: HerdCounts | null;
  onChange: (patch: Partial<HerdFieldConfig>) => void;
  onRemove?: () => void;
}) {
  const field = formFields.find((f) => f.id === herd.fieldId);
  const options = field?.type === "select" ? field.options ?? [] : [];
  const customFor = (value: string) => herd.groupLabels?.find((g) => g.value === value);
  const excluded = new Set(herd.excludedGroups ?? []);

  const setIncluded = (values: string[], included: boolean) => {
    const next = new Set(herd.excludedGroups ?? []);
    for (const v of values) {
      if (included) next.delete(v);
      else next.add(v);
    }
    onChange({ excludedGroups: [...next] });
  };

  // label = plural; singular aparte. La forma vacía se deduce de la otra.
  const setGroupLabel = (value: string, patch: { label?: string; singular?: string }) => {
    const prev = customFor(value);
    onChange({
      groupLabels: [
        ...(herd.groupLabels ?? []).filter((g) => g.value !== value),
        { value, label: prev?.label ?? "", singular: prev?.singular ?? "", ...patch },
      ],
    });
  };

  // Formas deducidas del patrón (en gris si no se escribe la otra)
  const typedPattern = herd.labelPattern?.trim() ?? "";
  const typedSingularPattern = herd.singularPattern?.trim() ?? "";
  const example = options[0]?.label ?? "Bogotá";
  const exampleForms = herdGroupName(undefined, herd, example);

  return (
    <Stack
      gap="sm"
      {...(title ? { p: "sm", style: { border: "1px solid var(--mantine-color-default-border)", borderRadius: 8 } } : {})}
    >
      {title && (
        <Group justify="space-between">
          <Text size="sm" fw={600}>{title}</Text>
          {onRemove && (
            <Button size="compact-xs" variant="subtle" color="red" onClick={onRemove}>
              Quitar
            </Button>
          )}
        </Group>
      )}

      <Select
        label="Agrupar asistentes por"
        description="Campo del formulario de registro que define la manada (especialidad, sociedad, ciudad…)"
        data={fieldOptions}
        value={herd.fieldId ?? null}
        // Las exclusiones y nombres son opciones del campo anterior: se descartan
        onChange={(v) => v !== herd.fieldId && onChange({ fieldId: v ?? undefined, excludedGroups: [], groupLabels: [] })}
        allowDeselect={!onRemove}
        searchable
      />

      {herd.fieldId && (
        <div>
          <Group grow align="flex-start">
            <TextInput
              size="xs"
              label="Nombre de los grupos — singular (opcional)"
              placeholder={typedPattern ? singularizeEs(typedPattern) : "colega de {valor}"}
              value={herd.singularPattern ?? ""}
              onChange={(e) => onChange({ singularPattern: e.currentTarget.value.slice(0, 80) })}
            />
            <TextInput
              size="xs"
              label="Plural (opcional)"
              placeholder={typedSingularPattern ? pluralizeEs(typedSingularPattern) : "colegas de {valor}"}
              value={herd.labelPattern ?? ""}
              onChange={(e) => onChange({ labelPattern: e.currentTarget.value.slice(0, 80) })}
            />
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            {"{valor}"} es la respuesta del asistente. Se usa en los grupos sin nombre
            propio{options.length > 0 ? " (abajo)" : ""}.
            {(typedPattern || typedSingularPattern) &&
              ` Ejemplo: «${exampleForms.singular}» / «${exampleForms.plural}».`}
          </Text>
        </div>
      )}

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
            Desmarca «Anunciar» para que nadie reciba mensajes de ese grupo y el
            grupal nunca hable de él. Quien tenga todos sus grupos sin anunciar
            no ve ningún mensaje.{" "}
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
                  // Sin nombre propio: el del patrón (o la opción)
                  const fallback = herdGroupName(undefined, herd, o.label);
                  const key = keyPrefix + herdKey(o.value);
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
                          placeholder={typedPlural ? singularizeEs(typedPlural) : fallback.singular}
                          value={custom?.singular ?? ""}
                          onChange={(e) => setGroupLabel(o.value, { singular: e.currentTarget.value })}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          placeholder={typedSingular ? pluralizeEs(typedSingular) : fallback.plural}
                          value={custom?.label ?? ""}
                          onChange={(e) => setGroupLabel(o.value, { label: e.currentTarget.value })}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" size="sm">
                          {counts?.counts[key] ?? 0} / {counts?.registered[key] ?? 0}
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
    </Stack>
  );
}

/**
 * Tratamiento formal antes de {nombre}: el admin elige un campo de selección
 * (p. ej. Perfil) y las opciones que lo llevan (Médico General, Residente…).
 * Sin opciones elegidas no se aplica.
 */
function HerdFormalTitleEditor({
  value,
  formFields,
  onChange,
}: {
  value: HerdFormalTitleConfig | undefined;
  formFields: FormField[];
  onChange: (v: HerdFormalTitleConfig | undefined) => void;
}) {
  // El backend usa el id del campo como ruta en Mongo: solo letras, números, _ y -
  const selectFields = formFields.filter((f) => f.type === "select" && /^[\w-]+$/.test(f.id));
  const field = selectFields.find((f) => f.id === value?.fieldId);
  const options = (field?.options ?? []).map((o) => ({ value: o.value, label: o.label || o.value }));
  const text = value?.text ?? DEFAULT_HERD_FORMAL_TITLE;
  const active = !!field && !!value?.values?.length;

  return (
    <Stack gap={6} p="sm" style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: 8 }}>
      <Group gap="xs">
        <Text size="sm" fw={600}>🩺 Tratamiento formal</Text>
        {active && <Badge size="xs" variant="light">{text.trim() || DEFAULT_HERD_FORMAL_TITLE}</Badge>}
      </Group>
      <Text size="xs" c="dimmed">
        Antepone un tratamiento al nombre en los mensajes individuales y en el
        saludo entre colegas («¡Hola {text.trim() || DEFAULT_HERD_FORMAL_TITLE} Ana!»), solo para
        quienes eligieron alguna de las opciones indicadas al registrarse.
      </Text>
      <Grid gutter="xs">
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Select
            label="Según el campo"
            placeholder="Sin tratamiento"
            clearable
            data={selectFields.map((f) => ({ value: f.id, label: f.label || f.id }))}
            value={field ? field.id : null}
            onChange={(fieldId) =>
              onChange(fieldId ? { fieldId, values: [], text: value?.text } : undefined)
            }
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 5 }}>
          <MultiSelect
            label="Opciones que lo llevan"
            placeholder={field ? "Elige una o varias" : "Primero elige el campo"}
            disabled={!field}
            data={options}
            value={value?.values ?? []}
            onChange={(values) => onChange({ ...value, values })}
            searchable
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 3 }}>
          <TextInput
            label="Tratamiento"
            placeholder={DEFAULT_HERD_FORMAL_TITLE}
            disabled={!field}
            value={value?.text ?? ""}
            maxLength={20}
            onChange={(e) => onChange({ ...value, text: e.currentTarget.value })}
          />
        </Grid.Col>
      </Grid>
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
  const extras = config.extraHerds ?? [];

  const setExtra = (i: number, patch: Partial<HerdFieldConfig>) =>
    setConfig((c) => ({
      ...c,
      extraHerds: (c.extraHerds ?? []).map((h, j) => (j === i ? { ...h, ...patch, fieldId: patch.fieldId ?? h.fieldId } : h)),
    }));

  const setPriv = (patch: Partial<HerdPrivateMessageConfig>) =>
    setConfig((c) => ({ ...c, privateMessage: { ...priv, ...patch } }));
  const setPub = (patch: Partial<HerdPublicMessageConfig>) =>
    setConfig((c) => ({ ...c, publicMessage: { ...pub, ...patch } }));
  const greet = { ...DEFAULT_HERD_GREETING, ...config.greeting };
  const setGreet = (patch: Partial<HerdGreetingConfig>) =>
    setConfig((c) => ({ ...c, greeting: { ...greet, ...patch } }));

  // Vista previa con el primer grupo (o uno de ejemplo)
  const sample = options[0];
  const sampleForms = sample
    ? herdGroupName(config.groupLabels?.find((g) => g.value === sample.value), config, sample.label)
    : { plural: "endocrinólogos", singular: "endocrinólogo" };
  const sampleGroup = sampleForms.plural;
  const sampleSingular = sampleForms.singular;

  const fieldOptions = formFields
    .filter((f) => f.type === "select" || f.type === "text")
    .map((f) => ({ value: f.id, label: f.label || f.id }));
  // Cada campo solo puede ser una manada
  const usedFields = new Set([config.fieldId, ...extras.map((h) => h.fieldId)].filter(Boolean));
  const fieldOptionsFor = (own?: string) =>
    fieldOptions.filter((o) => o.value === own || !usedFields.has(o.value));
  // Las adicionales usan el id del campo en sus claves: solo letras, números, _ y -
  const extraFieldOptionsFor = (own?: string) => fieldOptionsFor(own).filter((o) => /^[\w-]+$/.test(o.value));
  const freeFields = extraFieldOptionsFor();

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
          <Tabs.Tab value="greeting">
            🤝 Saludo{" "}
            {!greet.enabled && <Badge size="xs" color="gray" variant="light">off</Badge>}
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

            <HerdFieldEditor
              title={extras.length ? "Manada principal" : undefined}
              herd={config}
              keyPrefix=""
              formFields={formFields}
              fieldOptions={fieldOptionsFor(config.fieldId)}
              counts={counts}
              onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
            />

            {config.fieldId &&
              extras.map((h, i) => (
                <HerdFieldEditor
                  key={`${i}-${h.fieldId}`}
                  title={`Manada ${i + 2}`}
                  herd={h}
                  keyPrefix={`${h.fieldId}~`}
                  formFields={formFields}
                  fieldOptions={extraFieldOptionsFor(h.fieldId)}
                  counts={counts}
                  onChange={(patch) => setExtra(i, patch)}
                  onRemove={() =>
                    setConfig((c) => ({ ...c, extraHerds: (c.extraHerds ?? []).filter((_, j) => j !== i) }))
                  }
                />
              ))}

            {config.fieldId && (
              <Group justify="space-between" align="center">
                <Text size="xs" c="dimmed" maw={640}>
                  Con varias manadas, cada asistente pertenece a un grupo por campo
                  (p. ej. su especialidad y su ciudad). Al conectarse ve un mensaje
                  individual por manada, uno tras otro; la repetición y el grupal
                  rotan entre todas.
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  disabled={!freeFields.length || extras.length >= MAX_EXTRA_HERDS}
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      extraHerds: [...(c.extraHerds ?? []), { fieldId: freeFields[0].value }],
                    }))
                  }
                >
                  ➕ Agregar otra manada
                </Button>
              </Group>
            )}

            <HerdFormalTitleEditor
              value={config.formalTitle}
              formFields={formFields}
              onChange={(formalTitle) => setConfig((c) => ({ ...c, formalTitle }))}
            />

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
              nombre: config.formalTitle?.values?.length
                ? `${config.formalTitle.text?.trim() || DEFAULT_HERD_FORMAL_TITLE} Ana`
                : "Ana",
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

        <Tabs.Panel value="greeting" pt="md">
          <HerdGreetingForm
            greet={greet}
            privMsg={priv}
            onChange={setGreet}
            privateEnabled={priv.enabled}
            privateRepeats={!!priv.repeatEverySec}
            sampleGroup={sampleGroup}
          />
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

/**
 * Configuración del saludo entre colegas: el anuncio individual trae
 * «👋 Saludar a mis colegas» y los conectados del mismo grupo reciben
 * «👋 Ana te saluda desde …», con opción de devolverlo.
 */
function HerdGreetingForm({
  greet,
  privMsg,
  onChange,
  privateEnabled,
  privateRepeats,
  sampleGroup,
}: {
  greet: Required<HerdGreetingConfig>;
  privMsg: HerdMessageConfig; // el saludo usa el diseño del mensaje individual
  onChange: (patch: Partial<HerdGreetingConfig>) => void;
  privateEnabled: boolean;
  privateRepeats: boolean;
  sampleGroup: string;
}) {
  const examples = [
    ["Quien lo ve en su anuncio individual", "👋 Saludar a mis colegas (botón)"],
    ["Al tocarlo, se confirma", `👋 Saludaste a 22 colegas de ${sampleGroup}`],
    ["Lo reciben los conectados de su grupo", `👋 Ana te saluda desde ${sampleGroup}`],
    ["Si saludan varios seguidos", `👋 Carlos, Laura y Andrés de ${sampleGroup} te saludan`],
    ["Botón para devolverlo; quien saludó ve", "🙌 Carlos te devolvió el saludo"],
  ];

  // Vista previa sobre fondo de video con el diseño del mensaje individual
  const [moment, setMoment] = useState<"button" | "received" | "reply">("button");
  const noop = () => {};
  const previews = {
    button: {
      msg: privMsg,
      text: `¡Hola Ana! Contigo están conectados 23 profesionales de ${sampleGroup}`,
      action: { label: "👋 Saludar a mis colegas", onClick: noop },
    },
    received: {
      msg: { ...privMsg, position: greet.position, label: null },
      text: `👋 Carlos, Laura y Andrés de ${sampleGroup} te saludan`,
      action: { label: "🙌 Devolver saludo", onClick: noop },
    },
    reply: {
      msg: { ...privMsg, position: greet.position, label: null },
      text: "🙌 Carlos te devolvió el saludo",
      action: null,
    },
  }[moment];

  return (
    <Stack gap="md">
      <Stack gap={6}>
        <Box
          style={{
            position: "relative",
            aspectRatio: "16 / 9",
            borderRadius: 8,
            overflow: "hidden",
            background: ANNOUNCEMENT_PREVIEW_BG,
            opacity: greet.enabled ? 1 : 0.5,
          }}
        >
          <AnnouncementBanner
            zIndex={1}
            banner={{
              visible: true,
              text: previews.text,
              label: previews.msg.label?.trim() || null,
              style: herdBannerStyle(previews.msg),
              publishedAt: { button: 1, received: 2, reply: 3 }[moment],
              action: previews.action,
            }}
          />
        </Box>
        <SegmentedControl
          size="xs"
          value={moment}
          onChange={(v) => setMoment(v as typeof moment)}
          data={[
            { value: "button", label: "Anuncio con botón" },
            { value: "received", label: "Saludo recibido" },
            { value: "reply", label: "Le devuelven el saludo" },
          ]}
        />
        <Text size="xs" c="dimmed">
          Usa el diseño del «👋 Mensaje individual»; cámbialo allí. Aquí solo se elige dónde aparece el saludo recibido.
        </Text>
      </Stack>

      <Switch
        label="Activar «👋 Saludar a mis colegas»"
        description="Solo lo ven y reciben los asistentes del mismo grupo, con el evento en vivo. Se muestra el primer nombre de quien saluda."
        checked={greet.enabled}
        onChange={(e) => onChange({ enabled: e.currentTarget.checked })}
      />
      {greet.enabled && !privateEnabled && (
        <Alert color="yellow" variant="light" p="xs">
          El botón va dentro del mensaje individual, que está apagado: actívalo para que alguien pueda saludar.
        </Alert>
      )}
      {greet.enabled && privateEnabled && !privateRepeats && (
        <Alert color="blue" variant="light" p="xs">
          El mensaje individual no se repite: cada asistente tendrá una sola oportunidad de saludar (al
          conectarse). Para más interacción, configura «Repetir cada» en el mensaje individual o lánzalo a
          mano desde la tarjeta.
        </Alert>
      )}

      <Table withTableBorder verticalSpacing={4} fz="xs">
        <Table.Tbody>
          {examples.map(([when, text]) => (
            <Table.Tr key={when}>
              <Table.Td c="dimmed" w="40%">{when}</Table.Td>
              <Table.Td>{text}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Group grow align="flex-start">
        <Select
          label="Dónde aparece el saludo recibido"
          data={HERD_POSITIONS}
          value={greet.position}
          onChange={(v) => v && onChange({ position: v as HerdPosition })}
          allowDeselect={false}
          disabled={!greet.enabled}
        />
        <NumberInput
          label="Duración (s)"
          min={3}
          max={30}
          value={greet.durationSec}
          onChange={(v) => onChange({ durationSec: Math.min(30, Math.max(3, Number(v) || 6)) })}
          disabled={!greet.enabled}
        />
        <NumberInput
          label="Espera entre saludos (s)"
          description="Por persona"
          min={10}
          max={3600}
          value={greet.cooldownSec}
          onChange={(v) => onChange({ cooldownSec: Math.min(3600, Math.max(10, Number(v) || 60)) })}
          disabled={!greet.enabled}
        />
      </Group>

      <Stack gap={6}>
        <Text size="sm" fw={600}>🧪 Experimento: ¿el botón aumenta la permanencia?</Text>
        <Text size="xs" c="dimmed">
          Un porcentaje al azar de quienes reciben mensajes no ve el botón (ni puede devolver saludos). En
          «📊 Medir impacto → Saludo entre colegas» se compara su tiempo de reproducción contra quienes sí lo
          ven. 0 = todos ven el botón.
        </Text>
        <Group gap="xs" align="flex-end">
          <NumberInput
            w={120}
            label="% sin botón"
            min={0}
            max={90}
            value={greet.holdoutPercent}
            onChange={(v) => onChange({ holdoutPercent: Math.round(Math.min(90, Math.max(0, Number(v) || 0))) })}
            disabled={!greet.enabled}
          />
          {[0, 20, 50].map((n) => (
            <Button
              key={n}
              size="xs"
              variant={greet.holdoutPercent === n ? "filled" : "default"}
              onClick={() => onChange({ holdoutPercent: n })}
              disabled={!greet.enabled}
            >
              {n}%
            </Button>
          ))}
        </Group>
      </Stack>
    </Stack>
  );
}

const greetPct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n}%`);

type GreetingArm = NonNullable<HerdGreetingReport["experiment"]>["withButton"];

const GREETING_ARM_ROWS: Array<{ label: string; get: (a: GreetingArm) => string | number }> = [
  { label: "Asistentes en vivo", get: (a) => a.attendees },
  { label: "Reproducción promedio (min)", get: (a) => a.avgPlaybackMin },
  { label: "Mediana (min)", get: (a) => a.medianPlaybackMin },
  { label: "Vieron 30+ min", get: (a) => `${a.watched30Pct}%` },
];

/** Métricas del saludo entre colegas (📊 Medir impacto → Saludo entre colegas) */
function HerdGreetingView({ eventId }: { eventId: string }) {
  const [report, setReport] = useState<HerdGreetingReport | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      setReport(await getHerdGreetingReport(eventId));
    } catch (err) {
      console.error("Error cargando el reporte del saludo:", err);
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

  const { impressions, greets, replies, experiment: exp } = report;
  const significant = !!exp && exp.lift.pValue !== null && exp.lift.pValue < 0.05;

  return (
    <Stack gap="md">
      {!report.enabled && impressions.total === 0 && (
        <Alert color="gray" variant="light">
          El saludo entre colegas está apagado. Actívalo en «⚙️ Configurar → 🤝 Saludo».
        </Alert>
      )}

      <Group grow>
        {[
          ["Vieron el botón", impressions.withButton.toLocaleString("es")],
          ["Saludaron", `${greets.senders.toLocaleString("es")} (${greetPct(greets.ctrPct)})`],
          ["Saludos recibidos", greets.recipients.toLocaleString("es")],
          ["Devueltos", `${replies.total.toLocaleString("es")} (${greetPct(replies.greetsWithReplyPct)})`],
        ].map(([label, value]) => (
          <Card key={label} withBorder radius="md" p="xs">
            <Text size="xs" c="dimmed">{label}</Text>
            <Text fw={700}>{value}</Text>
          </Card>
        ))}
      </Group>
      <Text size="xs" c="dimmed">
        «Saludaron»: de quienes vieron el botón, cuántos saludaron al menos una vez. «Saludos recibidos»: suma
        de colegas conectados que recibió cada saludo. «Devueltos»: % de saludos con al menos una devolución.
        {impressions.attendees > impressions.withButton &&
          ` ${(impressions.attendees - impressions.withButton).toLocaleString("es")} asistentes vieron el anuncio sin botón (experimento).`}
      </Text>

      {report.byGroup.length > 0 && (
        <ScrollArea.Autosize mah={260}>
          <Table withTableBorder verticalSpacing={4} fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Grupo</Table.Th>
                <Table.Th>Vieron botón</Table.Th>
                <Table.Th>Saludaron</Table.Th>
                <Table.Th>Saludos</Table.Th>
                <Table.Th>Recibidos</Table.Th>
                <Table.Th>Devueltos</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {report.byGroup.map((g) => (
                <Table.Tr key={g.key}>
                  <Table.Td>{g.label}</Table.Td>
                  <Table.Td>{g.shown}</Table.Td>
                  <Table.Td>{g.senders} ({greetPct(g.ctrPct)})</Table.Td>
                  <Table.Td>{g.greets}</Table.Td>
                  <Table.Td>{g.recipients}</Table.Td>
                  <Table.Td>{g.replies}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      )}

      {exp ? (
        <Stack gap={6}>
          <Text size="sm" fw={600}>🧪 Permanencia con botón vs. sin botón</Text>
          <Alert
            color={exp.lift.pValue === null ? "gray" : significant ? (exp.lift.playbackMin > 0 ? "green" : "red") : "yellow"}
            variant="light"
            p="xs"
          >
            {exp.lift.pValue === null
              ? "Todavía no hay datos suficientes para comparar."
              : `Con botón reproducen ${exp.lift.playbackMin > 0 ? "+" : ""}${exp.lift.playbackMin} min${
                  exp.lift.playbackPct !== null ? ` (${exp.lift.playbackPct > 0 ? "+" : ""}${exp.lift.playbackPct}%)` : ""
                } en promedio. ${
                  significant
                    ? `Diferencia significativa (p = ${exp.lift.pValue}).`
                    : `Aún puede ser azar (p = ${exp.lift.pValue}; se busca p < 0.05).`
                }`}
          </Alert>
          <Table withTableBorder verticalSpacing={4} fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th />
                <Table.Th>👋 Con botón</Table.Th>
                <Table.Th>Sin botón</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {GREETING_ARM_ROWS.map((r) => (
                <Table.Tr key={r.label}>
                  <Table.Td>{r.label}</Table.Td>
                  <Table.Td>{r.get(exp.withButton)}</Table.Td>
                  <Table.Td>{r.get(exp.withoutButton)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Text size="xs" c="dimmed">
            Solo asistentes que ven los anuncios (sin grupo de control ni grupos excluidos) y estuvieron con el
            evento en vivo.
          </Text>
        </Stack>
      ) : (
        <Text size="xs" c="dimmed">
          Sin experimento: configura un «% sin botón» en «⚙️ Configurar → 🤝 Saludo» para comparar la permanencia.
        </Text>
      )}

      <Group justify="flex-end">
        <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} loading={loading} onClick={() => void load()}>
          Actualizar
        </Button>
      </Group>
    </Stack>
  );
}
