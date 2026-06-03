import { useState, useEffect } from "react";
import {
  Modal, Stack, TextInput, Select, Button, Group,
  ActionIcon, Divider, Alert,
} from "@mantine/core";
import { IconPlus, IconTrash, IconAlertTriangle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  createWaCampaign, listApprovedWaTemplates,
  type WaTemplate, type WaCampaign, type WaUtmParam,
} from "../../../api/wa-campaign";

interface Props {
  opened: boolean;
  onClose: () => void;
  orgId: string;
  eventId: string;
  onCreated: (campaign: WaCampaign) => void;
}

export default function CreateWaCampaignModal({ opened, onClose, orgId, eventId, onCreated }: Props) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [utmParams, setUtmParams] = useState<WaUtmParam[]>([]);
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

  const addUtm = () => setUtmParams((prev) => [...prev, { name: "", value: "" }]);
  const removeUtm = (i: number) => setUtmParams((prev) => prev.filter((_, idx) => idx !== i));
  const updateUtm = (i: number, field: "name" | "value", val: string) =>
    setUtmParams((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)));

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
        utmParams: utmParams.filter((p) => p.name && p.value),
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
    setUtmParams([]);
    onClose();
  };

  const templateOptions = templates.map((t) => ({
    value: t._id,
    label: t.displayName,
  }));

  return (
    <Modal opened={opened} onClose={handleClose} title="Nueva campaña de WhatsApp" size="md" centered>
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

        <Stack gap="xs">
          {utmParams.map((p, i) => (
            <Group key={i} gap="xs" align="flex-end">
              <TextInput
                placeholder="utm_perfil"
                value={p.name}
                onChange={(e) => updateUtm(i, "name", e.currentTarget.value)}
                style={{ flex: 1 }}
                size="sm"
              />
              <TextInput
                placeholder="medico_especialista / attendee.name"
                value={p.value}
                onChange={(e) => updateUtm(i, "value", e.currentTarget.value)}
                style={{ flex: 2 }}
                size="sm"
              />
              <ActionIcon color="red" variant="subtle" onClick={() => removeUtm(i)}>
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          ))}
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPlus size={12} />}
            onClick={addUtm}
          >
            Agregar UTM
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
