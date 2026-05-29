import { useState } from "react";
import {
  Modal,
  Stack,
  TextInput,
  Select,
  Alert,
  Button,
  Group,
  Text,
  MultiSelect,
  Collapse,
  Divider,
  ActionIcon,
  Autocomplete,
  Checkbox,
} from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconPlus, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  createCampaign,
  sendCampaign,
  type EmailCampaign,
  type TargetAudience,
  type UtmParam,
} from "../../../api/email-campaign";
import type { AvailableVariable, EmailTemplate } from "../../../api/event-email";

// ─── Types ───────────────────────────────────────────────────────────────────

type UtmRowValue =
  | { mode: "field"; fieldKey: string }
  | { mode: "variable"; varKey: string }
  | { mode: "text"; text: string };

interface UtmRow {
  id: number;
  name: string;
  val: UtmRowValue;
}

// ─── Constants ───────────────────────────────────────────────────────────────

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
  utm_source: "email",
  utm_medium: "email_campaign",
  utm_campaign: "webinar-jun-2026",
  utm_content: "banner_superior",
  utm_term: "cardiologia",
};

const CONTEXT_VARIABLE_OPTIONS = [
  { value: "event.slug", label: "Slug del evento  (ej. webinar-jun-2026)" },
  { value: "event.title", label: "Título del evento" },
  { value: "attendee.email", label: "Email del asistente" },
  { value: "attendee.id", label: "ID del asistente" },
];

let nextId = 1;
const makeRow = (): UtmRow => ({
  id: nextId++,
  name: "",
  val: { mode: "text", text: "" },
});

const DEFAULT_UTM_ROWS: UtmRow[] = [
  { id: nextId++, name: "utm_source",          val: { mode: "text",     text: "email" } },
  { id: nextId++, name: "utm_medium",          val: { mode: "text",     text: "email_campaign" } },
  { id: nextId++, name: "utm_campaign",        val: { mode: "variable", varKey: "event.slug" } },
  { id: nextId++, name: "utm_perfil",          val: { mode: "field",    fieldKey: "form.field_1764364059930" } },
  { id: nextId++, name: "utm_especialidad",    val: { mode: "field",    fieldKey: "form.field_1764364185864" } },
  { id: nextId++, name: "utm_subespecialidad", val: { mode: "field",    fieldKey: "form.field_1764364257048" } },
];

// ─── Sub-component: one UTM row ──────────────────────────────────────────────

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
    <Group gap="xs" align="flex-end" wrap="nowrap">
      {/* Param name */}
      <Autocomplete
        label="Parámetro"
        placeholder="utm_perfil"
        data={UTM_NAME_SUGGESTIONS}
        value={row.name}
        onChange={(v) => onChange({ ...row, name: v })}
        size="xs"
        style={{ width: 160, flexShrink: 0 }}
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
        size="xs"
        style={{ width: 170, flexShrink: 0 }}
      />

      {/* Value */}
      {row.val.mode === "field" ? (
        <Select
          label="Campo"
          placeholder="Selecciona"
          data={fieldOptions}
          value={row.val.fieldKey}
          onChange={(v) => v && onChange({ ...row, val: { mode: "field", fieldKey: v } })}
          searchable
          size="xs"
          style={{ flex: 1 }}
        />
      ) : row.val.mode === "variable" ? (
        <Select
          label="Variable"
          data={CONTEXT_VARIABLE_OPTIONS}
          value={row.val.varKey}
          onChange={(v) => v && onChange({ ...row, val: { mode: "variable", varKey: v } })}
          size="xs"
          style={{ flex: 1 }}
        />
      ) : (
        <TextInput
          label="Valor"
          placeholder={UTM_STATIC_PLACEHOLDERS[row.name] ?? "valor_fijo"}
          value={row.val.text}
          onChange={(e) => onChange({ ...row, val: { mode: "text", text: e.currentTarget.value } })}
          size="xs"
          style={{ flex: 1 }}
        />
      )}

      <ActionIcon
        color="red"
        variant="subtle"
        size="sm"
        onClick={onRemove}
        mt={18}
        style={{ flexShrink: 0 }}
      >
        <IconTrash size={14} />
      </ActionIcon>
    </Group>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildUtmParams(rows: UtmRow[]): UtmParam[] | undefined {
  const result: UtmParam[] = rows
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

// ─── Main component ───────────────────────────────────────────────────────────

interface CreateCampaignModalProps {
  opened: boolean;
  onClose: () => void;
  orgId: string;
  eventId: string;
  templates: EmailTemplate[];
  formFields: AvailableVariable[];
  onCreated: (campaign: EmailCampaign, sendNow: boolean) => void;
}

const AUDIENCE_OPTIONS = [
  { value: "event_users", label: "Registrados al evento (EventUsers)" },
  { value: "org_attendees", label: "Base de contactos de la org (OrgAttendees)" },
  { value: "both", label: "Ambos" },
];

const EVENT_USER_STATUS_OPTIONS = [
  { value: "registered", label: "Registrado" },
  { value: "attended", label: "Asistió" },
  { value: "cancelled", label: "Cancelado" },
];

export default function CreateCampaignModal({
  opened,
  onClose,
  orgId,
  eventId,
  templates,
  formFields,
  onCreated,
}: CreateCampaignModalProps) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [targetAudience, setTargetAudience] = useState<string | null>(null);
  const [eventUserStatus, setEventUserStatus] = useState<string[]>([]);
  const [excludeEventUsers, setExcludeEventUsers] = useState(false);
  const [utmOpen, setUtmOpen] = useState(true);
  const [utmRows, setUtmRows] = useState<UtmRow[]>(() =>
    DEFAULT_UTM_ROWS.map((r) => ({ ...r })),
  );
  const [saving, setSaving] = useState(false);

  const utmParams = buildUtmParams(utmRows);
  const hasUtm = !!utmParams;

  const updateRow = (updated: UtmRow) =>
    setUtmRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

  const removeRow = (id: number) =>
    setUtmRows((prev) => prev.filter((r) => r.id !== id));

  const addRow = () => setUtmRows((prev) => [...prev, makeRow()]);

  const availableTemplates = templates.filter(
    (t) => (t.type === "INVITATION" || t.type === "REMINDER") && t.enabled
  );

  const templateOptions = availableTemplates.map((t) => ({
    value: t._id,
    label: `${t.type === "INVITATION" ? "Invitación" : "Recordatorio"}: ${t.name}`,
  }));

  const selectedTemplate = availableTemplates.find((t) => t._id === templateId) ?? null;

  const handleTemplateChange = (value: string | null) => {
    setTemplateId(value);
    if (!value) return;
    const tpl = availableTemplates.find((t) => t._id === value);
    if (!tpl) return;
    if (tpl.type === "INVITATION") {
      setTargetAudience("org_attendees");
      setExcludeEventUsers(true);
      setEventUserStatus([]);
    } else if (tpl.type === "REMINDER") {
      setTargetAudience("event_users");
      setExcludeEventUsers(false);
      setEventUserStatus([]);
    }
  };

  const includesEventUsers =
    targetAudience === "event_users" || targetAudience === "both";

  const includesOrgAttendees =
    targetAudience === "org_attendees" || targetAudience === "both";

  const isValid = name.trim() && templateId && targetAudience;

  const handleSubmit = async (sendNow: boolean) => {
    if (!isValid) return;
    setSaving(true);
    try {
      const campaign = await createCampaign({
        orgId,
        eventId,
        name: name.trim(),
        templateId: templateId!,
        targetAudience: targetAudience as TargetAudience,
        audienceFilters:
          includesEventUsers && eventUserStatus.length > 0
            ? { eventUserStatus }
            : undefined,
        utmParams,
        excludeEventUsers: includesOrgAttendees ? excludeEventUsers : undefined,
      });

      if (sendNow) {
        await sendCampaign(campaign._id);
        notifications.show({
          title: "Campaña iniciada",
          message: "El envío ha comenzado. Puedes ver el progreso en el detalle.",
          color: "green",
        });
      } else {
        notifications.show({
          title: "Campaña creada",
          message: "La campaña fue guardada como borrador.",
          color: "blue",
        });
      }

      onCreated(campaign, sendNow);
      resetForm();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "No se pudo crear la campaña";
      notifications.show({ title: "Error", message: msg, color: "red" });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName("");
    setTemplateId(null);
    setTargetAudience(null);
    setEventUserStatus([]);
    setExcludeEventUsers(false);
    setUtmRows(DEFAULT_UTM_ROWS.map((r) => ({ ...r })));
    setUtmOpen(true);
  };

  return (
    <Modal
      opened={opened}
      onClose={() => { resetForm(); onClose(); }}
      title="Nueva campaña de email"
      size="lg"
      centered
    >
      <Stack gap="md">
        {availableTemplates.length === 0 && (
          <Alert color="yellow" title="Sin plantillas disponibles">
            Crea una plantilla de <strong>Invitación</strong> o{" "}
            <strong>Recordatorio</strong> en la pestaña "Plantillas" antes de
            crear una campaña.
          </Alert>
        )}

        <TextInput
          label="Nombre de la campaña"
          placeholder='Ej: "Recordatorio 24h - Webinar Marzo"'
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />

        <Select
          label="Plantilla"
          placeholder="Selecciona una plantilla"
          data={templateOptions}
          value={templateId}
          onChange={handleTemplateChange}
          required
          disabled={availableTemplates.length === 0}
        />

        <Select
          label="Audiencia"
          placeholder="¿A quién enviar?"
          data={AUDIENCE_OPTIONS}
          value={targetAudience}
          onChange={setTargetAudience}
          required
        />

        {includesEventUsers && (
          <MultiSelect
            label="Filtrar por estado del registro (opcional)"
            placeholder="Todos los registrados"
            data={EVENT_USER_STATUS_OPTIONS}
            value={eventUserStatus}
            onChange={setEventUserStatus}
            clearable
          />
        )}

        {includesOrgAttendees && (
          <Checkbox
            label="Excluir personas ya registradas al evento"
            description="Si está activo, quienes ya tienen un registro en el evento no recibirán este email."
            checked={excludeEventUsers}
            onChange={(e) => setExcludeEventUsers(e.currentTarget.checked)}
          />
        )}

        {targetAudience && (
          <Alert
            color={
              selectedTemplate?.type === "INVITATION" ? "blue"
              : selectedTemplate?.type === "REMINDER" ? "teal"
              : "gray"
            }
            variant="light"
            p="xs"
          >
            <Text size="xs">
              {targetAudience === "event_users" && (
                selectedTemplate?.type === "REMINDER"
                  ? "Recordatorio enviado únicamente a personas ya registradas en el evento. No recibirán el email quienes no se hayan inscrito."
                  : "Se enviarán emails a los usuarios registrados en este evento."
              )}
              {targetAudience === "org_attendees" && (
                excludeEventUsers
                  ? "Invitación enviada a toda la base de contactos de la organización, excluyendo a quienes ya están registrados en este evento. Así nadie recibe una invitación si ya se inscribió."
                  : "Se enviarán emails a toda la base de contactos de la organización (incluyendo ya registrados)."
              )}
              {targetAudience === "both" &&
                "Se enviará a la unión de registrados al evento y base de contactos (sin duplicados)."}
            </Text>
          </Alert>
        )}

        <Divider />

        <Button
          variant="subtle"
          size="xs"
          leftSection={utmOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          onClick={() => setUtmOpen((o) => !o)}
          justify="start"
          px={0}
        >
          Parámetros UTM{" "}
          {hasUtm && <Text span c="blue" ml={4}>({utmParams!.length} configurados)</Text>}
        </Button>

        <Collapse in={utmOpen}>
          <Stack gap="sm">
            <Text size="xs" c="dimmed">
              Usa <strong>texto fijo</strong> para valores iguales en todos los emails (p.ej.{" "}
              <Text span ff="monospace">utm_source=email</Text>) o <strong>campo del form</strong> para
              valores individuales por asistente. Usa{" "}
              <Text span ff="monospace">{"{{event.joinUrlWithUtm}}"}</Text> en la plantilla.
            </Text>

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
        </Collapse>

        <Group justify="flex-end" mt="xs">
          <Button
            variant="default"
            onClick={() => { resetForm(); onClose(); }}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            variant="light"
            onClick={() => handleSubmit(false)}
            loading={saving}
            disabled={!isValid || availableTemplates.length === 0}
          >
            Crear borrador
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            loading={saving}
            disabled={!isValid || availableTemplates.length === 0}
          >
            Crear y enviar ahora
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
