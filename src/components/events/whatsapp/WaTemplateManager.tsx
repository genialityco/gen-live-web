import { useState, useEffect, useCallback } from "react";
import {
  Stack, Group, Title, Text, Badge, Button, Card, SimpleGrid,
  Loader, Center, ActionIcon, Tooltip, Code, Box, Divider,
} from "@mantine/core";
import { IconRefresh, IconSend, IconPlus, IconLink, IconPencil, IconTrash, IconPhoto } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  listWaTemplates, submitWaTemplate, syncWaTemplate, syncWaTemplateUrl, deleteWaTemplate,
  type WaTemplate,
} from "../../../api/wa-campaign";
import { type FormField } from "../../../types";
import CreateWaTemplateDrawer from "./CreateWaTemplateDrawer";

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

function renderPreviewText(text: string): React.ReactNode[] {
  return text.split(/(\*[^*\n]+\*)/).map((part, i) =>
    part.startsWith("*") && part.endsWith("*") && part.length > 2
      ? <strong key={i}>{part.slice(1, -1)}</strong>
      : part,
  );
}

interface Props {
  registrationFields: FormField[];
  /** Imagen de portada del evento (o logo de la organización), usada como ejemplo en la vista previa del encabezado */
  coverImageUrl?: string;
}

export default function WaTemplateManager({ registrationFields, coverImageUrl }: Props) {
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WaTemplate | null>(null);

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

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este template? Esta acción no se puede deshacer.")) return;
    setActionId(id);
    try {
      await deleteWaTemplate(id);
      notifications.show({ title: "Template eliminado", message: "El borrador se eliminó correctamente", color: "teal" });
      await load();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err?.response?.data?.message ?? "No se pudo eliminar", color: "red" });
    } finally {
      setActionId(null);
    }
  };

  const handleSyncUrl = async (id: string) => {
    setActionId(id);
    try {
      const updated = await syncWaTemplateUrl(id);
      setTemplates((prev) => prev.map((t) => (t._id === id ? updated : t)));
      notifications.show({ title: "URL actualizada", message: `Estado: ${STATUS_LABELS[updated.status]}`, color: "teal" });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err?.response?.data?.message ?? "No se pudo actualizar la URL", color: "red" });
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
        <Button
          size="sm"
          leftSection={<IconPlus size={14} />}
          color="green"
          onClick={() => setDrawerOpen(true)}
        >
          Nuevo template
        </Button>
      </Group>

      <CreateWaTemplateDrawer
        opened={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingTemplate(null); }}
        onCreated={() => { setDrawerOpen(false); setEditingTemplate(null); load(); }}
        registrationFields={registrationFields}
        template={editingTemplate}
        coverImageUrl={coverImageUrl}
      />

      {templates.length === 0 ? (
        <Card withBorder p="xl" radius="md">
          <Text c="dimmed" ta="center">No hay templates registrados aún.</Text>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {templates.map((t) => {
            const header = t.components.find((c) => c.type === "HEADER");
            const body = t.components.find((c) => c.type === "BODY");
            const footer = t.components.find((c) => c.type === "FOOTER");
            const buttonsComp = t.components.find((c) => c.type === "BUTTONS");

            return (
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

                {/* ── Vista previa del mensaje ─────────────────────────── */}
                <Box style={{ background: "#e5ddd5", borderRadius: 6, padding: 8 }}>
                  <Box
                    style={{
                      background: "#fff",
                      borderRadius: "0 6px 6px 6px",
                      padding: "8px 10px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
                    }}
                  >
                    {header?.format === "IMAGE" ? (
                      <Box
                        mb={4}
                        style={{
                          borderRadius: 4,
                          overflow: "hidden",
                          aspectRatio: "1.91 / 1",
                          background: "#f1f1f1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {header.exampleImageUrl ? (
                          <img
                            src={header.exampleImageUrl}
                            alt="Encabezado"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                        ) : (
                          <IconPhoto size={20} color="#bbb" />
                        )}
                      </Box>
                    ) : header?.text ? (
                      <Text fw={700} size="xs" mb={2}>{renderPreviewText(header.text)}</Text>
                    ) : null}

                    {body?.text && (
                      <Text
                        size="xs"
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          display: "-webkit-box",
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {renderPreviewText(body.text)}
                      </Text>
                    )}

                    {footer?.text && (
                      <Text size="xs" c="dimmed" mt={2}>{footer.text}</Text>
                    )}

                    {buttonsComp?.buttons && buttonsComp.buttons.length > 0 && (
                      <>
                        <Divider my={4} />
                        <Stack gap={2}>
                          {buttonsComp.buttons.map((b, i) => (
                            <Text key={i} size="xs" ta="center" c="blue" fw={500}>
                              {b.text}
                            </Text>
                          ))}
                        </Stack>
                      </>
                    )}
                  </Box>
                </Box>

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
                  {t.status === "draft" && (
                    <Tooltip label="Editar borrador">
                      <ActionIcon
                        variant="light"
                        size="sm"
                        loading={actionId === t._id}
                        onClick={() => { setEditingTemplate(t); setDrawerOpen(true); }}
                      >
                        <IconPencil size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  {t.status === "draft" && !t.isDefault && (
                    <Tooltip label="Eliminar borrador">
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="sm"
                        loading={actionId === t._id}
                        onClick={() => handleDelete(t._id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
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
                  {t.metaTemplateId &&
                    t.components.some((c) => c.type === "BUTTONS" && c.buttons?.some((b) => b.type === "URL")) && (
                      <Tooltip label="Actualizar URL del botón al dominio actual del frontend">
                        <ActionIcon
                          variant="light"
                          color="grape"
                          size="sm"
                          loading={actionId === t._id}
                          onClick={() => handleSyncUrl(t._id)}
                        >
                          <IconLink size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                </Group>
              </Stack>
            </Card>
            );
          })}
        </SimpleGrid>
      )}
    </Stack>
  );
}
