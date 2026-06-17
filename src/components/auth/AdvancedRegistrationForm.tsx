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
  Alert,
  ThemeIcon,
  Center,
  Loader,
  Anchor,
} from "@mantine/core";
import { IconUserPlus, IconPencil } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  fetchRegistrationForm,
  registerOrgAttendeeAdvanced,
} from "../../api/orgs";
import {
  checkOrgRegistrationByIdentifiers,
  registerToEventWithFirebase,
} from "../../api/events";
import type { RegistrationForm, FormField } from "../../types";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../../auth/AuthProvider";
import {
  getDialCodeByCountry,
  getAllCountries,
  getStatesByCountry,
  getCitiesByCountry,
  type ICity,
} from "../../data/form-catalogs";
import { isFieldEffectivelyVisible } from "../../utils/form-visibility";
import { normalizeSelectStoredValue } from "../../utils/form-values";

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
  countryOptions: SelectOption[],
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

    const isFieldDisabled = (field as any).autoCalculated === true;

    const commonProps = {
      key: field.id,
      label: field.label,
      placeholder: field.placeholder,
      required: field.required,
      style: { display: field.hidden ? "none" : "block" },
      size: "md" as const,
      radius: "md" as const,
      description: helpText,
      disabled: isFieldDisabled,
      autoComplete: "new-password",
      styles: { label: { fontWeight: 600, marginBottom: 4 } },
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
            comboboxProps={{ withinPortal: true }}
            {...inputProps}
          />
        );

      case "checkbox":
        return (
          <Checkbox
            key={field.id}
            size="md"
            radius="md"
            required={field.required}
            style={{ display: field.hidden ? "none" : "block" }}
            styles={{
              body: { alignItems: "flex-start" },
              label: { whiteSpace: "normal", lineHeight: 1.2 },
            }}
            {...inputProps}
            label={
              <span dangerouslySetInnerHTML={{ __html: field.label || "" }} />
            }
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
  },
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

  const [checkingExisting, setCheckingExisting] = useState(false);
  const [existingWarning, setExistingWarning] = useState<null | {
    attendeeName?: string;
  }>(null);

  const form = useForm<FormValues>({
    initialValues: {},
    validate: {},
  });

  const sortedFields = useMemo(() => {
    if (!formConfig) return [];
    return [...formConfig.fields].sort((a, b) => a.order - b.order);
  }, [formConfig]);

  // Campos identificadores (los mismos que usas en OrgAccess)
  const identifierFields = useMemo(
    () => formConfig?.fields.filter((f) => f.isIdentifier) ?? [],
    [formConfig],
  );

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
          })),
      ),
    [],
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

  useEffect(() => {
    if (!formConfig) return;

    const initialValues: FormValues = {};

    formConfig.fields.forEach((field) => {
      let raw: string | number | boolean;
      if (existingData?.registrationData[field.id] !== undefined) {
        raw = existingData.registrationData[field.id];
      } else if (field.defaultValue !== undefined) {
        raw = field.defaultValue;
      } else {
        raw = field.type === "checkbox" ? false : "";
      }
      // Normaliza valores legacy guardados como etiqueta (ej. país "Colombia")
      // al value canónico de la opción, para que el Select lo muestre y al
      // guardar se persista el value correcto.
      initialValues[field.id] = normalizeSelectStoredValue(field, raw);
    });

    form.setInitialValues(initialValues);
    form.setValues(initialValues);
  }, [formConfig, existingData]);

  useEffect(() => {
    if (existingWarning) {
      const el = document.getElementById("existing-warning");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [existingWarning]);

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
      countryOptions,
    );

    if (!resolvedCountryCode) return;

    const dialCode = getDialCodeByCountry(resolvedCountryCode);
    if (!dialCode) return;

    const formatted = `+${dialCode}`;

    if (currentCode !== formatted) {
      form.setFieldValue(countryCodeFieldId, formatted);
    }
  }, [
    countryFieldId,
    countryCodeFieldId,
    form,
    form.values[countryFieldId as keyof FormValues],
    sortedFields,
    countryOptions,
  ]);

  // --- ID del campo de ciudad (si el form lo tiene) ---
  const cityFieldId = useMemo(() => {
    const field = sortedFields.find((f) => {
      const id = f.id.toLowerCase();
      return id.includes("ciudad") || id.includes("city");
    });
    return field?.id;
  }, [sortedFields]);

  // --- Ciudades del país seleccionado, cargadas de forma diferida ---
  const [citiesByCountry, setCitiesByCountry] = useState<Record<string, ICity[]>>({});

  const resolvedCountryCode = useMemo(
    () => resolveCountryCode(form.values, sortedFields, countryOptions),
    [form.values[countryFieldId as keyof FormValues], sortedFields, countryOptions],
  );

  useEffect(() => {
    if (!cityFieldId || !resolvedCountryCode) return;
    if (citiesByCountry[resolvedCountryCode]) return;

    getCitiesByCountry(resolvedCountryCode).then((cities) => {
      setCitiesByCountry((prev) => ({ ...prev, [resolvedCountryCode]: cities }));
    });
  }, [cityFieldId, resolvedCountryCode, citiesByCountry]);

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
        countryOptions,
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
            })),
        );
      }

      // ---- Ciudad (select dinámico) ----
      if (isCityField) {
        const stateField = sortedFields.find(
          (f) =>
            f.id.toLowerCase().includes("estado") ||
            f.id.toLowerCase().includes("departamento") ||
            f.id.toLowerCase().includes("state"),
        );

        const selectedState =
          stateField && typeof currentValues[stateField.id] === "string"
            ? (currentValues[stateField.id] as string)
            : undefined;

        const cities = citiesByCountry[countryCode!] ?? [];
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
            }),
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
            },
          );

          if (filteredByParent.length > 0) {
            return uniqueOptions(filteredByParent);
          }
        }
      }

      return uniqueOptions(field.options as any);
    },
    [sortedFields, countryOptions, citiesByCountry],
  );

  // Buscar si existe OrgAttendee cuando se llenan campos identificadores
  async function checkExistingByIdentifiers() {
    if (!orgId || !identifierFields.length) return;

    // Construir solo los campos identificadores con valor
    const payload: Record<string, any> = {};
    identifierFields.forEach((field) => {
      const value = form.values[field.id];
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        payload[field.id] = String(value).trim();
      }
    });

    // Si no hay ningún identificador lleno, no buscamos
    if (Object.keys(payload).length === 0) {
      setExistingWarning(null);
      return;
    }

    console.log("🔍 Checking existing attendee with payload:", payload);

    try {
      setCheckingExisting(true);
      const result = await checkOrgRegistrationByIdentifiers(orgId, payload);
      console.log("🔍 checkOrgRegistrationByIdentifiers result:", result);

      if (result?.found && result.orgAttendee) {
        setExistingWarning({
          attendeeName: result.orgAttendee.name,
        });
      } else {
        setExistingWarning(null);
      }
    } catch (error) {
      console.error("❌ Error checking existing org attendee:", error);
      setExistingWarning(null);
    } finally {
      setCheckingExisting(false);
    }
  }

  const handleSubmit = async (values: FormValues) => {
    try {
      setLoading(true);

      // 1) Copia inmutable para evaluar visibilidad
      const visibilityValues = { ...values };

      // 2) Copia mutable que realmente vamos a enviar
      const processedValues: FormValues = { ...values };

      // Limpiar valores de campos NO visibles
      sortedFields.forEach((field) => {
        const visible = isFieldEffectivelyVisible(
          field,
          visibilityValues,
          sortedFields,
        );

        if (!visible) {
          if (field.type === "checkbox") {
            processedValues[field.id] = false;
          } else {
            processedValues[field.id] = "";
          }
        }
      });

      // Rellenar código de país basado en selección de país
      const countryField = sortedFields.find(
        (f) =>
          f.id.toLowerCase().includes("country") ||
          f.id.toLowerCase().includes("pais"),
      );
      const phoneField = sortedFields.find((f) => f.type === "tel");

      if (countryField && phoneField && processedValues[countryField.id]) {
        const resolvedCountryCode = resolveCountryCode(
          processedValues,
          sortedFields,
          countryOptions,
        );
        const dialCode = resolvedCountryCode
          ? getDialCodeByCountry(resolvedCountryCode)
          : "";

        const countryCodeField = sortedFields.find(
          (f) =>
            f.id.toLowerCase().includes("countrycode") ||
            f.id.toLowerCase().includes("codigo"),
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
          f.type === "text",
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
        emailValue,
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
            "❌ registrationScope is 'org+event' pero falta eventId",
          );
          notifications.show({
            color: "red",
            title: "Error",
            message:
              "No se pudo identificar el evento. Recarga la página e inténtalo de nuevo.",
          });
          return;
        }

        await registerOrgAttendeeAdvanced(orgId, {
          attendeeId: existingData?.attendeeId,
          email: emailValue,
          name: nameValue,
          formData: processedValues,
          firebaseUID: userUID,
        });

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
        <Center py="xl">
          <Stack align="center" gap="sm">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Cargando…
            </Text>
          </Stack>
        </Center>
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
    <form onSubmit={form.onSubmit(handleSubmit)} autoComplete="off">
      <Stack gap="md">
        {mode === "page" && (
          <Stack gap={8} ta="center" align="center" mb={4}>
            <ThemeIcon size={48} radius="md" variant="light">
              {existingData ? (
                <IconPencil size={26} stroke={1.6} />
              ) : (
                <IconUserPlus size={26} stroke={1.6} />
              )}
            </ThemeIcon>

            <Stack gap={2} align="center">
              <Title order={3} fw={600}>
                {existingData
                  ? "Actualizar información"
                  : formConfig.title ||
                    (isOrgOnly ? "Registro" : "Registro al evento")}
              </Title>
              <Text c="dimmed" size="sm" maw={420}>
                {existingData
                  ? "Revisa y completa tus datos para continuar."
                  : "Completa tus datos para acceder al evento."}
              </Text>
            </Stack>
          </Stack>
        )}

        {/* Advertencia si ya existe un registro con los datos ingresados */}
        {existingWarning && (
          <Stack maw={560} mx="auto" w="100%">
            <Alert
              id="existing-warning"
              color="yellow"
              variant="light"
              radius="md"
              title="Registro encontrado"
              styles={{ title: { fontWeight: 600 } }}
            >
              <Stack gap={6}>
                <Text size="sm">
                  {existingWarning.attendeeName
                    ? `Ya existe un registro a nombre de "${existingWarning.attendeeName}".`
                    : "Ya existe un registro con estos datos."}
                </Text>

                <Text size="sm">
                  Si ya te habías registrado antes,{" "}
                  <Anchor component="button" type="button" fw={600} onClick={onCancel}>
                    haz clic aquí para ingresar
                  </Anchor>
                  .
                </Text>

                {checkingExisting && (
                  <Text size="xs" c="dimmed">
                    Verificando datos...
                  </Text>
                )}
              </Stack>
            </Alert>
          </Stack>
        )}

        <Stack gap="md" maw={560} mx="auto" w="100%">
          <Stack gap="md">
            {sortedFields.map((field) => {
              const currentValues = form.values;

              const visible = isFieldEffectivelyVisible(
                field,
                currentValues,
                sortedFields,
              );
              if (!visible) return null;

              const filteredOptions = getFilteredOptions(field, currentValues);

              const baseInputProps =
                field.type === "checkbox"
                  ? form.getInputProps(field.id, { type: "checkbox" })
                  : form.getInputProps(field.id);

              // 👇 Hack anti-autocompletado para campos de texto / email / tel / number / textarea
              const autoCompleteProps =
                field.type === "text" ||
                field.type === "email" ||
                field.type === "tel" ||
                field.type === "number" ||
                field.type === "textarea"
                  ? { autoComplete: "new-password" as const }
                  : {};

              //  si el campo es identificador, añadimos onBlur para disparar la búsqueda
              const inputProps = field.isIdentifier
                ? {
                    ...baseInputProps,
                    ...autoCompleteProps,
                    onBlur: (e: any) => {
                      if (typeof baseInputProps.onBlur === "function") {
                        baseInputProps.onBlur(e);
                      }
                      void checkExistingByIdentifiers();
                    },
                  }
                : { ...baseInputProps, ...autoCompleteProps };

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
        </Stack>

        <Stack gap={10} maw={560} mx="auto" w="100%" mt={4}>
          <Button
            type="submit"
            loading={loading}
            size="md"
            radius="md"
            fullWidth
          >
            {existingData ? "Guardar cambios" : "Registrarme"}
          </Button>

          {onCancel && (
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              radius="md"
              onClick={onCancel}
              fullWidth
            >
              Volver
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
              (isOrgOnly ? "Registro" : "Registro al evento")
        }
        size="md"
        centered
        radius="lg"
        overlayProps={{ blur: 3, opacity: 0.35 }}
      >
        {formContent}
      </Modal>
    );
  }

  return (
    <Card shadow="sm" p={{ base: "md", sm: "lg" }} radius="md" withBorder>
      {formContent}
    </Card>
  );
}
