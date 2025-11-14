import { Button, Group, Tooltip } from "@mantine/core";
import { setEventStatus } from "../../api/events";
import { useState } from "react";

export default function EventStatusSwitcher({
  eventId,
  initial,
}: {
  eventId: string;
  initial: "upcoming" | "live" | "ended" | "replay";
}) {
  const [status, setStatus] = useState(initial);
  const [loading, setLoading] = useState<
    "upcoming" | "live" | "ended" | "replay" | null
  >(null);

  const setS = async (s: typeof status) => {
    try {
      setLoading(s);
      await setEventStatus(eventId, s);
      setStatus(s);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Group gap="xs" wrap="wrap">
      <Tooltip label="Aún no inicia">
        <Button
          size="xs"
          variant={status === "upcoming" ? "filled" : "light"}
          loading={loading === "upcoming"}
          onClick={() => setS("upcoming")}
        >
          Upcoming
        </Button>
      </Tooltip>
      <Tooltip label="Iniciar en vivo">
        <Button
          size="xs"
          color="red"
          variant={status === "live" ? "filled" : "light"}
          loading={loading === "live"}
          onClick={() => setS("live")}
        >
          Live
        </Button>
      </Tooltip>
      <Tooltip label="Marcar terminado">
        <Button
          size="xs"
          color="gray"
          variant={status === "ended" ? "filled" : "light"}
          loading={loading === "ended"}
          onClick={() => setS("ended")}
        >
          Ended
        </Button>
      </Tooltip>
      <Tooltip label="Habilitar repetición">
        <Button
          size="xs"
          color="grape"
          variant={status === "replay" ? "filled" : "light"}
          loading={loading === "replay"}
          onClick={() => setS("replay")}
        >
          Replay
        </Button>
      </Tooltip>
    </Group>
  );
}
