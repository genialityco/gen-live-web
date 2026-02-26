import { useState, useEffect, useCallback, useRef } from "react";
import {
  Stack,
  Group,
  Title,
  Badge,
  Button,
  Text,
  SimpleGrid,
  Card,
  Progress,
  Table,
  Tabs,
  Loader,
  Center,
  Pagination,
  Anchor,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconPlayerPlay,
  IconX,
  IconRefresh,
  IconDownload,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  getCampaign,
  sendCampaign,
  cancelCampaign,
  resumeCampaign,
  listDeliveries,
  exportDeliveriesUrl,
  type EmailCampaign,
  type EmailDelivery,
  type DeliveryStatus,
  type CampaignStatus,
} from "../../../api/email-campaign";

interface CampaignDetailProps {
  campaignId: string;
  onBack: () => void;
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

const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: "Pendiente",
  sent: "Enviado",
  rejected: "Rechazado",
  failed: "Fallido",
};

const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, string> = {
  pending: "gray",
  sent: "green",
  rejected: "orange",
  failed: "red",
};

const DELIVERY_TABS: Array<{ value: string; label: string; status?: DeliveryStatus }> = [
  { value: "all", label: "Todos" },
  { value: "sent", label: "Enviados", status: "sent" },
  { value: "failed", label: "Fallidos", status: "failed" },
  { value: "rejected", label: "Rechazados", status: "rejected" },
  { value: "pending", label: "Pendientes", status: "pending" },
];

export default function CampaignDetail({
  campaignId,
  onBack,
}: CampaignDetailProps) {
  const [campaign, setCampaign] = useState<EmailCampaign | null>(null);
  const [deliveries, setDeliveries] = useState<EmailDelivery[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const LIMIT = 50;

  const loadCampaign = useCallback(async () => {
    const data = await getCampaign(campaignId);
    setCampaign(data);
    return data;
  }, [campaignId]);

  const loadDeliveries = useCallback(
    async (currentPage: number, tab: string) => {
      const tabDef = DELIVERY_TABS.find((t) => t.value === tab);
      const result = await listDeliveries(campaignId, {
        status: tabDef?.status,
        page: currentPage,
        limit: LIMIT,
      });
      setDeliveries(result.data);
      setTotal(result.total);
    },
    [campaignId]
  );

  const loadAll = useCallback(async () => {
    try {
      const camp = await loadCampaign();
      await loadDeliveries(page, activeTab);

      // Auto-polling mientras está enviando
      if (camp.status === "sending") {
        if (!pollingRef.current) {
          pollingRef.current = setInterval(async () => {
            const updated = await getCampaign(campaignId);
            setCampaign(updated);
            if (updated.status !== "sending" && pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
              await loadDeliveries(page, activeTab);
            }
          }, 5000);
        }
      } else if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } catch {
      notifications.show({
        title: "Error",
        message: "No se pudo cargar la campaña",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }, [campaignId, page, activeTab, loadCampaign, loadDeliveries]);

  useEffect(() => {
    loadAll();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadAll]);

  const handleTabChange = (tab: string | null) => {
    if (!tab) return;
    setActiveTab(tab);
    setPage(1);
  };

  const handlePageChange = (p: number) => setPage(p);

  const handleSend = async () => {
    setActionLoading(true);
    try {
      const result = await sendCampaign(campaignId);
      notifications.show({
        title: "Envío iniciado",
        message: `Procesando ${result.total.toLocaleString()} destinatarios`,
        color: "blue",
      });
      await loadAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al iniciar";
      notifications.show({ title: "Error", message: msg, color: "red" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await cancelCampaign(campaignId);
      notifications.show({
        title: "Cancelada",
        message: "La campaña fue cancelada",
        color: "orange",
      });
      await loadCampaign();
    } catch {
      notifications.show({
        title: "Error",
        message: "No se pudo cancelar",
        color: "red",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      const result = await resumeCampaign(campaignId);
      notifications.show({
        title: "Reanudando",
        message: `${result.pending.toLocaleString()} emails pendientes`,
        color: "blue",
      });
      await loadAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al reanudar";
      notifications.show({ title: "Error", message: msg, color: "red" });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !campaign) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  const { stats } = campaign;
  const sentPercent =
    stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;
  const errorCount = stats.failed + stats.rejected;
  const hasPending =
    campaign.status !== "sending" && stats.pending > 0;

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Group gap="sm">
          <ActionIcon variant="subtle" onClick={onBack}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Title order={4}>{campaign.name}</Title>
          <Badge
            color={STATUS_COLORS[campaign.status]}
            variant={campaign.status === "sending" ? "dot" : "light"}
          >
            {STATUS_LABELS[campaign.status]}
          </Badge>
        </Group>
        <Group gap="xs">
          {campaign.status === "draft" && (
            <Button
              size="sm"
              leftSection={<IconPlayerPlay size={14} />}
              onClick={handleSend}
              loading={actionLoading}
            >
              Iniciar envío
            </Button>
          )}
          {campaign.status === "sending" && (
            <Button
              size="sm"
              color="orange"
              variant="light"
              leftSection={<IconX size={14} />}
              onClick={handleCancel}
              loading={actionLoading}
            >
              Cancelar
            </Button>
          )}
          {["completed", "failed", "cancelled"].includes(campaign.status) &&
            hasPending && (
              <Button
                size="sm"
                variant="light"
                leftSection={<IconRefresh size={14} />}
                onClick={handleResume}
                loading={actionLoading}
              >
                Reanudar envío
              </Button>
            )}
          <Tooltip label="Exportar CSV">
            <Anchor href={exportDeliveriesUrl(campaignId)} target="_blank">
              <ActionIcon variant="light">
                <IconDownload size={16} />
              </ActionIcon>
            </Anchor>
          </Tooltip>
        </Group>
      </Group>

      {/* Progress bar (solo si enviando o hay datos) */}
      {stats.total > 0 && (
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {stats.sent.toLocaleString()} de {stats.total.toLocaleString()} enviados
            </Text>
            <Text size="xs" c="dimmed">
              {sentPercent}%
            </Text>
          </Group>
          <Progress
            value={sentPercent}
            color={campaign.status === "sending" ? "blue" : "green"}
            animated={campaign.status === "sending"}
          />
        </Stack>
      )}

      {/* Stats cards */}
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Card withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed">Total</Text>
          <Text size="xl" fw={700}>{stats.total.toLocaleString()}</Text>
        </Card>
        <Card withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed">Enviados</Text>
          <Text size="xl" fw={700} c="green">
            {stats.sent.toLocaleString()}
          </Text>
        </Card>
        <Card withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed">Fallidos</Text>
          <Text size="xl" fw={700} c={stats.failed > 0 ? "red" : "dimmed"}>
            {stats.failed.toLocaleString()}
          </Text>
        </Card>
        <Card withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed">Rechazados</Text>
          <Text size="xl" fw={700} c={stats.rejected > 0 ? "orange" : "dimmed"}>
            {stats.rejected.toLocaleString()}
          </Text>
        </Card>
      </SimpleGrid>

      {errorCount > 0 && (
        <Text size="xs" c="dimmed">
          {errorCount.toLocaleString()} emails con error (fallidos + rechazados)
        </Text>
      )}

      {/* Deliveries table */}
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          {DELIVERY_TABS.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value={activeTab} pt="sm">
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Email</Table.Th>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Enviado</Table.Th>
                <Table.Th>Error</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {deliveries.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      Sin registros
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                deliveries.map((d) => (
                  <Table.Tr key={d._id}>
                    <Table.Td>
                      <Text size="sm">{d.email}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {d.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        color={DELIVERY_STATUS_COLORS[d.status]}
                        variant="light"
                      >
                        {DELIVERY_STATUS_LABELS[d.status]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {d.sentAt
                          ? new Date(d.sentAt).toLocaleString("es", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {d.errorMessage ? (
                        <Text size="xs" c="red" lineClamp={2} maw={300}>
                          {d.errorMessage}
                        </Text>
                      ) : (
                        <Text size="xs" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>

          {total > LIMIT && (
            <Group justify="center" mt="md">
              <Pagination
                total={Math.ceil(total / LIMIT)}
                value={page}
                onChange={handlePageChange}
                size="sm"
              />
            </Group>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
