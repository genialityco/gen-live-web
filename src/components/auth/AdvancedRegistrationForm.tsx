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
  buildCityToStateMap,
  getDialCodeByCountry,
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
  // Si es hidden hard, no se muestra nunca
  if (field.hidden) return false;

  const logic = field.conditionalLogic as ConditionalRule[] | null | undefined;
  if (!logic || logic.length === 0) {
    // Sin lógica condicional: visible por defecto
    return true;
  }

  const showRules = logic.filter((r) => r.action === "show");
  const hideRules = logic.filter((r) => r.action === "hide");

  let visible = true;

  // Si hay reglas de "show", solo se muestra si al menos una se cumple
  if (showRules.length > 0) {
    visible = showRules.some((rule) => evaluateRule(rule, values));
  }

  // Si hay reglas de "hide" y alguna se cumple, se oculta
  if (hideRules.length > 0) {
    const mustHide = hideRules.some((rule) => evaluateRule(rule, values));
    if (mustHide) visible = false;
  }

  return visible;
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
    filteredOptions?: typeof field.options;
  }) => {
    const commonProps = {
      key: field.id,
      label: field.label,
      placeholder: field.placeholder,
      required: field.required,
      style: { display: field.hidden ? "none" : "block" },
      size: "sm" as const,
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
            size="sm"
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
  }, [formConfig, existingData]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedFields = useMemo(() => {
    if (!formConfig) return [];
    return [...formConfig.fields].sort((a, b) => a.order - b.order);
  }, [formConfig]);

  const getFilteredOptions = useCallback(
    (field: FormField, currentValues: FormValues) => {
      if (!field.options) return [];

      // 1) Caso genérico: si el field tiene dependsOn y las opciones tienen parentValue
      if (field.dependsOn) {
        const parentValue = currentValues[field.dependsOn];

        if (parentValue) {
          const filteredByParent = field.options.filter((opt) => {
            if (!opt.parentValue) return true; // por si hay opciones "globales"
            return opt.parentValue === parentValue;
          });

          // Si filtramos algo, devolvemos eso
          if (filteredByParent.length > 0) {
            return filteredByParent;
          }
        }
      }

      // 2) Caso especial ciudades (tu lógica previa con cityToStateMap)
      if (
        field.id.toLowerCase().includes("city") ||
        field.id.toLowerCase().includes("ciudad")
      ) {
        const stateField = sortedFields.find(
          (f) =>
            f.id.toLowerCase().includes("state") ||
            f.id.toLowerCase().includes("department") ||
            f.id.toLowerCase().includes("departamento")
        );

        if (stateField && currentValues[stateField.id]) {
          const selectedState = currentValues[stateField.id] as string;

          // intentar usar cityToStateMap
          const fromMap = field.options.filter(
            (city) => cityToStateMap[city.value] === selectedState
          );
          if (fromMap.length > 0) return fromMap;

          // fallback: usar parentValue
          const fromParent = field.options.filter(
            (city) => city.parentValue === selectedState
          );
          if (fromParent.length > 0) return fromParent;
        }
      }

      // 3) Default: sin filtrado especial
      return field.options;
    },
    [sortedFields, cityToStateMap]
  );

  const handleSubmit = async (values: FormValues) => {
    try {
      setLoading(true);
      const processedValues = { ...values };

      const countryField = sortedFields.find(
        (f) =>
          f.id.toLowerCase().includes("country") ||
          f.id.toLowerCase().includes("pais")
      );
      const phoneField = sortedFields.find((f) => f.type === "tel");

      if (countryField && phoneField && values[countryField.id]) {
        const countryCode = values[countryField.id] as string;
        const dialCode = getDialCodeByCountry(countryCode);

        const countryCodeField = sortedFields.find(
          (f) =>
            f.id.toLowerCase().includes("countrycode") ||
            f.id.toLowerCase().includes("codigo")
        );

        if (countryCodeField && dialCode) {
          processedValues[countryCodeField.id] = dialCode;
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

            const visible = shouldShowField(field, currentValues);
            if (!visible) return null;

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
