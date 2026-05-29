import { useState, useEffect, useCallback, useRef } from "react";
import {
  Stack,
  Group,
  Button,
  Text,
  Badge,
  Table,
  Loader,
  Center,
  Alert,
  ActionIcon,
  Modal,
} from "@mantine/core";
import { IconPlus, IconChevronRight, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  listCampaigns,
  deleteCampaign,
  type EmailCampaign,
  type CampaignStatus,
} from "../../../api/email-campaign";
import CreateCampaignModal from "./CreateCampaignModal";
import { fetchEmailVariables, type AvailableVariable, type EmailTemplate } from "../../../api/event-email";

interface CampaignListProps {
  orgId: string;
  eventId: string;
  onSelect: (campaignId: string) => void;
  templates: EmailTemplate[];
}

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Borrador",
  sending: "Enviando...",
  completed: "Completada",
  failed: "Fallida",
  cancelled: "Cancelada",
};

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "gray",
  sending: "blue",
  completed: "green",
  failed: "red",
  cancelled: "orange",
};

const AUDIENCE_LABELS: Record<string, string> = {
  event_users: "Registrados al evento",
  org_attendees: "Base de contactos",
  both: "Ambos",
};

export default function CampaignList({
  orgId,
  eventId,
  onSelect,
  templates,
}: CampaignListProps) {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formFields, setFormFields] = useState<AvailableVariable[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<EmailCampaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fetchedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [data, vars] = await Promise.all([
        listCampaigns(orgId, eventId),
        fetchedRef.current ? Promise.resolve(null) : fetchEmailVariables(orgId, eventId),
      ]);
      setCampaigns(data);
      if (vars) {
        setFormFields(vars.filter((v) => v.section === "Formulario"));
        fetchedRef.current = true;
      }
    } catch {
      notifications.show({
        title: "Error",
        message: "No se pudieron cargar las campañas",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }, [orgId, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteCampaign(confirmDelete._id);
      setCampaigns((prev) => prev.filter((c) => c._id !== confirmDelete._id));
      notifications.show({ title: "Campaña eliminada", message: confirmDelete.name, color: "gray" });
      setConfirmDelete(null);
    } catch {
      notifications.show({ title: "Error", message: "No se pudo eliminar la campaña", color: "red" });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600} size="sm" c="dimmed">
            {campaigns.length} campaña{campaigns.length !== 1 ? "s" : ""}
          </Text>
          <Button
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={() => setModalOpen(true)}
          >
            Nueva campaña
          </Button>
        </Group>

        {campaigns.length === 0 ? (
          <Alert color="gray" title="Sin campañas">
            Aún no hay campañas de email para este evento. Crea la primera.
          </Alert>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Audiencia</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Enviados / Total</Table.Th>
                <Table.Th>Fecha</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {campaigns.map((c) => (
                <Table.Tr
                  key={c._id}
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelect(c._id)}
                >
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {c.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {AUDIENCE_LABELS[c.targetAudience] ?? c.targetAudience}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={STATUS_COLORS[c.status]}
                      variant={c.status === "sending" ? "dot" : "light"}
                    >
                      {STATUS_LABELS[c.status]}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {c.stats.sent.toLocaleString()} /{" "}
                      {c.stats.total.toLocaleString()}
                      {c.stats.failed + c.stats.rejected > 0 && (
                        <Text span size="xs" c="red" ml={4}>
                          ({c.stats.failed + c.stats.rejected} errores)
                        </Text>
                      )}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {new Date(c.createdAt).toLocaleDateString("es", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      {c.status !== "sending" && (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(c); }}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                      <ActionIcon variant="subtle" color="gray">
                        <IconChevronRight size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>

      <Modal
        opened={!!confirmDelete}
        onClose={() => !deleting && setConfirmDelete(null)}
        title="Eliminar campaña"
        centered
        size="sm"
      >
        {confirmDelete && (
          <Stack gap="md">
            {confirmDelete.status === "completed" ? (
              <Alert color="red" title="Esta campaña ya fue enviada">
                Se eliminará <strong>{confirmDelete.name}</strong> y el historial
                de {confirmDelete.stats.sent.toLocaleString()} emails enviados.
                Esta acción no se puede deshacer.
              </Alert>
            ) : (
              <Text size="sm">
                ¿Eliminar la campaña <strong>{confirmDelete.name}</strong>? Esta
                acción no se puede deshacer.
              </Text>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                Cancelar
              </Button>
              <Button color="red" onClick={handleDelete} loading={deleting}>
                Eliminar
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <CreateCampaignModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        orgId={orgId}
        eventId={eventId}
        templates={templates}
        formFields={formFields}
        onCreated={(campaign, sendNow) => {
          setModalOpen(false);
          if (sendNow) {
            onSelect(campaign._id);
          } else {
            setCampaigns((prev) => [campaign, ...prev]);
          }
        }}
      />
    </>
  );
}
