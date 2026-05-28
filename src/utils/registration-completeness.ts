import type { FormField } from "../types";

/**
 * Devuelve true si el attendee debe completar su perfil antes de continuar.
 *
 * Casos que disparan el formulario:
 *  1. Campo required, no oculto, no autoCalculado y sin valor.
 *  2. Campo autoCalculated sin valor pero su dependsOn ya tiene valor
 *     (debió haberse calculado al registrarse, ej: codigo_pais sin pais actualizado).
 */
export function needsProfileUpdate(
  fields: FormField[],
  registrationData: Record<string, any> | undefined,
): boolean {
  const data = registrationData ?? {};

  for (const field of fields) {
    if (field.hidden) continue;

    const value = data[field.id];
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "");

    if (!isEmpty) continue;

    if (field.required && !field.autoCalculated) return true;

    if (field.autoCalculated && field.dependsOn) {
      const parentValue = data[field.dependsOn];
      const parentHasValue =
        parentValue !== undefined &&
        parentValue !== null &&
        parentValue !== "";
      if (parentHasValue) return true;
    }
  }

  return false;
}
