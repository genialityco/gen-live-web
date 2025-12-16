/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo } from "react";
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
  const [deferredPage, setDeferredPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal de visualización
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedData, setSelectedData] = useState<any>(null);

  // ========= Helpers =========
  const getAttendeeObj = (attendeeId: any) =>
    typeof attendeeId === "object" && attendeeId !== null ? attendeeId : null;

  const getAttendeeKey = (attendee: any) => attendee?._id || attendee?.email;

  // Fin del evento: endedAt (preferido) o schedule.endsAt
  const eventEndMs = useMemo(() => {
    const endedAtRaw = (event as any)?.endedAt;
    const scheduleEndsAtRaw = (event as any)?.schedule?.endsAt;

    const ended = endedAtRaw ? new Date(endedAtRaw).getTime() : NaN;
    if (!Number.isNaN(ended) && ended > 0) return ended;

    const schedEnd = scheduleEndsAtRaw
      ? new Date(scheduleEndsAtRaw).getTime()
      : NaN;
    if (!Number.isNaN(schedEnd) && schedEnd > 0) return schedEnd;

    return null;
  }, [event]);

  const eventEndLabel = useMemo(() => {
    if (!eventEndMs) return "Sin fecha de finalización";
    return new Date(eventEndMs).toLocaleString("es-ES");
  }, [eventEndMs]);

  // Set de asistentes (liveAttendees) para excluirlos de diferidos
  const asistentesKeySet = useMemo(() => {
    const keys = liveAttendees
      .map((la) => getAttendeeKey(getAttendeeObj(la.attendeeId)))
      .filter(Boolean) as string[];
    return new Set(keys);
  }, [liveAttendees]);

  // Diferidos: eventUsers cuyo lastLoginAt > fin del evento
  const deferredUsers = useMemo(() => {
    if (!eventEndMs) return [];

    return eventUsers.filter((eu) => {
      const attendee = getAttendeeObj(eu.attendeeId);
      const key = attendee ? getAttendeeKey(attendee) : null;

      // si fue asistente en vivo, no lo contamos como diferido
      if (key && asistentesKeySet.has(key)) return false;

      const loginMs = eu.lastLoginAt ? new Date(eu.lastLoginAt).getTime() : NaN;
      return !Number.isNaN(loginMs) && loginMs > eventEndMs;
    });
  }, [eventEndMs, eventUsers, asistentesKeySet]);

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

      const inscritos = [...eventUsers];
      const asistentes = [...liveAttendees];
      const diferidos = [...deferredUsers];

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
        "Tiempo en vivo (min)",
        "Última actividad (heartbeat)",
      ];

      const buildRowsForEventUsers = (
        users: EventUser[],
        tipoLabel: string
      ): (string | number)[][] => {
        return users.map((eu) => {
          const attendee = getAttendeeObj(eu.attendeeId);

          const email = (attendee as any)?.email ?? "-";

          const rowFields = allFields.map((field) =>
            attendee
              ? formatFieldValue(
                  field.id,
                  (attendee as any).registrationData?.[field.id]
                )
              : "-"
          );

          const registeredAtStr = eu.registeredAt
            ? new Date(eu.registeredAt).toLocaleString("es-ES")
            : "";

          const lastLoginStr = eu.lastLoginAt
            ? new Date(eu.lastLoginAt).toLocaleString("es-ES")
            : "Nunca";

          return [
            tipoLabel,
            email,
            ...rowFields,
            registeredAtStr,
            lastLoginStr,
            eu.checkedIn ? "Sí" : "No",
            eu.firebaseUID ?? "",
            "", // Tiempo en vivo (min)
            "", // Última actividad (heartbeat)
          ];
        });
      };

      const buildRowsForLiveAttendees = (
        users: LiveAttendee[]
      ): (string | number)[][] => {
        return users.map((eu) => {
          const attendee = getAttendeeObj(eu.attendeeId);

          const email = (attendee as any)?.email ?? "-";

          const rowFields = allFields.map((field) =>
            attendee
              ? formatFieldValue(
                  field.id,
                  (attendee as any).registrationData?.[field.id]
                )
              : "-"
          );

          const registeredAtStr = eu.registeredAt
            ? new Date(eu.registeredAt).toLocaleString("es-ES")
            : "";

          const lastLoginStr = ""; // LiveAttendee no trae lastLoginAt
          const liveMinutes = eu.viewingStats
            ? Math.floor(eu.viewingStats.liveWatchTimeSeconds / 60)
            : 0;

          const lastHeartbeatStr = eu.viewingStats?.lastHeartbeat
            ? new Date(eu.viewingStats.lastHeartbeat).toLocaleString("es-ES")
            : "Nunca";

          return [
            "Asistente",
            email,
            ...rowFields,
            registeredAtStr,
            lastLoginStr,
            eu.checkedIn ? "Sí" : "No",
            "", // Firebase UID no viene aquí
            liveMinutes,
            lastHeartbeatStr,
          ];
        });
      };

      const inscritosSheetData: (string | number)[][] = [
        commonHeader,
        ...buildRowsForEventUsers(inscritos, "Inscrito"),
      ];

      const asistentesSheetData: (string | number)[][] = [
        commonHeader,
        ...buildRowsForLiveAttendees(asistentes),
      ];

      const diferidosSheetData: (string | number)[][] = [
        commonHeader,
        ...buildRowsForEventUsers(diferidos, "Diferido"),
      ];

      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet(inscritosSheetData),
        "Inscritos"
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet(asistentesSheetData),
        "Asistentes"
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet(diferidosSheetData),
        "Diferidos"
      );

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
          api
            .get(`/event-users/event/${event._id}`)
            .catch(() => ({ data: [] })),
          api
            .get(`/event-users/event/${event._id}/live-attendees`)
            .catch(() => ({ data: [] })),
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
        const attendee = getAttendeeObj(eu.attendeeId);
        if (!attendee) return false;

        const key = getAttendeeKey(attendee) || null;
        if (!key) return true;

        if (seenEventUsers.has(key)) return false;

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
          const attendee = getAttendeeObj(eu.attendeeId);
          if (!attendee) return false;

          const key = getAttendeeKey(attendee) || null;
          if (!key) return true;

          if (seenLive.has(key)) return false;

          seenLive.add(key);
          return true;
        }
      );

      setEventUsers(validEventUsers);
      setEventUsersStats({ total: validEventUsers.length });

      setLiveAttendees(validLiveAttendees);
      setLiveAttendeesStats({ total: validLiveAttendees.length });

      setRegistrationForm(formResponse.data);

      // resetear páginas al recargar datos
      setRegisteredPage(1);
      setLivePage(1);
      setDeferredPage(1);
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

  // ============ Paginación ============
  const totalRegisteredPages = Math.max(
    1,
    Math.ceil(eventUsers.length / pageSize)
  );
  const totalLivePages = Math.max(
    1,
    Math.ceil(liveAttendees.length / pageSize)
  );
  const totalDeferredPages = Math.max(
    1,
    Math.ceil(deferredUsers.length / pageSize)
  );

  const registeredStartIndex = (registeredPage - 1) * pageSize;
  const liveStartIndex = (livePage - 1) * pageSize;
  const deferredStartIndex = (deferredPage - 1) * pageSize;

  const registeredPaginated = eventUsers.slice(
    registeredStartIndex,
    registeredStartIndex + pageSize
  );

  const livePaginated = liveAttendees.slice(
    liveStartIndex,
    liveStartIndex + pageSize
  );

  const deferredPaginated = deferredUsers.slice(
    deferredStartIndex,
    deferredStartIndex + pageSize
  );

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={1}>Asistentes</Title>
          <Text c="dimmed" size="lg">
            Gestiona los participantes de {event.title}
          </Text>
          <Text c="dimmed" size="sm" mt={4}>
            Fin del evento (endedAt / schedule.endsAt): {eventEndLabel}
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
            🎥 Asistentes ({liveAttendeesStats?.total || 0})
          </Tabs.Tab>
          <Tabs.Tab value="deferred">
            📼 Diferidos ({deferredUsers.length})
          </Tabs.Tab>
        </Tabs.List>

        {/* ========================= */}
        {/* Tab de inscritos */}
        {/* ========================= */}
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
                    const attendee = getAttendeeObj(eventUser.attendeeId);

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
                      setDeferredPage(1);
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
                    const attendee = getAttendeeObj(eventUser.attendeeId);

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
                          <Badge variant="light" size="sm">
                            {liveMinutes} min
                          </Badge>
                        </Table.Td>

                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {eventUser.viewingStats?.lastHeartbeat
                              ? new Date(
                                  eventUser.viewingStats.lastHeartbeat
                                ).toLocaleString("es-ES", {
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
                      setDeferredPage(1);
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

        {/* ========================= */}
        {/* Tab de diferidos */}
        {/* ========================= */}
        <Tabs.Panel value="deferred" pt="lg">
          {deferredUsers.length === 0 ? (
            <Alert variant="light" color="blue">
              <Text>No hay diferidos detectados.</Text>
              <Text size="sm" c="dimmed" mt="xs">
                Se consideran diferidos quienes ingresaron después del fin del
                evento (endedAt / schedule.endsAt), usando lastLoginAt.
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
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Último acceso</Table.Th>
                    <Table.Th>Acciones</Table.Th>
                  </Table.Tr>
                </Table.Thead>

                <Table.Tbody>
                  {deferredPaginated.map((eventUser) => {
                    const attendee = getAttendeeObj(eventUser.attendeeId);

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

                        <Table.Td>
                          <Badge variant="light" size="sm">
                            Diferido
                          </Badge>
                        </Table.Td>

                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {lastLogin}
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
                  {deferredUsers.length === 0 ? 0 : deferredStartIndex + 1} –{" "}
                  {Math.min(
                    deferredStartIndex + pageSize,
                    deferredUsers.length
                  )}{" "}
                  de {deferredUsers.length}
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
                      setDeferredPage(1);
                    }}
                  />

                  <Pagination
                    size="sm"
                    value={deferredPage}
                    onChange={setDeferredPage}
                    total={totalDeferredPages}
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
                            value as any
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
