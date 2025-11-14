import {
  Modal,
  TextInput,
  Select,
  Checkbox,
  Textarea,
  Button,
  Stack,
  Text,
  NumberInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState, useEffect } from "react";
import { fetchRegistrationForm } from "../api/orgs";
import { registerToEvent, checkIfRegistered } from "../api/events";
import type { RegistrationForm } from "../api/orgs";
import { notifications } from "@mantine/notifications";

interface RegistrationFormModalProps {
  orgSlug: string;
  eventId: string;
  onSuccess: () => void;
}

type FormValues = Record<string, string | number | boolean>;

export function RegistrationFormModal({
  orgSlug,
  eventId,
  onSuccess,
}: RegistrationFormModalProps) {
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formConfig, setFormConfig] = useState<RegistrationForm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, setStoredEmail] = useState<string | null>(null);

  const form = useForm<FormValues>({
    initialValues: {},
  });

  useEffect(() => {
    const checkFormStatus = async () => {
      try {
        setLoading(true);

        // Obtener configuración del formulario
        const config = await fetchRegistrationForm(orgSlug);
        setFormConfig(config);

        // Si el formulario no está habilitado, permitir acceso directo
        if (!config.enabled) {
          onSuccess();
          return;
        }

        // Verificar si el usuario ya está registrado usando email guardado en localStorage
        const savedEmail = localStorage.getItem(`event_${eventId}_email`);

        if (savedEmail) {
          const { isRegistered } = await checkIfRegistered(eventId, savedEmail);
          if (isRegistered) {
            setStoredEmail(savedEmail);
            onSuccess();
            return;
          }
        }

        // Inicializar valores del formulario
        const initialValues: FormValues = {};
        config.fields
          .sort((a, b) => a.order - b.order)
          .forEach((field) => {
            if (field.type === "checkbox") {
              initialValues[field.id] = false;
            } else if (field.type === "email" && savedEmail) {
              initialValues[field.id] = savedEmail;
            } else {
              initialValues[field.id] = "";
            }
          });
        form.setValues(initialValues);
        setOpened(true);
      } catch (error) {
        console.error("Error checking form status:", error);
        notifications.show({
          title: "Error",
          message: "No se pudo verificar el estado del formulario",
          color: "red",
        });
      } finally {
        setLoading(false);
      }
    };

    checkFormStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, eventId]);

  const handleSubmit = async (values: FormValues) => {
    if (!formConfig) return;

    // Validar campos requeridos
    const errors: Record<string, string> = {};
    formConfig.fields.forEach((field) => {
      if (field.required && !values[field.id]) {
        errors[field.id] = "Este campo es requerido";
      }
    });

    if (Object.keys(errors).length > 0) {
      form.setErrors(errors);
      return;
    }

    try {
      setSubmitting(true);

      // Extraer email (obligatorio) y nombre (opcional) del formulario
      const emailField = formConfig.fields.find((f) => f.type === "email");
      const nameField = formConfig.fields.find((f) =>
        f.label.toLowerCase().includes("nombre")
      );

      const email = emailField ? String(values[emailField.id] || "") : "";
      const name = nameField ? String(values[nameField.id] || "") : "";

      // Registrar al usuario en el evento
      await registerToEvent(eventId, {
        email,
        name,
        formData: values, // Todos los campos del formulario
      });

      // Guardar email en localStorage para futuras verificaciones
      localStorage.setItem(`event_${eventId}_email`, email);
      setStoredEmail(email);

      notifications.show({
        title: "Éxito",
        message:
          formConfig.successMessage || "¡Registro completado exitosamente!",
        color: "green",
      });

      setOpened(false);
      onSuccess();
    } catch (error) {
      console.error("Error submitting form:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      notifications.show({
        title: "Error",
        message:
          "No se pudo completar el registro. Por favor intenta de nuevo.",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !formConfig) {
    console.log(
      "Modal not rendering - loading:",
      loading,
      "formConfig:",
      !!formConfig
    );
    return null;
  }

  console.log(
    "Modal rendering with opened:",
    opened,
    "fields:",
    formConfig.fields.length
  );
  console.log("Form values:", form.values);
  console.log("Form errors:", form.errors);

  const handleFormSubmit = form.onSubmit(
    (values) => {
      console.log("Form submitted with values:", values);
      handleSubmit(values);
    },
    (errors) => {
      console.log("Form validation failed with errors:", errors);
    }
  );

  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      title={formConfig.title || "Formulario de Registro"}
      size="lg"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
    >
      <form onSubmit={handleFormSubmit}>
        <Stack gap="md">
          {formConfig.description && (
            <Text size="sm" c="dimmed">
              {formConfig.description}
            </Text>
          )}

          {formConfig.fields
            .sort((a, b) => a.order - b.order)
            .map((field) => {
              const commonProps = {
                key: field.id,
                label: field.label,
                placeholder: field.placeholder,
                required: field.required,
                ...form.getInputProps(field.id),
              };

              switch (field.type) {
                case "text":
                case "email":
                case "tel":
                  return <TextInput {...commonProps} type={field.type} />;

                case "number":
                  return (
                    <NumberInput
                      {...commonProps}
                      min={field.validation?.min}
                      max={field.validation?.max}
                    />
                  );

                case "select":
                  return (
                    <Select
                      {...commonProps}
                      data={
                        field.options?.map((opt) => ({
                          value: opt.value,
                          label: opt.label,
                        })) || []
                      }
                    />
                  );

                case "checkbox":
                  return (
                    <Checkbox
                      {...commonProps}
                      label={field.label}
                      {...form.getInputProps(field.id, { type: "checkbox" })}
                    />
                  );

                case "textarea":
                  return <Textarea {...commonProps} minRows={3} maxRows={6} />;

                default:
                  return null;
              }
            })}

          <Button
            type="submit"
            loading={submitting}
            fullWidth
            mt="md"
            onClick={() => console.log("Button clicked!")}
          >
            {formConfig.submitButtonText || "Enviar"}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
