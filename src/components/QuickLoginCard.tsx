import { Card, Stack, Button, Text, TextInput, Alert, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState } from "react";
import { IconAlertCircle } from "@tabler/icons-react";
import type { RegistrationForm } from "../types";
import { findRegistration, type FoundRegistration } from "../api/events";

interface QuickLoginCardProps {
  eventId: string;
  formConfig: RegistrationForm;
  onFound: (registration: FoundRegistration) => void;
  onNotFound: () => void;
  onBack: () => void;
}

export function QuickLoginCard({
  eventId,
  formConfig,
  onFound,
  onNotFound,
  onBack,
}: QuickLoginCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extraer campos identificadores
  const identifierFields = formConfig.fields
    .filter((f) => f.isIdentifier)
    .sort((a, b) => a.order - b.order);

  const form = useForm({
    initialValues: identifierFields.reduce(
      (acc, field) => {
        acc[field.id] = "";
        return acc;
      },
      {} as Record<string, string>
    ),
    validate: {
      ...identifierFields.reduce(
        (acc, field) => {
          acc[field.id] = (value: string) =>
            !value ? `${field.label} es requerido` : null;
          return acc;
        },
        {} as Record<string, (value: string) => string | null>
      ),
    },
  });

  const handleSubmit = async (values: Record<string, string>) => {
    try {
      setLoading(true);
      setError(null);

      const result = await findRegistration({
        eventId,
        identifiers: values,
      });

      if (result.found) {
        onFound(result);
      } else {
        setError("No encontramos un registro con esos datos.");
      }
    } catch (err) {
      console.error("Error finding registration:", err);
      setError("Error al buscar el registro. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card shadow="md" padding="xl" radius="lg" withBorder>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg">
          <Stack gap="sm" ta="center">
            <Title order={2}>
              Ingresar con datos de registro
            </Title>
            <Text size="sm" c="dimmed">
              Ingresa los siguientes datos para buscar tu registro:
            </Text>
          </Stack>

          <Stack gap="md" maw={400} mx="auto" w="100%">
            {identifierFields.map((field) => (
              <TextInput
                key={field.id}
                label={field.label}
                placeholder={field.placeholder}
                required
                type={field.type === "email" ? "email" : field.type}
                {...form.getInputProps(field.id)}
              />
            ))}

            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red">
                {error}
              </Alert>
            )}

            <Stack gap="sm">
              <Button type="submit" loading={loading} size="md">
                Buscar mi registro
              </Button>
              
              <Button variant="light" onClick={onNotFound} size="md">
                Ir a registrarme
              </Button>
            </Stack>

            <Button variant="subtle" size="sm" onClick={onBack}>
              ← Volver
            </Button>
          </Stack>
        </Stack>
      </form>
    </Card>
  );
}