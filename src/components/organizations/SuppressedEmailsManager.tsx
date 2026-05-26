import { useState, useEffect, useCallback } from "react";
import {
  Stack,
  Card,
  Group,
  Text,
  Button,
  Table,
  Badge,
  Loader,
  Center,
  Alert,
  ActionIcon,
  Tooltip,
  Modal,
} from "@mantine/core";
import { IconRefresh, IconAlertTriangle } from "@tabler/icons-react";
import {
  fetchSuppressedAttendees,
  restoreAttendeeEmail,
  type SuppressedAttendee,
} from "../../api/email-campaign";

interface Props {
  orgId: string;
}

export default function SuppressedEmailsManager({ orgId }: Props) {
  const [attendees, setAttendees] = useState<SuppressedAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<SuppressedAttendee | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSuppressedAttendees(orgId);
      setAttendees(data);
    } catch {
      setError("No se pudo cargar la lista de emails suprimidos");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRestore = async (attendee: SuppressedAttendee) => {
    setRestoring(attendee._id);
    try {
      await restoreAttendeeEmail(attendee._id);
      setAttendees((prev) => prev.filter((a) => a._id !== attendee._id));
    } catch {
      setError("No se pudo restaurar el email");
    } finally {
      setRestoring(null);
      setConfirmTarget(null);
    }
  };

  if (loading) {
    return (
      <Center py="xl">
        <Loader size="md" />
      </Center>
    );
  }

  if (error) {
    return (
      <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
        {error}
      </Alert>
    );
  }

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {attendees.length === 0
              ? "No hay emails suprimidos"
              : `${attendees.length} email${attendees.length !== 1 ? "s" : ""} suprimido${attendees.length !== 1 ? "s" : ""}`}
          </Text>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            onClick={load}
          >
            Actualizar
          </Button>
        </Group>

        {attendees.length === 0 ? (
          <Alert color="green" variant="light">
            Tu base de datos de emails está limpia. No hay direcciones suprimidas
            por bounces ni complaints.
          </Alert>
        ) : (
          <>
            <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />}>
              Estos emails fueron suprimidos automáticamente. Las campañas los
              omiten. Solo restaura si estás seguro de que la dirección es válida.
            </Alert>

            <Card withBorder radius="md" p={0}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nombre</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Motivo</Table.Th>
                    <Table.Th>Detalle</Table.Th>
                    <Table.Th>Fecha</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {attendees.map((a) => (
                    <Table.Tr key={a._id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {a.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace">
                          {a.email}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={a.emailStatus === "complained" ? "orange" : "red"}
                          variant="light"
                          size="sm"
                        >
                          {a.emailStatus === "complained" ? "Spam/Queja" : "Bounce"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed" maw={200}>
                          {a.emailSuppressReason ?? "—"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {a.emailSuppressedAt
                            ? new Date(a.emailSuppressedAt).toLocaleDateString(
                                "es-CO",
                                { day: "2-digit", month: "short", year: "numeric" }
                              )
                            : "—"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label="Restaurar email (volver a incluir en campañas)">
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size="sm"
                            loading={restoring === a._id}
                            onClick={() => setConfirmTarget(a)}
                          >
                            <IconRefresh size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          </>
        )}
      </Stack>

      <Modal
        opened={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        title="Restaurar email"
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            ¿Confirmas que quieres restaurar{" "}
            <Text component="span" fw={600} ff="monospace">
              {confirmTarget?.email}
            </Text>
            ? Este email volverá a recibir campañas.
          </Text>
          {confirmTarget?.emailStatus === "complained" && (
            <Alert color="orange" variant="light">
              <Text size="sm">
                Este destinatario marcó un email como spam. Restaurar puede
                afectar la reputación del dominio.
              </Text>
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmTarget(null)}>
              Cancelar
            </Button>
            <Button
              color="blue"
              loading={restoring === confirmTarget?._id}
              onClick={() => confirmTarget && handleRestore(confirmTarget)}
            >
              Restaurar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
