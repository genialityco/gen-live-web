// src/components/auth/RegistrationSummary.tsx
import {
  Stack,
  Button,
  Text,
  Paper,
  Divider,
  Group,
  Badge,
  Card,
  Title,
} from "@mantine/core";
import { IconCheck, IconEdit, IconArrowRight } from "@tabler/icons-react";
import type { RegistrationForm } from "../../types";
import type { FoundRegistration } from "../../api/events";
import { transformRegistrationDataToLabels } from "../../utils/formDataTransform";

interface RegistrationSummaryProps {
  registration: FoundRegistration;
  formConfig: RegistrationForm;
  onContinueToEvent: () => void;
  onUpdateInfo: () => void;
}

export function RegistrationSummary({
  registration,
  formConfig,
  onContinueToEvent,
  onUpdateInfo,
}: RegistrationSummaryProps) {
  const { attendee, isRegistered } = registration;

  if (!attendee) return null;

  // Ordenar campos según el orden del formulario
  const sortedFields = [...formConfig.fields].sort((a, b) => a.order - b.order);

  // Transformar valores a etiquetas legibles usando la función utilitaria
  const readableData = transformRegistrationDataToLabels(
    attendee.registrationData,
    formConfig.fields
  );

  return (
    <Card shadow="md" padding="xl" radius="lg" withBorder>
      <Stack gap="lg">
        <Title order={4}>Tu información de registro</Title>

        {isRegistered ? (
          <Badge color="green" size="lg" leftSection={<IconCheck size={16} />}>
            Ya estás registrado en este evento
          </Badge>
        ) : (
          <Badge color="blue" size="lg">
            Registro encontrado
          </Badge>
        )}

        <Text size="sm" c="dimmed">
          Verifica que tu información esté correcta antes de continuar:
        </Text>

        {/* Resumen de datos */}
        <Paper p="md" withBorder>
          <Stack gap="sm">
            {sortedFields.map((field) => {
              const originalValue = attendee.registrationData[field.id];
              const displayValue = readableData[field.id];

              // No mostrar campos ocultos o vacíos en el resumen
              if (field.hidden || !originalValue) return null;

              return (
                <Group
                  key={field.id}
                  justify="space-between"
                  align="flex-start"
                >
                  <Text
                    size="sm"
                    fw={500}
                    c="dimmed"
                    style={{ flex: "0 0 40%" }}
                  >
                    {field.label}:
                  </Text>
                  <Text size="sm" style={{ flex: 1 }}>
                    {displayValue}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </Paper>

        <Divider />

        {/* Opciones */}
        <Stack gap="sm">
          <Button
            size="md"
            fullWidth
            rightSection={<IconArrowRight size={20} />}
            onClick={onContinueToEvent}
          >
            Continuar al evento
          </Button>

          <Button
            variant="light"
            fullWidth
            leftSection={<IconEdit size={20} />}
            onClick={onUpdateInfo}
          >
            Actualizar mi información
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}
