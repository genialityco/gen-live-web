/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
import {
  fetchRegistrationForm,
  registerOrgAttendeeAdvanced,
} from "../../api/orgs";
import { registerToEventWithFirebase } from "../../api/events";
import type { RegistrationForm, FormField } from "../../types";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../../auth/AuthProvider";
import {
  getDialCodeByCountry,
  getAllCountries,
  getStatesByCountry,
  getCitiesByCountry,
} from "../../data/form-catalogs";

interface AdvancedRegistrationFormProps {
  orgSlug: string;
  orgId: string;
  eventId?: string;
  registrationScope: "org-only" | "org+event";
  onSuccess: () => void;
  onCancel?: () => void;
  existingData?: {
    attendeeId: string;
    registrationData: Record<string, string | number | boolean>;
  };
  mode?: "modal" | "page";
}

type FormValues = Record<string, string | number | boolean>;

type ConditionalOperator = "equals" | "notEquals" | "contains" | "notContains";
type ConditionalLogicLogic = "and" | "or";

interface ConditionalCondition {
  field: string;
  operator: ConditionalOperator;
  value: string | number | boolean;
}

interface ConditionalRule {
  action: "show" | "hide";
  conditions: ConditionalCondition[];
  logic: ConditionalLogicLogic;
}

// Evalúa UNA condición
function evaluateCondition(
  condition: ConditionalCondition,
  values: FormValues
): boolean {
  const fieldValue = values[condition.field];

  switch (condition.operator) {
    case "equals":
      return fieldValue === condition.value;
    case "notEquals":
      return fieldValue !== condition.value;
    case "contains":
      if (typeof fieldValue === "string") {
        return fieldValue.includes(String(condition.value));
      }
      return false;
    case "notContains":
      if (typeof fieldValue === "string") {
        return !fieldValue.includes(String(condition.value));
      }
      return true;
    default:
      return false;
  }
}

// Evalúa un grupo de condiciones de una regla
function evaluateRule(rule: ConditionalRule, values: FormValues): boolean {
  if (!rule.conditions || rule.conditions.length === 0) return true;

  if (rule.logic === "and") {
    return rule.conditions.every((c) => evaluateCondition(c, values));
  }

  // logic === "or"
  return rule.conditions.some((c) => evaluateCondition(c, values));
}

// Determina si el campo se debe mostrar
function shouldShowField(field: FormField, values: FormValues): boolean {
  if (field.hidden) return false;

  const logic = field.conditionalLogic as ConditionalRule[] | null | undefined;
  if (!logic || logic.length === 0) return true;

  const showRules = logic.filter((r) => r.action === "show");
  const hideRules = logic.filter((r) => r.action === "hide");

  let visible = true;

  if (showRules.length > 0) {
    visible = showRules.some((rule) => evaluateRule(rule, values));
  }

  if (hideRules.length > 0) {
    const mustHide = hideRules.some((rule) => evaluateRule(rule, values));
    if (mustHide) visible = false;
  }

  return visible;
}

function isFieldEffectivelyVisible(
  field: FormField,
  values: FormValues,
  allFields: FormField[]
): boolean {
  // 1. Si depende de otro campo, heredamos visibilidad y valor del padre
  if (field.dependsOn) {
    const parentField = allFields.find((f) => f.id === field.dependsOn);

    if (parentField) {
      const parentVisible = isFieldEffectivelyVisible(
        parentField,
        values,
        allFields
      );
      const parentValue = values[parentField.id];

      if (
        !parentVisible ||
        parentValue === "" ||
        parentValue === null ||
        parentValue === undefined
      ) {
        return false;
      }
    }
  }

  // 2. Aplicar la lógica propia del campo (hidden + conditionalLogic)
  return shouldShowField(field, values);
}

type SelectOption = { value: string; label?: string; parentValue?: string };

function uniqueOptions<T extends { value: any }>(options: T[]): T[] {
  const seen = new Set<string>();
  return options.filter((opt) => {
    const key = String(opt.value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveCountryCode(
  currentValues: FormValues,
  sortedFields: FormField[],
  countryOptions: SelectOption[]
): string | undefined {
  // Busca el campo de país, pero ignora los que son código (ej: codigo_pais, countrycode)
  const countryField = sortedFields.find((f) => {
    const id = f.id.toLowerCase();
    // Debe contener 'pais' o 'country', pero NO 'codigo' ni 'code'
    const isCountry = id.includes("pais") || id.includes("country");
    const isCode = id.includes("codigo") || id.includes("code");
    return isCountry && !isCode;
  });

  if (!countryField) return undefined;

  const raw = currentValues[countryField.id];
  if (!raw || typeof raw !== "string") return undefined;

  // Si ya parece un ISO2 (CL, AR, MX...)
  if (/^[A-Z]{2}$/i.test(raw)) {
    return raw.toUpperCase();
  }

  // Si lo que se guardó fue el label (ej: "Colombia"), lo mapeamos
  const byLabel = countryOptions.find((c) => c.label === raw);
  if (byLabel) return byLabel.value;

  return undefined;
}

// Componente memoizado para cada campo del formulario
const FormFieldComponent = memo(
  ({
    field,
    inputProps,
    filteredOptions,
  }: {
    field: FormField;
    inputProps: ReturnType<ReturnType<typeof useForm>["getInputProps"]>;
    filteredOptions?: SelectOption[];
  }) => {
    const helpText = field.helpText || undefined;

    const commonProps = {
      key: field.id,
      label: field.label,
      placeholder: field.placeholder,
      required: field.required,
      style: { display: field.hidden ? "none" : "block" },
      size: "sm" as const,
      description: helpText,
    };

    switch (field.type) {
      case "text":
      case "email":
        return <TextInput {...commonProps} type={field.type} {...inputProps} />;

      case "tel":
        return <TextInput {...commonProps} type="tel" {...inputProps} />;

      case "number":
        return <NumberInput {...commonProps} {...inputProps} />;

      case "select":
        return (
          <Select
            {...commonProps}
            data={(filteredOptions as any) || (field.options as any) || []}
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
            size="sm"
            required={field.required}
            style={{ display: field.hidden ? "none" : "block" }}
            styles={{
              label: {
                whiteSpace: "normal",
                lineHeight: 1.4,
                fontSize: "0.8rem",
              },
            }}
            {...inputProps}
          />
        );

      case "textarea":
        return (
          <Textarea
            {...commonProps}
            rows={3}
            autosize
            minRows={3}
            maxRows={6}
            {...inputProps}
          />
        );

      default:
        return null;
    }
  }
);

FormFieldComponent.displayName = "FormFieldComponent";

export function AdvancedRegistrationForm({
  orgSlug,
  orgId,
  eventId,
  registrationScope,
  onSuccess,
  onCancel,
  existingData,
  mode = "modal",
}: AdvancedRegistrationFormProps) {
  const [formConfig, setFormConfig] = useState<RegistrationForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(true);
  const { createAnonymousSession } = useAuth();

  // Opciones de países precalculadas (value = isoCode, label = nombre)
  const countryOptions: SelectOption[] = useMemo(
    () =>
      uniqueOptions(
        getAllCountries()
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((country) => ({
            value: country.isoCode,
            label: country.name,
          }))
      ),
    []
  );

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

  useEffect(() => {
    if (!formConfig) return;

    const initialValues: FormValues = {};

    formConfig.fields.forEach((field) => {
      if (existingData?.registrationData[field.id] !== undefined) {
        initialValues[field.id] = existingData.registrationData[field.id];
      } else if (field.defaultValue !== undefined) {
        initialValues[field.id] = field.defaultValue;
      } else {
        initialValues[field.id] = field.type === "checkbox" ? false : "";
      }
    });

    form.setInitialValues(initialValues);
    form.setValues(initialValues);
  }, [formConfig, existingData]);

  const sortedFields = useMemo(() => {
    if (!formConfig) return [];
    return [...formConfig.fields].sort((a, b) => a.order - b.order);
  }, [formConfig]);

  // --- IDs de campos especiales: país y código de país ---
  const countryFieldId = useMemo(() => {
    const field = sortedFields.find((f) => {
      const id = f.id.toLowerCase();
      const isCountry = id.includes("pais") || id.includes("country");
      const isCode = id.includes("codigo") || id.includes("code");
      return isCountry && !isCode; // solo el campo de selección de país
    });
    return field?.id;
  }, [sortedFields]);

  const countryCodeFieldId = useMemo(() => {
    const field = sortedFields.find((f) => {
      const id = f.id.toLowerCase();
      // aquí SÍ queremos el campo de código, ej: "codigo_pais"
      return id.includes("countrycode") || id.includes("codigo");
    });
    return field?.id;
  }, [sortedFields]);

  // --- Auto-asignar código de país al cambiar el país ---
  useEffect(() => {
    if (!countryFieldId || !countryCodeFieldId) return;

    const rawCountry = form.values[countryFieldId];
    const currentCode = form.values[countryCodeFieldId];

    // Si no hay país seleccionado, limpiamos el código (opcional)
    if (!rawCountry || typeof rawCountry !== "string") {
      if (currentCode) {
        form.setFieldValue(countryCodeFieldId, "");
      }
      return;
    }

    const resolvedCountryCode = resolveCountryCode(
      form.values,
      sortedFields,
      countryOptions
    );

    if (!resolvedCountryCode) return;

    const dialCode = getDialCodeByCountry(resolvedCountryCode);
    if (!dialCode) return;

    const formatted = `+${dialCode}`;

    if (currentCode !== formatted) {
      form.setFieldValue(countryCodeFieldId, formatted);
    }
    // 👇 escuchamos solo el valor del país y las refs necesarias
  }, [
    countryFieldId,
    countryCodeFieldId,
    form,
    form.values[countryFieldId as keyof FormValues],
    sortedFields,
    countryOptions,
  ]);

  /**
   * Devuelve las opciones para un campo select.
   * - Para País/Estado/Ciudad: usa la librería country-state-city (options no vienen de BD).
   * - Para otros selects: usa field.options y parentValue para cascada.
   */
  const getFilteredOptions = useCallback(
    (field: FormField, currentValues: FormValues) => {
      const idLower = field.id.toLowerCase();

      const isCountryField =
        idLower.includes("pais") || idLower.includes("country");
      const isStateField =
        idLower.includes("estado") ||
        idLower.includes("departamento") ||
        idLower.includes("state");
      const isCityField =
        idLower.includes("ciudad") || idLower.includes("city");

      // ---- País (select dinámico) ----
      if (isCountryField) {
        return countryOptions; // ya viene deduplicado
      }

      // ---- Resolver código de país una sola vez ----
      const countryCode = resolveCountryCode(
        currentValues,
        sortedFields,
        countryOptions
      );

      // Si no hay país seleccionado, no mostramos estados/ciudades todavía
      if (!countryCode && (isStateField || isCityField)) {
        return [];
      }

      // ---- Estado/Departamento (select dinámico) ----
      if (isStateField) {
        const states = getStatesByCountry(countryCode!);

        return uniqueOptions(
          states
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s) => ({
              value: s.name,
              label: s.name,
            }))
        );
      }

      // ---- Ciudad (select dinámico) ----
      if (isCityField) {
        const stateField = sortedFields.find(
          (f) =>
            f.id.toLowerCase().includes("estado") ||
            f.id.toLowerCase().includes("departamento") ||
            f.id.toLowerCase().includes("state")
        );

        const selectedState =
          stateField && typeof currentValues[stateField.id] === "string"
            ? (currentValues[stateField.id] as string)
            : undefined;

        const cities = getCitiesByCountry(countryCode!);
        const states = getStatesByCountry(countryCode!);

        return uniqueOptions(
          cities
            .filter((city) => {
              if (!selectedState) return true; // si no hay depto, mostrar todas
              const state = states.find((s) => s.isoCode === city.stateCode);
              return state?.name === selectedState;
            })
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((city) => {
              const state = states.find((s) => s.isoCode === city.stateCode);
              const stateName = state?.name;
              return {
                value: city.name, // guardas solo el nombre
                label: stateName ? `${city.name} (${stateName})` : city.name,
              };
            })
        );
      }

      // ---- Caso genérico: selects de negocio (perfil, especialidad, etc.) ----
      if (!field.options) return [];

      if (field.dependsOn) {
        const parentValue = currentValues[field.dependsOn];

        if (parentValue) {
          const filteredByParent = (field.options as any).filter(
            (opt: SelectOption) => {
              if (!opt.parentValue) return true;
              return opt.parentValue === parentValue;
            }
          );

          if (filteredByParent.length > 0) {
            return uniqueOptions(filteredByParent);
          }
        }
      }

      return uniqueOptions(field.options as any);
    },
    [sortedFields, countryOptions]
  );

  const handleSubmit = async (values: FormValues) => {
    try {
      setLoading(true);

      // 1) Copia inmutable para evaluar visibilidad
      const visibilityValues = { ...values };

      // 2) Copia mutable que realmente vamos a enviar
      const processedValues: FormValues = { ...values };

      // Limpiar valores de campos NO visibles (para no conservar datos viejos)
      sortedFields.forEach((field) => {
        const visible = isFieldEffectivelyVisible(
          field,
          visibilityValues, // 👈 usamos SIEMPRE la foto original
          sortedFields
        );

        if (!visible) {
          if (field.type === "checkbox") {
            processedValues[field.id] = false; // sin marcar
          } else {
            processedValues[field.id] = ""; // o null si prefieres
          }
        }
      });

      // Rellenar código de país basado en selección de país
      const countryField = sortedFields.find(
        (f) =>
          f.id.toLowerCase().includes("country") ||
          f.id.toLowerCase().includes("pais")
      );
      const phoneField = sortedFields.find((f) => f.type === "tel");

      if (countryField && phoneField && processedValues[countryField.id]) {
        const resolvedCountryCode = resolveCountryCode(
          processedValues,
          sortedFields,
          countryOptions
        );
        const dialCode = resolvedCountryCode
          ? getDialCodeByCountry(resolvedCountryCode)
          : "";

        const countryCodeField = sortedFields.find(
          (f) =>
            f.id.toLowerCase().includes("countrycode") ||
            f.id.toLowerCase().includes("codigo")
        );

        if (countryCodeField && dialCode) {
          processedValues[countryCodeField.id] = `+${dialCode}`;
        }
      }

      const emailField = sortedFields.find((f) => f.type === "email");
      const emailValue = emailField
        ? (processedValues[emailField.id] as string)
        : "";

      const nameField = sortedFields.find(
        (f) =>
          f.id.toLowerCase().includes("name") ||
          f.id.toLowerCase().includes("nombre") ||
          f.type === "text"
      );
      const nameValue = nameField
        ? (processedValues[nameField.id] as string)
        : "";

      if (!emailValue) {
        notifications.show({
          color: "red",
          title: "Error",
          message: "El campo de email es requerido para el registro",
        });
        return;
      }

      const userUID = await createAnonymousSession(emailValue);
      console.log(
        "🔐 Created/updated anonymous session with UID:",
        userUID,
        "for email:",
        emailValue
      );

      localStorage.setItem("user-email", emailValue);
      localStorage.setItem(`uid-${userUID}-email`, emailValue);

      const isOrgOnly = registrationScope === "org-only";

      if (isOrgOnly) {
        await registerOrgAttendeeAdvanced(orgId, {
          attendeeId: existingData?.attendeeId,
          email: emailValue,
          name: nameValue,
          formData: processedValues,
          firebaseUID: userUID,
        });

        notifications.show({
          color: "green",
          title: existingData ? "Datos actualizados" : "Registro exitoso",
          message: existingData
            ? "Tu información en la organización fue actualizada."
            : "Te registraste correctamente en la organización.",
        });
      } else {
        if (!eventId) {
          console.error(
            "❌ registrationScope is 'org+event' pero falta eventId"
          );
          notifications.show({
            color: "red",
            title: "Error",
            message:
              "No se pudo identificar el evento. Recarga la página e inténtalo de nuevo.",
          });
          return;
        }

        // actualizar también el OrgAttendee al mismo tiempo
        await registerOrgAttendeeAdvanced(orgId, {
          attendeeId: existingData?.attendeeId,
          email: emailValue,
          name: nameValue,
          formData: processedValues,
          firebaseUID: userUID,
        });

        // registrar al evento
        await registerToEventWithFirebase(eventId, {
          email: emailValue,
          name: nameValue,
          formData: processedValues,
          firebaseUID: userUID,
        });

        notifications.show({
          color: "green",
          title: "Registro exitoso",
          message: existingData
            ? "Tu información fue actualizada y sigues registrado en el evento."
            : "Te has registrado correctamente al evento.",
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
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack align="center" gap="sm">
          <Text size="sm">Cargando formulario...</Text>
        </Stack>
      </Card>
    );
  }

  if (!formConfig) {
    return mode === "modal" ? null : (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack align="center" gap="sm">
          <Text c="red" size="sm">
            Error al cargar el formulario
          </Text>
          <Button size="sm" onClick={onCancel}>
            Volver
          </Button>
        </Stack>
      </Card>
    );
  }

  const isOrgOnly = registrationScope === "org-only";

  const formContent = (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        {mode === "page" && (
          <Stack gap={4} ta="center">
            <Title order={3}>
              {existingData
                ? "Actualizar información"
                : formConfig.title ||
                  (isOrgOnly
                    ? "Registro en la organización"
                    : "Registro al evento")}
            </Title>
            {formConfig.description && (
              <Text c="dimmed" size="sm">
                {formConfig.description}
              </Text>
            )}
          </Stack>
        )}

        <Stack gap="sm" maw={600} mx="auto" w="100%">
          {sortedFields.map((field) => {
            const currentValues = form.values;

            const visible = isFieldEffectivelyVisible(
              field,
              currentValues,
              sortedFields
            );
            if (!visible) return null;

            const filteredOptions = getFilteredOptions(field, currentValues);

            const inputProps =
              field.type === "checkbox"
                ? form.getInputProps(field.id, { type: "checkbox" })
                : form.getInputProps(field.id);

            return (
              <FormFieldComponent
                key={field.id}
                field={field}
                inputProps={inputProps}
                filteredOptions={filteredOptions}
              />
            );
          })}
        </Stack>

        <Stack gap={8} maw={400} mx="auto" w="100%">
          <Button type="submit" loading={loading} size="sm" fullWidth>
            {existingData
              ? "Actualizar información"
              : isOrgOnly
              ? "Guardar registro"
              : "Registrarme al evento"}
          </Button>

          {onCancel && (
            <Button variant="subtle" size="xs" onClick={onCancel} fullWidth>
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
        title={
          existingData
            ? "Actualizar información"
            : formConfig.title ||
              (isOrgOnly ? "Registro en la organización" : "Registro al evento")
        }
        size="md"
        centered
      >
        {formContent}
      </Modal>
    );
  }

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      {formContent}
    </Card>
  );
}
