// src/components/events/NetworkBlocksCard.tsx
import { useCallback, useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconCheck, IconCopy, IconRefresh } from "@tabler/icons-react";
import {
  getNetworkBlockSummary,
  NETWORK_BLOCK_CAUSE_LABELS,
  type NetworkBlockCause,
  type NetworkBlockSummary,
} from "../../api/network-reports";

const CAUSE_COLORS: Record<NetworkBlockCause, string> = {
  all_blocked: "red",
  video_blocked: "orange",
  timeout: "gray",
};

/** Texto listo para el área de sistemas de la entidad */
function itMessage(s: NetworkBlockSummary) {
  const hosts = s.byHost.map((h) => h.host);
  const lines = [
    `Durante el evento, ${s.total} usuario(s) no pudieron cargar el video desde su red institucional.`,
    "",
    "Dominios que la red bloqueó:",
    ...hosts.map((h) => `- ${h}`),
    "",
    "Redes desde donde se reportó:",
    ...s.byOrg.map((o) => `- ${o.org}: ${o.n} usuario(s)${o.prefixes.length ? ` (${o.prefixes.join(", ")})` : ""}`),
  ];
  if (s.byCause.all_blocked) {
    lines.push(
      "",
      "El patrón indica inspección SSL (p. ej. Fortinet) con un certificado que los equipos no reconocen " +
        "(ERR_CERT_AUTHORITY_INVALID). Solicitamos excluir de la inspección SSL los dominios anteriores " +
        "o instalar el certificado CA del firewall en los equipos.",
    );
  } else {
    lines.push("", "Solicitamos habilitar esos dominios en el firewall o proxy de la entidad.");
  }
  return lines.join("\n");
}

/**
 * Bloqueos de red que reportan los asistentes cuyo navegador no logra
 * conectarse al servidor del video (Control del evento).
 */
export function NetworkBlocksCard({ eventId }: { eventId: string }) {
  const [summary, setSummary] = useState<NetworkBlockSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setSummary(await getNetworkBlockSummary(eventId));
    } catch (err) {
      console.error("Error cargando bloqueos de red:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const causes = Object.entries(summary?.byCause ?? {}) as Array<[NetworkBlockCause, number]>;

  return (
    <Card withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div>
            <Title order={3}>📶 Bloqueos de red</Title>
            <Text size="xs" c="dimmed">
              Asistentes cuya red (firewall, proxy, inspección SSL…) no deja
              cargar el video. Se registran automáticamente desde la página del
              asistente.
            </Text>
          </div>
          <ActionIcon
            variant="subtle"
            onClick={() => void load()}
            loading={loading}
            title="Actualizar"
            aria-label="Actualizar"
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Group>

        {error && <Alert color="red" variant="light">No se pudo cargar el reporte.</Alert>}
        {loading && !summary && <Loader size="xs" />}

        {summary && summary.total === 0 && (
          <Text size="sm" c="dimmed">Sin bloqueos reportados.</Text>
        )}

        {summary && summary.total > 0 && (
          <>
            <Group gap="xs">
              <Badge color="red" variant="light" size="lg">
                {summary.total} bloqueado{summary.total === 1 ? "" : "s"}
              </Badge>
              <Badge color="green" variant="light" size="lg">
                {summary.recovered} se recuperaron
              </Badge>
            </Group>
            <Group gap={6}>
              {causes.map(([cause, n]) => (
                <Badge key={cause} color={CAUSE_COLORS[cause]} variant="dot">
                  {NETWORK_BLOCK_CAUSE_LABELS[cause]}: {n}
                </Badge>
              ))}
            </Group>
            {summary.byOrg[0] && (
              <Text size="xs">
                Red principal: <b>{summary.byOrg[0].org}</b> ({summary.byOrg[0].n})
              </Text>
            )}
            <Group justify="flex-end">
              <Button size="xs" variant="light" onClick={() => setOpen(true)}>
                Ver detalle
              </Button>
            </Group>
          </>
        )}
      </Stack>

      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title={<Text fw={700}>📶 Bloqueos de red</Text>}
        size="xl"
        radius="md"
        centered
      >
        {summary && <NetworkBlocksDetail summary={summary} />}
      </Modal>
    </Card>
  );
}

function NetworkBlocksDetail({ summary }: { summary: NetworkBlockSummary }) {
  const message = itMessage(summary);
  return (
    <Stack gap="md">
      <div>
        <Text size="sm" fw={600} mb={4}>Redes / operadores</Text>
        <Table withTableBorder verticalSpacing={4} fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Red (dueña de la IP)</Table.Th>
              <Table.Th w={80}>Usuarios</Table.Th>
              <Table.Th>Prefijos de IP</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {summary.byOrg.map((o) => (
              <Table.Tr key={o.org}>
                <Table.Td>{o.org}</Table.Td>
                <Table.Td>{o.n}</Table.Td>
                <Table.Td>{o.prefixes.join(", ") || "—"}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {summary.byOrg.length === 0 && (
          <Text size="xs" c="dimmed">Sin datos de red (falta la base GeoLite2-ASN en el servidor).</Text>
        )}
      </div>

      <div>
        <Text size="sm" fw={600} mb={4}>Últimos reportes</Text>
        <ScrollArea.Autosize mah={320}>
          <Table withTableBorder verticalSpacing={4} fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Asistente</Table.Th>
                <Table.Th>Causa</Table.Th>
                <Table.Th>Dominios que fallan</Table.Th>
                <Table.Th>Red</Table.Th>
                <Table.Th>Equipo</Table.Th>
                <Table.Th>Hora</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.recent.map((r, i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    {r.name ?? "Sin registro"}
                    {r.email && <Text size="xs" c="dimmed">{r.email}</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={CAUSE_COLORS[r.cause]} variant="light">
                      {NETWORK_BLOCK_CAUSE_LABELS[r.cause]}
                    </Badge>
                    {r.recovered && <Badge size="xs" color="green" variant="light" ml={4}>Recuperado</Badge>}
                  </Table.Td>
                  <Table.Td>
                    {r.probes.filter((p) => p.result !== "ok").map((p) => p.host).join(", ") || r.videoHost}
                  </Table.Td>
                  <Table.Td>
                    {r.org ?? "—"}
                    {r.ipPrefix && <Text size="xs" c="dimmed">{r.ipPrefix}</Text>}
                  </Table.Td>
                  <Table.Td>
                    {r.mobile ? "Celular" : "Computador"}
                    {r.connectionType && <Text size="xs" c="dimmed">{r.connectionType}</Text>}
                  </Table.Td>
                  <Table.Td>
                    {new Date(r.lastSeenAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                    {r.occurrences > 1 && <Text size="xs" c="dimmed">{r.occurrences} veces</Text>}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      </div>

      <div>
        <Group justify="space-between" mb={4}>
          <Text size="sm" fw={600}>Mensaje para el área de sistemas</Text>
          <CopyButton value={message}>
            {({ copied, copy }) => (
              <Button
                size="compact-xs"
                variant="light"
                color={copied ? "teal" : "blue"}
                leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                onClick={copy}
              >
                {copied ? "Copiado" : "Copiar"}
              </Button>
            )}
          </CopyButton>
        </Group>
        <Text
          size="xs"
          p="xs"
          style={{
            whiteSpace: "pre-wrap",
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: 8,
          }}
        >
          {message}
        </Text>
      </div>
    </Stack>
  );
}
