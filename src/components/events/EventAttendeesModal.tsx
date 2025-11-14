import { useState, useEffect } from "react";
import {
  Stack,
  Card,
  Group,
  Text,
  Table,
  Badge,
  Loader,
  Center,
  Alert,
  Modal,
  Button,
} from "@mantine/core";
import { api } from "../../core/api";
import { type OrgAttendee } from "../organizations/OrgAttendeesManager";

interface EventAttendeesModalProps {
  opened: boolean;
  onClose: () => void;
  orgId: string;
  eventId: string;
  eventTitle: string;
}

export default function EventAttendeesModal({ 
  opened, 
  onClose, 
  orgId, 
  eventId, 
  eventTitle 
}: EventAttendeesModalProps) {
  const [attendees, setAttendees] = useState<OrgAttendee[]>([]);
  const [stats, setStats] = useState<{ total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!opened || !orgId || !eventId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const [attendeesResponse, statsResponse] = await Promise.all([
          api.get(`/orgs/${orgId}/events/${eventId}/attendees`),
          api.get(`/orgs/${orgId}/events/${eventId}/attendees/stats`),
        ]);
        
        setAttendees(attendeesResponse.data);
        setStats(statsResponse.data);
      } catch (err) {
        console.error("Error loading event attendees:", err);
        setError("No se pudieron cargar los asistentes del evento");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [opened, orgId, eventId]);

  const refetchData = async () => {
    if (!orgId || !eventId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const [attendeesResponse, statsResponse] = await Promise.all([
        api.get(`/orgs/${orgId}/events/${eventId}/attendees`),
        api.get(`/orgs/${orgId}/events/${eventId}/attendees/stats`),
      ]);
      
      setAttendees(attendeesResponse.data);
      setStats(statsResponse.data);
    } catch (err) {
      console.error("Error loading event attendees:", err);
      setError("No se pudieron cargar los asistentes del evento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Asistentes del evento: ${eventTitle}`}
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* Estadísticas */}
        {stats && (
          <Card withBorder p="md" radius="md">
            <Group justify="center">
              <Stack align="center" gap="xs">
                <Text size="xl" fw={700} c="blue">
                  {stats.total}
                </Text>
                <Text size="sm" c="dimmed" ta="center">
                  Asistentes registrados
                </Text>
              </Stack>
            </Group>
          </Card>
        )}

        {loading ? (
          <Center h={200}>
            <Loader size="lg" />
          </Center>
        ) : error ? (
          <Alert color="red" title="Error">
            {error}
            <Group mt="md">
              <Button onClick={refetchData} size="sm">
                Reintentar
              </Button>
            </Group>
          </Alert>
        ) : attendees.length === 0 ? (
          <Alert variant="light" color="blue">
            <Text>No hay asistentes registrados para este evento aún.</Text>
            <Text size="sm" c="dimmed" mt="xs">
              Los asistentes aparecerán aquí cuando accedan al evento.
            </Text>
          </Alert>
        ) : (
          <Card withBorder radius="lg" p={0}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Nombre</Table.Th>
                  <Table.Th>Última actividad</Table.Th>
                  <Table.Th>Estado</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {attendees.map((attendee) => (
                  <Table.Tr key={attendee._id}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {attendee.email}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {attendee.name || "-"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {attendee.lastSeenAt 
                          ? new Date(attendee.lastSeenAt).toLocaleDateString('es-ES', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Nunca'
                        }
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge 
                        color={attendee.isActive ? "green" : "gray"}
                        variant="light"
                        size="sm"
                      >
                        {attendee.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        )}

        <Group justify="flex-end" mt="md">
          <Button onClick={onClose} variant="light">
            Cerrar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}