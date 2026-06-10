import { useState, useEffect, useCallback } from "react";
import {
  Stack, Group, Button, Text, Badge, Table,
  Loader, Center, Alert, ActionIcon, Modal,
} from "@mantine/core";
import { IconPlus, IconChevronRight, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { listWaCampaigns, deleteWaCampaign, type WaCampaign, type WaCampaignStatus } from "../../../api/wa-campaign";
import { fetchEmailVariables, type AvailableVariable } from "../../../api/event-email";
import CreateWaCampaignModal from "./CreateWaCampaignModal";

interface Props {
  orgId: string;
  eventId: string;
  onSelect: (id: string) => void;
}

const STATUS_LABELS: Record<WaCampaignStatus, string> = {
  draft: "Borrador",
  sending: "Enviando...",
  completed: "Completada",
  failed: "Fallida",
  cancelled: "Cancelada",
};

const STATUS_COLORS: Record<WaCampaignStatus, string> = {
  draft: "gray",
  sending: "blue",
  completed: "green",
  failed: "red",
  cancelled: "orange",
};

export default function WaCampaignList({ orgId, eventId, onSelect }: Props) {
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WaCampaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formFields, setFormFields] = useState<AvailableVariable[]>([]);

  const handleDeleteClick = (campaign: WaCampaign, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(campaign);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteWaCampaign(deleteTarget._id);
      setCampaigns((prev) => prev.filter((c) => c._id !== deleteTarget._id));
      notifications.show({ title: "Eliminada", message: deleteTarget.name, color: "green" });
      setDeleteTarget(null);
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err?.response?.data?.message ?? "No se pudo eliminar",
        color: "red",
      });
    } finally {
      setDeleting(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const [data, vars] = await Promise.all([
        listWaCampaigns(orgId, eventId),
        fetchEmailVariables(orgId, eventId).catch(() => []),
      ]);
      setCampaigns(data);
      setFormFields(vars.filter((v) => v.section === "Formulario"));
    } catch {
      notifications.show({ title: "Error", message: "No se pudieron cargar las campañas", color: "red" });
    } finally {
      setLoading(false);
    }
  }, [orgId, eventId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Center py="xl"><Loader /></Center>;

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600} size="sm" c="dimmed">
            {campaigns.length} campaña{campaigns.length !== 1 ? "s" : ""}
          </Text>
          <Button size="sm" leftSection={<IconPlus size={16} />} onClick={() => setModalOpen(true)}>
            Nueva campaña
          </Button>
        </Group>

        {campaigns.length === 0 ? (
          <Alert color="gray" title="Sin campañas de WhatsApp">
            Crea la primera campaña de WhatsApp para este evento.
          </Alert>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Enviados</Table.Th>
                <Table.Th>Entregados</Table.Th>
                <Table.Th>Leídos</Table.Th>
                <Table.Th>Fecha</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {campaigns.map((c) => (
                <Table.Tr key={c._id} style={{ cursor: "pointer" }} onClick={() => onSelect(c._id)}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{c.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={STATUS_COLORS[c.status]}
                      variant={c.status === "sending" ? "dot" : "light"}
                      size="sm"
                    >
                      {STATUS_LABELS[c.status]}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{c.stats.sent.toLocaleString()} / {c.stats.total.toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={c.stats.delivered > 0 ? "teal" : "dimmed"}>
                      {c.stats.delivered.toLocaleString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={c.stats.read > 0 ? "blue" : "dimmed"}>
                      {c.stats.read.toLocaleString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {new Date(c.createdAt).toLocaleDateString("es", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      {c.status !== "sending" && (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={(e) => handleDeleteClick(c, e)}
                        >
                          <IconTrash size={15} />
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

      <CreateWaCampaignModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        orgId={orgId}
        eventId={eventId}
        formFields={formFields}
        onCreated={(campaign) => {
          setModalOpen(false);
          setCampaigns((prev) => [campaign, ...prev]);
        }}
      />

      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar campaña"
        centered
        size="sm"
      >
        <Text size="sm">
          ¿Seguro que quieres eliminar <b>{deleteTarget?.name}</b>?
          {deleteTarget && deleteTarget.stats.total > 0 && (
            <> Se eliminarán también los {deleteTarget.stats.total.toLocaleString()} registros de envío.</>
          )}
        </Text>
        <Group justify="flex-end" mt="md" gap="sm">
          <Button variant="default" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancelar
          </Button>
          <Button color="red" onClick={handleDeleteConfirm} loading={deleting}>
            Eliminar
          </Button>
        </Group>
      </Modal>
    </>
  );
}
