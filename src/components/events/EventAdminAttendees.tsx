/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import {
  Stack,
  Title,
  Card,
  Group,
  Text,
  Tabs,
  Table,
  Badge,
  Loader,
  Center,
  Alert,
  Button,
  ActionIcon,
  Tooltip,
  Modal,
  Divider,
  Pagination,
  Select,
} from "@mantine/core";
import { IconEye, IconFileSpreadsheet } from "@tabler/icons-react";
import * as XLSX from "xlsx";
import { type Org } from "../../api/orgs";
import { type EventItem } from "../../api/events";
import { api } from "../../core/api";
import type { RegistrationForm } from "../../types";

interface EventAdminAttendeesProps {
  org: Org;
  event: EventItem;
}

// EventUser: personas inscritas al evento
interface EventUser {
  _id: string;
  eventId: string;
  attendeeId:
    | string
    | {
        _id: string;
        email: string;
        name?: string;
        registrationData?: Record<string, any>;
        organizationId?: string;
      };
  firebaseUID?: string;
  lastLoginAt?: string;
  status: "registered" | "attended" | "cancelled";
  registeredAt: string;
  attendedAt?: string;
  checkedIn: boolean;
  checkedInAt?: string;
  additionalData?: Record<string, any>;
}

// LiveAttendee: EventUser con estadísticas de visualización
interface LiveAttendee {
  _id: string;
  eventId: string;
  attendeeId:
    | string
    | {
        _id: string;
        email: string;
        name?: string;
        registrationData?: Record<string, any>;
        organizationId?: string;
      };
  status: "registered" | "attended" | "cancelled";
  registeredAt: string;
  checkedIn: boolean;
  viewingStats?: {
    totalSessions: number;
    totalWatchTimeSeconds: number;
    liveWatchTimeSeconds: number;
    lastHeartbeat?: string;
  };
}

export default function EventAdminAttendees({
  org,
  event,
}: EventAdminAttendeesProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registrationForm, setRegistrationForm] =
    useState<RegistrationForm | null>(null);

  // EventUsers (inscritos)
  const [eventUsers, setEventUsers] = useState<EventUser[]>([]);
  const [eventUsersStats, setEventUsersStats] = useState<{
    total: number;
  } | null>(null);

  // Live attendees (asistieron en vivo)
  const [liveAttendees, setLiveAttendees] = useState<LiveAttendee[]>([]);
  const [liveAttendeesStats, setLiveAttendeesStats] = useState<{
    total: number;
  } | null>(null);

  // Paginación
  const [registeredPage, setRegisteredPage] = useState(1);
  const [livePage, setLivePage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal de visualización
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedData, setSelectedData] = useState<any>(null);

  // Obtener campos identificadores
  const getIdentifierFields = () => {
    if (!registrationForm) return [];
    return registrationForm.fields.filter((field) => field.isIdentifier);
  };

  // Obtener valor de un campo
  const getFieldValue = (
    registrationData: Record<string, any> | undefined,
    fieldId: string
  ) => {
    if (!registrationData) return "-";
    return registrationData[fieldId] || "-";
  };

  // Obtener el label de un campo por su ID
  const getFieldLabelById = (fieldId: string): string => {
    if (!registrationForm) return fieldId;
    const field = registrationForm.fields.find((f) => f.id === fieldId);
    return field?.label || fieldId;
  };

  // Formatear el valor según el tipo de campo
  const formatFieldValue = (
    fieldId: string,
    value: string | number | boolean | null | undefined
  ): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "✓ Sí" : "✗ No";

    const field = registrationForm?.fields.find((f) => f.id === fieldId);
    if (field?.type === "select" && field.options) {
      const option = field.options.find((opt) => opt.value === value);
      if (option) return option.label;
    }

    return String(value);
  };

  // ============================
  // EXPORTAR EXCEL (3 HOJAS)
  // ============================
  const handleExportExcel = () => {
    try {
      const allFields = registrationForm?.fields ?? [];

      // ---------- 1) ORDENAMOS POR ÚLTIMO ACCESO ----------
      const registeredForExport = [...eventUsers].sort((a, b) => {
        const aTime = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const bTime = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
        return bTime - aTime; // descendente
      });

      // ---------- 2) DETERMINAR FIN DEL EN VIVO ----------
      // Usamos el último lastHeartbeat de liveAttendees
      const liveEndTimestamp = (() => {
        const timestamps = liveAttendees
          .map((la) => la.viewingStats?.lastHeartbeat)
          .filter((ts): ts is string => Boolean(ts))
          .map((ts) => new Date(ts).getTime())
          .filter((ms) => !Number.isNaN(ms) && ms > 0);

        if (timestamps.length === 0) return null;
        return Math.max(...timestamps);
      })();

      // ---------- 3) CLASIFICAR: ASISTENTES / INSCRITOS / DIFERIDOS ----------
      const asistentes: EventUser[] = [];
      const inscritos: EventUser[] = [];
      const diferidos: EventUser[] = [];

      registeredForExport.forEach((eu) => {
        const registeredMs = new Date(eu.registeredAt).getTime();
        const isRegisteredMsValid = !Number.isNaN(registeredMs);

        // Asistentes: status === "attended"
        if (eu.status === "attended") {
          asistentes.push(eu);
          return;
        }

        // Si no tenemos liveEnd, todo lo NO attended va a "Inscritos"
        if (!liveEndTimestamp || !isRegisteredMsValid) {
          inscritos.push(eu);
          return;
        }

        // Diferidos: registrados DESPUÉS de terminado el evento
        if (registeredMs > liveEndTimestamp) {
          diferidos.push(eu);
        } else {
          // Inscritos: registrados antes/durante el evento (y que no asistieron)
          inscritos.push(eu);
        }
      });

      // ---------- 4) HEADER COMÚN ----------
      const commonHeader: (string | number)[] = [
        "Tipo",
        "Email",
        ...allFields.map((f) => f.label),
        "Estado",
        "Registrado en",
        "Último acceso",
        "Check-in",
        "Check-in en vivo",
        "Firebase UID",
      ];

      // Helper para construir filas de EventUser
      const buildRowsForEventUsers = (
        users: EventUser[],
        tipoLabel: string
      ): (string | number)[][] => {
        const rows: (string | number)[][] = [];

        users.forEach((eu) => {
          const attendee =
            typeof eu.attendeeId === "object" && eu.attendeeId !== null
              ? eu.attendeeId
              : null;

          const email = (attendee as any)?.email ?? "-";

          const rowFields = allFields.map((field) =>
            attendee
              ? formatFieldValue(
                  field.id,
                  (attendee as any).registrationData?.[field.id]
                )
              : "-"
          );

          const statusLabel =
            eu.status === "attended"
              ? "Asistió en vivo"
              : eu.status === "cancelled"
              ? "Cancelado"
              : "Registrado";

          const registeredAtStr = eu.registeredAt
            ? new Date(eu.registeredAt).toLocaleString("es-ES")
            : "";

          const lastLoginStr = eu.lastLoginAt
            ? new Date(eu.lastLoginAt).toLocaleString("es-ES")
            : "Nunca";

          const checkedInLabel = eu.checkedIn ? "Sí" : "No";
          const checkedInAtStr = eu.checkedInAt
            ? new Date(eu.checkedInAt).toLocaleString("es-ES")
            : "";

          rows.push([
            tipoLabel,
            email,
            ...rowFields,
            statusLabel,
            registeredAtStr,
            lastLoginStr,
            checkedInLabel,
            checkedInAtStr,
            eu.firebaseUID ?? "",
          ]);
        });

        return rows;
      };

      // ---------- 5) ARMAR LAS 3 HOJAS ----------
      const asistentesSheetData: (string | number)[][] = [
        commonHeader,
        ...buildRowsForEventUsers(asistentes, "Asistente"),
      ];

      const inscritosSheetData: (string | number)[][] = [
        commonHeader,
        ...buildRowsForEventUsers(inscritos, "Inscrito"),
      ];

      const diferidosSheetData: (string | number)[][] = [
        commonHeader,
        ...buildRowsForEventUsers(diferidos, "Diferido"),
      ];

      // ---------- 6) CREAR WORKBOOK Y GUARDAR ----------
      const wb = XLSX.utils.book_new();

      const wsAsistentes = XLSX.utils.aoa_to_sheet(asistentesSheetData);
      XLSX.utils.book_append_sheet(wb, wsAsistentes, "Asistentes");

      const wsInscritos = XLSX.utils.aoa_to_sheet(inscritosSheetData);
      XLSX.utils.book_append_sheet(wb, wsInscritos, "Inscritos");

      const wsDiferidos = XLSX.utils.aoa_to_sheet(diferidosSheetData);
      XLSX.utils.book_append_sheet(wb, wsDiferidos, "Diferidos");

      const safeTitle = event.title
        ? event.title.replace(/[\\/:*?"<>|]/g, "_")
        : "evento";

      XLSX.writeFile(wb, `asistentes_${safeTitle}.xlsx`);
    } catch (err) {
      console.error("Error exporting to Excel:", err);
    }
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener el formulario de registro
      const orgResponse = await api.get(`/orgs/${org._id}`);
      const orgSlug = orgResponse.data.domainSlug;

      const [eventUsersResponse, liveAttendeesResponse, formResponse] =
        await Promise.all([
          // EventUsers (inscritos)
          api
            .get(`/event-users/event/${event._id}`)
            .catch(() => ({ data: [] })),
          // Live attendees (asistieron en vivo basado en ViewingSession)
          api
            .get(`/event-users/event/${event._id}/live-attendees`)
            .catch(() => ({ data: [] })),
          // Formulario de registro
          api
            .get(`/orgs/slug/${orgSlug}/registration-form`)
            .catch(() => ({ data: null })),
        ]);

      // ---------- INSCRITOS (EventUsers) ----------
      const validEventUsersRaw = eventUsersResponse.data.filter(
        (eu: EventUser) =>
          typeof eu.attendeeId === "object" && eu.attendeeId !== null
      );

      const seenEventUsers = new Set<string>();
      const validEventUsers = validEventUsersRaw.filter((eu: EventUser) => {
        const attendee =
          typeof eu.attendeeId === "object" && eu.attendeeId !== null
            ? eu.attendeeId
            : null;

        if (!attendee) return false;

        const attendeeObj = attendee as { _id?: string; email?: string };

        const key = attendeeObj._id || attendeeObj.email || null;
        if (!key) return true; // si no hay nada con qué deduplicar, lo dejamos pasar

        if (seenEventUsers.has(key)) {
          return false;
        }

        seenEventUsers.add(key);
        return true;
      });

      // ---------- LIVE ATTENDEES ----------
      const validLiveAttendeesRaw = liveAttendeesResponse.data.filter(
        (eu: LiveAttendee) =>
          typeof eu.attendeeId === "object" && eu.attendeeId !== null
      );

      const seenLive = new Set<string>();
      const validLiveAttendees = validLiveAttendeesRaw.filter(
        (eu: LiveAttendee) => {
          const attendee =
            typeof eu.attendeeId === "object" && eu.attendeeId !== null
              ? eu.attendeeId
              : null;

          if (!attendee) return false;

          const attendeeObj = attendee as { _id?: string; email?: string };

          const key = attendeeObj._id || attendeeObj.email || null;
          if (!key) return true;

          if (seenLive.has(key)) {
            console.log("Duplicado detectado (liveAttendee)", {
              duplicatedKey: key,
              eventUser: eu,
            });
            return false;
          }

          seenLive.add(key);
          return true;
        }
      );

      setEventUsers(validEventUsers);
      setEventUsersStats({ total: validEventUsers.length });

      setLiveAttendees(validLiveAttendees);
      setLiveAttendeesStats({ total: validLiveAttendees.length });

      setRegistrationForm(formResponse.data);

      // resetear página al recargar datos
      setRegisteredPage(1);
      setLivePage(1);
    } catch (err) {
      console.error("Error loading attendees:", err);
      setError("No se pudieron cargar los datos de asistentes");
    } finally {
      setLoading(false);
    }
  }, [org._id, event._id]);

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

  // Datos paginados
  const totalRegisteredPages = Math.max(
    1,
    Math.ceil(eventUsers.length / pageSize)
  );
  const totalLivePages = Math.max(
    1,
    Math.ceil(liveAttendees.length / pageSize)
  );

  const registeredStartIndex = (registeredPage - 1) * pageSize;
  const liveStartIndex = (livePage - 1) * pageSize;

  const registeredPaginated = eventUsers.slice(
    registeredStartIndex,
    registeredStartIndex + pageSize
  );
  const livePaginated = liveAttendees.slice(
    liveStartIndex,
    liveStartIndex + pageSize
  );

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={1}>Asistentes</Title>
          <Text c="dimmed" size="lg">
            Gestiona los participantes de {event.title}
          </Text>
        </div>

        <Button
          variant="light"
          leftSection={<IconFileSpreadsheet size={16} />}
          onClick={handleExportExcel}
        >
          Exportar a Excel
        </Button>
      </Group>

      <Tabs defaultValue="registered">
        <Tabs.List>
          <Tabs.Tab value="registered">
            📝 Inscritos ({eventUsersStats?.total || 0})
          </Tabs.Tab>
          <Tabs.Tab value="live">
            🎥 Asistieron en vivo ({liveAttendeesStats?.total || 0})
          </Tabs.Tab>
        </Tabs.List>

        {/* Tab de inscritos */}
        <Tabs.Panel value="registered" pt="lg">
          {eventUsers.length === 0 ? (
            <Alert variant="light" color="blue">
              <Text>No hay personas inscritas a este evento aún.</Text>
              <Text size="sm" c="dimmed" mt="xs">
                Los usuarios inscritos aparecerán aquí cuando se registren al
                evento.
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
                    <Table.Th>Estado</Table.Th>
                    <Table.Th>Inscripción</Table.Th>
                    <Table.Th>Último acceso</Table.Th>
                    <Table.Th>Check-in en vivo</Table.Th>
                    <Table.Th>Acciones</Table.Th>
                  </Table.Tr>
                </Table.Thead>

                <Table.Tbody>
                  {registeredPaginated.map((eventUser) => {
                    const attendee =
                      typeof eventUser.attendeeId === "object"
                        ? eventUser.attendeeId
                        : null;

                    const lastLogin = eventUser.lastLoginAt
                      ? new Date(eventUser.lastLoginAt).toLocaleString(
                          "es-ES",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : "Nunca";

                    return (
                      <Table.Tr key={eventUser._id}>
                        {getIdentifierFields().map((field) => (
                          <Table.Td key={field.id}>
                            <Text size="sm">
                              {attendee
                                ? getFieldValue(
                                    (attendee as any).registrationData,
                                    field.id
                                  )
                                : "-"}
                            </Text>
                          </Table.Td>
                        ))}

                        {/* Estado general */}
                        <Table.Td>
                          <Badge
                            color={
                              eventUser.status === "attended"
                                ? "green"
                                : eventUser.status === "cancelled"
                                ? "red"
                                : "blue"
                            }
                            variant="light"
                            size="sm"
                          >
                            {eventUser.status === "attended"
                              ? "Asistió en vivo"
                              : eventUser.status === "cancelled"
                              ? "Cancelado"
                              : "Registrado"}
                          </Badge>
                        </Table.Td>

                        {/* Fecha de inscripción */}
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {new Date(
                              eventUser.registeredAt
                            ).toLocaleDateString("es-ES")}
                          </Text>
                        </Table.Td>

                        {/* Último acceso (live o replay) */}
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {lastLogin}
                          </Text>
                        </Table.Td>

                        {/* Check-in en vivo */}
                        <Table.Td>
                          <Badge
                            color={eventUser.checkedIn ? "green" : "gray"}
                            variant="light"
                            size="sm"
                          >
                            {eventUser.checkedIn
                              ? "✓ Asistió en vivo"
                              : "Pendiente"}
                          </Badge>
                        </Table.Td>

                        {/* Acciones */}
                        <Table.Td>
                          {attendee ? (
                            <Tooltip label="Ver datos completos">
                              <ActionIcon
                                variant="light"
                                color="blue"
                                onClick={() => {
                                  setSelectedData(attendee);
                                  setViewModalOpen(true);
                                }}
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                          ) : (
                            <Text size="xs" c="dimmed">
                              Sin datos
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>

              <Group justify="space-between" p="md">
                <Text size="xs" c="dimmed">
                  Mostrando{" "}
                  {eventUsers.length === 0 ? 0 : registeredStartIndex + 1} –{" "}
                  {Math.min(registeredStartIndex + pageSize, eventUsers.length)}{" "}
                  de {eventUsers.length}
                </Text>

                <Group gap="xs">
                  <Select
                    size="xs"
                    w={140}
                    data={[
                      { value: "5", label: "5 por página" },
                      { value: "10", label: "10 por página" },
                      { value: "20", label: "20 por página" },
                      { value: "50", label: "50 por página" },
                    ]}
                    value={String(pageSize)}
                    onChange={(value) => {
                      if (!value) return;
                      const newSize = Number(value);
                      setPageSize(newSize);
                      setRegisteredPage(1);
                      setLivePage(1);
                    }}
                  />

                  <Pagination
                    size="sm"
                    value={registeredPage}
                    onChange={setRegisteredPage}
                    total={totalRegisteredPages}
                  />
                </Group>
              </Group>
            </Card>
          )}
        </Tabs.Panel>

        {/* Tab de asistieron en vivo */}
        <Tabs.Panel value="live" pt="lg">
          {liveAttendees.length === 0 ? (
            <Alert variant="light" color="blue">
              <Text>
                No hay personas que hayan asistido en vivo a este evento aún.
              </Text>
              <Text size="sm" c="dimmed" mt="xs">
                Los usuarios que accedan al evento en vivo aparecerán aquí.
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
                    <Table.Th>Tiempo en vivo</Table.Th>
                    <Table.Th>Última actividad</Table.Th>
                    <Table.Th>Acciones</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {livePaginated.map((eventUser) => {
                    const attendee =
                      typeof eventUser.attendeeId === "object"
                        ? eventUser.attendeeId
                        : null;
                    const liveMinutes = eventUser.viewingStats
                      ? Math.floor(
                          eventUser.viewingStats.liveWatchTimeSeconds / 60
                        )
                      : 0;

                    return (
                      <Table.Tr key={eventUser._id}>
                        {getIdentifierFields().map((field) => (
                          <Table.Td key={field.id}>
                            <Text size="sm">
                              {attendee
                                ? getFieldValue(
                                    (attendee as any).registrationData,
                                    field.id
                                  )
                                : "-"}
                            </Text>
                          </Table.Td>
                        ))}

                        <Table.Td>
                          <Badge color="blue" variant="light" size="sm">
                            {liveMinutes} min
                          </Badge>
                        </Table.Td>

                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {eventUser.viewingStats?.lastHeartbeat
                              ? new Date(
                                  eventUser.viewingStats.lastHeartbeat
                                ).toLocaleDateString("es-ES", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Nunca"}
                          </Text>
                        </Table.Td>

                        <Table.Td>
                          {attendee ? (
                            <Tooltip label="Ver datos completos">
                              <ActionIcon
                                variant="light"
                                color="blue"
                                onClick={() => {
                                  setSelectedData(attendee);
                                  setViewModalOpen(true);
                                }}
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                          ) : (
                            <Text size="xs" c="dimmed">
                              Sin datos
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>

              <Group justify="space-between" p="md">
                <Text size="xs" c="dimmed">
                  Mostrando{" "}
                  {liveAttendees.length === 0 ? 0 : liveStartIndex + 1} –{" "}
                  {Math.min(liveStartIndex + pageSize, liveAttendees.length)} de{" "}
                  {liveAttendees.length}
                </Text>

                <Group gap="xs">
                  <Select
                    size="xs"
                    w={140}
                    data={[
                      { value: "5", label: "5 por página" },
                      { value: "10", label: "10 por página" },
                      { value: "20", label: "20 por página" },
                      { value: "50", label: "50 por página" },
                    ]}
                    value={String(pageSize)}
                    onChange={(value) => {
                      if (!value) return;
                      const newSize = Number(value);
                      setPageSize(newSize);
                      setRegisteredPage(1);
                      setLivePage(1);
                    }}
                  />

                  <Pagination
                    size="sm"
                    value={livePage}
                    onChange={setLivePage}
                    total={totalLivePages}
                  />
                </Group>
              </Group>
            </Card>
          )}
        </Tabs.Panel>
      </Tabs>

      {/* Modal para ver datos completos */}
      <Modal
        opened={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setSelectedData(null);
        }}
        title="Datos completos del registro"
        size="lg"
        centered
      >
        {selectedData && registrationForm && (
          <Stack gap="md">
            <div>
              <Text size="sm" fw={600} mb="xs">
                Información del registro:
              </Text>
              <Card withBorder p="sm">
                <Stack gap="sm">
                  {selectedData.registrationData &&
                  Object.keys(selectedData.registrationData).length > 0 ? (
                    <>
                      {Object.entries(selectedData.registrationData).map(
                        ([fieldId, value]) => {
                          const label = getFieldLabelById(fieldId);
                          const formattedValue = formatFieldValue(
                            fieldId,
                            value as
                              | string
                              | number
                              | boolean
                              | null
                              | undefined
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
                          Email:
                        </Text>
                        <Text size="sm" fw={500}>
                          {selectedData.email}
                        </Text>
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
                  setSelectedData(null);
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
