import { useState, useEffect } from "react";
import {
  Modal, Stack, TextInput, Select, Button, Group, Text,
  ActionIcon, Divider, Alert, Autocomplete,
} from "@mantine/core";
import { IconPlus, IconTrash, IconAlertTriangle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  createWaCampaign, listApprovedWaTemplates,
  type WaTemplate, type WaCampaign, type WaUtmParam,
} from "../../../api/wa-campaign";
import type { AvailableVariable } from "../../../api/event-email";

// ─── UTM rows: texto fijo / variable del evento / campo del form ─────────────

type UtmRowValue =
  | { mode: "field"; fieldKey: string }
  | { mode: "variable"; varKey: string }
  | { mode: "text"; text: string };

interface UtmRow {
  id: number;
  name: string;
  val: UtmRowValue;
}

const UTM_NAME_SUGGESTIONS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_perfil",
  "utm_especialidad",
  "utm_subespecialidad",
];

const UTM_STATIC_PLACEHOLDERS: Record<string, string> = {
  utm_source: "whatsapp",
  utm_medium: "whatsapp_campaign",
  utm_campaign: "webinar-jun-2026",
  utm_content: "boton_recordatorio",
  utm_term: "cardiologia",
};

const CONTEXT_VARIABLE_OPTIONS = [
  { value: "event.slug", label: "Slug del evento (ej. webinar-jun-2026)" },
  { value: "event.title", label: "Título del evento" },
  { value: "attendee.name", label: "Nombre del asistente" },
  { value: "attendee.email", label: "Email del asistente" },
];

let nextId = 1;
const makeRow = (): UtmRow => ({
  id: nextId++,
  name: "",
  val: { mode: "text", text: "" },
});

const DEFAULT_UTM_ROWS: UtmRow[] = [
  { id: nextId++, name: "utm_source",        val: { mode: "text",     text: "whatsapp" } },
  { id: nextId++, name: "utm_medium",        val: { mode: "text",     text: "whatsapp_campaign" } },
  { id: nextId++, name: "utm_campaign",      val: { mode: "variable", varKey: "event.slug" } },
  { id: nextId++, name: "utm_perfil",        val: { mode: "field",    fieldKey: "form.field_1764364059930" } },
  { id: nextId++, name: "utm_especialidad",  val: { mode: "field",    fieldKey: "form.field_1764364185864" } },
  { id: nextId++, name: "utm_subespecialidad", val: { mode: "field",  fieldKey: "form.field_1764364257048" } },
];

function buildUtmParams(rows: UtmRow[]): WaUtmParam[] | undefined {
  const result: WaUtmParam[] = rows
    .filter((r) => {
      if (!r.name.trim()) return false;
      if (r.val.mode === "text")     return r.val.text.trim().length > 0;
      if (r.val.mode === "variable") return r.val.varKey.length > 0;
      return r.val.fieldKey.length > 0;
    })
    .map((r) => ({
      name: r.name.trim(),
      value:
        r.val.mode === "field"    ? r.val.fieldKey :
        r.val.mode === "variable" ? r.val.varKey   :
        r.val.text.trim(),
    }));
  return result.length > 0 ? result : undefined;
}

interface UtmRowProps {
  row: UtmRow;
  formFields: AvailableVariable[];
  onChange: (row: UtmRow) => void;
  onRemove: () => void;
}

function UtmRowEditor({ row, formFields, onChange, onRemove }: UtmRowProps) {
  const fieldOptions = formFields.map((f) => ({ value: f.key, label: f.label }));

  const handleModeChange = (v: string | null) => {
    if (v === "field")    onChange({ ...row, val: { mode: "field",    fieldKey: fieldOptions[0]?.value ?? "" } });
    else if (v === "variable") onChange({ ...row, val: { mode: "variable", varKey: CONTEXT_VARIABLE_OPTIONS[0].value } });
    else                  onChange({ ...row, val: { mode: "text",     text: "" } });
  };

  return (
    <Stack gap="xs" p="xs" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 6 }}>
      <Group gap="xs" align="flex-end" wrap="nowrap">
        {/* Param name */}
        <Autocomplete
          label="Parámetro"
          placeholder="utm_perfil"
          data={UTM_NAME_SUGGESTIONS}
          value={row.name}
          onChange={(v) => onChange({ ...row, name: v })}
          size="sm"
          style={{ flex: 1 }}
        />

        {/* Value type */}
        <Select
          label="Tipo"
          data={[
            { value: "text",     label: "Texto fijo" },
            { value: "variable", label: "Variable del evento" },
            ...(formFields.length > 0 ? [{ value: "field", label: "Campo del form" }] : []),
          ]}
          value={row.val.mode}
          onChange={handleModeChange}
          size="sm"
          style={{ flex: 1 }}
        />

        <ActionIcon
          color="red"
          variant="subtle"
          size="lg"
          onClick={onRemove}
          mb={4}
          style={{ flexShrink: 0 }}
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Group>

      {/* Value */}
      {row.val.mode === "field" ? (
        <Select
          label="Campo del formulario"
          placeholder="Selecciona"
          data={fieldOptions}
          value={row.val.fieldKey}
          onChange={(v) => v && onChange({ ...row, val: { mode: "field", fieldKey: v } })}
          searchable
          size="sm"
          comboboxProps={{ width: "target" }}
        />
      ) : row.val.mode === "variable" ? (
        <Select
          label="Variable del evento"
          data={CONTEXT_VARIABLE_OPTIONS}
          value={row.val.varKey}
          onChange={(v) => v && onChange({ ...row, val: { mode: "variable", varKey: v } })}
          size="sm"
          comboboxProps={{ width: "target" }}
        />
      ) : (
        <TextInput
          label="Valor"
          placeholder={UTM_STATIC_PLACEHOLDERS[row.name] ?? "valor_fijo"}
          value={row.val.text}
          onChange={(e) => onChange({ ...row, val: { mode: "text", text: e.currentTarget.value } })}
          size="sm"
        />
      )}
    </Stack>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  opened: boolean;
  onClose: () => void;
  orgId: string;
  eventId: string;
  formFields: AvailableVariable[];
  onCreated: (campaign: WaCampaign) => void;
}

export default function CreateWaCampaignModal({ opened, onClose, orgId, eventId, formFields, onCreated }: Props) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [utmRows, setUtmRows] = useState<UtmRow[]>(() => DEFAULT_UTM_ROWS.map((r) => ({ ...r })));
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setLoadingTemplates(true);
    listApprovedWaTemplates()
      .then(setTemplates)
      .catch(() => notifications.show({ title: "Error", message: "No se pudieron cargar los templates", color: "red" }))
      .finally(() => setLoadingTemplates(false));
  }, [opened]);

  const updateRow = (updated: UtmRow) =>
    setUtmRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

  const removeRow = (id: number) =>
    setUtmRows((prev) => prev.filter((r) => r.id !== id));

  const addRow = () => setUtmRows((prev) => [...prev, makeRow()]);

  const handleSubmit = async () => {
    if (!name.trim()) return notifications.show({ title: "Nombre requerido", message: "", color: "yellow" });
    if (!templateId) return notifications.show({ title: "Selecciona un template", message: "", color: "yellow" });

    setLoading(true);
    try {
      const campaign = await createWaCampaign({
        orgId,
        eventId,
        name: name.trim(),
        templateId,
        utmParams: buildUtmParams(utmRows),
      });
      notifications.show({ title: "Campaña creada", message: campaign.name, color: "green" });
      onCreated(campaign);
      handleClose();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err?.response?.data?.message ?? "No se pudo crear la campaña",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setTemplateId(null);
    setUtmRows(DEFAULT_UTM_ROWS.map((r) => ({ ...r })));
    onClose();
  };

  const templateOptions = templates.map((t) => ({
    value: t._id,
    label: t.displayName,
  }));

  return (
    <Modal opened={opened} onClose={handleClose} title="Nueva campaña de WhatsApp" size="lg" centered>
      <Stack gap="md">
        <TextInput
          label="Nombre de la campaña"
          placeholder="Ej: Recordatorio webinar junio"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />

        {templates.length === 0 && !loadingTemplates ? (
          <Alert color="orange" icon={<IconAlertTriangle size={16} />} title="Sin templates aprobados">
            No hay templates aprobados por Meta. Ve a la pestaña "Templates" para enviar uno a revisión.
          </Alert>
        ) : (
          <Select
            label="Template"
            placeholder="Selecciona un template aprobado"
            data={templateOptions}
            value={templateId}
            onChange={setTemplateId}
            disabled={loadingTemplates}
            required
          />
        )}

        <Divider label="Parámetros UTM (opcional)" labelPosition="left" />

        <Text size="xs" c="dimmed">
          Estos parámetros se agregan al link del evento que recibe cada destinatario
          (botón del template). Usa <strong>texto fijo</strong> para valores iguales en
          todos los envíos, <strong>variable del evento</strong> para datos del evento, o{" "}
          <strong>campo del form</strong> para valores individuales por asistente.
        </Text>

        <Stack gap="sm">
          {utmRows.map((row) => (
            <UtmRowEditor
              key={row.id}
              row={row}
              formFields={formFields}
              onChange={updateRow}
              onRemove={() => removeRow(row.id)}
            />
          ))}
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={13} />}
            onClick={addRow}
            style={{ alignSelf: "flex-start" }}
          >
            Agregar parámetro
          </Button>
        </Stack>

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!templateId}>
            Crear campaña
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
