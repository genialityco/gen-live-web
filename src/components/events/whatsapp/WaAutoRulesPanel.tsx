import { useCallback, useEffect, useState } from "react";
import {
  Stack, Group, Button, Text, Badge, Table, Alert, Switch, ActionIcon, Tooltip,
  Modal, TextInput, Select, NumberInput, Divider, Loader, Center,
} from "@mantine/core";
import {
  IconPlus, IconTrash, IconPencil, IconRobot, IconClockPlay, IconAlertTriangle,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  listWaAutoRules, createWaAutoRule, updateWaAutoRule, deleteWaAutoRule,
  listApprovedWaTemplates, WA_AUDIENCE_LABELS,
  type WaAutoRule, type WaAudience, type WaTemplate,
} from "../../../api/wa-campaign";
import { fetchEmailVariables, type AvailableVariable } from "../../../api/event-email";
import {
  buildUtmParams, defaultUtmRowsFor, makeRow, rowsFromUtmParams, type UtmRow,
} from "./waUtm";
import UtmRowEditor from "./WaUtmRowEditor";

interface Props {
  orgId: string;
  orgName: string;
  /** Evento desde el que se abre (solo para cargar los campos del formulario) */
  eventId: string;
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "2026-11-20" → inicio de ese día en hora local */
const dateInputToIso = (v: string) => new Date(`${v}T00:00:00`).toISOString();
const isoToDateInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Mensaje de error que devuelve la API (axios), o el texto por defecto */
const apiError = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

const formatDelay = (min: number) =>
  min === 0 ? "Inmediato" : min % 60 === 0 ? `${min / 60} h` : `${min} min`;

/**
 * Campañas automáticas de la organización: cada regla crea sola la campaña
 * programada en todos los eventos de la organización, y esa campaña se envía
 * cuando el evento pasa a diferido.
 */
export default function WaAutoRulesPanel({ orgId, orgName, eventId }: Props) {
  const [rules, setRules] = useState<WaAutoRule[]>([]);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [formFields, setFormFields] = useState<AvailableVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<WaAutoRule | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, t, vars] = await Promise.all([
        listWaAutoRules(orgId),
        listApprovedWaTemplates().catch(() => []),
        fetchEmailVariables(orgId, eventId).catch(() => []),
      ]);
      setRules(r);
      setTemplates(t);
      setFormFields(vars.filter((v) => v.key.startsWith("form.")));
    } catch {
      notifications.show({ title: "Error", message: "No se pudieron cargar las reglas", color: "red" });
    } finally {
      setLoading(false);
    }
  }, [orgId, eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const templateName = (id: string) => templates.find((t) => t._id === id)?.displayName ?? "Template no disponible";

  const toggle = async (rule: WaAutoRule, enabled: boolean) => {
    try {
      const updated = await updateWaAutoRule(rule._id, { enabled });
      setRules((prev) => prev.map((r) => (r._id === rule._id ? updated : r)));
      notifications.show({
        title: enabled ? "Regla activada" : "Regla desactivada",
        message: enabled
          ? "En un minuto se programará la campaña en los eventos que apliquen."
          : "Se quitaron las campañas que aún no se habían enviado.",
        color: enabled ? "green" : "gray",
      });
    } catch (err) {
      notifications.show({ title: "Error", message: apiError(err, "No se pudo actualizar"), color: "red" });
    }
  };

  const remove = async (rule: WaAutoRule) => {
    if (!window.confirm(`¿Eliminar la regla «${rule.name}»? Se quitarán las campañas que aún no se hayan enviado.`)) return;
    try {
      await deleteWaAutoRule(rule._id);
      setRules((prev) => prev.filter((r) => r._id !== rule._id));
    } catch (err) {
      notifications.show({ title: "Error", message: apiError(err, "No se pudo eliminar"), color: "red" });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2} style={{ flex: 1 }}>
          <Group gap="xs">
            <IconRobot size={18} />
            <Text fw={600}>Campañas automáticas de {orgName}</Text>
          </Group>
          <Text size="sm" c="dimmed">
            Cada regla crea sola la campaña en todos los eventos de la organización que empiecen
            desde la fecha indicada. La campaña aparece como «Programada» en cada evento y se envía
            cuando el evento pasa a diferido. Se puede cancelar en un evento puntual desde su detalle.
          </Text>
        </Stack>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing("new")}>
          Nueva regla
        </Button>
      </Group>

      {loading ? (
        <Center py="lg"><Loader size="sm" /></Center>
      ) : rules.length === 0 ? (
        <Alert color="gray" title="Sin campañas automáticas">
          Crea una regla para no tener que programar la misma campaña en cada evento, por ejemplo
          la invitación a ver la grabación a quienes no asistieron.
        </Alert>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nombre</Table.Th>
              <Table.Th>Template</Table.Th>
              <Table.Th>Destinatarios</Table.Th>
              <Table.Th>Espera</Table.Th>
              <Table.Th>Eventos desde</Table.Th>
              <Table.Th>Activa</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rules.map((r) => (
              <Table.Tr key={r._id}>
                <Table.Td><Text size="sm" fw={500}>{r.name}</Text></Table.Td>
                <Table.Td><Text size="sm">{templateName(r.templateId)}</Text></Table.Td>
                <Table.Td><Badge variant="light" size="sm">{WA_AUDIENCE_LABELS[r.audience]}</Badge></Table.Td>
                <Table.Td><Text size="sm">{formatDelay(r.delayMinutes)}</Text></Table.Td>
                <Table.Td><Text size="sm">{new Date(r.appliesFrom).toLocaleDateString("es-CO")}</Text></Table.Td>
                <Table.Td>
                  <Switch checked={r.enabled} onChange={(e) => void toggle(r, e.currentTarget.checked)} />
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap" justify="flex-end">
                    <Tooltip label="Editar">
                      <ActionIcon variant="subtle" onClick={() => setEditing(r)}><IconPencil size={16} /></ActionIcon>
                    </Tooltip>
                    <Tooltip label="Eliminar">
                      <ActionIcon variant="subtle" color="red" onClick={() => void remove(r)}><IconTrash size={16} /></ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {editing && (
        <AutoRuleModal
          rule={editing === "new" ? null : editing}
          orgId={orgId}
          templates={templates}
          formFields={formFields}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setRules((prev) =>
              prev.some((r) => r._id === saved._id)
                ? prev.map((r) => (r._id === saved._id ? saved : r))
                : [saved, ...prev],
            );
            setEditing(null);
          }}
        />
      )}
    </Stack>
  );
}

// ─── Modal de creación / edición ──────────────────────────────────────────────

interface ModalProps {
  rule: WaAutoRule | null;
  orgId: string;
  templates: WaTemplate[];
  formFields: AvailableVariable[];
  onClose: () => void;
  onSaved: (rule: WaAutoRule) => void;
}

function AutoRuleModal({ rule, orgId, templates, formFields, onClose, onSaved }: ModalProps) {
  const [name, setName] = useState(rule?.name ?? "Invitación a ver la grabación");
  const [templateId, setTemplateId] = useState<string | null>(rule?.templateId ?? null);
  const [audience, setAudience] = useState<WaAudience>(rule?.audience ?? "event_no_show");
  const [delayMinutes, setDelayMinutes] = useState<number>(rule?.delayMinutes ?? 0);
  const [appliesFrom, setAppliesFrom] = useState(rule ? isoToDateInput(rule.appliesFrom) : todayIso());
  const [utmRows, setUtmRows] = useState<UtmRow[]>(() =>
    rule ? rowsFromUtmParams(rule.utmParams) : defaultUtmRowsFor(formFields),
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return notifications.show({ title: "Nombre requerido", message: "", color: "yellow" });
    if (!templateId) return notifications.show({ title: "Selecciona un template", message: "", color: "yellow" });
    if (!appliesFrom) return notifications.show({ title: "Indica desde qué fecha aplica", message: "", color: "yellow" });
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        templateId,
        audience,
        delayMinutes,
        utmParams: buildUtmParams(utmRows) ?? null,
        appliesFrom: dateInputToIso(appliesFrom),
      };
      const saved = rule ? await updateWaAutoRule(rule._id, data) : await createWaAutoRule(orgId, data);
      notifications.show({
        title: rule ? "Regla actualizada" : "Regla creada",
        message: "En un minuto se programará la campaña en los eventos que apliquen.",
        color: "green",
      });
      onSaved(saved);
    } catch (err) {
      notifications.show({ title: "Error", message: apiError(err, "No se pudo guardar"), color: "red" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened onClose={onClose} title={rule ? "Editar campaña automática" : "Nueva campaña automática"} size="lg" centered>
      <Stack gap="md">
        <TextInput
          label="Nombre de la campaña en cada evento"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />

        {templates.length === 0 ? (
          <Alert color="orange" icon={<IconAlertTriangle size={16} />} title="Sin templates aprobados">
            No hay templates aprobados por Meta. Ve a la pestaña «Templates» para enviar uno a revisión.
          </Alert>
        ) : (
          <Select
            label="Template"
            placeholder="Selecciona un template aprobado"
            data={templates.map((t) => ({ value: t._id, label: t.displayName }))}
            value={templateId}
            onChange={setTemplateId}
            required
          />
        )}

        <Select
          label="Destinatarios"
          data={(Object.keys(WA_AUDIENCE_LABELS) as WaAudience[]).map((value) => ({
            value,
            label: WA_AUDIENCE_LABELS[value],
          }))}
          value={audience}
          onChange={(v) => v && setAudience(v as WaAudience)}
          allowDeselect={false}
          description={
            audience === "event_no_show"
              ? "Se calcula al enviar: inscritos sin sesión en el vivo ni en la grabación."
              : undefined
          }
        />

        <Group grow align="flex-start">
          <NumberInput
            label="Minutos de espera tras pasar a diferido"
            min={0}
            max={10080}
            step={5}
            allowDecimal={false}
            value={delayMinutes}
            onChange={(v) => setDelayMinutes(typeof v === "number" ? v : 0)}
            leftSection={<IconClockPlay size={16} />}
          />
          <TextInput
            type="date"
            label="Aplicar a eventos que empiecen desde"
            value={appliesFrom}
            onChange={(e) => setAppliesFrom(e.currentTarget.value)}
            required
          />
        </Group>

        {rule && (
          <Alert color="blue" variant="light">
            Al guardar, las campañas de esta regla que aún no se han enviado se vuelven a crear con la
            nueva configuración. Las ya enviadas no cambian.
          </Alert>
        )}

        <Divider label="Parámetros UTM (opcional)" labelPosition="left" />
        <Stack gap="sm">
          {utmRows.map((row) => (
            <UtmRowEditor
              key={row.id}
              row={row}
              formFields={formFields}
              onChange={(u) => setUtmRows((prev) => prev.map((r) => (r.id === u.id ? u : r)))}
              onRemove={() => setUtmRows((prev) => prev.filter((r) => r.id !== row.id))}
            />
          ))}
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={13} />}
            onClick={() => setUtmRows((prev) => [...prev, makeRow()])}
            style={{ alignSelf: "flex-start" }}
          >
            Agregar parámetro
          </Button>
        </Stack>

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void save()} loading={saving} disabled={!templateId}>
            {rule ? "Guardar cambios" : "Crear regla"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
