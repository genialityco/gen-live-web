import { Modal, Stack, Button, Text, TextInput, Alert } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState } from "react";
import { IconAlertCircle } from "@tabler/icons-react";
import type { RegistrationForm } from "../types";
import { findRegistration, type FoundRegistration } from "../api/events";

interface QuickLoginFormProps {
  opened: boolean;
  onClose: () => void;
  eventId: string;
  formConfig: RegistrationForm;
  onFound: (registration: FoundRegistration) => void;
  onNotFound: () => void;
}

export function QuickLoginForm({
  opened,
  onClose,
  eventId,
  formConfig,
  onFound,
  onNotFound,
}: QuickLoginFormProps) {
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
        setError(
          "No encontramos un registro con esos datos. Por favor, regístrate primero."
        );
        setTimeout(() => {
          onNotFound();
        }, 2000);
      }
    } catch (err) {
      console.error("Error finding registration:", err);
      setError("Error al buscar el registro. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Ingresar con datos de registro"
      size="md"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Ingresa los siguientes datos para buscar tu registro:
          </Text>

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

          <Button type="submit" loading={loading} fullWidth>
            Buscar mi registro
          </Button>

          <Button variant="subtle" fullWidth onClick={onClose}>
            Volver
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
