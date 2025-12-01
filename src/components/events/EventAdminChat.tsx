import { useMemo } from "react";
import { Card } from "@mantine/core";
import type { EventItem } from "../../api/events";

interface EventAdminChatProps {
  event: EventItem;
}

// Mejor tener la URL base en env:
const CHAT_ADMIN_BASE_URL =
  import.meta.env.VITE_CHAT_ADMIN_BASE_URL ||
  "https://chat-geniality.netlify.app/admin";

export function EventAdminChat({ event }: EventAdminChatProps) {
  const chatUrl = useMemo(
    () => `${CHAT_ADMIN_BASE_URL}/${event._id}`,
    [event._id]
  );

  return (
    <Card
      withBorder
      radius="md"
      p={0}
      style={{
        height: "calc(100vh - 180px)",
        overflow: "hidden",
      }}
    >
      <iframe
        src={chatUrl}
        title="Administrador de chat"
        style={{
          border: "none",
          width: "100%",
          height: "100%",
        }}
        // Ajusta permisos según necesites
        allow="clipboard-read; clipboard-write; microphone; camera"
      />
    </Card>
  );
}
