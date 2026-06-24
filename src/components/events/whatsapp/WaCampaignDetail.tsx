import { useState, useEffect, useCallback, useRef } from "react";
import {
  Stack, Group, Title, Badge, Button, Text, SimpleGrid, Card,
  Progress, Table, Select, Loader, Center, Pagination, ActionIcon,
  Divider, Tooltip,
} from "@mantine/core";
import { IconArrowLeft, IconPlayerPlay, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  getWaCampaign, sendWaCampaign, cancelWaCampaign, listWaDeliveries,
  previewWaRecipients, getWaCampaignAnalytics,
  getWaCountryReport, getWaGeoAnalytics, backfillWaGeo,
  type WaCampaign, type WaDelivery, type WaCampaignStatus, type WaDeliveryStatus,
  type WaUtmParam, type WaCampaignAnalytics,
  type WaCountryReport, type WaGeoAnalytics,
} from "../../../api/wa-campaign";
import {
  CountryBars,
  ConversionBars,
  isoToFlag,
  countryName,
  type ComparisonRow,
} from "../../common/CountryBars";

interface Props {
  campaignId: string;
  onBack: () => void;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function UtmSummary({ utmParams }: { utmParams: WaUtmParam[] }) {
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
  const [analytics, setAnalytics] = useState<WaCampaignAnalytics | null>(null);
  const [countryReport, setCountryReport] = useState<WaCountryReport | null>(null);
  const [geo, setGeo] = useState<WaGeoAnalytics | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [unifiedView, setUnifiedView] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Preview de destinatarios (solo en draft)
  const [previewRecipients, setPreviewRecipients] = useState<{ phone: string; name: string }[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadDeliveries = useCallback(async (p: number, status?: string) => {
    const result = await listWaDeliveries(campaignId, {
      status: status === "all" ? undefined : status,
      page: p,
      limit: LIMIT,
    });
    setDeliveries(result.data);
    setTotal(result.total);
  }, [campaignId]);

  const loadPreviewRecipients = useCallback(async (p: number) => {
    setPreviewLoading(true);
    try {
      const result = await previewWaRecipients(campaignId, { page: p, limit: LIMIT });
      setPreviewRecipients(result.data);
      setPreviewTotal(result.total);
    } catch {
      notifications.show({ title: "Error", message: "No se pudieron cargar los destinatarios", color: "red" });
    } finally {
      setPreviewLoading(false);
    }
  }, [campaignId]);

  const loadAnalytics = useCallback(async () => {
    // analytics, país declarado y geo por IP son opcionales — no bloquean la vista
    const [data, cr, g] = await Promise.all([
      getWaCampaignAnalytics(campaignId).catch(() => null),
      getWaCountryReport(campaignId).catch(() => null),
      getWaGeoAnalytics(campaignId).catch(() => null),
    ]);
    if (data) setAnalytics(data);
    setCountryReport(cr);
    setGeo(g);
  }, [campaignId]);

  const handleBackfillGeo = useCallback(async () => {
    setBackfilling(true);
    try {
      const result = await backfillWaGeo(campaignId);
      notifications.show({
        title: "Geolocalización completada",
        message: `${result.updated} de ${result.pending} clics resueltos`,
        color: "teal",
      });
      const g = await getWaGeoAnalytics(campaignId).catch(() => null);
      setGeo(g);
    } catch {
      notifications.show({ title: "Error", message: "No se pudo geolocalizar los clics", color: "red" });
    } finally {
      setBackfilling(false);
    }
  }, [campaignId]);

  const loadAll = useCallback(async () => {
    try {
      const camp = await getWaCampaign(campaignId);
      setCampaign(camp);
      if (camp.status === "draft") {
        await loadPreviewRecipients(previewPage);
      } else {
        await loadDeliveries(page, statusFilter);
        loadAnalytics();
      }

      if (camp.status === "sending") {
        if (!pollingRef.current) {
          pollingRef.current = setInterval(async () => {
            const updated = await getWaCampaign(campaignId);
            setCampaign(updated);
            if (updated.status !== "sending" && pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
              await loadDeliveries(page, statusFilter);
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
  }, [campaignId, page, statusFilter, previewPage, loadDeliveries, loadPreviewRecipients, loadAnalytics]);

  useEffect(() => {
    loadAll();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [loadAll]);

  // Recargar preview al cambiar página (solo draft)
  useEffect(() => {
    if (campaign?.status === "draft") {
      loadPreviewRecipients(previewPage);
    }
  }, [previewPage]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Comparativa por país: une enviados (país declarado del formulario) con
  // clics (país por IP). Son dimensiones distintas, por eso la unión por código.
  const countryComparison: ComparisonRow[] = (() => {
    if (!countryReport && !geo) return [];
    const map = new Map<string, ComparisonRow>();
    for (const c of countryReport?.byCountry ?? []) {
      map.set(c.value, {
        key: c.value,
        label: c.label ?? countryName(c.value),
        flag: isoToFlag(c.value),
        sent: c.count,
        clicked: 0,
      });
    }
    for (const c of geo?.byCountry ?? []) {
      const existing = map.get(c.country);
      if (existing) {
        existing.clicked = c.uniqueClickers;
      } else {
        map.set(c.country, {
          key: c.country,
          label: countryName(c.country),
          flag: isoToFlag(c.country),
          sent: 0,
          clicked: c.uniqueClickers,
        });
      }
    }
    return [...map.values()];
  })();

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

      {campaign.utmParams?.length ? <UtmSummary utmParams={campaign.utmParams} /> : null}

      {/* ── Analíticas de clics ─────────────────────────────────────────────── */}
      {analytics && (analytics.totalClicks > 0 || campaign.status === "completed") && (
        <>
          <Stack gap={2}>
            <Title order={5}>Interacciones de la campaña</Title>
            <Text size="sm" c="dimmed">
              Clics registrados en el link del evento enviado por WhatsApp.
            </Text>
          </Stack>
          <SimpleGrid cols={{ base: 2, sm: 3 }}>
            <Card withBorder p="sm" radius="md">
              <Text size="xs" c="dimmed">Usuarios que hicieron clic</Text>
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
          </SimpleGrid>

          {Object.keys(analytics.byUtm).length > 0 && (
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={600}>Distribución por UTM</Text>
                <Button size="xs" variant="light" onClick={() => setUnifiedView((v) => !v)}>
                  {unifiedView ? "Separar vistas" : "Unificar vistas"}
                </Button>
              </Group>
              {Object.entries(analytics.byUtm).map(([utmKey, values]) => (
                <Card key={utmKey} withBorder radius="md" p="sm">
                  <Text size="sm" fw={600} mb="sm">
                    Distribución {utmKey}
                  </Text>
                  {unifiedView ? (
                    <ConversionBars
                      sentLabel="Enviados"
                      clickedLabel="Clickers únicos"
                      rows={values.map((v) => ({
                        key: v.value,
                        label: v.value,
                        sent: v.sent,
                        clicked: v.uniqueClickers,
                      }))}
                    />
                  ) : (
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                      <div>
                        <Text size="xs" fw={700} c="grape" ta="center" mb={8}>
                          Distribución de envío
                        </Text>
                        <CountryBars
                          color="grape"
                          rows={values.map((v) => ({
                            key: v.value,
                            name: v.value,
                            value: v.sent,
                          }))}
                        />
                      </div>
                      <div>
                        <Text size="xs" fw={700} c="blue" ta="center" mb={8}>
                          Distribución de clics
                        </Text>
                        <CountryBars
                          color="blue"
                          secondaryLabel="Total clics"
                          rows={values.map((v) => ({
                            key: v.value,
                            name: v.value,
                            value: v.uniqueClickers,
                            secondary: v.clicks,
                          }))}
                        />
                      </div>
                    </SimpleGrid>
                  )}
                </Card>
              ))}
            </Stack>
          )}

          {analytics.totalClicks === 0 && (
            <Text size="sm" c="dimmed">
              Sin clics registrados aún. Los clics aparecen cuando los destinatarios abren el link del evento.
            </Text>
          )}
        </>
      )}
      {/* ──────────────────────────────────────────────────────────────────────── */}

      {/* ── Distribución por país: envío (declarado) vs clics (IP) ─────────────── */}
      {((countryReport && countryReport.byCountry.length > 0) ||
        (geo && (geo.byCountry.length > 0 || geo.unknown.uniqueClickers > 0))) && (
        <>
          <Divider />
          <Group justify="space-between" align="center">
            <Title order={5}>Distribución por país</Title>
            <Group gap="xs">
              {geo && geo.unknown.uniqueClickers > 0 && (
                <Tooltip label="Re-resuelve el país de clics antiguos guardados sin geolocalización">
                  <Button
                    size="xs"
                    variant="light"
                    color="teal"
                    loading={backfilling}
                    onClick={handleBackfillGeo}
                  >
                    Geolocalizar clics sin país
                  </Button>
                </Tooltip>
              )}
              <Button size="xs" variant="light" onClick={() => setUnifiedView((v) => !v)}>
                {unifiedView ? "Separar vistas" : "Unificar vistas"}
              </Button>
            </Group>
          </Group>
          <Card withBorder radius="md" p="sm">
            {unifiedView ? (
              <ConversionBars
                sentLabel="Enviados (país declarado)"
                clickedLabel="Clics (país por IP)"
                rows={countryComparison}
              />
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                <div>
                  <Text size="xs" fw={700} c="grape" ta="center">
                    Distribución de envío
                  </Text>
                  <Text size="xs" c="dimmed" ta="center" mb={8}>
                    Por país declarado en el formulario
                  </Text>
                  <CountryBars
                    color="grape"
                    unknownLabel="Sin país declarado"
                    unknown={countryReport?.unknown}
                    rows={(countryReport?.byCountry ?? []).map((c) => ({
                      key: c.value,
                      flag: isoToFlag(c.value),
                      name: c.label ?? countryName(c.value),
                      value: c.count,
                    }))}
                  />
                </div>
                <div>
                  <Text size="xs" fw={700} c="blue" ta="center">
                    Distribución de clics
                  </Text>
                  <Text size="xs" c="dimmed" ta="center" mb={8}>
                    Por país de la IP del clic
                  </Text>
                  <CountryBars
                    color="blue"
                    secondaryLabel="Total clics"
                    unknownLabel="Sin ubicación determinada"
                    unknown={geo?.unknown.uniqueClickers}
                    rows={(geo?.byCountry ?? []).map((c) => ({
                      key: c.country,
                      flag: isoToFlag(c.country),
                      name: countryName(c.country),
                      value: c.uniqueClickers,
                      secondary: c.clicks,
                    }))}
                  />
                </div>
              </SimpleGrid>
            )}
          </Card>
        </>
      )}

      <Divider />

      {campaign.status === "draft" ? (
        /* ── Vista previa de destinatarios (antes de enviar) ── */
        <Stack gap="sm">
          <Group gap="xs">
            <Text size="sm" fw={600}>Destinatarios</Text>
            {previewLoading
              ? <Loader size={14} />
              : <Badge size="sm" variant="light" color="blue">{previewTotal.toLocaleString()} personas</Badge>
            }
            <Text size="xs" c="dimmed">— asistentes con teléfono válido en esta organización</Text>
          </Group>

          {!previewLoading && previewTotal === 0 && (
            <Text size="sm" c="orange" py="sm">
              No hay asistentes con teléfono registrado en esta organización.
            </Text>
          )}

          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Teléfono</Table.Th>
                <Table.Th>Nombre</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {previewLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={2}><Center py="md"><Loader size="sm" /></Center></Table.Td>
                </Table.Tr>
              ) : previewRecipients.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={2}>
                    <Text size="sm" c="dimmed" ta="center" py="md">Sin destinatarios</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                previewRecipients.map((r, i) => (
                  <Table.Tr key={i}>
                    <Table.Td><Text size="sm">{r.phone}</Text></Table.Td>
                    <Table.Td><Text size="sm" c="dimmed">{r.name || "—"}</Text></Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>

          {previewTotal > LIMIT && (
            <Group justify="center" mt="sm">
              <Pagination total={Math.ceil(previewTotal / LIMIT)} value={previewPage} onChange={setPreviewPage} size="sm" />
            </Group>
          )}
        </Stack>
      ) : (
        /* ── Tabla de deliveries (enviando / completada / fallida) ── */
        <Stack gap="sm">
          <Select
            label="Filtrar por estado"
            data={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(v) => { if (v) { setStatusFilter(v); setPage(1); } }}
            size="sm"
            style={{ width: 220 }}
            allowDeselect={false}
          />

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
      )}
    </Stack>
  );
}
