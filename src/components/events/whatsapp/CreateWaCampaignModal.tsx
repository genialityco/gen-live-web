import { useState, useEffect } from "react";
import {
  Modal, Stack, TextInput, Select, Button, Group, Text,
  Divider, Alert, Switch, NumberInput,
} from "@mantine/core";
import { IconPlus, IconAlertTriangle, IconClockPlay } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  createWaCampaign, listApprovedWaTemplates, WA_AUDIENCE_LABELS,
  type WaTemplate, type WaCampaign, type WaAudience,
} from "../../../api/wa-campaign";
import type { AvailableVariable } from "../../../api/event-email";
import { DEFAULT_UTM_ROWS, buildUtmParams, makeRow, type UtmRow } from "./waUtm";
import UtmRowEditor from "./WaUtmRowEditor";

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
  const [audience, setAudience] = useState<WaAudience>("org_attendees");
  const [autoSend, setAutoSend] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState<number>(30);
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
        audience,
        autoSend: autoSend ? { delayMinutes } : null,
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
    setAudience("org_attendees");
    setAutoSend(false);
    setDelayMinutes(30);
    onClose();
  };

  // Al activar el envío automático se sugiere la audiencia de "no asistieron"
  const handleAutoSendChange = (checked: boolean) => {
    setAutoSend(checked);
    if (checked && audience === "org_attendees") setAudience("event_no_show");
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

        <Select
          label="Destinatarios"
          data={(Object.keys(WA_AUDIENCE_LABELS) as WaAudience[]).map((value) => ({
            value,
            label: WA_AUDIENCE_LABELS[value],
          }))}
          value={audience}
          onChange={(v) => v && setAudience(v as WaAudience)}
          description={
            audience === "event_no_show"
              ? "Se calcula al momento de enviar: inscritos sin sesión en el vivo ni en la grabación. Excluye a quien se dio de baja."
              : undefined
          }
          allowDeselect={false}
        />

        <Stack gap="xs">
          <Switch
            label="Enviar automáticamente cuando el evento pase a diferido (grabación)"
            checked={autoSend}
            onChange={(e) => handleAutoSendChange(e.currentTarget.checked)}
          />
          {autoSend && (
            <>
              <NumberInput
                label="Minutos de espera después de pasar a diferido"
                description="Da tiempo a que la grabación quede lista antes de invitar a verla."
                min={0}
                max={10080}
                step={5}
                allowDecimal={false}
                value={delayMinutes}
                onChange={(v) => setDelayMinutes(typeof v === "number" ? v : 0)}
                leftSection={<IconClockPlay size={16} />}
              />
              <Alert color="blue" variant="light">
                La campaña queda programada. Se envía sola cuando el evento esté en estado
                «diferido» y pasen los minutos indicados. Si el evento ya está en diferido,
                se envía al cumplirse la espera. Puedes cancelarla antes desde el detalle.
              </Alert>
            </>
          )}
        </Stack>

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
            {autoSend ? "Programar campaña" : "Crear campaña"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
