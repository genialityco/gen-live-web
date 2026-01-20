import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Divider,
  Box,
  Tabs,
  ScrollArea,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import {
  approveJoin,
  rejectJoin,
  subscribeJoinRequests,
  type JoinRequest,
} from "../../api/live-join-service";

type StatusTab = "pending" | "approved" | "rejected";

export function JoinRequestsPanel({ eventSlug }: { eventSlug: string }) {
  const [items, setItems] = useState<JoinRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<StatusTab>("pending");

  const orderRef = useRef<Record<string, number>>({});
  const seqRef = useRef(1);

  useEffect(() => {
    const unsub = subscribeJoinRequests(eventSlug, (next) => {
      for (const r of next) {
        if (!orderRef.current[r.requestId]) {
          orderRef.current[r.requestId] = seqRef.current++;
        }
      }
      setItems(next);
    });
    return () => unsub();
  }, [eventSlug]);

  const sortedAll = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      const oa = orderRef.current[a.requestId] ?? Number.MAX_SAFE_INTEGER;
      const ob = orderRef.current[b.requestId] ?? Number.MAX_SAFE_INTEGER;
      return oa - ob;
    });
    return arr;
  }, [items]);

  const pending = useMemo(
    () => sortedAll.filter((i) => i.status === "pending"),
    [sortedAll],
  );
  const approved = useMemo(
    () => sortedAll.filter((i) => i.status === "approved"),
    [sortedAll],
  );
  const rejected = useMemo(
    () => sortedAll.filter((i) => i.status === "rejected"),
    [sortedAll],
  );

  const onApprove = async (requestId: string) => {
    setBusyId(requestId);
    try {
      await approveJoin(eventSlug, requestId);
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (requestId: string) => {
    setBusyId(requestId);
    try {
      await rejectJoin(eventSlug, requestId, "No aceptada");
    } finally {
      setBusyId(null);
    }
  };

  const renderList = (list: JoinRequest[], status: StatusTab) => {
    if (list.length === 0) {
      const msg =
        status === "pending"
          ? "No hay solicitudes pendientes."
          : status === "approved"
            ? "Aún no has aceptado a nadie."
            : "Aún no has rechazado a nadie.";

      return (
        <Text size="sm" c="dimmed" ta="center" py="md">
          {msg}
        </Text>
      );
    }

    return (
      <Stack gap="xs">
        {list.map((r, idx) => {
          const isBusy = busyId === r.requestId;
          const arrivalOrder = orderRef.current[r.requestId] ?? 0;

          const label =
            status === "pending"
              ? `#${idx + 1}` // posición en cola del tab pendiente
              : `#${arrivalOrder || "—"}`; // opcional: en otras tabs

          return (
            <Paper
              key={r.requestId}
              p="sm"
              radius="md"
              withBorder
              style={{
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.12)",
              }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Box style={{ minWidth: 0 }}>
                  <Group gap="xs" wrap="nowrap">
                    <Badge size="xs" variant="filled">
                      {label}
                    </Badge>
                    <Text fw={600} size="sm" truncate style={{ maxWidth: 190 }}>
                      {r.name || "Invitado"}
                    </Text>
                  </Group>
                </Box>

                {/* Acciones solo para pendientes */}
                {status === "pending" ? (
                  <Group gap="xs" wrap="nowrap">
                    <Tooltip label="Rechazar">
                      <ActionIcon
                        color="red"
                        variant="light"
                        loading={isBusy}
                        onClick={() => onReject(r.requestId)}
                        aria-label="Rechazar"
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    </Tooltip>

                    <Button
                      size="xs"
                      loading={isBusy}
                      onClick={() => onApprove(r.requestId)}
                    >
                      Aceptar
                    </Button>
                  </Group>
                ) : (
                  <Text size="xs" c="dimmed">
                    —
                  </Text>
                )}
              </Group>
            </Paper>
          );
        })}
      </Stack>
    );
  };

  return (
    <Paper p="sm" radius="md" withBorder>
      <Stack gap="sm">
        <Box>
          <Text fw={700}>Requests</Text>
          <Text size="xs" c="dimmed">
            Ordenadas por llegada
          </Text>
        </Box>

        <Divider />

        <Tabs
          value={tab}
          onChange={(v) => setTab((v as StatusTab) || "pending")}
          keepMounted={false}
        >
          <Tabs.List grow>
            <Tabs.Tab value="pending">Pendientes</Tabs.Tab>
            <Tabs.Tab value="approved">Aceptadas</Tabs.Tab>
            <Tabs.Tab value="rejected">Rechazadas</Tabs.Tab>
          </Tabs.List>

          <ScrollArea h={420} mt="md" offsetScrollbars>
            <Tabs.Panel value="pending">
              {renderList(pending, "pending")}
            </Tabs.Panel>
            <Tabs.Panel value="approved">
              {renderList(approved, "approved")}
            </Tabs.Panel>
            <Tabs.Panel value="rejected">
              {renderList(rejected, "rejected")}
            </Tabs.Panel>
          </ScrollArea>
        </Tabs>
      </Stack>
    </Paper>
  );
}
