/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FormFieldType } from "../types"; // o desde donde lo tengas

export function normalizeIdentifierValue(
  raw: string,
  type: FormFieldType | undefined
): any {
  if (raw == null) return raw;
  const value = raw.trim();

  switch (type) {
    case "number": {
      const n = Number(value);
      if (Number.isNaN(n)) {
        return NaN; // luego validamos
      }
      return n;
    }
    case "checkbox": {
      const v = value.toLowerCase();
      if (["true", "1", "on", "sí", "si", "yes"].includes(v)) return true;
      if (["false", "0", "off", "no"].includes(v)) return false;
      return value;
    }
    // text / email / tel / textarea / select → string normal
    default:
      return value;
  }
}
