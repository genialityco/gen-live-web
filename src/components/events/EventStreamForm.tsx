import { useEffect, useState } from "react";
import { ActionIcon, Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { updateEventStreams, type EventItem, type EventStream } from "../../api/events";

const PROVIDER_OPTIONS = [
  { label: "Vimeo", value: "vimeo" },
  { label: "Bunny", value: "bunny" },
  { label: "Cloudflare", value: "cloudflare" },
  { label: "Otro (iframe)", value: "other" },
];

function normalizeStreamUrl(provider: string, input: string) {
  if (provider === "vimeo") {
    // admite: https://vimeo.com/12345 o https://player.vimeo.com/video/12345
    const idMatch = input.match(/vimeo\.com\/(?:video\/)?(\d+)/i)?.[1];
    if (idMatch) return `https://player.vimeo.com/video/${idMatch}`;
  }
  return input.trim();
}

export default function EventStreamForm({
  eventId,
  initialStreams,
  onSaved,
}: {
  eventId: string;
  initialStreams?: EventStream[];
  onSaved: (updated?: EventItem) => void;
}) {
  const [rows, setRows] = useState<EventStream[]>(
    initialStreams && initialStreams.length > 0
      ? initialStreams
      : [{ provider: "vimeo", url: "" }]
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRows(
      initialStreams && initialStreams.length > 0
        ? initialStreams
        : [{ provider: "vimeo", url: "" }]
    );
  }, [initialStreams]);

  const updateRow = (index: number, patch: Partial<EventStream>) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const addRow = () => {
    setRows((prev) => [...prev, { provider: "vimeo", url: "" }]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    const cleaned = rows
      .filter((row) => row.url.trim())
      .map((row) => ({ ...row, url: normalizeStreamUrl(row.provider, row.url) }));

    setLoading(true);
    try {
      const updated = await updateEventStreams(eventId, cleaned);
      onSaved(updated);
    } finally {
      setLoading(false);
    }
  };

  const hasAnyUrl = rows.some((row) => row.url.trim());

  return (
    <Stack>
      {rows.map((row, index) => (
        <Group key={index} align="flex-end" wrap="nowrap">
          <Select
            label="Fuente"
            data={PROVIDER_OPTIONS}
            value={row.provider}
            onChange={(value) => value && updateRow(index, { provider: value })}
            w={140}
          />
          <TextInput
            label="URL"
            placeholder="https://..."
            value={row.url}
            onChange={(e) => updateRow(index, { url: e.target.value })}
            style={{ flex: 1 }}
          />
          <ActionIcon
            color="red"
            variant="subtle"
            onClick={() => removeRow(index)}
            disabled={rows.length === 1}
            mb={4}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ))}

      <Group justify="space-between">
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={addRow}
        >
          Agregar fuente
        </Button>
        <Button onClick={submit} loading={loading} disabled={!eventId || !hasAnyUrl}>
          Guardar stream
        </Button>
      </Group>
    </Stack>
  );
}
