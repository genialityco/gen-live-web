import {
  Card,
  TextInput,
  Button,
  Stack,
  Text,
  Alert,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState, useEffect } from "react";
import { fetchRegistrationForm } from "../api/orgs";
import { checkRegistrationByIdentifiers } from "../api/events";
import type { RegistrationForm } from "../types";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../auth/AuthProvider";

interface RegistrationVerificationFormProps {
  orgSlug: string;
  eventId: string;
  onVerificationComplete: (result: {
    isRegistered: boolean;
    orgAttendee?: any;
    eventUser?: any;
    identifierFields: Record<string, any>;
  }) => void;
  onNewRegistration?: () => void;
}

type FormValues = Record<string, string>;

export function RegistrationVerificationForm({
  orgSlug,
  eventId,
  onVerificationComplete,
  onNewRegistration,
}: RegistrationVerificationFormProps) {
  const [formConfig, setFormConfig] = useState<RegistrationForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(true);
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

  // Obtener solo los campos identificadores
  const identifierFields = formConfig?.fields.filter(f => f.isIdentifier) || [];

  const form = useForm<FormValues>({
    initialValues: {},
    validate: {},
  });

  // Inicializar valores del formulario
  useEffect(() => {
    if (!formConfig) return;

    const initialValues: FormValues = {};
    const validationRules: Record<string, (value: string) => string | null> = {};

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
  }, [formConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerify = async (values: FormValues) => {
    try {
      setLoading(true);
      console.log("🔍 Verifying registration with identifiers:", values);

      // Verificar registro por campos identificadores
      const result = await checkRegistrationByIdentifiers(eventId, values);

      console.log("📋 Verification result:", result);

      // IMPORTANTE: El email SIEMPRE viene del OrgAttendee.registrationData
      // Los campos identificadores pueden ser documento, teléfono, etc.
      // El backend busca el OrgAttendee usando esos identificadores
      // y devuelve el objeto completo que incluye el email
      
      let userEmail: string | null = null;
      
      // PRIORIDAD 1: Buscar email_system en registrationData (campo estándar del sistema)
      if (result.orgAttendee?.registrationData?.email_system) {
        userEmail = result.orgAttendee.registrationData.email_system;
        console.log("✅ Email found in OrgAttendee (email_system):", userEmail);
      }
      // PRIORIDAD 2: Buscar campo 'email' directo (compatibilidad)
      else if (result.orgAttendee?.registrationData?.email) {
        userEmail = result.orgAttendee.registrationData.email;
        console.log("✅ Email found in OrgAttendee (email):", userEmail);
      }
      // PRIORIDAD 3: Buscar cualquier campo tipo email en registrationData
      else if (result.orgAttendee?.registrationData) {
        // Buscar cualquier campo que contenga '@' (es un email)
        for (const [key, value] of Object.entries(result.orgAttendee.registrationData)) {
          if (typeof value === 'string' && value.includes('@')) {
            userEmail = value;
            console.log(`✅ Email found in OrgAttendee (${key}):`, userEmail);
            break;
          }
        }
      }
      // PRIORIDAD 4: Si el campo identificador ingresado es email (caso raro pero válido)
      if (!userEmail) {
        const emailField = identifierFields.find(f => f.type === 'email');
        if (emailField && values[emailField.id]) {
          userEmail = values[emailField.id];
          console.log("✅ Email found in identifier field:", userEmail);
        }
      }

      if (result.isRegistered && result.eventUser) {
        // Usuario YA registrado en este evento (tiene OrgAttendee Y EventUser)
        console.log("✅ User already registered to this event (OrgAttendee + EventUser)");
        
        // CRÍTICO: Crear sesión anónima con el email ANTES de redirigir
        if (userEmail) {
          try {
            console.log("🔐 Creating anonymous session for registered user with email:", userEmail);
            const userUID = await createAnonymousSession(userEmail);
            console.log("✅ Anonymous session created with UID:", userUID);
            
            // Guardar email en localStorage para que EventAttend pueda usarlo
            localStorage.setItem('user-email', userEmail);
            localStorage.setItem(`uid-${userUID}-email`, userEmail);
          } catch (error) {
            console.error("❌ CRITICAL: Could not create anonymous session:", error);
            notifications.show({
              color: "red",
              title: "Error de sesión",
              message: "No se pudo crear la sesión. Por favor intenta de nuevo.",
            });
            setLoading(false);
            return; // No continuar si falla la sesión
          }
        } else {
          console.error("❌ CRITICAL: No email found for registered user");
          notifications.show({
            color: "red",
            title: "Error",
            message: "No se pudo identificar tu email. Por favor contacta al administrador.",
          });
          setLoading(false);
          return;
        }

        notifications.show({
          color: "green",
          title: "¡Bienvenido de vuelta!",
          message: "Ya estás registrado en este evento",
        });

      } else if (result.orgAttendee && !result.isRegistered) {
        // Usuario existe en organización pero NO en evento (solo OrgAttendee, sin EventUser)
        console.log("📝 User exists in org but not in event - will show summary");
        
        // Guardar email para uso posterior
        if (userEmail) {
          localStorage.setItem('user-email', userEmail);
        }
        
        notifications.show({
          color: "blue",
          title: "Te encontramos",
          message: "Verifica tus datos y continúa al evento",
        });

      } else {
        // Usuario nuevo (ni OrgAttendee ni EventUser)
        console.log("🆕 New user - no previous registration");
        
        // Guardar email para pre-llenar formulario
        if (userEmail) {
          localStorage.setItem('user-email', userEmail);
        }
        
        notifications.show({
          color: "blue",
          title: "Nuevo registro",
          message: "Por favor completa el formulario de registro",
        });
      }

      // Pasar resultado al componente padre
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
        No se encontraron campos identificadores en el formulario. 
        Por favor contacta al administrador.
      </Alert>
    );
  }

  return (
    <Card shadow="md" padding="xl" radius="lg" withBorder>
      <form onSubmit={form.onSubmit(handleVerify)}>
        <Stack gap="lg">
          <div>
            <Title order={3}>Verificar registro</Title>
            <Text size="sm" c="dimmed" mt="xs">
              Ingresa tus datos para verificar si ya estás registrado
            </Text>
          </div>

          <Alert color="blue" variant="light">
            <Text size="sm">
              Ingresa los siguientes datos para verificar tu registro. 
              Si ya estás registrado, accederás directamente al evento.
            </Text>
          </Alert>

          {identifierFields.map((field) => (
            <TextInput
              key={field.id}
              label={field.label}
              placeholder={field.placeholder}
              type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
              required={field.required}
              {...form.getInputProps(field.id)}
            />
          ))}

          <Stack gap="md" mt="md">
            <Button 
              type="submit" 
              size="lg" 
              loading={loading}
              fullWidth
            >
              Verificar Registro
            </Button>

            {onNewRegistration && (
              <>
                <Text size="sm" ta="center" c="dimmed">
                  ¿Primera vez aquí?
                </Text>
                <Button 
                  variant="light" 
                  size="md" 
                  onClick={onNewRegistration}
                  fullWidth
                >
                  Registrarme por primera vez
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </form>
    </Card>
  );
}
