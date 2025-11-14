import { Button, Group, Table, Text } from "@mantine/core";
import { type EventItem, setEventStatus } from "../../api/events";
import { Link } from "react-router-dom";

export default function OrgEventsTable({
  events,
  onChanged,
  onConfigure,
  onViewAttendees,
}: {
  events: EventItem[];
  onChanged: () => void;
  onConfigure: (ev: EventItem) => void;
  onViewAttendees?: (ev: EventItem) => void;
}) {
  const color = (s: EventItem["status"]) =>
    s === "live"
      ? "red"
      : s === "upcoming"
      ? "blue"
      : s === "replay"
      ? "grape"
      : "gray";

  return (
    <Table highlightOnHover withTableBorder withColumnBorders>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Título</Table.Th>
          <Table.Th>Slug</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Acciones</Table.Th>
          <Table.Th>ID</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {events.map((ev) => (
          <Table.Tr key={ev._id}>
            <Table.Td>{ev.title}</Table.Td>
            <Table.Td>
              <Group gap="xs">
                <Text>{ev.slug}</Text>
                <Button
                  size="xs"
                  variant="subtle"
                  component={Link}
                  to={`/e/${encodeURIComponent(ev.slug)}`}
                  target="_blank"
                >
                  Abrir público
                </Button>
              </Group>
            </Table.Td>
            <Table.Td>
              <Text tt="uppercase" c={color(ev.status)}>
                {ev.status}
              </Text>
            </Table.Td>
            <Table.Td>
              <Group gap="xs" wrap="wrap">
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    setEventStatus(ev._id, "upcoming").then(onChanged)
                  }
                >
                  Upcoming
                </Button>
                <Button
                  size="xs"
                  color="red"
                  variant="light"
                  onClick={() => setEventStatus(ev._id, "live").then(onChanged)}
                >
                  Live
                </Button>
                <Button
                  size="xs"
                  color="gray"
                  variant="light"
                  onClick={() =>
                    setEventStatus(ev._id, "ended").then(onChanged)
                  }
                >
                  Ended
                </Button>
                <Button
                  size="xs"
                  color="grape"
                  variant="light"
                  onClick={() =>
                    setEventStatus(ev._id, "replay").then(onChanged)
                  }
                >
                  Replay
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => onConfigure(ev)}
                >
                  🎛️ Configurar stream
                </Button>
                {onViewAttendees && (
                  <Button
                    size="xs"
                    variant="light"
                    color="blue"
                    onClick={() => onViewAttendees(ev)}
                  >
                    👥 Ver asistentes
                  </Button>
                )}
              </Group>
            </Table.Td>
            <Table.Td>
              <Text size="xs" c="dimmed">
                {ev._id}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
