import type { FormField } from "../types";

export type FormValues = Record<string, string | number | boolean>;

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
  values: FormValues,
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

// Determina si el campo se debe mostrar (hidden estático + conditionalLogic)
export function shouldShowField(field: FormField, values: FormValues): boolean {
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

/**
 * Visibilidad EFECTIVA de un campo: combina su propia lógica (`hidden` +
 * `conditionalLogic`) con la cadena `dependsOn` — un campo no es visible si su
 * padre no es visible o no tiene valor. Es la única fuente de verdad sobre qué
 * campos aplican a un usuario; tanto el formulario de registro como el chequeo
 * de completitud (`needsProfileUpdate`) deben usar ESTA función para no
 * exigir/limpiar campos de forma inconsistente.
 */
export function isFieldEffectivelyVisible(
  field: FormField,
  values: FormValues,
  allFields: FormField[],
): boolean {
  // 1. Si depende de otro campo, heredamos visibilidad y valor del padre
  if (field.dependsOn) {
    const parentField = allFields.find((f) => f.id === field.dependsOn);

    if (parentField) {
      const parentVisible = isFieldEffectivelyVisible(
        parentField,
        values,
        allFields,
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
