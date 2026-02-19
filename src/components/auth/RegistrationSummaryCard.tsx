import {
  Card,
  Stack,
  Button,
  Text,
  Divider,
  Group,
  Badge,
  Title,
  Box,
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
    if (attendee.email && typeof attendee.email === "string")
      return attendee.email;

    const data = attendee.registrationData || {};
    if (data.email_system && typeof data.email_system === "string")
      return data.email_system;
    if (data.email && typeof data.email === "string") return data.email;

    for (const value of Object.values(data)) {
      if (typeof value === "string" && value.includes("@")) return value;
    }
    return null;
  };

  const handleContinueToEvent = async () => {
    try {
      setLoading(true);

      const attendeeEmail = resolveAttendeeEmail();
      if (!attendeeEmail) {
        notifications.show({
          title: "Error",
          message:
            "No se pudo identificar tu correo. Por favor contacta al administrador.",
          color: "red",
        });
        return;
      }

      const userUID = await createAnonymousSession(attendeeEmail);

      localStorage.setItem("user-email", attendeeEmail);
      localStorage.setItem(`uid-${userUID}-email`, attendeeEmail);

      if (!isRegistered) {
        await registerToEventWithFirebase(eventId, {
          email: attendeeEmail,
          formData: attendee.registrationData,
          firebaseUID: userUID,
        });

        notifications.show({
          title: "¡Listo!",
          message: "Te hemos registrado automáticamente en este evento",
          color: "green",
        });
      } else {
        try {
          await associateFirebaseUID(eventId, attendeeEmail, userUID);
        } catch (error) {
          // no bloquea el flujo
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
    formConfig.fields,
  );

  return (
    <Card withBorder radius="2xl" p="xl" shadow="sm">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Text fz={28} lh={1}>
              {isRegistered ? "✅" : "🔎"}
            </Text>

            <Box style={{ minWidth: 0 }}>
              <Title order={4} fw={900} style={{ lineHeight: 1.15 }}>
                Resumen de tu registro
              </Title>
              <Text size="sm" c="dimmed" lineClamp={2}>
                Revisa tus datos antes de entrar al evento.
              </Text>
            </Box>
          </Group>

          {isRegistered ? (
            <Badge
              color="green"
              size="lg"
              radius="xl"
              leftSection={<IconCheck size={14} />}
            >
              Registrado
            </Badge>
          ) : (
            <Badge color="blue" size="lg" radius="xl">
              Registro encontrado
            </Badge>
          )}
        </Group>

        <Divider />

        {/* Datos: mini-cards para lectura móvil */}
        <Stack gap="sm">
          {sortedFields.map((field) => {
            const originalValue = attendee.registrationData[field.id];
            const displayValue = readableData[field.id];

            if (
              field.hidden ||
              originalValue === undefined ||
              originalValue === null ||
              originalValue === ""
            )
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
                <Group
                  justify="space-between"
                  align="flex-start"
                  wrap="nowrap"
                  gap="md"
                >
                  <Text
                    size="xs"
                    fw={800}
                    c="dimmed"
                    style={{
                      minWidth: 120,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={field.label}
                  >
                    {field.label}
                  </Text>

                  <Text
                    size="sm"
                    fw={600}
                    style={{ textAlign: "right", wordBreak: "break-word" }}
                  >
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
            rightSection={<IconArrowRight size={18} />}
            onClick={handleContinueToEvent}
            loading={loading}
            fullWidth
          >
            Entrar al evento
          </Button>

          <Group grow gap="sm">
            <Button
              variant="light"
              radius="xl"
              leftSection={<IconEdit size={16} />}
              onClick={onUpdateInfo}
            >
              Actualizar
            </Button>

            <Button variant="subtle" radius="xl" onClick={onBack}>
              ← Volver
            </Button>
          </Group>
        </Stack>
      </Stack>
    </Card>
  );
}
