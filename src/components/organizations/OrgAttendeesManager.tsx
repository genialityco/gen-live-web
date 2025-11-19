/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import {
  Stack,
  Title,
  Card,
  Group,
  Text,
  Button,
  Table,
  Badge,
  Loader,
  Center,
  Alert,
  Modal,
  Divider,
  Pagination,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { IconEye, IconUpload } from "@tabler/icons-react";
import { api } from "../../core/api";
import type { RegistrationForm } from "../../types";
import ImportAttendeesModal from "./ImportAttendeesModal";

export type OrgAttendee = {
  _id: string;
  orgId: string;
  organizationId: string;
  email: string;
  name?: string;
  phone?: string;
  registrationData?: Record<string, any>;
  registeredAt: string;
  eventIds: string[];
};

interface OrgAttendeesManagerProps {
  orgId: string;
  orgName: string;
}

export default function OrgAttendeesManager({
  orgId,
  orgName,
}: OrgAttendeesManagerProps) {
  const [attendees, setAttendees] = useState<OrgAttendee[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    thisMonth: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState<OrgAttendee | null>(
    null
  );
  const [registrationForm, setRegistrationForm] =
    useState<RegistrationForm | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const itemsPerPage = 10;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Primero obtenemos la organización para conseguir el slug
      const orgResponse = await api.get(`/orgs/${orgId}`);
      const orgSlug = orgResponse.data.domainSlug;

      const [attendeesResponse, statsResponse, formResponse] =
        await Promise.all([
          api.get(`/orgs/${orgId}/attendees`),
          api.get(`/orgs/${orgId}/attendees/stats`),
          api
            .get(`/orgs/slug/${orgSlug}/registration-form`)
            .catch(() => ({ data: null })),
        ]);

      setAttendees(attendeesResponse.data);
      setStats(statsResponse.data);
      setRegistrationForm(formResponse.data);
    } catch (err) {
      console.error("Error loading attendees:", err);
      setError("No se pudieron cargar los registros");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  // Función para obtener campos identificadores
  const getIdentifierFields = () => {
    if (!registrationForm) return [];
    return registrationForm.fields.filter((field) => field.isIdentifier);
  };

  // Función para obtener valor de un campo
  const getFieldValue = (attendee: OrgAttendee, fieldId: string) => {
    return attendee.registrationData?.[fieldId] || "-";
  };

  // Función para obtener el label de un campo por su ID
  const getFieldLabelById = (fieldId: string): string => {
    if (!registrationForm) return fieldId;
    const field = registrationForm.fields.find((f) => f.id === fieldId);
    return field?.label || fieldId;
  };

  // Función para formatear el valor según el tipo de campo
  const formatFieldValue = (
    fieldId: string,
    value: string | number | boolean | null | undefined
  ): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "✓ Sí" : "✗ No";

    // Si es un campo select, intentar obtener el label de la opción
    const field = registrationForm?.fields.find((f) => f.id === fieldId);
    if (field?.type === "select" && field.options) {
      const option = field.options.find((opt) => opt.value === value);
      if (option) return option.label;
    }

    return String(value);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <Center h={200}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (error) {
    return (
      <Alert color="red" title="Error">
        {error}
        <Group mt="md">
          <Button onClick={loadData} size="sm">
            Reintentar
          </Button>
        </Group>
      </Alert>
    );
  }

  // Paginación
  const startIndex = (activePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAttendees = attendees.slice(startIndex, endIndex);
  const totalPages = Math.ceil(attendees.length / itemsPerPage);

  return (
    <Stack gap="lg">
      {/* Estadísticas */}
      {stats && (
        <Group gap="md" grow>
          <Card withBorder p="md" radius="md">
            <Stack align="center" gap="xs">
              <Text size="xl" fw={700} c="blue">
                {stats.total}
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                Total asistentes
              </Text>
            </Stack>
          </Card>
          <Card withBorder p="md" radius="md">
            <Stack align="center" gap="xs">
              <Text size="xl" fw={700} c="green">
                {stats.thisMonth}
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                Este mes
              </Text>
            </Stack>
          </Card>
        </Group>
      )}

      {/* Encabezado */}
      <Group justify="space-between" align="center">
        <div>
          <Title order={3}>Registros de {orgName}</Title>
          <Text c="dimmed" size="sm">
            Visualiza la base de datos de registros de tu organización
          </Text>
        </div>
        <Button
          leftSection={<IconUpload size={16} />}
          variant="light"
          onClick={() => setImportModalOpen(true)}
        >
          Importar desde Excel
        </Button>
      </Group>

      {/* Tabla de asistentes */}
      {attendees.length === 0 ? (
        <Alert variant="light" color="blue">
          <Text>No hay registros aún.</Text>
          <Text size="sm" c="dimmed" mt="xs">
            Los registros se crearán automáticamente cuando los usuarios se
            registren en eventos, o puedes agregarlos manualmente.
          </Text>
        </Alert>
      ) : (
        <Card withBorder radius="lg" p={0}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                {getIdentifierFields().map((field) => (
                  <Table.Th key={field.id}>{field.label}</Table.Th>
                ))}
                <Table.Th>Eventos</Table.Th>
                <Table.Th>Registro</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedAttendees.map((attendee) => (
                <Table.Tr key={attendee._id}>
                  {getIdentifierFields().map((field) => (
                    <Table.Td key={field.id}>
                      <Text size="sm">{getFieldValue(attendee, field.id)}</Text>
                    </Table.Td>
                  ))}
                  <Table.Td>
                    <Badge variant="light" size="sm">
                      {attendee.eventIds.length} evento
                      {attendee.eventIds.length !== 1 ? "s" : ""}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {new Date(attendee.registeredAt).toLocaleDateString(
                        "es-ES"
                      )}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label="Ver datos completos">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => {
                          setSelectedAttendee(attendee);
                          setViewModalOpen(true);
                        }}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {totalPages > 1 && (
            <>
              <Divider />
              <Group justify="center" p="md">
                <Pagination
                  value={activePage}
                  onChange={setActivePage}
                  total={totalPages}
                  size="sm"
                />
              </Group>
            </>
          )}
        </Card>
      )}

      {registrationForm && (
        <ImportAttendeesModal
          opened={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          orgId={orgId}
          registrationForm={registrationForm}
          onImported={() => {
            setImportModalOpen(false);
            loadData(); // refrescar tabla
          }}
        />
      )}

      {/* Modal para ver datos completos */}
      <Modal
        opened={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setSelectedAttendee(null);
        }}
        title="Datos completos del registro"
        size="lg"
        centered
      >
        {selectedAttendee && registrationForm && (
          <Stack gap="md">
            <div>
              <Text size="sm" fw={600} mb="xs">
                Información del registro:
              </Text>
              <Card withBorder p="sm">
                <Stack gap="sm">
                  {selectedAttendee.registrationData &&
                  Object.keys(selectedAttendee.registrationData).length > 0 ? (
                    <>
                      {Object.entries(selectedAttendee.registrationData).map(
                        ([fieldId, value]) => {
                          const label = getFieldLabelById(fieldId);
                          const formattedValue = formatFieldValue(
                            fieldId,
                            value
                          );

                          return (
                            <Group
                              key={fieldId}
                              justify="space-between"
                              wrap="nowrap"
                              align="flex-start"
                            >
                              <Text
                                size="sm"
                                c="dimmed"
                                style={{ minWidth: "40%", paddingTop: "2px" }}
                              >
                                {label}:
                              </Text>
                              <Text
                                size="sm"
                                fw={500}
                                style={{ textAlign: "right", flex: 1 }}
                              >
                                {formattedValue}
                              </Text>
                            </Group>
                          );
                        }
                      )}
                      <Divider my="xs" />
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Eventos registrados:
                        </Text>
                        <Badge variant="light" size="sm">
                          {selectedAttendee.eventIds.length}
                        </Badge>
                      </Group>
                    </>
                  ) : (
                    <Text size="sm" c="dimmed">
                      No hay datos de registro
                    </Text>
                  )}
                </Stack>
              </Card>
            </div>

            <Group justify="flex-end" gap="sm">
              <Button
                variant="light"
                onClick={() => {
                  setViewModalOpen(false);
                  setSelectedAttendee(null);
                }}
              >
                Cerrar
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
