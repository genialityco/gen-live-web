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
import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { fetchRegistrationForm } from "../api/orgs";
import { registerToEvent, updateRegistration } from "../api/events";
import type { RegistrationForm, FormField } from "../types";
import { notifications } from "@mantine/notifications";
import {
  buildCityToStateMap,
  getDialCodeByCountry,
} from "../data/form-catalogs";

interface AdvancedRegistrationFormModalProps {
  orgSlug: string;
  eventId: string;
  onSuccess: () => void;
  onCancel?: () => void; // Callback cuando el usuario cancela/cierra el modal
  existingData?: {
    attendeeId: string;
    registrationData: Record<string, string | number | boolean>;
  };
}

type FormValues = Record<string, string | number | boolean>;

// Componente memoizado para cada campo del formulario
// Solo se re-renderiza si cambia su propio valor o las opciones (para selects)
const FormFieldComponent = memo(({ 
  field, 
  inputProps, 
  filteredOptions,
  parentValue 
}: { 
  field: FormField;
  inputProps: ReturnType<ReturnType<typeof useForm>['getInputProps']>;
  filteredOptions?: typeof field.options;
  parentValue?: string | number | boolean;
}) => {
  const commonProps = {
    key: field.id,
    label: field.label,
    placeholder: field.placeholder,
    required: field.required,
    description: field.helpText,
    ...inputProps,
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

    case "select": {
      const options = filteredOptions || [];
      // Deshabilitar solo si el campo depende de otro Y ese campo padre no tiene valor
      const isDisabled = !!(field.dependsOn && (parentValue === undefined || parentValue === null || parentValue === ''));
      return (
        <Select
          {...commonProps}
          data={options.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
          disabled={isDisabled}
          searchable
          clearable
          nothingFoundMessage="No se encontraron opciones"
        />
      );
    }

    case "checkbox":
      return (
        <Checkbox
          label={field.label}
          description={field.helpText}
          {...inputProps}
        />
      );

    case "textarea":
      return <Textarea {...commonProps} minRows={3} maxRows={6} />;

    default:
      return null;
  }
}, (prevProps, nextProps) => {
  // Comparación personalizada: solo re-renderizar si cambia el valor del campo, las opciones, o el valor del padre
  // Para checkboxes, usar 'checked' en lugar de 'value'
  const prevValue = prevProps.field.type === 'checkbox' 
    ? ('checked' in prevProps.inputProps ? prevProps.inputProps.checked : undefined)
    : prevProps.inputProps.value;
  const nextValue = nextProps.field.type === 'checkbox'
    ? ('checked' in nextProps.inputProps ? nextProps.inputProps.checked : undefined)
    : nextProps.inputProps.value;
    
  return (
    prevValue === nextValue &&
    prevProps.inputProps.error === nextProps.inputProps.error &&
    prevProps.filteredOptions === nextProps.filteredOptions &&
    prevProps.field.id === nextProps.field.id &&
    prevProps.parentValue === nextProps.parentValue
  );
});

FormFieldComponent.displayName = 'FormFieldComponent';

export function AdvancedRegistrationFormModal({
  orgSlug,
  eventId,
  onSuccess,
  onCancel,
  existingData,
}: AdvancedRegistrationFormModalProps) {
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formConfig, setFormConfig] = useState<RegistrationForm | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Evaluar una regla condicional
  const evaluateCondition = (
    condition: { field: string; operator: string; value: string | number | boolean },
    formValues: FormValues
  ): boolean => {
    const fieldValue = formValues[condition.field];
    
    // Si el campo no tiene valor (undefined, null, o string vacío), 
    // considerarlo como que no cumple condiciones positivas
    const isEmpty = fieldValue === undefined || fieldValue === null || fieldValue === '';
    
    switch (condition.operator) {
      case "equals":
        return fieldValue === condition.value;
      case "notEquals":
        // Si el campo está vacío, no cumple la condición "notEquals"
        // (no podemos decir que es diferente a algo si no tiene valor)
        if (isEmpty) return false;
        return fieldValue !== condition.value;
      case "contains":
        if (isEmpty) return false;
        return String(fieldValue).includes(String(condition.value));
      case "greaterThan":
        if (isEmpty) return false;
        return Number(fieldValue) > Number(condition.value);
      case "lessThan":
        if (isEmpty) return false;
        return Number(fieldValue) < Number(condition.value);
      default:
        return false;
    }
  };

  // Evaluar si un campo debe mostrarse según su lógica condicional
  // useMemo para cachear la función y evitar recrearla en cada render
  const shouldShowField = useMemo(() => {
    return (field: FormField, formValues: FormValues): boolean => {
      if (!field.conditionalLogic || field.conditionalLogic.length === 0) {
        return !field.hidden;
      }

      // Evaluar todas las reglas de visibilidad
      for (const logic of field.conditionalLogic) {
        if (logic.action !== "show" && logic.action !== "hide") continue;

        const results = logic.conditions.map((condition) =>
          evaluateCondition(condition, formValues)
        );

        const conditionMet =
          logic.logic === "and"
            ? results.every((r) => r)
            : results.some((r) => r);

        if (conditionMet) {
          return logic.action === "show";
        }
      }

      // Por defecto, no mostrar si tiene lógica condicional de tipo "show"
      // Esto oculta campos con lógica "show" cuando las condiciones no se cumplen
      const hasShowLogic = field.conditionalLogic.some((l) => l.action === "show");
      return !hasShowLogic && !field.hidden;
    };
  }, []);

  // Definir validación dinámica
  const validateField = useCallback((field: FormField, value: string | number | boolean, formValues: FormValues) => {
    // Validar solo campos visibles
    if (!shouldShowField(field, formValues)) {
      return null;
    }

    // Campo requerido
    if (field.required && !value) {
      return "Este campo es requerido";
    }

    // Validaciones personalizadas
    if (field.validation) {
      const strValue = String(value);

      // Patrón regex
      if (field.validation.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(strValue)) {
          return "Formato inválido";
        }
      }

      // Longitud mínima
      if (field.validation.minLength && strValue.length < field.validation.minLength) {
        return `Mínimo ${field.validation.minLength} caracteres`;
      }

      // Longitud máxima
      if (field.validation.maxLength && strValue.length > field.validation.maxLength) {
        return `Máximo ${field.validation.maxLength} caracteres`;
      }
    }

    return null;
  }, [shouldShowField]);

  const form = useForm<FormValues>({
    initialValues: {},
    validate: (values) => {
      if (!formConfig) return {};
      
      const errors: Record<string, string> = {};
      formConfig.fields.forEach((field) => {
        const error = validateField(field, values[field.id], values);
        if (error) {
          errors[field.id] = error;
        }
      });
      return errors;
    },
  });

  const { values } = form;

  // Obtener opciones filtradas para selects dependientes
  const getFilteredOptions = (field: FormField, formValues: FormValues) => {
    if (!field.options || !field.dependsOn) {
      return field.options || [];
    }

    const parentValue = formValues[field.dependsOn];
    if (!parentValue) {
      return [];
    }

    return field.options.filter(
      (opt) => !opt.parentValue || opt.parentValue === parentValue
    );
  };

  // Calcular valores de campos dependientes solo para campos clave
  const countryFieldId = useMemo(() => 
    formConfig?.fields.find(f => f.label === 'País' || f.id.includes('pais'))?.id,
    [formConfig]
  );
  
  const cityFieldId = useMemo(() =>
    formConfig?.fields.find(f => f.label === 'Ciudad')?.id,
    [formConfig]
  );

  const selectedCountry = countryFieldId ? values[countryFieldId] as string : undefined;
  const selectedCity = cityFieldId ? values[cityFieldId] as string : undefined;

  // Auto-calcular valores de campos dependientes (optimizado)
  useEffect(() => {
    if (!formConfig) return;

    const updates: FormValues = {};

    formConfig.fields.forEach((field) => {
      // Auto-calcular departamento/estado cuando se selecciona una ciudad
      if ((field.label === 'Departamento' || field.label?.includes('Estado')) && field.type === 'select') {
        if (selectedCity && typeof selectedCity === 'string' && selectedCountry) {
          // Si el valor viene en formato "ciudad|departamento", extraer el departamento
          if (selectedCity.includes('|')) {
            const [, stateName] = selectedCity.split('|');
            if (stateName && values[field.id] !== stateName) {
              updates[field.id] = stateName;
            }
          } else {
            // Fallback: Usar la librería para obtener el estado de la ciudad
            const cityToStateMap = buildCityToStateMap(selectedCountry);
            const state = cityToStateMap[selectedCity];
            if (state && values[field.id] !== state) {
              updates[field.id] = state;
            }
          }
        }
      }

      // Auto-calcular código de país cuando se selecciona un país
      // NOTA: Se calcula siempre, incluso si el campo está oculto, para guardar en BD
      if ((field.label?.toLowerCase().includes('indicativo') || 
           field.label?.toLowerCase().includes('código') ||
           field.id.includes('indicativo') ||
           field.id.includes('codigo_pais') ||
           field.id.includes('dial_code')) && field.type === 'text') {
        if (selectedCountry) {
          const dialCode = getDialCodeByCountry(selectedCountry);
          const formattedDialCode = dialCode ? `+${dialCode}` : '';
          if (formattedDialCode && values[field.id] !== formattedDialCode) {
            updates[field.id] = formattedDialCode;
          }
        }
      }

      // Lógica mejorada de autoCalculated
      // NOTA: Los campos autoCalculated se actualizan siempre, incluso si están ocultos
      if (field.autoCalculated && field.dependsOn) {
        const parentValue = values[field.dependsOn];
        if (!parentValue) return;

        // Si el campo depende de un país para obtener código telefónico
        const parentField = formConfig.fields.find(f => f.id === field.dependsOn);
        if (parentField && (parentField.label === 'País' || parentField.id.includes('pais'))) {
          // Este campo auto-calcula el código de país
          if (field.id.includes('codigo') || field.label?.toLowerCase().includes('código')) {
            const dialCode = getDialCodeByCountry(parentValue as string);
            const formattedDialCode = dialCode ? `+${dialCode}` : '';
            if (formattedDialCode && values[field.id] !== formattedDialCode) {
              updates[field.id] = formattedDialCode;
            }
          }
        }
        
        // Si el campo padre tiene opciones con parentValue, usar esa lógica (cascada)
        if (parentField?.options) {
          const selectedOption = parentField.options.find(opt => opt.value === parentValue);
          if (selectedOption?.parentValue && values[field.id] !== selectedOption.parentValue) {
            updates[field.id] = selectedOption.parentValue;
          }
        }
      }
    });

    if (Object.keys(updates).length > 0) {
      form.setValues((prev) => ({ ...prev, ...updates }));
    }
  }, [selectedCountry, selectedCity, formConfig, form, values]);

  // Asignar "No aplica" a campos ocultos condicionalmente (optimizado)
  // Solo se ejecuta cuando cambian los valores que afectan la visibilidad
  useEffect(() => {
    if (!formConfig) return;

    // Recopilar solo los valores de campos que tienen conditionalLogic
    const fieldsWithLogic = formConfig.fields.filter(f => f.conditionalLogic && f.conditionalLogic.length > 0);
    const relevantFieldIds = new Set<string>();
    
    fieldsWithLogic.forEach(field => {
      field.conditionalLogic?.forEach(logic => {
        logic.conditions.forEach(condition => {
          relevantFieldIds.add(condition.field);
        });
      });
    });

    // Crear un objeto solo con los valores relevantes
    const relevantValues: Record<string, string | number | boolean> = {};
    relevantFieldIds.forEach(id => {
      relevantValues[id] = values[id];
    });

    // Usar un timeout para evitar actualizaciones inmediatas durante escritura
    const timeoutId = setTimeout(() => {
      const updates: FormValues = {};

      formConfig.fields.forEach((field) => {
        const isVisible = shouldShowField(field, values);
        
        // Si el campo no es visible y tiene un defaultValue, asignarlo
        if (!isVisible && field.defaultValue !== undefined) {
          if (values[field.id] !== field.defaultValue) {
            updates[field.id] = field.defaultValue;
          }
        }
      });

      if (Object.keys(updates).length > 0) {
        form.setValues((prev) => ({ ...prev, ...updates }));
      }
    }, 150); // Debounce de 150ms

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry, selectedCity, formConfig]);

  useEffect(() => {
    const checkFormStatus = async () => {
      try {
        setLoading(true);

        const config = await fetchRegistrationForm(orgSlug);
        setFormConfig(config);

        if (!config.enabled) {
          onSuccess();
          return;
        }

        // Inicializar valores del formulario
        const initialValues: FormValues = {};
        const sortedFields = config.fields.sort((a, b) => a.order - b.order);
        
        // Función auxiliar para verificar si un campo debe estar visible inicialmente
        const isFieldInitiallyVisible = (field: FormField, currentValues: FormValues): boolean => {
          if (!field.conditionalLogic || field.conditionalLogic.length === 0) {
            return !field.hidden;
          }

          // Evaluar la lógica condicional con los valores actuales
          for (const logic of field.conditionalLogic) {
            if (logic.action !== "show" && logic.action !== "hide") continue;

            const results = logic.conditions.map((condition) => {
              const fieldValue = currentValues[condition.field];
              
              switch (condition.operator) {
                case "equals":
                  return fieldValue === condition.value;
                case "notEquals":
                  return fieldValue !== condition.value && fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
                case "contains":
                  return String(fieldValue || '').includes(String(condition.value));
                case "greaterThan":
                  return Number(fieldValue) > Number(condition.value);
                case "lessThan":
                  return Number(fieldValue) < Number(condition.value);
                default:
                  return false;
              }
            });

            const conditionMet =
              logic.logic === "and"
                ? results.every((r) => r)
                : results.some((r) => r);

            if (conditionMet) {
              return logic.action === "show";
            }
          }

          // Si tiene lógica "show" y no se cumplen las condiciones, ocultar
          const hasShowLogic = field.conditionalLogic.some((l) => l.action === "show");
          return !hasShowLogic && !field.hidden;
        };
        
        // Inicializar valores en orden
        sortedFields.forEach((field) => {
          // Si hay datos existentes (modo actualización), usar esos valores
          if (existingData?.registrationData?.[field.id] !== undefined) {
            initialValues[field.id] = existingData.registrationData[field.id];
          } else if (field.type === "checkbox") {
            initialValues[field.id] = false;
          } else {
            // Solo asignar valor por defecto si el campo está visible inicialmente
            const isVisible = isFieldInitiallyVisible(field, initialValues);
            if (isVisible && field.defaultValue !== undefined) {
              initialValues[field.id] = field.defaultValue;
            } else {
              initialValues[field.id] = "";
            }
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

  const handleSubmit = async (formValues: FormValues) => {
    if (!formConfig) return;

    try {
      setSubmitting(true);

      // Trim de espacios finales en todos los campos de texto
      const cleanedValues: FormValues = {};
      Object.keys(formValues).forEach((key) => {
        const value = formValues[key];
        if (typeof value === "string") {
          cleanedValues[key] = value.trim();
        } else {
          cleanedValues[key] = value;
        }
      });

      // Extraer email
      const emailField = formConfig.fields.find((f) => f.type === "email");
      const email = emailField ? String(cleanedValues[emailField.id] || "") : "";

      // Si hay datos existentes, actualizar; sino, crear nuevo
      if (existingData?.attendeeId) {
        await updateRegistration({
          attendeeId: existingData.attendeeId,
          formData: cleanedValues,
        });
        
        notifications.show({
          title: "Éxito",
          message: "¡Información actualizada exitosamente!",
          color: "green",
        });
      } else {
        await registerToEvent(eventId, {
          email,
          formData: cleanedValues,
        });

        notifications.show({
          title: "Éxito",
          message: formConfig.successMessage || "¡Registro completado exitosamente!",
          color: "green",
        });
      }

      setOpened(false);
      onSuccess();
    } catch (error) {
      console.error("Error submitting form:", error);
      notifications.show({
        title: "Error",
        message: "No se pudo completar el registro. Por favor intenta de nuevo.",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const sortedFields = useMemo(() => {
    if (!formConfig) return [];
    return [...formConfig.fields].sort((a, b) => a.order - b.order);
  }, [formConfig]);

  // Memoizar la visibilidad de campos
  const fieldVisibility = useMemo(() => {
    const visibility: Record<string, boolean> = {};
    sortedFields.forEach(field => {
      visibility[field.id] = shouldShowField(field, values);
    });
    return visibility;
  }, [sortedFields, shouldShowField, values]);

  // Asignar valores por defecto cuando un campo se muestra por primera vez
  useEffect(() => {
    if (!formConfig || !opened) return;

    sortedFields.forEach(field => {
      const isVisible = fieldVisibility[field.id];
      const currentValue = values[field.id];
      
      // Si el campo es visible, tiene valor por defecto, y no tiene valor asignado
      // (o tiene valor vacío), asignar el valor por defecto
      if (isVisible && 
          field.defaultValue !== undefined && 
          (currentValue === undefined || currentValue === null || currentValue === '')) {
        form.setFieldValue(field.id, field.defaultValue);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldVisibility, formConfig, sortedFields, opened]); // NO incluir 'values' y 'form' para evitar loops infinitos

  // Memoizar las opciones filtradas para selects
  const filteredOptionsCache = useMemo(() => {
    const cache: Record<string, FormField['options']> = {};
    sortedFields.forEach(field => {
      if (field.type === 'select') {
        cache[field.id] = getFilteredOptions(field, values);
      }
    });
    return cache;
  }, [sortedFields, values]);

  if (loading || !formConfig) {
    return null;
  }

  // Determinar el título según si es actualización o registro nuevo
  const modalTitle = existingData?.attendeeId
    ? "Actualizar mi información"
    : (formConfig.title || "Formulario de Registro");

  const handleClose = () => {
    setOpened(false);
    onCancel?.();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={modalTitle}
      size="lg"
      closeOnClickOutside={true}
      closeOnEscape={true}
      withCloseButton={true}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {formConfig.description && !existingData?.attendeeId && (
            <Text size="sm" c="dimmed">
              {formConfig.description}
            </Text>
          )}
          
          {existingData?.attendeeId && (
            <Text size="sm" c="dimmed">
              Actualiza los campos que desees modificar y presiona guardar.
            </Text>
          )}

          {sortedFields.map((field) => {
            // Usar la visibilidad pre-calculada
            if (!fieldVisibility[field.id]) {
              return null;
            }

            const inputProps = field.type === 'checkbox' 
              ? form.getInputProps(field.id, { type: "checkbox" })
              : form.getInputProps(field.id);

            // Obtener el valor del campo padre si existe dependencia
            const parentValue = field.dependsOn ? values[field.dependsOn] : undefined;

            return (
              <FormFieldComponent
                key={field.id}
                field={field}
                inputProps={inputProps}
                filteredOptions={filteredOptionsCache[field.id]}
                parentValue={parentValue}
              />
            );
          })}

          <Stack gap="sm">
            <Button type="submit" loading={submitting} fullWidth>
              {existingData?.attendeeId 
                ? "Guardar cambios" 
                : (formConfig.submitButtonText || "Enviar")
              }
            </Button>
            <Button 
              variant="subtle" 
              fullWidth 
              onClick={handleClose}
              disabled={submitting}
            >
              {existingData?.attendeeId ? "Cancelar" : "Cerrar (no podré acceder al evento)"}
            </Button>
          </Stack>
        </Stack>
      </form>
    </Modal>
  );
}
