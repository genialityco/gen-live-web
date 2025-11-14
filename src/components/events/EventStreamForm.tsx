import { useEffect, useState } from "react";
import { Button, Group, Stack, TextInput } from "@mantine/core";
import { updateEventStream } from "../../api/events";

function normalizeVimeoUrl(input: string) {
  // admite: https://vimeo.com/12345 o https://player.vimeo.com/video/12345
  const idMatch = input.match(/vimeo\.com\/(?:video\/)?(\d+)/i)?.[1];
  if (idMatch) return `https://player.vimeo.com/video/${idMatch}`;
  return input.trim();
}

export default function EventStreamForm({
  eventId,
  initialUrl,
  onSaved,
}: {
  eventId: string;
  initialUrl?: string | null;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUrl(initialUrl ?? "");
  }, [initialUrl]);

  const submit = async () => {
    const cleaned = normalizeVimeoUrl(url);
    setLoading(true);
    try {
      await updateEventStream(eventId, { provider: "vimeo", url: cleaned });
      onSaved();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack>
      <TextInput
        label="Vimeo URL"
        placeholder="https://vimeo.com/123456789 o https://player.vimeo.com/video/123456789"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <Group>
        <Button onClick={submit} loading={loading} disabled={!eventId || !url}>
          Guardar stream
        </Button>
      </Group>
    </Stack>
  );
}
