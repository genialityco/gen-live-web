/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button, Group, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import { createEvent } from "../../api/events";

export default function CreateEventForm({
  orgId,
  onCreated,
}: {
  orgId: string;
  onCreated: (ev: any) => void;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!title || !slug) return;
    setLoading(true);
    try {
      const ev = await createEvent({ orgId, title, slug });
      onCreated(ev);
      setTitle("");
      setSlug("");
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
        description="minúsculas, números y guiones"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
      />
      <Group>
        <Button onClick={submit} loading={loading}>
          Crear evento
        </Button>
      </Group>
    </Stack>
  );
}
