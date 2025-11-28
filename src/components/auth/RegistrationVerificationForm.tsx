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
    }
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
                "Este dato no coincide con nuestro registro"
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
      (f) => f.id === recoveryIdentifierId
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
      fieldDef.type
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
        error
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
    // 🔹 Pantalla de recuperación
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Stack gap={2}>
            <Title order={4}>Recordar mis datos</Title>
            <Text size="xs" c="dimmed">
              Si ya te registraste antes pero no recuerdas con qué datos,
              podemos enviarte un correo con un recordatorio.
              <br />
              Elige qué dato recuerdas (por ejemplo, tu correo o documento) y
              escríbelo a continuación.
            </Text>
          </Stack>

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              ¿Qué dato recuerdas?
            </Text>
            <select
              value={recoveryIdentifierId ?? ""}
              onChange={(e) => setRecoveryIdentifierId(e.target.value || null)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ced4da",
                fontSize: 14,
              }}
            >
              <option value="">Selecciona un tipo de dato</option>
              {identifierFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </select>

            <TextInput
              mt="xs"
              label="Valor del dato"
              placeholder="Escribe aquí tu correo, documento u otro identificador"
              value={recoveryIdentifierValue}
              onChange={(e) =>
                setRecoveryIdentifierValue(e.currentTarget.value)
              }
            />
          </Stack>

          <Group justify="space-between" mt="md">
            <Button
              variant="subtle"
              size="xs"
              onClick={() => setViewMode("verify")}
            >
              ← Volver a verificación
            </Button>
            <Button size="sm" loading={recovering} onClick={handleRecover}>
              Enviarme un recordatorio
            </Button>
          </Group>
        </Stack>
      </Card>
    );
  }

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <form onSubmit={form.onSubmit(handleVerify)}>
        <Stack gap="md">
          <Stack gap={2}>
            <Title order={4}>Ingresar</Title>
            <Text size="xs" c="dimmed">
              Verifica si ya estás registrado.
            </Text>
          </Stack>

          <Stack gap="xs">
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
                  size="sm"
                  {...form.getInputProps(field.id)}
                  styles={(theme) => ({
                    input: {
                      backgroundColor: isMismatched
                        ? theme.colors.red[0]
                        : undefined,
                      borderColor: isMismatched
                        ? theme.colors.red[6]
                        : undefined,
                    },
                    label: {
                      color: isMismatched ? theme.colors.red[6] : undefined,
                      fontWeight: isMismatched ? 600 : undefined,
                    },
                  })}
                />
              );
            })}
          </Stack>

          <Text size="xs" c="dimmed">
            ¿No recuerdas con qué datos te registraste?{" "}
            <Button
              variant="subtle"
              size="xs"
              px={0}
              onClick={() => setViewMode("recover")}
            >
              Recordar mis datos
            </Button>
          </Text>

          <Stack gap="xs" mt={4}>
            <Button type="submit" size="sm" loading={loading} fullWidth>
              Ingresar
            </Button>

            {onNewRegistration && (
              <Group justify="center" gap={4}>
                <Text size="xs" c="dimmed">
                  ¿Primera vez aquí?
                </Text>
                <Button
                  variant="subtle"
                  size="xs"
                  px="xs"
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
