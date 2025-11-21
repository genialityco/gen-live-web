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
import { useAuth } from "../../auth/AuthProvider";
import type { RegistrationForm } from "../../types";
import type { FoundRegistration } from "../../api/events";
import {
  associateFirebaseUID,
  registerToEventWithFirebase,
} from "../../api/events";
import { transformRegistrationDataToLabels } from "../../utils/formDataTransform";

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

  const resolveAttendeeEmail = (): string | null => {
    if (!attendee) return null;

    if (attendee.email && typeof attendee.email === "string") {
      return attendee.email;
    }

    const data = attendee.registrationData || {};

    if (data.email_system && typeof data.email_system === "string") {
      return data.email_system;
    }

    if (data.email && typeof data.email === "string") {
      return data.email;
    }

    for (const value of Object.values(data)) {
      if (typeof value === "string" && value.includes("@")) {
        return value;
      }
    }

    return null;
  };

  const handleContinueToEvent = async () => {
    try {
      setLoading(true);

      const attendeeEmail = resolveAttendeeEmail();

      if (!attendeeEmail) {
        console.error("❌ No email resolved for attendee in summary card");
        notifications.show({
          title: "Error",
          message:
            "No se pudo identificar tu correo electrónico. Por favor contacta al administrador.",
          color: "red",
        });
        setLoading(false);
        return;
      }

      const userUID = await createAnonymousSession(attendeeEmail);
      console.log(
        "🔐 Created anonymous session with UID:",
        userUID,
        "for attendee:",
        attendeeEmail
      );

      localStorage.setItem("user-email", attendeeEmail);
      localStorage.setItem(`uid-${userUID}-email`, attendeeEmail);

      if (!isRegistered) {
        await registerToEventWithFirebase(eventId, {
          email: attendeeEmail,
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
        try {
          await associateFirebaseUID(eventId, attendeeEmail, userUID);
          console.log("🔗 Associated Firebase UID with existing EventUser");
        } catch (error) {
          console.error("⚠️ Failed to associate Firebase UID:", error);
        }
      }

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

  const sortedFields = [...formConfig.fields].sort((a, b) => a.order - b.order);

  const readableData = transformRegistrationDataToLabels(
    attendee.registrationData,
    formConfig.fields
  );

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        {/* Header compacto */}
        <Group justify="space-between" align="flex-start">
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Title order={4}>Resumen de tu registro</Title>
            <Text size="xs" c="dimmed">
              Revisa que tus datos estén correctos antes de entrar al evento.
            </Text>
          </Stack>

          {isRegistered ? (
            <Badge
              color="green"
              size="sm"
              leftSection={<IconCheck size={14} />}
            >
              Registrado
            </Badge>
          ) : (
            <Badge color="blue" size="sm">
              Registro encontrado
            </Badge>
          )}
        </Group>

        {/* Resumen de datos, compacto */}
        <Paper
          p="md"
          withBorder
          radius="md"
          w="100%"
          style={{ background: "var(--mantine-color-gray-0)" }}
        >
          <Stack gap={6}>
            {sortedFields.map((field) => {
              const originalValue = attendee.registrationData[field.id];
              const displayValue = readableData[field.id];

              if (field.hidden || !originalValue) return null;

              return (
                <Group
                  key={field.id}
                  justify="space-between"
                  align="flex-start"
                  wrap="nowrap"
                  gap={8}
                >
                  <Text
                    size="xs"
                    fw={500}
                    c="dimmed"
                    style={{
                      flex: "0 0 40%",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                    title={field.label} // Tooltip nativo al pasar el mouse
                  >
                    {field.label}
                  </Text>

                  <Text
                    size="xs"
                    style={{
                      flex: 1,
                      textAlign: "right",
                      wordBreak: "break-word",
                    }}
                  >
                    {displayValue}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </Paper>

        <Divider my={4} />

        {/* Acciones más compactas */}
        <Stack gap={6} w="100%">
          <Button
            size="sm"
            rightSection={<IconArrowRight size={16} />}
            onClick={handleContinueToEvent}
            loading={loading}
            fullWidth
          >
            Entrar al evento
          </Button>

          <Group justify="space-between" gap={4}>
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconEdit size={14} />}
              onClick={onUpdateInfo}
            >
              Actualizar información
            </Button>

            <Button variant="subtle" size="xs" onClick={onBack}>
              ← Volver
            </Button>
          </Group>
        </Stack>
      </Stack>
    </Card>
  );
}
