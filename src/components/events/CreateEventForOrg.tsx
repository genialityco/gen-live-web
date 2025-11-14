import { useState } from "react";
import { Button, Group, Stack, TextInput } from "@mantine/core";
import { createEvent } from "../../api/events";

export default function CreateEventForOrg({
  orgId,
  onCreated,
}: {
  orgId: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);

  const normalizeSlug = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 40);

  const submit = async () => {
    if (!orgId || !title || !slug) return;
    setLoading(true);
    try {
      await createEvent({
        orgId,
        title: title.trim(),
        slug: normalizeSlug(slug),
      });
      setTitle("");
      setSlug("");
      onCreated();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack>
      <TextInput
        label="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TextInput
        label="Slug"
        description="minúsculas, números y guiones (ej: lanzamiento-2025)"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
      />
      <Group>
        <Button onClick={submit} loading={loading} disabled={!orgId}>
          Crear evento
        </Button>
      </Group>
    </Stack>
  );
}
