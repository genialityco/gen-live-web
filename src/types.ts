export type EventStatus = "upcoming" | "live" | "ended" | "replay";

// Form field types
export type FormFieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "select"
  | "checkbox"
  | "textarea";

export type OptionsSource = "manual" | "countries" | "states" | "cities";

export interface FormFieldOption {
  label: string;
  value: string;
  parentValue?: string; // Para opciones dependientes (cascada)
}

export interface ConditionalRule {
  field: string;
  operator: "equals" | "notEquals" | "contains" | "notContains";
  value: string | number | boolean;
}

export interface ConditionalLogic {
  action: "show" | "hide" | "enable" | "disable" | "require";
  conditions: ConditionalRule[];
  logic: "and" | "or"; // Cómo combinar múltiples condiciones
}

export interface FormField {
  id: string; // Identificador único del campo
  type: FormFieldType;
  label: string; // Etiqueta visible
  placeholder?: string;
  required: boolean;
  options?: FormFieldOption[]; // Para tipo 'select'

  optionsSource?: OptionsSource;
  countryCode?: string;

  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string; // Regex para validación personalizada
  };
  order: number; // Orden de aparición

  // Propiedades avanzadas
  helpText?: string; // Texto de ayuda que se muestra debajo del campo
  defaultValue?: string | number | boolean; // Valor por defecto
  hidden?: boolean; // Campo oculto
  autoCalculated?: boolean; // Se calcula automáticamente
  dependsOn?: string; // ID del campo padre (para cascada)
  conditionalLogic?: ConditionalLogic[]; // Reglas de visibilidad/habilitación
  isIdentifier?: boolean; // Campo usado para identificar registros únicos (evitar duplicados)
}

export interface RegistrationForm {
  enabled: boolean;
  title?: string;
  description?: string;
  fields: FormField[];
  submitButtonText?: string;
  successMessage?: string;
}
