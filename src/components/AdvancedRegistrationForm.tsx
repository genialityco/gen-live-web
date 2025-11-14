import {
  Modal,
  Card,
  TextInput,
  Select,
  Checkbox,
  Textarea,
  Button,
  Stack,
  Text,
  NumberInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { fetchRegistrationForm } from "../api/orgs";
import { registerToEventWithFirebase } from "../api/events";
import type { RegistrationForm, FormField } from "../types";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../auth/AuthProvider";
import {
  buildCityToStateMap,
  getDialCodeByCountry,
} from "../data/form-catalogs";

interface AdvancedRegistrationFormProps {
  orgSlug: string;
  eventId: string;
  onSuccess: () => void;
  onCancel?: () => void;
  existingData?: {
    attendeeId: string;
    registrationData: Record<string, string | number | boolean>;
  };
  mode?: "modal" | "page";
}

type FormValues = Record<string, string | number | boolean>;

// Componente memoizado para cada campo del formulario
const FormFieldComponent = memo(({ 
  field, 
  inputProps, 
  filteredOptions,
}: { 
  field: FormField;
  inputProps: ReturnType<ReturnType<typeof useForm>['getInputProps']>;
  filteredOptions?: typeof field.options;
}) => {
  const commonProps = {
    key: field.id,
    label: field.label,
    placeholder: field.placeholder,
    required: field.required,
    style: { display: field.hidden ? "none" : "block" },
  };

  switch (field.type) {
    case "text":
    case "email":
      return (
        <TextInput
          {...commonProps}
          type={field.type}
          {...inputProps}
        />
      );
    case "tel":
      return (
        <TextInput
          {...commonProps}
          type="tel"
          {...inputProps}
        />
      );
    case "number":
      return (
        <NumberInput
          {...commonProps}
          {...inputProps}
        />
      );
    case "select":
      return (
        <Select
          {...commonProps}
          data={filteredOptions || field.options || []}
          searchable
          clearable
          {...inputProps}
        />
      );
    case "checkbox":
      return (
        <Checkbox
          key={field.id}
          label={field.label}
          {...inputProps}
        />
      );
    case "textarea":
      return (
        <Textarea
          {...commonProps}
          rows={4}
          {...inputProps}
        />
      );
    default:
      return null;
  }
});

FormFieldComponent.displayName = "FormFieldComponent";

export function AdvancedRegistrationForm({
  orgSlug,
  eventId,
  onSuccess,
  onCancel,
  existingData,
  mode = "modal",
}: AdvancedRegistrationFormProps) {
  const [formConfig, setFormConfig] = useState<RegistrationForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(true);
  const { createAnonymousSession } = useAuth();

  // Memoizar el mapa de ciudades para evitar recalcularlo en cada render
  const cityToStateMap = useMemo(() => buildCityToStateMap("CO"), []);

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
          message: "No se pudo cargar el formulario",
        });
      } finally {
        setFormLoading(false);
      }
    };

    loadForm();
  }, [orgSlug]);

  const form = useForm<FormValues>({
    initialValues: {},
    validate: {},
  });

  // Inicializar valores del formulario cuando se carga la configuración
  useEffect(() => {
    if (!formConfig) return;

    const initialValues: FormValues = {};
    const validationRules: Record<string, (value: string | number | boolean) => string | null> = {};

    formConfig.fields.forEach((field) => {
      // Valor inicial
      if (existingData?.registrationData[field.id] !== undefined) {
        initialValues[field.id] = existingData.registrationData[field.id];
      } else if (field.defaultValue !== undefined) {
        initialValues[field.id] = field.defaultValue;
      } else {
        initialValues[field.id] = field.type === "checkbox" ? false : "";
      }

      // Validaciones
      if (field.required && !field.hidden) {
        validationRules[field.id] = (value: string | number | boolean) => {
          if (field.type === "checkbox") {
            return value ? null : `${field.label} es requerido`;
          }
          return value ? null : `${field.label} es requerido`;
        };
      }
    });

    form.setInitialValues(initialValues);
    form.setValues(initialValues);
    // Note: Mantine form doesn't have setValidationRules, validation is set in useForm config
  }, [formConfig, existingData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Memoizar campos ordenados
  const sortedFields = useMemo(() => {
    if (!formConfig) return [];
    return [...formConfig.fields].sort((a, b) => a.order - b.order);
  }, [formConfig]);

  // Función para obtener opciones filtradas basadas en campos dependientes
  const getFilteredOptions = useCallback((field: FormField, currentValues: FormValues) => {
    if (!field.options) return [];

    // Para ciudades, filtrar por estado/departamento seleccionado
    if (field.id.toLowerCase().includes('city') || field.id.toLowerCase().includes('ciudad')) {
      const stateField = sortedFields.find(f => 
        f.id.toLowerCase().includes('state') || 
        f.id.toLowerCase().includes('department') || 
        f.id.toLowerCase().includes('departamento')
      );
      
      if (stateField && currentValues[stateField.id]) {
        const selectedState = currentValues[stateField.id] as string;
        return field.options.filter(city => 
          cityToStateMap[city.value] === selectedState
        );
      }
    }

    return field.options;
  }, [sortedFields, cityToStateMap]);

  const handleSubmit = async (values: FormValues) => {
    try {
      setLoading(true);

      // Auto-calcular código de país si hay campo de teléfono
      const processedValues = { ...values };
      
      // Buscar campo de país y teléfono para auto-calcular código
      const countryField = sortedFields.find(f => 
        f.id.toLowerCase().includes('country') || f.id.toLowerCase().includes('pais')
      );
      const phoneField = sortedFields.find(f => f.type === 'tel');
      
      if (countryField && phoneField && values[countryField.id]) {
        const countryCode = values[countryField.id] as string;
        const dialCode = getDialCodeByCountry(countryCode);
        
        // Buscar campo de código de país
        const countryCodeField = sortedFields.find(f => 
          f.id.toLowerCase().includes('countrycode') || 
          f.id.toLowerCase().includes('codigo')
        );
        
        if (countryCodeField && dialCode) {
          processedValues[countryCodeField.id] = dialCode;
        }
      }

      if (existingData?.attendeeId) {
        // IMPORTANTE: existingData significa que hay un OrgAttendee existente
        // Pero puede ser que NO tenga EventUser para ESTE evento específico
        // Por lo tanto, usamos registerToEventWithFirebase que maneja ambos casos:
        // - Actualiza OrgAttendee
        // - Crea EventUser si no existe
        
        const emailField = sortedFields.find(f => f.type === 'email');
        const emailValue = emailField ? processedValues[emailField.id] as string : '';
        
        const nameField = sortedFields.find(f => 
          f.id.toLowerCase().includes('name') || 
          f.id.toLowerCase().includes('nombre') ||
          f.type === 'text'
        );
        const nameValue = nameField ? processedValues[nameField.id] as string : '';

        if (!emailValue) {
          notifications.show({
            color: "red", 
            title: "Error",
            message: "El campo de email es requerido para el registro",
          });
          return;
        }

        // Crear sesión anónima primero
        const userUID = await createAnonymousSession(emailValue);
        console.log("🔐 Created/updated anonymous session with UID:", userUID, "for email:", emailValue);

        // Guardar email en localStorage para persistencia entre sesiones
        localStorage.setItem('user-email', emailValue);
        localStorage.setItem(`uid-${userUID}-email`, emailValue);

        // Registrar al evento (actualiza OrgAttendee + crea EventUser)
        await registerToEventWithFirebase(eventId, {
          email: emailValue,
          name: nameValue,
          formData: processedValues,
          firebaseUID: userUID,
        });
        
        console.log("✅ Registration completed - OrgAttendee updated and EventUser created");
        
        notifications.show({
          color: "green",
          title: "Registro exitoso",
          message: "Te has registrado correctamente al evento",
        });
      } else {
        // Crear nuevo registro
        // Encontrar el campo de email
        const emailField = sortedFields.find(f => f.type === 'email');
        const emailValue = emailField ? processedValues[emailField.id] as string : '';
        
        // Encontrar el campo de nombre (si existe)
        const nameField = sortedFields.find(f => 
          f.id.toLowerCase().includes('name') || 
          f.id.toLowerCase().includes('nombre') ||
          f.type === 'text' // Fallback al primer campo de texto
        );
        const nameValue = nameField ? processedValues[nameField.id] as string : '';

        if (!emailValue) {
          notifications.show({
            color: "red", 
            title: "Error",
            message: "El campo de email es requerido para el registro",
          });
          return;
        }

        // Crear sesión anónima primero para obtener el UID
        const userUID = await createAnonymousSession(emailValue);
        console.log("🔐 Created anonymous session with UID:", userUID, "for email:", emailValue);

        // Guardar email en localStorage para persistencia entre sesiones
        localStorage.setItem('user-email', emailValue);
        localStorage.setItem(`uid-${userUID}-email`, emailValue);

        // Registrar con Firebase UID incluido desde el principio
        await registerToEventWithFirebase(eventId, {
          email: emailValue,
          name: nameValue,
          formData: processedValues,
          firebaseUID: userUID,
        });
        
        console.log("✅ Registration completed with Firebase UID included");
        
        notifications.show({
          color: "green",
          title: "Registro exitoso",
          message: "Te has registrado correctamente al evento",
        });
      }

      onSuccess();
    } catch (error) {
      console.error("Error submitting form:", error);
      notifications.show({
        color: "red",
        title: "Error",
        message: "No se pudo procesar tu registro. Intenta de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (formLoading) {
    return mode === "modal" ? null : (
      <Card shadow="md" padding="xl" radius="lg" withBorder>
        <Stack align="center" gap="lg">
          <Text>Cargando formulario...</Text>
        </Stack>
      </Card>
    );
  }

  if (!formConfig) {
    return mode === "modal" ? null : (
      <Card shadow="md" padding="xl" radius="lg" withBorder>
        <Stack align="center" gap="lg">
          <Text c="red">Error al cargar el formulario</Text>
          <Button onClick={onCancel}>Volver</Button>
        </Stack>
      </Card>
    );
  }

  const formContent = (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="lg">
        {mode === "page" && (
          <Stack gap="sm" ta="center">
            <Title order={2}>
              {existingData ? "Actualizar información" : formConfig.title || "Registro al evento"}
            </Title>
            {formConfig.description && (
              <Text c="dimmed" size="md">
                {formConfig.description}
              </Text>
            )}
          </Stack>
        )}

        <Stack gap="md" maw={600} mx="auto" w="100%">
          {sortedFields.map((field) => {
            // Evaluar condiciones para mostrar/ocultar campos
            const currentValues = form.values;
            const shouldShow = !field.hidden;

            if (!shouldShow) return null;

            const filteredOptions = getFilteredOptions(field, currentValues);

            return (
              <FormFieldComponent
                key={field.id}
                field={field}
                inputProps={form.getInputProps(field.id)}
                filteredOptions={filteredOptions}
              />
            );
          })}
        </Stack>

        <Stack gap="md" maw={400} mx="auto" w="100%">
          <Button
            type="submit"
            loading={loading}
            size="lg"
          >
            {existingData ? "Actualizar información" : "Registrarme al evento"}
          </Button>

          {onCancel && (
            <Button
              variant="subtle"
              size="sm"
              onClick={onCancel}
            >
              Cancelar
            </Button>
          )}
        </Stack>
      </Stack>
    </form>
  );

  if (mode === "modal") {
    return (
      <Modal
        opened={true}
        onClose={onCancel || (() => {})}
        title={existingData ? "Actualizar información" : formConfig.title || "Registro al evento"}
        size="lg"
        centered
      >
        {formContent}
      </Modal>
    );
  }

  return (
    <Card shadow="md" padding="xl" radius="lg" withBorder>
      {formContent}
    </Card>
  );
}