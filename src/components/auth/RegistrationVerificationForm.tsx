/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Card,
  TextInput,
  Button,
  Stack,
  Text,
  Alert,
  Title,
  Group,
  Box,
  Divider,
  Select,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState, useEffect } from "react";
import { fetchRegistrationForm } from "../../api/orgs";
import {
  checkRegistrationByIdentifiers,
  type EventCheckResponse,
} from "../../api/events";
import type { RegistrationForm } from "../../types";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../../auth/AuthProvider";
import { recoverOrgAccess } from "../../api/org-attendees";
import { normalizeIdentifierValue } from "../../utils/normalizeByType";

interface RegistrationVerificationFormProps {
  orgSlug: string;
  eventId: string;
  orgId: string;
  onVerificationComplete: (
    result: EventCheckResponse & {
      identifierFields: Record<string, any>;
    },
  ) => void;
  onNewRegistration?: () => void;
}

type FormValues = Record<string, string>;

export function RegistrationVerificationForm({
  orgSlug,
  eventId,
  orgId,
  onVerificationComplete,
  onNewRegistration,
}: RegistrationVerificationFormProps) {
  const [formConfig, setFormConfig] = useState<RegistrationForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(true);
  const [mismatchedFields, setMismatchedFields] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"verify" | "recover">("verify");
  const [recoveryIdentifierId, setRecoveryIdentifierId] = useState<
    string | null
  >(null);
  const [recoveryIdentifierValue, setRecoveryIdentifierValue] = useState("");
  const [recovering, setRecovering] = useState(false);
  const { createAnonymousSession } = useAuth();

  useEffect(() => {
    const loadForm = async () => {
      try {
        const config = await fetchRegistrationForm(orgSlug);
        setFormConfig(config);
      } catch (error) {
        console.error("Error loading form config:", error);
        notifications.show({
          color: "red",
          title: "Error",
          message: "No se pudo cargar el formulario de verificación",
        });
      } finally {
        setFormLoading(false);
      }
    };

    loadForm();
  }, [orgSlug]);

  const identifierFields =
    formConfig?.fields.filter((f) => f.isIdentifier) || [];

  const form = useForm<FormValues>({
    initialValues: {},
    validate: {},
  });

  useEffect(() => {
    if (!formConfig) return;

    const initialValues: FormValues = {};
    const validationRules: Record<string, (value: string) => string | null> =
      {};

    identifierFields.forEach((field) => {
      initialValues[field.id] = "";

      if (field.required) {
        validationRules[field.id] = (value: string) => {
          return value ? null : `${field.label} es requerido`;
        };
      }
    });

    form.setInitialValues(initialValues);
    form.setValues(initialValues);
    // podrías también hacer form.setValidate(validationRules) si quieres usarlo
  }, [formConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerify = async (values: FormValues) => {
    try {
      setLoading(true);
      setMismatchedFields([]); // 👈 limpiar resaltados previos
      console.log("🔍 Verifying registration with identifiers:", values);

      const result = await checkRegistrationByIdentifiers(eventId, values);
      console.log("📋 Verification result:", result);

      if (!result.isRegistered && !result.orgAttendee) {
        Object.keys(values).forEach((field) => form.clearFieldError(field));

        const reason = result.status;

        if (reason === "INVALID_FIELDS") {
          const mismatched = result.mismatched ?? [];

          mismatched.forEach((fieldId) => {
            if (fieldId in values) {
              form.setFieldError(
                fieldId,
                "Este dato no coincide con nuestro registro",
              );
            }
          });

          setMismatchedFields(mismatched);

          notifications.show({
            color: "orange",
            title: "Datos incorrectos",
            message:
              "Algunos de los datos ingresados no coinciden con nuestro registro. Revisa la información e inténtalo nuevamente.",
          });

          return;
        }

        if (reason === "USER_NOT_FOUND") {
          notifications.show({
            color: "red",
            title: "Usuario no encontrado",
            message:
              result.message ??
              "No encontramos ningún registro con estos datos en esta organización.",
          });

          if (onNewRegistration) {
            onNewRegistration();
          }
          return;
        }

        notifications.show({
          color: "red",
          title: "No encontrado",
          message:
            result.message ?? "No encontramos un registro con estos datos.",
        });
        return;
      }

      // ---------- 2) A PARTIR DE AQUÍ, SÍ HAY ORGATTENDEE / EVENTUSER ----------
      let userEmail: string | null = null;
      const orgAttendee = result.orgAttendee;

      if (orgAttendee?.registrationData?.email_system) {
        userEmail = orgAttendee.registrationData.email_system;
      } else if (orgAttendee?.registrationData?.email) {
        userEmail = orgAttendee.registrationData.email;
      } else if (orgAttendee?.registrationData) {
        for (const [, value] of Object.entries(orgAttendee.registrationData)) {
          if (typeof value === "string" && value.includes("@")) {
            userEmail = value;
            break;
          }
        }
      }

      if (!userEmail) {
        const emailField = identifierFields.find((f) => f.type === "email");
        if (emailField && values[emailField.id]) {
          userEmail = values[emailField.id];
        }
      }

      if (
        result.isRegistered &&
        result.eventUser &&
        result.status === "EVENT_REGISTERED"
      ) {
        if (userEmail) {
          try {
            const userUID = await createAnonymousSession(userEmail);
            localStorage.setItem("user-email", userEmail);
            localStorage.setItem(`uid-${userUID}-email`, userEmail);
          } catch (error) {
            console.error("❌ Could not create anonymous session:", error);
            notifications.show({
              color: "red",
              title: "Error de sesión",
              message:
                "No se pudo crear la sesión. Por favor intenta de nuevo.",
            });
            setLoading(false);
            return;
          }
        } else {
          notifications.show({
            color: "red",
            title: "Error",
            message:
              "No se pudo identificar tu email. Por favor contacta al administrador.",
          });
          setLoading(false);
          return;
        }

        notifications.show({
          color: "green",
          title: "¡Bienvenido de vuelta!",
          message: "Ya estás registrado en este evento",
        });
      } else if (
        !result.isRegistered &&
        orgAttendee &&
        result.status === "ORG_ONLY"
      ) {
        if (userEmail) {
          localStorage.setItem("user-email", userEmail);
        }

        notifications.show({
          color: "blue",
          title: "Te encontramos",
          message: "Verifica tus datos y continúa al evento",
        });
      } else {
        if (userEmail) {
          localStorage.setItem("user-email", userEmail);
        }

        notifications.show({
          color: "blue",
          title: "Nuevo registro",
          message: "Por favor completa el formulario de registro",
        });
      }

      onVerificationComplete({
        ...result,
        identifierFields: values,
      });
    } catch (error) {
      console.error("Error verifying registration:", error);
      notifications.show({
        color: "red",
        title: "Error",
        message: "No se pudo verificar tu registro. Intenta de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async () => {
    if (!formConfig) return;

    if (!recoveryIdentifierId || !recoveryIdentifierValue.trim()) {
      notifications.show({
        color: "orange",
        title: "Dato requerido",
        message:
          "Selecciona un tipo de dato e ingresa un valor para enviarte el recordatorio.",
      });
      return;
    }

    const fieldDef = identifierFields.find(
      (f) => f.id === recoveryIdentifierId,
    );

    if (!fieldDef) {
      notifications.show({
        color: "red",
        title: "Error",
        message: "El tipo de dato seleccionado no es válido.",
      });
      return;
    }

    const normalized = normalizeIdentifierValue(
      recoveryIdentifierValue,
      fieldDef.type,
    );

    if (fieldDef.type === "number" && Number.isNaN(normalized)) {
      notifications.show({
        color: "orange",
        title: "Dato inválido",
        message: `El valor ingresado para "${fieldDef.label}" debe ser numérico.`,
      });
      return;
    }

    try {
      setRecovering(true);

      await recoverOrgAccess(orgId, {
        [recoveryIdentifierId]: normalized,
      });

      notifications.show({
        color: "green",
        title: "Si encontramos un registro...",
        message:
          "Te enviaremos un correo con la información para que recuerdes con qué datos te registraste.",
      });

      setViewMode("verify");
    } catch (error) {
      console.error(
        "❌ Error enviando correo de recuperación (event-mode):",
        error,
      );
      notifications.show({
        color: "red",
        title: "Error",
        message:
          "No se pudo procesar tu solicitud de recuperación. Intenta de nuevo más tarde.",
      });
    } finally {
      setRecovering(false);
    }
  };

  if (formLoading) {
    return (
      <Card shadow="md" padding="xl" radius="lg" withBorder>
        <Stack align="center" gap="lg">
          <Text>Cargando formulario...</Text>
        </Stack>
      </Card>
    );
  }

  if (!formConfig || identifierFields.length === 0) {
    return (
      <Alert color="red" title="Error de configuración">
        No se encontraron campos identificadores en el formulario. Por favor
        contacta al administrador.
      </Alert>
    );
  }

  if (viewMode === "recover") {
    return (
      <Card withBorder radius="2xl" p="xl" shadow="sm">
        <Stack gap="lg">
          <Group gap="sm" wrap="nowrap">
            <Text fz={28} lh={1}>
              🧠
            </Text>
            <Box>
              <Title order={4} fw={900}>
                Recordar mis datos
              </Title>
              <Text size="sm" c="dimmed">
                Te enviaremos un recordatorio si encontramos un registro con ese
                dato.
              </Text>
            </Box>
          </Group>

          <Divider />

          <Stack gap="sm">
            <Select
              label="¿Qué dato recuerdas?"
              placeholder="Selecciona un tipo de dato"
              value={recoveryIdentifierId ?? ""}
              onChange={(v) => setRecoveryIdentifierId(v || null)}
              data={identifierFields.map((f) => ({
                value: f.id,
                label: f.label,
              }))}
              searchable
              nothingFoundMessage="No hay opciones"
              radius="lg"
              size="md"
            />

            <TextInput
              label="Valor"
              placeholder="Escribe tu correo, documento u otro identificador"
              value={recoveryIdentifierValue}
              onChange={(e) =>
                setRecoveryIdentifierValue(e.currentTarget.value)
              }
              radius="lg"
              size="md"
            />
          </Stack>

          <Group justify="space-between" mt="xs">
            <Button
              variant="subtle"
              radius="xl"
              onClick={() => setViewMode("verify")}
            >
              ← Volver
            </Button>

            <Button radius="xl" loading={recovering} onClick={handleRecover}>
              Enviarme recordatorio
            </Button>
          </Group>
        </Stack>
      </Card>
    );
  }

return (
  <Card withBorder radius="2xl" p="xl" shadow="sm">
    <form onSubmit={form.onSubmit(handleVerify)}>
      <Stack gap="lg">
        <Group gap="sm" wrap="nowrap">
          <Text fz={28} lh={1}>
            👋
          </Text>
          <Box>
            <Title order={4} fw={900}>
              Ingresar
            </Title>
            <Text size="sm" c="dimmed">
              Verifica si ya estás registrado en este evento.
            </Text>
          </Box>
        </Group>

        <Divider />

        <Stack gap="sm">
          {identifierFields.map((field) => {
            const isMismatched = mismatchedFields.includes(field.id);

            return (
              <TextInput
                key={field.id}
                label={field.label}
                placeholder={field.placeholder}
                type={
                  field.type === "email"
                    ? "email"
                    : field.type === "tel"
                    ? "tel"
                    : "text"
                }
                required={field.required}
                size="md"
                radius="lg"
                {...form.getInputProps(field.id)}
                error={form.errors[field.id] as string | undefined}
                styles={(theme) => ({
                  label: {
                    color: isMismatched ? theme.colors.red[7] : undefined,
                    fontWeight: 700,
                  },
                })}
              />
            );
          })}
        </Stack>

        <Group justify="center" align="center" mt={-4}>
          <Text size="sm" c="dimmed">
            ¿No recuerdas tus datos?
          </Text>

          <Button
            variant="subtle"
            size="sm"
            radius="xl"
            px={10}
            onClick={() => setViewMode("recover")}
          >
            Recordar mis datos
          </Button>
        </Group>

        <Stack gap="sm" mt="xs">
          <Button type="submit" size="md" radius="xl" loading={loading} fullWidth>
            Ingresar
          </Button>

          {onNewRegistration && (
            <Group justify="center" gap="xs">
              <Text size="sm" c="dimmed">
                ¿Primera vez aquí?
              </Text>
              <Button
                variant="light"
                size="sm"
                radius="xl"
                onClick={onNewRegistration}
              >
                Registrarme
              </Button>
            </Group>
          )}
        </Stack>
      </Stack>
    </form>
  </Card>
);

}
