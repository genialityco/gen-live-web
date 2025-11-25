/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import {
  Stack,
  Title,
  Card,
  Group,
  Text,
  Button,
  TextInput,
  Select,
  Switch,
  NumberInput,
  Textarea,
  ActionIcon,
  Divider,
  Alert,
  Modal,
  Badge,
  Paper,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconTrash, IconPlus } from "@tabler/icons-react";
import {
  type Org,
  type RegistrationForm,
  type FormField,
  type FormFieldType,
  updateRegistrationForm,
} from "../../api/orgs";

interface RegistrationFormBuilderProps {
  org: Org;
  onUpdate: () => void;
}

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Teléfono" },
  { value: "number", label: "Número" },
  { value: "select", label: "Selector" },
  { value: "checkbox", label: "Casilla de verificación" },
  { value: "textarea", label: "Área de texto" },
];

// Campo obligatorio del sistema (siempre debe existir)
const EMAIL_FIELD: FormField = {
  id: "email_system",
  type: "email",
  label: "Correo electrónico",
  placeholder: "tu@email.com",
  required: true,
  order: 0,
  isIdentifier: false, // Puede ser marcado como identificador por el admin
};

const DEFAULT_FIELDS: Partial<FormField>[] = [
  { type: "text", label: "Nombre", required: true },
  { type: "text", label: "Apellidos", required: true },
  { type: "text", label: "País", required: false },
  { type: "text", label: "Cédula/DNI", required: false },
  { type: "text", label: "Especialidad", required: false },
  {
    type: "checkbox",
    label: "Acepto el tratamiento de datos personales",
    required: true,
  },
];

export default function RegistrationFormBuilder({
  org,
  onUpdate,
}: RegistrationFormBuilderProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<RegistrationForm>(
    org.registrationForm || {
      enabled: false,
      title: "Registro al evento",
      description: "Por favor completa los siguientes datos para registrarte",
      fields: [],
      submitButtonText: "Registrarme",
      successMessage: "¡Registro exitoso! Gracias por inscribirte.",
    }
  );

  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSave = async () => {
    try {
      setLoading(true);

      // 🧼 Normalizar antes de enviar al backend
      const normalizedForm: RegistrationForm = {
        ...form,
        fields: form.fields.map((field, index) => {
          const normalizedField: any = { ...field, order: index };

          if (field.conditionalLogic && field.conditionalLogic.length > 0) {
            const allowedActions = [
              "show",
              "hide",
              "enable",
              "disable",
              "require",
            ] as const;

            normalizedField.conditionalLogic = field.conditionalLogic
              // Filtrar reglas vacías/mal formadas
              .filter(
                (rule) => rule && allowedActions.includes(rule.action as any)
              )
              .map((rule) => ({
                ...rule,
                // logic solo puede ser 'and' | 'or'
                logic: rule.logic === "or" ? "or" : "and",
                conditions: (rule.conditions || []).map((cond) => ({
                  ...cond,
                  // Normalizar operadores
                  operator:
                    cond.operator === "notEquals"
                      ? "notEquals"
                      : cond.operator === "contains"
                      ? "contains"
                      : cond.operator === "notContains"
                      ? "notContains"
                      : "equals",
                })),
              }));

            // Si después de normalizar ya no hay reglas válidas, eliminar conditionalLogic
            if (
              !normalizedField.conditionalLogic ||
              normalizedField.conditionalLogic.length === 0
            ) {
              delete normalizedField.conditionalLogic;
            }
          } else {
            // Si no hay lógica condicional, no enviar el campo
            delete normalizedField.conditionalLogic;
          }

          return normalizedField;
        }),
      };

      await updateRegistrationForm(org.domainSlug, normalizedForm);

      notifications.show({
        title: "Éxito",
        message: "Formulario de registro actualizado",
        color: "green",
      });
      onUpdate();
    } catch (error) {
      console.error(error);
      notifications.show({
        title: "Error",
        message: "No se pudo actualizar el formulario",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const addField = (fieldTemplate?: Partial<FormField>) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: fieldTemplate?.type || "text",
      label: fieldTemplate?.label || "Nuevo campo",
      required: fieldTemplate?.required ?? false,
      options: fieldTemplate?.options,
      order: form.fields.length,
      helpText: fieldTemplate?.helpText,
      defaultValue: fieldTemplate?.defaultValue,
      hidden: fieldTemplate?.hidden,
      dependsOn: fieldTemplate?.dependsOn,
      conditionalLogic: fieldTemplate?.conditionalLogic,
      validation: fieldTemplate?.validation,
      // nuevos campos de tipos/TS (opcionales)
      optionsSource: fieldTemplate?.optionsSource,
      countryCode: fieldTemplate?.countryCode,
      isIdentifier: fieldTemplate?.isIdentifier,
      autoCalculated: fieldTemplate?.autoCalculated,
    };
    setEditingField(newField);
    setIsModalOpen(true);
  };

  // Agregar campo directamente sin abrir modal (para campos pre-configurados)
  const addFieldDirectly = (fieldTemplate: Partial<FormField>) => {
    setForm((prevForm: RegistrationForm) => {
      const newField: FormField = {
        id: fieldTemplate.id || `field_${Date.now()}`,
        type: fieldTemplate.type || "text",
        label: fieldTemplate.label || "Nuevo campo",
        placeholder: fieldTemplate.placeholder,
        required: fieldTemplate.required ?? false,
        options: fieldTemplate.options,
        order: prevForm.fields.length,
        helpText: fieldTemplate.helpText,
        defaultValue: fieldTemplate.defaultValue,
        hidden: fieldTemplate.hidden,
        autoCalculated: fieldTemplate.autoCalculated,
        dependsOn: fieldTemplate.dependsOn,
        conditionalLogic: fieldTemplate.conditionalLogic,
        validation: fieldTemplate.validation,
        isIdentifier: fieldTemplate.isIdentifier,
        optionsSource: fieldTemplate.optionsSource,
        countryCode: fieldTemplate.countryCode,
      };
      return { ...prevForm, fields: [...prevForm.fields, newField] };
    });
  };

  const addPrePopulatedField = (
    fieldType: "pais" | "estado" | "ciudad" | "pais-telefono",
    countryCode?: string
  ) => {
    const timestamp = Date.now();

    if (fieldType === "pais") {
      // Campo País basado en librería (se resuelve en el formulario público)
      addFieldDirectly({
        id: `pais_${timestamp}`,
        type: "select",
        label: "País",
        placeholder: "Seleccione su país",
        required: true,
        helpText: "Seleccione el país de residencia",
        optionsSource: "countries", // <- clave: no guardamos opciones
      });

      notifications.show({
        title: "Campo agregado",
        message: "Se agregó el campo País (catálogo dinámico).",
        color: "green",
      });
    } else if (fieldType === "estado") {
      // Campo Estado/Departamento basado en librería
      addFieldDirectly({
        id: `estado_${timestamp}`,
        type: "select",
        label: "Estado/Departamento",
        placeholder: "Seleccione su estado",
        required: true,
        helpText: "Seleccione el estado o departamento",
        optionsSource: "states",
        countryCode: countryCode || "CO", // por defecto CO
      });

      notifications.show({
        title: "Campo agregado",
        message:
          "Se agregó el campo Estado/Departamento (catálogo dinámico por país).",
        color: "green",
      });
    } else if (fieldType === "ciudad") {
      // Campo Ciudad basado en librería
      addFieldDirectly({
        id: `ciudad_${timestamp}`,
        type: "select",
        label: "Ciudad",
        placeholder: "Seleccione su ciudad",
        required: true,
        helpText: "Seleccione la ciudad",
        optionsSource: "cities",
        countryCode: countryCode || "CO", // por defecto CO
        // opcionalmente, en el futuro, podrías setear dependsOn a un campo estado
      });

      notifications.show({
        title: "Campo agregado",
        message: "Se agregó el campo Ciudad (catálogo dinámico por estado).",
        color: "green",
      });
    } else if (fieldType === "pais-telefono") {
      // Agregar campos País + Código país (auto) + Teléfono
      const paisId = `pais_${timestamp}`;
      const codigoId = `codigo_pais_${timestamp}`;
      const telefonoId = `telefono_${timestamp}`;

      // 1. Campo País (select dinámico por librería)
      addFieldDirectly({
        id: paisId,
        type: "select",
        label: "País",
        placeholder: "Seleccione su país",
        required: true,
        helpText: "Seleccione el país de residencia",
        optionsSource: "countries",
      });

      // 2. Campo Código de país (texto auto-calculado según país)
      addFieldDirectly({
        id: codigoId,
        type: "text",
        label: "Código de país",
        placeholder: "+57",
        required: true,
        helpText: "Se asigna automáticamente según el país",
        autoCalculated: true,
        dependsOn: paisId,
        validation: {
          pattern: "^\\+\\d{1,4}$",
        },
      });

      // 3. Campo Teléfono
      addFieldDirectly({
        id: telefonoId,
        type: "tel",
        label: "Número de teléfono",
        placeholder: "3001234567",
        required: true,
        helpText: "Ingrese su número de teléfono sin código de país",
        validation: {
          minLength: 7,
          maxLength: 15,
        },
      });

      notifications.show({
        title: "Campos agregados",
        message:
          "Se agregaron los campos País, Código de país y Teléfono relacionados (catálogos dinámicos).",
        color: "green",
      });
    }
  };

  const editField = (field: FormField) => {
    setEditingField({ ...field });
    setIsModalOpen(true);
  };

  const saveField = () => {
    if (!editingField) return;

    const existingIndex = form.fields.findIndex(
      (f: { id: any }) => f.id === editingField.id
    );

    if (existingIndex >= 0) {
      // Actualizar campo existente
      const updatedFields = [...form.fields];
      updatedFields[existingIndex] = editingField;
      setForm({ ...form, fields: updatedFields });
    } else {
      // Agregar nuevo campo
      setForm({ ...form, fields: [...form.fields, editingField] });
    }

    setIsModalOpen(false);
    setEditingField(null);
  };

  const deleteField = (fieldId: string) => {
    // No permitir eliminar el campo de email (obligatorio del sistema)
    if (fieldId === EMAIL_FIELD.id) {
      notifications.show({
        title: "No permitido",
        message: "El campo de email es obligatorio y no se puede eliminar",
        color: "red",
      });
      return;
    }

    setForm({
      ...form,
      fields: form.fields.filter((f: { id: string }) => f.id !== fieldId),
    });
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newFields = [...form.fields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newFields.length) return;

    [newFields[index], newFields[targetIndex]] = [
      newFields[targetIndex],
      newFields[index],
    ];

    // Actualizar el orden
    newFields.forEach((field, idx) => {
      field.order = idx;
    });

    setForm({ ...form, fields: newFields });
  };

  const loadDefaultFields = () => {
    // Email siempre es el primer campo (obligatorio del sistema)
    const emailField = { ...EMAIL_FIELD };

    // Resto de campos por defecto
    const otherFields: FormField[] = DEFAULT_FIELDS.map((template, index) => ({
      id: `field_${Date.now()}_${index}`,
      type: template.type!,
      label: template.label!,
      required: template.required!,
      options: template.options,
      order: index + 1, // Empezar desde 1 porque email es 0
    }));

    setForm({ ...form, fields: [emailField, ...otherFields] });
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Formulario de Registro</Title>
        <Button onClick={handleSave} loading={loading} size="lg">
          💾 Guardar cambios
        </Button>
      </Group>

      <Alert variant="light" color="blue">
        Crea un formulario personalizado que los asistentes deberán completar
        antes de acceder a los eventos de esta organización.
      </Alert>

      {/* Configuración general */}
      <Card withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Configuración general</Text>
            <Switch
              label="Habilitar formulario"
              checked={form.enabled}
              onChange={(e) =>
                setForm({ ...form, enabled: e.currentTarget.checked })
              }
            />
          </Group>

          {form.enabled && (
            <>
              <Divider />
              <TextInput
                label="Título del formulario"
                value={form.title || ""}
                onChange={(e) =>
                  setForm({ ...form, title: e.currentTarget.value })
                }
                placeholder="Registro al evento"
              />

              <Textarea
                label="Descripción"
                value={form.description || ""}
                onChange={(e) =>
                  setForm({ ...form, description: e.currentTarget.value })
                }
                placeholder="Por favor completa los siguientes datos..."
                rows={3}
              />

              <TextInput
                label="Texto del botón"
                value={form.submitButtonText || ""}
                onChange={(e) =>
                  setForm({ ...form, submitButtonText: e.currentTarget.value })
                }
                placeholder="Registrarme"
              />

              <TextInput
                label="Mensaje de éxito"
                value={form.successMessage || ""}
                onChange={(e) =>
                  setForm({ ...form, successMessage: e.currentTarget.value })
                }
                placeholder="¡Registro exitoso!"
              />
            </>
          )}
        </Stack>
      </Card>

      {/* Campos del formulario */}
      {form.enabled && (
        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600}>Campos del formulario</Text>
              <Group>
                {form.fields.length === 0 && (
                  <Button variant="light" size="sm" onClick={loadDefaultFields}>
                    📋 Cargar campos predeterminados
                  </Button>
                )}
                <Button
                  variant="filled"
                  size="sm"
                  onClick={() => addField()}
                  leftSection="➕"
                >
                  Agregar campo
                </Button>
              </Group>
            </Group>

            {/* Campos especiales pre-poblados */}
            {form.fields.length > 0 && (
              <Alert color="blue" variant="light">
                <Text size="sm" fw={600} mb="xs">
                  Agregar campos especiales pre-poblados:
                </Text>
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    color="blue"
                    onClick={() => addPrePopulatedField("pais")}
                  >
                    🌎 País
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="cyan"
                    onClick={() => addPrePopulatedField("estado", "CO")}
                  >
                    📍 Estado/Depto CO
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="teal"
                    onClick={() => addPrePopulatedField("ciudad", "CO")}
                  >
                    🏙️ Ciudad CO
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="violet"
                    onClick={() => addPrePopulatedField("pais-telefono")}
                  >
                    📞 País + Teléfono
                  </Button>
                </Group>
              </Alert>
            )}

            <Group justify="space-between"></Group>

            {form.fields.length === 0 ? (
              <Alert color="gray">
                No hay campos agregados. Agrega campos personalizados o carga
                los predeterminados.
              </Alert>
            ) : (
              <Stack gap="sm">
                {form.fields.map((field: FormField, index: number) => (
                  <Card key={field.id} withBorder p="sm" bg="gray.0">
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="xs" style={{ flex: 1 }}>
                        <Badge
                          color={
                            field.type === "checkbox"
                              ? "grape"
                              : field.type === "select"
                              ? "cyan"
                              : "blue"
                          }
                          size="sm"
                        >
                          {
                            FIELD_TYPES.find((t) => t.value === field.type)
                              ?.label
                          }
                        </Badge>
                        <Text fw={500} size="sm">
                          {field.label}
                        </Text>
                        {field.id === EMAIL_FIELD.id && (
                          <Badge color="orange" size="xs">
                            Campo del sistema
                          </Badge>
                        )}
                        {field.required && (
                          <Badge color="red" size="xs">
                            Requerido
                          </Badge>
                        )}
                        {field.isIdentifier && (
                          <Badge color="violet" size="xs">
                            🔍 Identificador
                          </Badge>
                        )}
                      </Group>

                      <Group gap="xs" wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => moveField(index, "up")}
                          disabled={index === 0}
                        >
                          ⬆️
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => moveField(index, "down")}
                          disabled={index === form.fields.length - 1}
                        >
                          ⬇️
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          size="sm"
                          onClick={() => editField(field)}
                          title={
                            field.id === EMAIL_FIELD.id
                              ? "Solo puedes editar si es identificador"
                              : "Editar campo"
                          }
                        >
                          ✏️
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => deleteField(String(field.id))}
                          disabled={field.id === EMAIL_FIELD.id}
                          title={
                            field.id === EMAIL_FIELD.id
                              ? "El email del sistema no se puede eliminar"
                              : "Eliminar campo"
                          }
                        >
                          🗑️
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      )}

      {/* Modal para editar campo */}
      <Modal
        opened={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingField(null);
        }}
        title={
          <Text fw={600}>
            {editingField &&
            form.fields.find((f: { id: any }) => f.id === editingField.id)
              ? "Editar campo"
              : "Nuevo campo"}
          </Text>
        }
        size="xl"
      >
        {editingField && (
          <Stack gap="md">
            {/* SI ES EMAIL_SYSTEM, SOLO PERMITIR EDITAR isIdentifier */}
            {editingField.id === EMAIL_FIELD.id ? (
              <>
                <Alert color="blue" variant="light">
                  El campo de <strong>email del sistema</strong> es obligatorio
                  y no se pueden modificar sus propiedades básicas. Solo puedes
                  configurarlo como campo identificador.
                </Alert>

                <Paper p="md" withBorder>
                  <Stack gap="sm">
                    <Group>
                      <Text fw={500}>Correo electrónico</Text>
                      <Badge color="orange" size="xs">
                        Campo del sistema
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      Tipo: Email | Requerido: Sí
                    </Text>
                  </Stack>
                </Paper>

                <Divider />

                <Switch
                  label="Campo identificador"
                  description="Usar para búsqueda de registros existentes. Si está activado, los usuarios podrán ingresar su email para verificar si ya están registrados."
                  checked={editingField.isIdentifier || false}
                  onChange={(e) =>
                    setEditingField({
                      ...editingField,
                      isIdentifier: e.currentTarget.checked,
                    })
                  }
                />

                <Alert color="violet" variant="light">
                  <Text size="sm">
                    <strong>Recomendación:</strong> Activa esta opción si
                    quieres que el email sea usado para verificar registros
                    previos. Los usuarios podrán ingresar su email para
                    verificar si ya están registrados en la organización o
                    evento.
                  </Text>
                </Alert>
              </>
            ) : (
              <>
                {/* Configuración Básica */}
                <Divider label="Configuración Básica" labelPosition="center" />

                <Select
                  label="Tipo de campo"
                  value={editingField.type}
                  onChange={(value) =>
                    setEditingField({
                      ...editingField,
                      type: value as FormFieldType,
                    })
                  }
                  data={FIELD_TYPES}
                  required
                />

                <TextInput
                  label="Etiqueta"
                  value={editingField.label}
                  onChange={(e) =>
                    setEditingField({
                      ...editingField,
                      label: e.currentTarget.value,
                    })
                  }
                  placeholder="Nombre del campo"
                  required
                />

                {editingField.type !== "checkbox" && (
                  <TextInput
                    label="Placeholder"
                    value={editingField.placeholder || ""}
                    onChange={(e) =>
                      setEditingField({
                        ...editingField,
                        placeholder: e.currentTarget.value,
                      })
                    }
                    placeholder="Texto de ayuda dentro del campo"
                  />
                )}

                <Textarea
                  label="Texto de ayuda"
                  description="Mensaje que aparece debajo del campo para guiar al usuario"
                  value={editingField.helpText || ""}
                  onChange={(e) =>
                    setEditingField({
                      ...editingField,
                      helpText: e.currentTarget.value,
                    })
                  }
                  placeholder="Ej: Si su cédula contiene letras, ingrese solo los números"
                  rows={2}
                />

                <Group grow>
                  <Switch
                    label="Campo requerido"
                    checked={editingField.required}
                    onChange={(e) =>
                      setEditingField({
                        ...editingField,
                        required: e.currentTarget.checked,
                      })
                    }
                  />
                  <Switch
                    label="Campo oculto"
                    description="No visible para el usuario"
                    checked={editingField.hidden || false}
                    onChange={(e) =>
                      setEditingField({
                        ...editingField,
                        hidden: e.currentTarget.checked,
                      })
                    }
                  />
                </Group>

                <Switch
                  label="Campo identificador"
                  description="Usar para búsqueda de registros existentes (ej: email, número de ID)"
                  checked={editingField.isIdentifier || false}
                  onChange={(e) =>
                    setEditingField({
                      ...editingField,
                      isIdentifier: e.currentTarget.checked,
                    })
                  }
                />

                {editingField.type !== "checkbox" && (
                  <TextInput
                    label="Valor por defecto"
                    description="Valor que se asigna automáticamente"
                    value={(editingField.defaultValue as string) || ""}
                    onChange={(e) =>
                      setEditingField({
                        ...editingField,
                        defaultValue: e.currentTarget.value,
                      })
                    }
                    placeholder="Ej: No aplica"
                  />
                )}

                {/* Opciones para Select */}
                {editingField.type === "select" && (
                  <>
                    <Divider
                      label="Opciones del Selector"
                      labelPosition="center"
                    />

                    {/* Solo permitir editar opciones manuales */}
                    {(!editingField.optionsSource ||
                      editingField.optionsSource === "manual") && (
                      <>
                        <Textarea
                          label="Opciones"
                          description="Formato: valor|etiqueta|valorPadre (uno por línea). El valorPadre es opcional para opciones en cascada."
                          value={
                            editingField.options
                              ?.map(
                                (o: {
                                  value: any;
                                  label: any;
                                  parentValue?: string;
                                }) =>
                                  `${o.value}|${o.label}${
                                    o.parentValue ? "|" + o.parentValue : ""
                                  }`
                              )
                              .join("\n") || ""
                          }
                          onChange={(e) => {
                            const lines = e.currentTarget.value.split("\n");
                            const options = lines
                              .filter((line) => line.trim())
                              .map((line) => {
                                const parts = line.split("|");
                                return {
                                  value: parts[0]?.trim() || "",
                                  label:
                                    parts[1]?.trim() || parts[0]?.trim() || "",
                                  parentValue: parts[2]?.trim() || undefined,
                                };
                              });
                            setEditingField({ ...editingField, options });
                          }}
                          placeholder="colombia|Colombia&#10;endocrinologia|Endocrinología|medicina-interna"
                          rows={6}
                        />

                        <Select
                          label="Depende de (campo padre)"
                          description="Si seleccionas un campo padre, este selector mostrará solo las opciones filtradas"
                          value={editingField.dependsOn || ""}
                          onChange={(value) =>
                            setEditingField({
                              ...editingField,
                              dependsOn: value || undefined,
                            })
                          }
                          data={[
                            { value: "", label: "-- Ninguno --" },
                            ...form.fields
                              .filter(
                                (f: { id: any; type: string }) =>
                                  f.id !== editingField.id &&
                                  f.type === "select"
                              )
                              .map((f: { id: any; label: any }) => ({
                                value: f.id,
                                label: f.label,
                              })),
                          ]}
                          clearable
                        />
                      </>
                    )}

                    {/* Selects con catálogo dinámico */}
                    {editingField.optionsSource &&
                      editingField.optionsSource !== "manual" && (
                        <>
                          <Alert color="blue" variant="light">
                            <Text size="sm">
                              Las opciones de este campo se generan
                              automáticamente a partir de catálogos de{" "}
                              {editingField.optionsSource === "countries" &&
                                "países"}
                              {editingField.optionsSource === "states" &&
                                "estados/departamentos"}
                              {editingField.optionsSource === "cities" &&
                                "ciudades"}
                              . No es necesario configurarlas manualmente.
                            </Text>
                          </Alert>

                          <Select
                            label="Depende de (campo padre)"
                            description="Para catálogos dinámicos, puedes hacer que este campo dependa de otro (ej: Estado depende de País)."
                            value={editingField.dependsOn || ""}
                            onChange={(value) =>
                              setEditingField({
                                ...editingField,
                                dependsOn: value || undefined,
                              })
                            }
                            data={[
                              { value: "", label: "-- Ninguno --" },
                              ...form.fields
                                .filter(
                                  (f: { id: any; type: string }) =>
                                    f.id !== editingField.id &&
                                    f.type === "select"
                                )
                                .map((f: { id: any; label: any }) => ({
                                  value: f.id,
                                  label: f.label,
                                })),
                            ]}
                            clearable
                          />
                        </>
                      )}
                  </>
                )}

                {/* Validaciones */}
                <Divider label="Validaciones" labelPosition="center" />

                {(editingField.type === "text" ||
                  editingField.type === "email" ||
                  editingField.type === "tel") && (
                  <>
                    <TextInput
                      label="Patrón RegEx"
                      description="Expresión regular para validar el formato (ej: ^[0-9]+$ para solo números)"
                      value={editingField.validation?.pattern || ""}
                      onChange={(e) =>
                        setEditingField({
                          ...editingField,
                          validation: {
                            ...editingField.validation,
                            pattern: e.currentTarget.value,
                          },
                        })
                      }
                      placeholder="^[a-zA-Z]+$"
                    />

                    <Group grow>
                      <NumberInput
                        label="Longitud mínima"
                        value={editingField.validation?.minLength}
                        onChange={(value) =>
                          setEditingField({
                            ...editingField,
                            validation: {
                              ...editingField.validation,
                              minLength: value as number,
                            },
                          })
                        }
                        min={0}
                      />
                      <NumberInput
                        label="Longitud máxima"
                        value={editingField.validation?.maxLength}
                        onChange={(value) =>
                          setEditingField({
                            ...editingField,
                            validation: {
                              ...editingField.validation,
                              maxLength: value as number,
                            },
                          })
                        }
                        min={0}
                      />
                    </Group>
                  </>
                )}

                {editingField.type === "number" && (
                  <Group grow>
                    <NumberInput
                      label="Valor mínimo"
                      value={editingField.validation?.min}
                      onChange={(value) =>
                        setEditingField({
                          ...editingField,
                          validation: {
                            ...editingField.validation,
                            min: value as number,
                          },
                        })
                      }
                    />
                    <NumberInput
                      label="Valor máximo"
                      value={editingField.validation?.max}
                      onChange={(value) =>
                        setEditingField({
                          ...editingField,
                          validation: {
                            ...editingField.validation,
                            max: value as number,
                          },
                        })
                      }
                    />
                  </Group>
                )}

                {/* Lógica Condicional */}
                <Divider
                  label="Lógica Condicional (Avanzado)"
                  labelPosition="center"
                />

                <Alert color="blue" variant="light">
                  <Text size="sm">
                    <strong>Mostrar/ocultar dinámicamente:</strong> Configura
                    cuándo debe aparecer este campo según el valor de otros
                    campos.
                  </Text>
                </Alert>

                <Select
                  label="Acción condicional"
                  description="¿Qué hacer cuando se cumplan las condiciones?"
                  value={editingField.conditionalLogic?.[0]?.action || ""}
                  onChange={(value) => {
                    if (!value) {
                      setEditingField({
                        ...editingField,
                        conditionalLogic: undefined,
                      });
                      return;
                    }

                    const existingConditions =
                      editingField.conditionalLogic?.[0]?.conditions || [];
                    const existingLogic =
                      editingField.conditionalLogic?.[0]?.logic || "and";

                    setEditingField({
                      ...editingField,
                      conditionalLogic: [
                        {
                          action: value as "show" | "hide",
                          conditions:
                            existingConditions.length > 0
                              ? existingConditions
                              : [
                                  {
                                    field: "",
                                    operator: "equals" as const,
                                    value: "",
                                  },
                                ],
                          logic: existingLogic,
                        },
                      ],
                    });
                  }}
                  data={[
                    { value: "", label: "-- Sin lógica condicional --" },
                    { value: "show", label: "Mostrar cuando..." },
                    { value: "hide", label: "Ocultar cuando..." },
                  ]}
                  clearable
                />

                {editingField.conditionalLogic &&
                  editingField.conditionalLogic.length > 0 && (
                    <>
                      <Select
                        label="Lógica de condiciones"
                        description="¿Cómo evaluar múltiples condiciones?"
                        value={editingField.conditionalLogic[0]?.logic || "and"}
                        onChange={(value) => {
                          if (!editingField.conditionalLogic) return;

                          setEditingField({
                            ...editingField,
                            conditionalLogic: [
                              {
                                ...editingField.conditionalLogic[0],
                                logic: value as "and" | "or",
                              },
                            ],
                          });
                        }}
                        data={[
                          {
                            value: "and",
                            label: "Y (todas las condiciones deben cumplirse)",
                          },
                          {
                            value: "or",
                            label: "O (al menos una condición debe cumplirse)",
                          },
                        ]}
                      />

                      <Stack gap="xs">
                        {editingField.conditionalLogic[0]?.conditions.map(
                          (condition, index: number) => (
                            <Paper key={index} p="md" withBorder>
                              <Stack gap="xs">
                                <Group justify="space-between">
                                  <Text size="sm" fw={500}>
                                    Condición {index + 1}
                                  </Text>
                                  {editingField.conditionalLogic![0].conditions
                                    .length > 1 && (
                                    <ActionIcon
                                      color="red"
                                      variant="subtle"
                                      onClick={() => {
                                        if (!editingField.conditionalLogic)
                                          return;
                                        const newConditions = [
                                          ...editingField.conditionalLogic[0]
                                            .conditions,
                                        ];
                                        newConditions.splice(index, 1);
                                        setEditingField({
                                          ...editingField,
                                          conditionalLogic: [
                                            {
                                              ...editingField
                                                .conditionalLogic[0],
                                              conditions: newConditions,
                                            },
                                          ],
                                        });
                                      }}
                                    >
                                      <IconTrash size={16} />
                                    </ActionIcon>
                                  )}
                                </Group>

                                <Select
                                  label="Campo a evaluar"
                                  description="¿Qué campo quieres comprobar?"
                                  value={condition.field || ""}
                                  onChange={(value) => {
                                    if (
                                      !value ||
                                      !editingField.conditionalLogic
                                    )
                                      return;
                                    const newConditions = [
                                      ...editingField.conditionalLogic[0]
                                        .conditions,
                                    ];
                                    newConditions[index] = {
                                      ...condition,
                                      field: value,
                                    };
                                    setEditingField({
                                      ...editingField,
                                      conditionalLogic: [
                                        {
                                          ...editingField.conditionalLogic[0],
                                          conditions: newConditions,
                                        },
                                      ],
                                    });
                                  }}
                                  data={form.fields
                                    .filter(
                                      (f: { id: any }) =>
                                        f.id !== editingField.id
                                    )
                                    .map((f: { id: any; label: any }) => ({
                                      value: f.id,
                                      label: f.label,
                                    }))}
                                />

                                <Group grow>
                                  <Select
                                    label="Operador"
                                    value={condition.operator || "equals"}
                                    onChange={(value) => {
                                      if (!editingField.conditionalLogic)
                                        return;
                                      const newConditions = [
                                        ...editingField.conditionalLogic[0]
                                          .conditions,
                                      ];
                                      newConditions[index] = {
                                        ...condition,
                                        operator: value as
                                          | "equals"
                                          | "notEquals",
                                      };
                                      setEditingField({
                                        ...editingField,
                                        conditionalLogic: [
                                          {
                                            ...editingField.conditionalLogic[0],
                                            conditions: newConditions,
                                          },
                                        ],
                                      });
                                    }}
                                    data={[
                                      { value: "equals", label: "Es igual a" },
                                      {
                                        value: "notEquals",
                                        label: "Es diferente de",
                                      },
                                    ]}
                                  />

                                  <TextInput
                                    label="Valor"
                                    description="Valor a comparar"
                                    value={
                                      typeof condition.value === "string"
                                        ? condition.value
                                        : String(condition.value ?? "")
                                    }
                                    onChange={(e) => {
                                      if (!editingField.conditionalLogic)
                                        return;
                                      const newValue = e.currentTarget.value;
                                      const newConditions = [
                                        ...editingField.conditionalLogic[0]
                                          .conditions,
                                      ];
                                      newConditions[index] = {
                                        ...condition,
                                        value: newValue,
                                      };
                                      setEditingField({
                                        ...editingField,
                                        conditionalLogic: [
                                          {
                                            ...editingField.conditionalLogic[0],
                                            conditions: newConditions,
                                          },
                                        ],
                                      });
                                    }}
                                    placeholder="Ej: CO, medico_especialista"
                                  />
                                </Group>
                              </Stack>
                            </Paper>
                          )
                        )}

                        <Button
                          variant="light"
                          leftSection={<IconPlus size={16} />}
                          onClick={() => {
                            if (!editingField.conditionalLogic) return;
                            setEditingField({
                              ...editingField,
                              conditionalLogic: [
                                {
                                  ...editingField.conditionalLogic[0],
                                  conditions: [
                                    ...editingField.conditionalLogic[0]
                                      .conditions,
                                    {
                                      field: "",
                                      operator: "equals" as const,
                                      value: "",
                                    },
                                  ],
                                },
                              ],
                            });
                          }}
                        >
                          Agregar condición
                        </Button>
                      </Stack>

                      <Alert color="cyan" variant="light">
                        <Text size="xs">
                          <strong>Ejemplo:</strong> Mostrar "Área de
                          especialidad" cuando "Perfil" es igual a
                          "medico_especialista" O "residente"
                        </Text>
                      </Alert>
                    </>
                  )}
              </>
            )}

            {/* Botones siempre visibles (fuera del condicional) */}
            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingField(null);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={saveField}>Guardar campo</Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Group justify="flex-end">
        <Button onClick={handleSave} loading={loading} size="lg">
          💾 Guardar todos los cambios
        </Button>
      </Group>
    </Stack>
  );
}
