import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Divider,
} from "@mantine/core";
import {
  approveJoin,
  rejectJoin,
  subscribeJoinRequests,
  type JoinRequest,
} from "../../api/live-join-service";

export function JoinRequestsPanel({ eventSlug }: { eventSlug: string }) {
  const [items, setItems] = useState<JoinRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeJoinRequests(eventSlug, setItems);
    console.log("Subscribed to join requests for event:", eventSlug);
    return () => unsub();
  }, [eventSlug]);

  const pending = useMemo(
    () => items.filter((i) => i.status === "pending"),
    [items]
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

  return (
    <Paper p="sm" radius="md" bg="dark.7" withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={500}>Solicitudes para unirse</Text>
          <Badge variant="light">{pending.length} pendientes</Badge>
        </Group>

        <Divider />

        {pending.length === 0 ? (
          <Text size="sm" c="dimmed">
            No hay solicitudes por ahora.
          </Text>
        ) : (
          pending.slice(0, 10).map((r) => (
            <Paper key={r.requestId} p="xs" radius="md" withBorder bg="dark.8">
              <Stack gap={6}>
                <Group justify="space-between" align="flex-start">
                  <Stack gap={0}>
                    <Text size="sm" fw={600}>
                      {r.name || "Invitado"}
                    </Text>
                    <Text size="xs" c="dimmed">
                      uid: {r.uid}
                    </Text>
                  </Stack>
                  <Badge color="yellow" variant="light">
                    pendiente
                  </Badge>
                </Group>

                <Group justify="flex-end">
                  <Button
                    size="xs"
                    variant="default"
                    loading={busyId === r.requestId}
                    onClick={() => onReject(r.requestId)}
                  >
                    Rechazar
                  </Button>
                  <Button
                    size="xs"
                    loading={busyId === r.requestId}
                    onClick={() => onApprove(r.requestId)}
                  >
                    Aceptar
                  </Button>
                </Group>
              </Stack>
            </Paper>
          ))
        )}
      </Stack>
    </Paper>
  );
}
