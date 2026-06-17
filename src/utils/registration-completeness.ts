import type { FormField } from "../types";
import { isFieldEffectivelyVisible, type FormValues } from "./form-visibility";

/**
 * Devuelve true si el attendee debe completar su perfil antes de continuar.
 *
 * Solo se consideran campos EFECTIVAMENTE visibles para los datos actuales del
 * usuario (misma lógica que usa el formulario: `hidden` + `conditionalLogic` +
 * cadena `dependsOn`). Esto evita el loop de "actualiza tus datos" cuando un
 * campo `required` está oculto por conditionalLogic para ese perfil: el form lo
 * limpia a "" al guardar, así que jamás podría llenarse desde aquí.
 *
 * Casos que disparan el formulario (para un campo visible y vacío):
 *  1. Campo required (y no autoCalculado).
 *  2. Campo autoCalculated cuyo padre (`dependsOn`) ya tiene valor — debió
 *     haberse calculado al registrarse (ej: codigo_pais sin pais actualizado).
 */
export function needsProfileUpdate(
  fields: FormField[],
  registrationData: Record<string, any> | undefined,
): boolean {
  const data = (registrationData ?? {}) as FormValues;

  for (const field of fields) {
    // Solo exigimos lo que el usuario realmente puede ver y llenar
    if (!isFieldEffectivelyVisible(field, data, fields)) continue;

    const value = data[field.id];
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "");

    if (!isEmpty) continue;

    if (field.required && !field.autoCalculated) return true;

    if (field.autoCalculated && field.dependsOn) {
      // El padre tiene valor (garantizado por isFieldEffectivelyVisible), así
      // que este campo debió calcularse y no lo hizo.
      return true;
    }
  }

  return false;
}
