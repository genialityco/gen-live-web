// src/components/auth/RegistrationSummary.tsx
import {
  Stack,
  Button,
  Text,
  Divider,
  Group,
  Badge,
  Card,
  Title,
  Box,
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

  const sortedFields = [...formConfig.fields].sort((a, b) => a.order - b.order);

  const readableData = transformRegistrationDataToLabels(
    attendee.registrationData,
    formConfig.fields
  );

  return (
    <Card withBorder radius="2xl" p="xl" shadow="sm">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Box>
            <Title order={4} fw={900}>
              Tu información de registro
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              Revisa que todo esté correcto antes de continuar.
            </Text>
          </Box>

          {isRegistered ? (
            <Badge
              color="green"
              size="lg"
              radius="xl"
              leftSection={<IconCheck size={14} />}
            >
              Ya estás registrado
            </Badge>
          ) : (
            <Badge color="blue" size="lg" radius="xl">
              Registro encontrado
            </Badge>
          )}
        </Group>

        <Divider />

        {/* Datos - filas tipo "mini-cards" */}
        <Stack gap="sm">
          {sortedFields.map((field) => {
            const originalValue = attendee.registrationData[field.id];
            const displayValue = readableData[field.id];

            // no mostrar hidden o vacío
            if (field.hidden || originalValue === undefined || originalValue === null || originalValue === "")
              return null;

            return (
              <Card
                key={field.id}
                withBorder
                radius="xl"
                p="md"
                shadow="xs"
                styles={{
                  root: {
                    background: "rgba(255,255,255,.85)",
                    backdropFilter: "blur(6px)",
                  },
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Text
                    size="xs"
                    fw={800}
                    c="dimmed"
                    style={{ minWidth: 130 }}
                  >
                    {field.label}
                  </Text>

                  <Text size="sm" fw={600} style={{ textAlign: "right" }}>
                    {String(displayValue ?? "")}
                  </Text>
                </Group>
              </Card>
            );
          })}
        </Stack>

        <Divider />

        {/* Acciones */}
        <Stack gap="sm">
          <Button
            size="md"
            radius="xl"
            fullWidth
            rightSection={<IconArrowRight size={18} />}
            onClick={onContinueToEvent}
          >
            Continuar al evento
          </Button>

          <Button
            variant="light"
            radius="xl"
            fullWidth
            leftSection={<IconEdit size={18} />}
            onClick={onUpdateInfo}
          >
            Actualizar mi información
          </Button>
        </Stack>

        <Text size="xs" c="dimmed" ta="center">
          Si algo no coincide, actualiza tu información antes de continuar.
        </Text>
      </Stack>
    </Card>
  );
}
