import {
  Card,
  Stack,
  Button,
  Text,
  Paper,
  Divider,
  Group,
  Badge,
  Title,
} from "@mantine/core";
import { useState } from "react";
import { IconCheck, IconEdit, IconArrowRight } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../auth/AuthProvider";
import type { RegistrationForm } from "../types";
import type { FoundRegistration } from "../api/events";
import { associateFirebaseUID, registerToEventWithFirebase } from "../api/events";
import { transformRegistrationDataToLabels } from "../utils/formDataTransform";

interface RegistrationSummaryCardProps {
  eventId: string;
  registration: FoundRegistration;
  formConfig: RegistrationForm;
  onContinueToEvent: () => void;
  onUpdateInfo: () => void;
  onBack: () => void;
}

export function RegistrationSummaryCard({
  eventId,
  registration,
  formConfig,
  onContinueToEvent,
  onUpdateInfo,
  onBack,
}: RegistrationSummaryCardProps) {
  const { attendee, isRegistered } = registration;
  const [loading, setLoading] = useState(false);
  const { createAnonymousSession } = useAuth();

  if (!attendee) return null;

  // Función para manejar "Continuar al evento"
  const handleContinueToEvent = async () => {
    try {
      setLoading(true);

      // Crear sesión anónima primero
      const userUID = await createAnonymousSession(attendee.email);
      console.log("🔐 Created anonymous session with UID:", userUID, "for attendee:", attendee.email);

      // Si no está registrado en este evento específico, crear EventUser con Firebase UID
      if (!isRegistered) {
        // Usar el nuevo endpoint que crea EventUser con Firebase UID directamente
        await registerToEventWithFirebase(eventId, {
          email: attendee.email,
          formData: attendee.registrationData,
          firebaseUID: userUID,
        });
        
        console.log("✅ Created EventUser with Firebase UID directly");
        
        notifications.show({
          title: "¡Listo!",
          message: "Te hemos registrado automáticamente en este evento",
          color: "green",
        });
      } else {
        // Si ya está registrado, solo asociar Firebase UID
        try {
          await associateFirebaseUID(eventId, attendee.email, userUID);
          console.log("🔗 Associated Firebase UID with existing EventUser");
        } catch (error) {
          console.error("⚠️ Failed to associate Firebase UID:", error);
          // No fallar aquí, el usuario ya está registrado
        }
      }

      // Continuar al evento
      onContinueToEvent();
    } catch (error) {
      console.error("Error in continue to event flow:", error);
      notifications.show({
        title: "Error",
        message: "Hubo un problema al acceder al evento. Intenta de nuevo.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

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
        <Stack gap="sm" ta="center">
          <Title order={2}>
            Tu información de registro
          </Title>
          
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
        </Stack>

        {/* Resumen de datos */}
        <Paper p="lg" withBorder radius="md" maw={600} mx="auto" w="100%">
          <Stack gap="md">
            {sortedFields.map((field) => {
              const originalValue = attendee.registrationData[field.id];
              const displayValue = readableData[field.id];
              
              // No mostrar campos ocultos o auto-calculados en el resumen
              if (field.hidden || !originalValue) return null;

              return (
                <Group key={field.id} justify="space-between" wrap="nowrap">
                  <Text size="sm" fw={500} c="dimmed" style={{ flex: '0 0 40%' }}>
                    {field.label}:
                  </Text>
                  <Text size="sm" style={{ flex: 1, textAlign: 'right' }}>
                    {displayValue}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </Paper>

        <Divider />

        {/* Opciones */}
        <Stack gap="md" maw={400} mx="auto" w="100%">
          <Button
            size="lg"
            rightSection={<IconArrowRight size={20} />}
            onClick={handleContinueToEvent}
            loading={loading}
          >
            Continuar al evento
          </Button>

          <Button
            variant="light"
            leftSection={<IconEdit size={20} />}
            onClick={onUpdateInfo}
          >
            Actualizar mi información
          </Button>

          <Button variant="subtle" size="sm" onClick={onBack}>
            ← Volver
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}