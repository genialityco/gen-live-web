import type { FormField } from "../types";
import { getAllCountries } from "../data/form-catalogs";

/**
 * Normaliza el valor guardado de un campo `select` al `value` canónico de su
 * opción cuando lo que llega es la ETIQUETA en vez del value.
 *
 * Motivación: el select de país usa `isoCode` como value ("CO") y el nombre
 * como label ("Colombia"); los selects de negocio usan slugs como value y el
 * texto como label. Pero la importación por Excel y registros legacy a veces
 * guardan el texto visible ("Colombia", "Médico General"). Si ese texto no
 * coincide con ningún `value` de opción, el Select queda sin selección.
 *
 * Estado/ciudad usan el nombre como value (value === label), así que no
 * requieren conversión y se devuelven tal cual.
 *
 * Usado tanto en el prefill del formulario (para mostrar el valor) como en la
 * importación (para persistir el value correcto desde el inicio).
 */
export function normalizeSelectStoredValue(
  field: Pick<FormField, "type" | "id" | "options">,
  raw: string | number | boolean,
): string | number | boolean {
  if (field.type !== "select" || typeof raw !== "string" || raw.trim() === "")
    return raw;

  const value = raw.trim();
  const idLower = field.id.toLowerCase();
  const isCountryCode =
    idLower.includes("codigo") || idLower.includes("code");
  const isCountry =
    !isCountryCode &&
    (idLower.includes("pais") || idLower.includes("country"));

  // ---- País: nombre → isoCode ----
  if (isCountry) {
    if (/^[A-Za-z]{2}$/.test(value)) return value.toUpperCase(); // ya es ISO2
    const match = getAllCountries().find(
      (c) => c.name.toLowerCase() === value.toLowerCase(),
    );
    return match ? match.isoCode : value;
  }

  // ---- Selects de negocio: label → value ----
  const opts = field.options;
  if (opts && opts.length > 0) {
    if (opts.some((o) => o.value === value)) return value; // ya es un value
    const byLabel = opts.find((o) => (o.label ?? o.value) === value);
    if (byLabel) return byLabel.value;
  }

  return value;
}
