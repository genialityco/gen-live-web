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
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  createCampaign,
  sendCampaign,
  type EmailCampaign,
  type TargetAudience,
} from "../../../api/email-campaign";
import type { EmailTemplate } from "../../../api/event-email";

interface CreateCampaignModalProps {
  opened: boolean;
  onClose: () => void;
  orgId: string;
  eventId: string;
  templates: EmailTemplate[];
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
  onCreated,
}: CreateCampaignModalProps) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [targetAudience, setTargetAudience] = useState<string | null>(null);
  const [eventUserStatus, setEventUserStatus] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Solo mostrar INVITATION y REMINDER habilitados
  const availableTemplates = templates.filter(
    (t) => (t.type === "INVITATION" || t.type === "REMINDER") && t.enabled
  );

  const templateOptions = availableTemplates.map((t) => ({
    value: t._id,
    label: `${t.type === "INVITATION" ? "Invitación" : "Recordatorio"}: ${t.name}`,
  }));

  const includesEventUsers =
    targetAudience === "event_users" || targetAudience === "both";

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
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title="Nueva campaña de email"
      size="md"
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
          onChange={setTemplateId}
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

        {targetAudience && (
          <Text size="xs" c="dimmed">
            {targetAudience === "event_users" &&
              "Se enviarán emails a los usuarios registrados en este evento."}
            {targetAudience === "org_attendees" &&
              "Se enviarán emails a toda la base de contactos de la organización."}
            {targetAudience === "both" &&
              "Se enviará a la unión de registrados al evento y base de contactos (sin duplicados)."}
          </Text>
        )}

        <Group justify="flex-end" mt="xs">
          <Button
            variant="default"
            onClick={() => {
              resetForm();
              onClose();
            }}
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
