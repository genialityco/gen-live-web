import { useState } from "react";
import { Button, Group, Stack, TextInput } from "@mantine/core";
import { createOrg, type Org } from "../../api/orgs";

export default function CreateOrganizationForm({
  onCreated,
}: {
  onCreated: (org?: Org) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);

  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 40);

  const submit = async () => {
    if (!name || !slug) return;
    setLoading(true);
    try {
      const newOrg = await createOrg({ name: name.trim(), domainSlug: normalize(slug) });
      setName("");
      setSlug("");
      onCreated(newOrg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack>
      <TextInput
        label="Nombre de la organización"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextInput
        label="Subdominio (domainSlug)"
        description="Solo minúsculas, números y guiones. Ej: mi-org"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
      />
      <Group>
        <Button onClick={submit} loading={loading}>
          Crear organización
        </Button>
      </Group>
    </Stack>
  );
}
