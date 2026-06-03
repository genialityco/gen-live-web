import { useState, useEffect, useCallback } from "react";
import {
  Stack, Group, Title, Text, Badge, Button, Card, SimpleGrid,
  Loader, Center, Modal, TextInput, Select, ActionIcon, Tooltip,
  Alert, Code,
} from "@mantine/core";
import { IconRefresh, IconSend, IconPlus, IconAlertTriangle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  listWaTemplates, submitWaTemplate, syncWaTemplate,
  type WaTemplate,
} from "../../../api/wa-campaign";

const STATUS_LABELS: Record<WaTemplate["status"], string> = {
  draft: "Borrador",
  pending_review: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
  paused: "Pausado",
  disabled: "Deshabilitado",
};

const STATUS_COLORS: Record<WaTemplate["status"], string> = {
  draft: "gray",
  pending_review: "blue",
  approved: "green",
  rejected: "red",
  paused: "orange",
  disabled: "dark",
};

export default function WaTemplateManager() {
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listWaTemplates();
      setTemplates(data);
    } catch {
      notifications.show({ title: "Error", message: "No se pudieron cargar los templates", color: "red" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (id: string) => {
    setActionId(id);
    try {
      await submitWaTemplate(id);
      notifications.show({ title: "Enviado a Meta", message: "El template está en revisión (24-48h)", color: "blue" });
      await load();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err?.response?.data?.message ?? "No se pudo enviar", color: "red" });
    } finally {
      setActionId(null);
    }
  };

  const handleSync = async (id: string) => {
    setActionId(id);
    try {
      const updated = await syncWaTemplate(id);
      setTemplates((prev) => prev.map((t) => (t._id === id ? updated : t)));
      notifications.show({ title: "Sincronizado", message: `Estado: ${STATUS_LABELS[updated.status]}`, color: "teal" });
    } catch {
      notifications.show({ title: "Error", message: "No se pudo sincronizar", color: "red" });
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <Center py="xl"><Loader /></Center>;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Stack gap={2}>
          <Title order={5}>Templates de WhatsApp</Title>
          <Text size="sm" c="dimmed">
            Los templates deben ser aprobados por Meta antes de usarlos en campañas.
          </Text>
        </Stack>
      </Group>

      <Alert color="blue" icon={<IconAlertTriangle size={16} />}>
        Los templates se crean en Meta Business Manager. Aquí puedes ver su estado
        y sincronizarlo manualmente si no llega el webhook automático.
      </Alert>

      {templates.length === 0 ? (
        <Card withBorder p="xl" radius="md">
          <Text c="dimmed" ta="center">No hay templates registrados aún.</Text>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {templates.map((t) => (
            <Card key={t._id} withBorder radius="md" p="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={600} size="sm">{t.displayName}</Text>
                  <Badge color={STATUS_COLORS[t.status]} variant="light" size="sm">
                    {STATUS_LABELS[t.status]}
                  </Badge>
                </Group>

                <Code block style={{ fontSize: 11 }}>{t.name}</Code>

                <Group gap={4}>
                  <Badge size="xs" variant="outline" color="gray">{t.category}</Badge>
                  <Badge size="xs" variant="outline" color="gray">{t.language}</Badge>
                </Group>

                {t.rejectionReason && (
                  <Text size="xs" c="red">Motivo: {t.rejectionReason}</Text>
                )}

                <Group gap="xs" mt={4}>
                  {t.status === "draft" && (
                    <Button
                      size="xs"
                      leftSection={<IconSend size={12} />}
                      loading={actionId === t._id}
                      onClick={() => handleSubmit(t._id)}
                    >
                      Enviar a revisión
                    </Button>
                  )}
                  {t.metaTemplateId && (
                    <Tooltip label="Sincronizar estado con Meta">
                      <ActionIcon
                        variant="light"
                        size="sm"
                        loading={actionId === t._id}
                        onClick={() => handleSync(t._id)}
                      >
                        <IconRefresh size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
