/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEventRealtimeData } from "../../hooks/useEventRealtimeData";
import { useParams } from "react-router-dom";
import { Alert, Stack, Title, Text, Divider } from "@mantine/core";

function toVimeoEmbed(url?: string | null) {
  if (!url) return null;
  const id = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i)?.[1];
  const embed = id ? `https://player.vimeo.com/video/${id}` : url;
  return embed;
}

export default function EventPublic() {
  const { slug = "" } = useParams();
  const { resolved, status, nowCount, loading } = useEventRealtimeData(slug);

  if (loading)
    return (
      <Stack p="lg">
        <Text>Cargando evento...</Text>
      </Stack>
    );
  if (!resolved)
    return (
      <Stack p="lg">
        <Alert color="red">Evento no encontrado</Alert>
      </Stack>
    );

  const canPlay = status === "live" || status === "replay";
  const vimeo =
    resolved.stream?.provider === "vimeo"
      ? toVimeoEmbed((resolved.stream as any)?.url)
      : null;

  console.log({ status, resolved });

  return (
    <Stack p="lg" maw={900} mx="auto" gap="md">
      <Title order={2}>{resolved.title}</Title>
      <Text c="dimmed">
        Estado: {status} • Conectados: {nowCount}
      </Text>
      <Divider />

      {canPlay && vimeo ? (
        <div
          style={{
            position: "relative",
            paddingBottom: "56.25%",
            height: 0,
            overflow: "hidden",
            borderRadius: 12,
          }}
        >
          <iframe
            src={vimeo}
            title="Vimeo player"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: 0,
            }}
          />
        </div>
      ) : (
        <Alert variant="light" color={status === "upcoming" ? "blue" : "gray"}>
          {status === "upcoming"
            ? "Este evento aún no inicia. Vuelve cuando esté en vivo."
            : "La transmisión ha finalizado."}
        </Alert>
      )}
    </Stack>
  );
}
