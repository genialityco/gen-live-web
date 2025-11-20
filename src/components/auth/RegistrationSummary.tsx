import {
  Modal,
  Stack,
  Button,
  Text,
  Paper,
  Divider,
  Group,
  Badge,
} from "@mantine/core";
import { IconCheck, IconEdit, IconArrowRight } from "@tabler/icons-react";
import type { RegistrationForm } from "../../types";
import type { FoundRegistration } from "../../api/events";
import { transformRegistrationDataToLabels } from "../../utils/formDataTransform";

interface RegistrationSummaryProps {
  opened: boolean;
  onClose: () => void;
  registration: FoundRegistration;
  formConfig: RegistrationForm;
  onContinueToEvent: () => void;
  onUpdateInfo: () => void;
}

export function RegistrationSummary({
  opened,
  onClose,
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
    <Modal
      opened={opened}
      onClose={onClose}
      title="Tu información de registro"
      size="lg"
      centered
    >
      <Stack gap="lg">
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
              
              // No mostrar campos ocultos o auto-calculados en el resumen
              if (field.hidden || !originalValue) return null;

              return (
                <Group key={field.id} justify="space-between">
                  <Text size="sm" fw={500} c="dimmed" style={{ flex: '0 0 40%' }}>
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
            size="lg"
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

          <Button variant="subtle" fullWidth onClick={onClose}>
            Cerrar
          </Button>
        </Stack>
      </Stack>
    </Modal>
  );
}
