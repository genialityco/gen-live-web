import { useState, useEffect, useCallback } from "react";
import {
  Stack, Group, Button, Text, Badge, Table,
  Loader, Center, Alert, ActionIcon,
} from "@mantine/core";
import { IconPlus, IconChevronRight } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { listWaCampaigns, type WaCampaign, type WaCampaignStatus } from "../../../api/wa-campaign";
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

  const load = useCallback(async () => {
    try {
      const data = await listWaCampaigns(orgId, eventId);
      setCampaigns(data);
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
                    <ActionIcon variant="subtle" color="gray">
                      <IconChevronRight size={16} />
                    </ActionIcon>
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
        onCreated={(campaign) => {
          setModalOpen(false);
          setCampaigns((prev) => [campaign, ...prev]);
        }}
      />
    </>
  );
}
