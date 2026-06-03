import { useState, useEffect, useCallback, useRef } from "react";
import {
  Stack, Group, Title, Badge, Button, Text, SimpleGrid, Card,
  Progress, Table, Select, Loader, Center, Pagination, ActionIcon,
  Divider,
} from "@mantine/core";
import {
  IconArrowLeft, IconPlayerPlay, IconX, IconRefresh,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  getWaCampaign, sendWaCampaign, cancelWaCampaign, listWaDeliveries,
  type WaCampaign, type WaDelivery, type WaCampaignStatus, type WaDeliveryStatus,
} from "../../../api/wa-campaign";

interface Props {
  campaignId: string;
  onBack: () => void;
}

const STATUS_LABELS: Record<WaCampaignStatus, string> = {
  draft: "Borrador", sending: "Enviando...", completed: "Completada",
  failed: "Fallida", cancelled: "Cancelada",
};
const STATUS_COLORS: Record<WaCampaignStatus, string> = {
  draft: "gray", sending: "blue", completed: "green", failed: "red", cancelled: "orange",
};
const DELIVERY_LABELS: Record<WaDeliveryStatus, string> = {
  pending: "Pendiente", sent: "Enviado", delivered: "Entregado",
  read: "Leído", failed: "Fallido", opted_out: "Opt-out",
};
const DELIVERY_COLORS: Record<WaDeliveryStatus, string> = {
  pending: "gray", sent: "blue", delivered: "teal",
  read: "green", failed: "red", opted_out: "orange",
};

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "sent", label: "Enviados" },
  { value: "delivered", label: "Entregados" },
  { value: "read", label: "Leídos" },
  { value: "pending", label: "Pendientes" },
  { value: "failed", label: "Fallidos" },
  { value: "opted_out", label: "Opt-out" },
];

const LIMIT = 50;

export default function WaCampaignDetail({ campaignId, onBack }: Props) {
  const [campaign, setCampaign] = useState<WaCampaign | null>(null);
  const [deliveries, setDeliveries] = useState<WaDelivery[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDeliveries = useCallback(async (p: number, status?: string) => {
    const result = await listWaDeliveries(campaignId, {
      status: status === "all" ? undefined : status,
      page: p,
      limit: LIMIT,
    });
    setDeliveries(result.data);
    setTotal(result.total);
  }, [campaignId]);

  const loadAll = useCallback(async () => {
    try {
      const camp = await getWaCampaign(campaignId);
      setCampaign(camp);
      await loadDeliveries(page, statusFilter);

      if (camp.status === "sending") {
        if (!pollingRef.current) {
          pollingRef.current = setInterval(async () => {
            const updated = await getWaCampaign(campaignId);
            setCampaign(updated);
            if (updated.status !== "sending" && pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
              await loadDeliveries(page, statusFilter);
            }
          }, 5000);
        }
      } else if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } catch {
      notifications.show({ title: "Error", message: "No se pudo cargar la campaña", color: "red" });
    } finally {
      setLoading(false);
    }
  }, [campaignId, page, statusFilter, loadDeliveries]);

  useEffect(() => {
    loadAll();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [loadAll]);

  const handleSend = async () => {
    setActionLoading(true);
    try {
      const result = await sendWaCampaign(campaignId);
      notifications.show({ title: "Envío iniciado", message: `${result.total.toLocaleString()} destinatarios`, color: "blue" });
      await loadAll();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err?.response?.data?.message ?? "Error al iniciar", color: "red" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await cancelWaCampaign(campaignId);
      notifications.show({ title: "Cancelada", message: "La campaña fue cancelada", color: "orange" });
      const updated = await getWaCampaign(campaignId);
      setCampaign(updated);
    } catch {
      notifications.show({ title: "Error", message: "No se pudo cancelar", color: "red" });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !campaign) return <Center py="xl"><Loader /></Center>;

  const { stats } = campaign;
  const sentPercent = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;
  const readRate = stats.sent > 0 ? ((stats.read / stats.sent) * 100).toFixed(1) : "0";

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Group gap="sm">
          <ActionIcon variant="subtle" onClick={onBack}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Title order={4}>{campaign.name}</Title>
          <Badge color={STATUS_COLORS[campaign.status]} variant={campaign.status === "sending" ? "dot" : "light"}>
            {STATUS_LABELS[campaign.status]}
          </Badge>
        </Group>
        <Group gap="xs">
          {campaign.status === "draft" && (
            <Button size="sm" leftSection={<IconPlayerPlay size={14} />} onClick={handleSend} loading={actionLoading}>
              Iniciar envío
            </Button>
          )}
          {campaign.status === "sending" && (
            <Button size="sm" color="orange" variant="light" leftSection={<IconX size={14} />} onClick={handleCancel} loading={actionLoading}>
              Cancelar
            </Button>
          )}
        </Group>
      </Group>

      {/* Progress */}
      {stats.total > 0 && (
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">{stats.sent.toLocaleString()} de {stats.total.toLocaleString()} enviados</Text>
            <Text size="xs" c="dimmed">{sentPercent}%</Text>
          </Group>
          <Progress value={sentPercent} color={campaign.status === "sending" ? "blue" : "green"} animated={campaign.status === "sending"} />
        </Stack>
      )}

      {/* Stats */}
      <SimpleGrid cols={{ base: 3, sm: 6 }}>
        <Card withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed">Total</Text>
          <Text size="xl" fw={700}>{stats.total.toLocaleString()}</Text>
        </Card>
        <Card withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed">Enviados</Text>
          <Text size="xl" fw={700} c="blue">{stats.sent.toLocaleString()}</Text>
        </Card>
        <Card withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed">Entregados</Text>
          <Text size="xl" fw={700} c="teal">{stats.delivered.toLocaleString()}</Text>
        </Card>
        <Card withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed">Leídos</Text>
          <Text size="xl" fw={700} c="green">{stats.read.toLocaleString()}</Text>
          {stats.sent > 0 && <Text size="xs" c="dimmed">{readRate}% de enviados</Text>}
        </Card>
        <Card withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed">Fallidos</Text>
          <Text size="xl" fw={700} c={stats.failed > 0 ? "red" : "dimmed"}>{stats.failed.toLocaleString()}</Text>
        </Card>
        <Card withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed">Opt-out</Text>
          <Text size="xl" fw={700} c={stats.optedOut > 0 ? "orange" : "dimmed"}>{stats.optedOut.toLocaleString()}</Text>
        </Card>
      </SimpleGrid>

      <Divider />

      {/* Filtro deliveries */}
      <Select
        label="Filtrar por estado"
        data={STATUS_FILTER_OPTIONS}
        value={statusFilter}
        onChange={(v) => { if (v) { setStatusFilter(v); setPage(1); } }}
        size="sm"
        style={{ width: 220 }}
        allowDeselect={false}
      />

      {/* Tabla */}
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Teléfono</Table.Th>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th>Enviado / Entregado / Leído</Table.Th>
            <Table.Th>Error</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {deliveries.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text size="sm" c="dimmed" ta="center" py="md">Sin registros</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            deliveries.map((d) => (
              <Table.Tr key={d._id}>
                <Table.Td><Text size="sm">{d.phone}</Text></Table.Td>
                <Table.Td><Text size="sm" c="dimmed">{d.name}</Text></Table.Td>
                <Table.Td>
                  <Badge size="sm" color={DELIVERY_COLORS[d.status]} variant="light">
                    {DELIVERY_LABELS[d.status]}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    {d.sentAt && <Text size="xs" c="dimmed">✉ {new Date(d.sentAt).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>}
                    {d.deliveredAt && <Text size="xs" c="teal">✓ {new Date(d.deliveredAt).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>}
                    {d.readAt && <Text size="xs" c="green">👁 {new Date(d.readAt).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  {d.errorMessage
                    ? <Text size="xs" c="red" lineClamp={2} maw={250}>{d.errorMessage}</Text>
                    : <Text size="xs" c="dimmed">—</Text>}
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      {total > LIMIT && (
        <Group justify="center" mt="sm">
          <Pagination total={Math.ceil(total / LIMIT)} value={page} onChange={setPage} size="sm" />
        </Group>
      )}
    </Stack>
  );
}
