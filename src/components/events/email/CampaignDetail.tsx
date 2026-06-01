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
  Select,
  Loader,
  Center,
  Pagination,
  ActionIcon,
  Tooltip,
  Alert,
  Divider,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconPlayerPlay,
  IconX,
  IconRefresh,
  IconFileSpreadsheet,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import * as XLSX from "xlsx";
import {
  getCampaign,
  sendCampaign,
  cancelCampaign,
  resumeCampaign,
  listDeliveries,
  getCampaignAnalytics,
  type EmailCampaign,
  type EmailDelivery,
  type DeliveryStatus,
  type CampaignStatus,
  type UtmParam,
  type CampaignAnalytics,
} from "../../../api/email-campaign";

// ─── Sub-components ──────────────────────────────────────────────────────────

function UtmSummary({ utmParams }: { utmParams: UtmParam[] }) {
  if (utmParams.length === 0) return null;
  return (
    <Card withBorder radius="md" p="sm">
      <Group gap="xs" align="center" wrap="wrap">
        <Text size="xs" fw={600} c="dimmed" style={{ whiteSpace: "nowrap" }}>
          UTMs configurados:
        </Text>
        {utmParams.map((p, i) => (
          <Badge key={i} size="sm" variant="light" color="violet">
            <Text span fw={400} c="dimmed">{p.name}=</Text>
            {p.value.startsWith("form.") ? (
              <Text span c="blue">{p.value}</Text>
            ) : p.value.startsWith("event.") || p.value.startsWith("attendee.") ? (
              <Text span c="teal">{p.value}</Text>
            ) : (
              p.value
            )}
          </Badge>
        ))}
      </Group>
    </Card>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

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
  bounced: "Rebotado",
  complained: "Spam/Queja",
};

const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, string> = {
  pending: "gray",
  sent: "green",
  rejected: "orange",
  failed: "red",
  bounced: "red",
  complained: "orange",
};

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "sent", label: "Enviados" },
  { value: "pending", label: "Pendientes" },
  { value: "failed", label: "Fallidos" },
  { value: "rejected", label: "Rechazados" },
  { value: "bounced", label: "Rebotados" },
  { value: "complained", label: "Spam / Queja" },
];

const LIMIT = 50;

// ─── Main component ───────────────────────────────────────────────────────────

export default function CampaignDetail({ campaignId, onBack }: CampaignDetailProps) {
  const [campaign, setCampaign] = useState<EmailCampaign | null>(null);
  const [deliveries, setDeliveries] = useState<EmailDelivery[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeStatus = statusFilter === "all" ? undefined : (statusFilter as DeliveryStatus);

  const loadCampaign = useCallback(async () => {
    const data = await getCampaign(campaignId);
    setCampaign(data);
    return data;
  }, [campaignId]);

  const loadDeliveries = useCallback(
    async (currentPage: number, status?: DeliveryStatus) => {
      const result = await listDeliveries(campaignId, {
        status,
        page: currentPage,
        limit: LIMIT,
      });
      setDeliveries(result.data);
      setTotal(result.total);
    },
    [campaignId]
  );

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await getCampaignAnalytics(campaignId);
      setAnalytics(data);
    } catch {
      // analytics are optional — don't block the view on error
    }
  }, [campaignId]);

  const loadAll = useCallback(async () => {
    try {
      const camp = await loadCampaign();
      await loadDeliveries(page, activeStatus);

      if (camp.status !== "draft") {
        loadAnalytics();
      }

      if (camp.status === "sending") {
        if (!pollingRef.current) {
          pollingRef.current = setInterval(async () => {
            const updated = await getCampaign(campaignId);
            setCampaign(updated);
            if (updated.status !== "sending" && pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
              await loadDeliveries(page, activeStatus);
              loadAnalytics();
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
  }, [campaignId, page, activeStatus, loadCampaign, loadDeliveries, loadAnalytics]);

  useEffect(() => {
    loadAll();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [loadAll]);

  const handleFilterChange = (value: string | null) => {
    if (!value) return;
    setStatusFilter(value);
    setPage(1);
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      // Fetch all deliveries for current filter (without page limit)
      const result = await listDeliveries(campaignId, {
        status: activeStatus,
        page: 1,
        limit: 99999,
      });

      const rows = result.data.map((d) => ({
        Email: d.email,
        Nombre: d.name,
        Estado: DELIVERY_STATUS_LABELS[d.status] ?? d.status,
        "Fecha envío": d.sentAt ? new Date(d.sentAt).toLocaleString("es") : "",
        "Fecha entrega SES": d.deliveredAt ? new Date(d.deliveredAt).toLocaleString("es") : "",
        "ID SES": d.sesMessageId ?? "",
        Error: d.errorMessage ?? "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Destinatarios");

      const filterLabel = STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "todos";
      const fileName = `campana-${campaignId}-${filterLabel.toLowerCase().replace(/\s+/g, "-")}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch {
      notifications.show({ title: "Error", message: "No se pudo exportar", color: "red" });
    } finally {
      setExporting(false);
    }
  };

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
      notifications.show({ title: "Cancelada", message: "La campaña fue cancelada", color: "orange" });
      await loadCampaign();
    } catch {
      notifications.show({ title: "Error", message: "No se pudo cancelar", color: "red" });
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
  const sentPercent = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;
  const errorCount = stats.failed + stats.rejected;
  const hasPending = campaign.status !== "sending" && stats.pending > 0;
  const bounced = stats.bounced ?? 0;
  const complained = stats.complained ?? 0;
  const bounceRate = stats.total > 0 ? ((bounced + complained) / stats.total) * 100 : 0;

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
          {["completed", "failed", "cancelled"].includes(campaign.status) && hasPending && (
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
        </Group>
      </Group>

      {/* Campaign metadata */}
      {campaign.excludeEventUsers && (
        <Text size="xs" c="dimmed">
          Excluye personas ya registradas al evento del envío.
        </Text>
      )}
      {campaign.utmParams?.length && <UtmSummary utmParams={campaign.utmParams} />}

      {/* Progress bar */}
      {stats.total > 0 && (
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {stats.sent.toLocaleString()} de {stats.total.toLocaleString()} enviados
            </Text>
            <Text size="xs" c="dimmed">{sentPercent}%</Text>
          </Group>
          <Progress
            value={sentPercent}
            color={campaign.status === "sending" ? "blue" : "green"}
            animated={campaign.status === "sending"}
          />
        </Stack>
      )}

      {/* Stats cards */}
      <SimpleGrid cols={{ base: 2, sm: 3 }}>
        <Card withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed">Total</Text>
          <Text size="xl" fw={700}>{stats.total.toLocaleString()}</Text>
        </Card>
        <Card withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed">Enviados</Text>
          <Text size="xl" fw={700} c="green">{stats.sent.toLocaleString()}</Text>
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
        <Card withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed">Rebotados</Text>
          <Text size="xl" fw={700} c={bounced > 0 ? "red" : "dimmed"}>
            {bounced.toLocaleString()}
          </Text>
        </Card>
        <Card withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed">Spam/Queja</Text>
          <Text size="xl" fw={700} c={complained > 0 ? "orange" : "dimmed"}>
            {complained.toLocaleString()}
          </Text>
        </Card>
      </SimpleGrid>

      {errorCount > 0 && (
        <Text size="xs" c="dimmed">
          {errorCount.toLocaleString()} emails con error (fallidos + rechazados)
        </Text>
      )}

      {/* ── Analíticas de clics ─────────────────────────────────────────────── */}
      {analytics && (analytics.totalClicks > 0 || campaign.status === "completed") && (
        <>
          <Divider label="Analíticas de clics" labelPosition="left" />
          <SimpleGrid cols={{ base: 2, sm: 3 }}>
            <Card withBorder p="sm" radius="md">
              <Text size="xs" c="dimmed">Clics únicos</Text>
              <Text size="xl" fw={700} c="blue">
                {analytics.uniqueClickers.toLocaleString()}
              </Text>
              {stats.sent > 0 && (
                <Text size="xs" c="dimmed">
                  {((analytics.uniqueClickers / stats.sent) * 100).toFixed(1)}% de enviados
                </Text>
              )}
            </Card>
            <Card withBorder p="sm" radius="md">
              <Text size="xs" c="dimmed">Total clics</Text>
              <Text size="xl" fw={700} c="indigo">
                {analytics.totalClicks.toLocaleString()}
              </Text>
            </Card>
            <Card withBorder p="sm" radius="md">
              <Text size="xs" c="dimmed">Tasa de clic</Text>
              <Text size="xl" fw={700} c={analytics.uniqueClickers > 0 ? "teal" : "dimmed"}>
                {stats.sent > 0
                  ? `${((analytics.uniqueClickers / stats.sent) * 100).toFixed(1)}%`
                  : "—"}
              </Text>
            </Card>
          </SimpleGrid>

          {Object.keys(analytics.byUtm).length > 0 && (
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {Object.entries(analytics.byUtm).map(([utmKey, values]) => {
                const maxClicks = values[0]?.clicks ?? 1;
                return (
                  <Card key={utmKey} withBorder radius="md" p="sm">
                    <Text size="sm" fw={600} mb="xs" c="dimmed">
                      {utmKey}
                    </Text>
                    <Stack gap={6}>
                      {values.slice(0, 10).map(({ value, clicks }) => (
                        <div key={value}>
                          <Group justify="space-between" mb={2}>
                            <Text size="xs" truncate maw={180}>{value}</Text>
                            <Text size="xs" fw={600}>{clicks.toLocaleString()}</Text>
                          </Group>
                          <Progress
                            value={(clicks / maxClicks) * 100}
                            size="sm"
                            color="blue"
                            radius="xl"
                          />
                        </div>
                      ))}
                      {values.length > 10 && (
                        <Text size="xs" c="dimmed">
                          +{values.length - 10} valores más
                        </Text>
                      )}
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>
          )}

          {analytics.totalClicks === 0 && (
            <Text size="sm" c="dimmed">
              Sin clics registrados aún. Los clics aparecen en tiempo real cuando los destinatarios abren el link del evento.
            </Text>
          )}
        </>
      )}
      {/* ──────────────────────────────────────────────────────────────────────── */}

      {bounceRate >= 2 && (
        <Alert
          color={bounceRate >= 5 ? "red" : "yellow"}
          title={bounceRate >= 5 ? "Tasa de rebotes crítica" : "Tasa de rebotes elevada"}
          icon={<IconAlertTriangle size={16} />}
        >
          {bounceRate.toFixed(1)}% de los emails rebotaron o fueron marcados como spam (
          {(bounced + complained).toLocaleString()} de {stats.total.toLocaleString()}).{" "}
          {bounceRate >= 5
            ? "Una tasa superior al 5% puede suspender tu cuenta de SES. Revisa la calidad de tu lista."
            : "Considera limpiar tu lista de contactos para evitar daños a la reputación del dominio."}
        </Alert>
      )}

      {/* Deliveries: filter + export */}
      <Group justify="space-between" align="flex-end">
        <Select
          label="Filtrar por estado"
          data={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={handleFilterChange}
          size="sm"
          style={{ width: 220 }}
          allowDeselect={false}
        />
        <Tooltip label="Exportar a Excel según filtro activo">
          <Button
            variant="light"
            color="teal"
            size="sm"
            leftSection={<IconFileSpreadsheet size={16} />}
            onClick={handleExportExcel}
            loading={exporting}
            disabled={stats.total === 0}
          >
            Exportar Excel
          </Button>
        </Tooltip>
      </Group>

      {/* Pending alert */}
      {statusFilter === "pending" && campaign.status !== "sending" && stats.pending > 0 && (
        <Alert color="yellow" title="Emails pendientes sin procesar" icon={<IconAlertTriangle size={16} />}>
          {stats.pending.toLocaleString()} emails no se enviaron porque el proceso fue interrumpido.
          Usa <strong>Reanudar envío</strong> para procesarlos.
        </Alert>
      )}

      {/* Deliveries table */}
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Email</Table.Th>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th>Enviado / Entregado</Table.Th>
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
                <Table.Td><Text size="sm">{d.email}</Text></Table.Td>
                <Table.Td><Text size="sm" c="dimmed">{d.name}</Text></Table.Td>
                <Table.Td>
                  <Badge size="sm" color={DELIVERY_STATUS_COLORS[d.status]} variant="light">
                    {DELIVERY_STATUS_LABELS[d.status]}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
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
                    {d.deliveredAt && (
                      <Text size="xs" c="teal">
                        ✓ SES:{" "}
                        {new Date(d.deliveredAt).toLocaleString("es", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  {d.errorMessage ? (
                    <Text size="xs" c="red" lineClamp={2} maw={300}>{d.errorMessage}</Text>
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
        <Group justify="center" mt="sm">
          <Pagination
            total={Math.ceil(total / LIMIT)}
            value={page}
            onChange={setPage}
            size="sm"
          />
        </Group>
      )}
    </Stack>
  );
}
