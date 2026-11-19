/**
 * Parámetros UTM de las campañas de WhatsApp: filas del editor y conversión
 * al formato que guarda el backend. Lo usan el modal de campaña y las reglas
 * automáticas.
 */
import type { WaUtmParam } from "../../../api/wa-campaign";

// ─── UTM rows: texto fijo / variable del evento / campo del form ─────────────

export type UtmRowValue =
  | { mode: "field"; fieldKey: string }
  | { mode: "variable"; varKey: string }
  | { mode: "text"; text: string };

export interface UtmRow {
  id: number;
  name: string;
  val: UtmRowValue;
}

export const UTM_NAME_SUGGESTIONS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_perfil",
  "utm_especialidad",
  "utm_subespecialidad",
];

export const UTM_STATIC_PLACEHOLDERS: Record<string, string> = {
  utm_source: "whatsapp",
  utm_medium: "whatsapp_campaign",
  utm_campaign: "webinar-jun-2026",
  utm_content: "boton_recordatorio",
  utm_term: "cardiologia",
};

export const CONTEXT_VARIABLE_OPTIONS = [
  { value: "event.slug", label: "Slug del evento (ej. webinar-jun-2026)" },
  { value: "event.title", label: "Título del evento" },
  { value: "attendee.name", label: "Nombre del asistente" },
  { value: "attendee.email", label: "Email del asistente" },
];

let nextId = 1;
export const makeRow = (): UtmRow => ({
  id: nextId++,
  name: "",
  val: { mode: "text", text: "" },
});

export const DEFAULT_UTM_ROWS: UtmRow[] = [
  { id: nextId++, name: "utm_source",        val: { mode: "text",     text: "whatsapp" } },
  { id: nextId++, name: "utm_medium",        val: { mode: "text",     text: "whatsapp_campaign" } },
  { id: nextId++, name: "utm_campaign",      val: { mode: "variable", varKey: "event.slug" } },
  { id: nextId++, name: "utm_perfil",        val: { mode: "field",    fieldKey: "form.field_1764364059930" } },
  { id: nextId++, name: "utm_especialidad",  val: { mode: "field",    fieldKey: "form.field_1764364185864" } },
  { id: nextId++, name: "utm_subespecialidad", val: { mode: "field",  fieldKey: "form.field_1764364257048" } },
];

export function buildUtmParams(rows: UtmRow[]): WaUtmParam[] | undefined {
  const result: WaUtmParam[] = rows
    .filter((r) => {
      if (!r.name.trim()) return false;
      if (r.val.mode === "text")     return r.val.text.trim().length > 0;
      if (r.val.mode === "variable") return r.val.varKey.length > 0;
      return r.val.fieldKey.length > 0;
    })
    .map((r) => ({
      name: r.name.trim(),
      value:
        r.val.mode === "field"    ? r.val.fieldKey :
        r.val.mode === "variable" ? r.val.varKey   :
        r.val.text.trim(),
    }));
  return result.length > 0 ? result : undefined;
}

/** Filas del editor a partir de los UTM guardados (para editar una regla) */
export function rowsFromUtmParams(params: WaUtmParam[] | null | undefined): UtmRow[] {
  const variables = new Set(CONTEXT_VARIABLE_OPTIONS.map((o) => o.value));
  return (params ?? []).map((p) => ({
    id: nextId++,
    name: p.name,
    val: p.value.startsWith("form.")
      ? { mode: "field", fieldKey: p.value }
      : variables.has(p.value)
        ? { mode: "variable", varKey: p.value }
        : { mode: "text", text: p.value },
  }));
}

/**
 * UTM sugeridos según el formulario de la organización: fuente, medio y
 * campaña fijos, más perfil y especialidad si el formulario tiene esos campos.
 */
export function defaultUtmRowsFor(formFields: { key: string; label: string }[]): UtmRow[] {
  const find = (re: RegExp) => formFields.find((f) => re.test(f.label))?.key;
  const rows: UtmRow[] = [
    { id: nextId++, name: "utm_source", val: { mode: "text", text: "whatsapp" } },
    { id: nextId++, name: "utm_medium", val: { mode: "text", text: "whatsapp_campaign" } },
    { id: nextId++, name: "utm_campaign", val: { mode: "variable", varKey: "event.slug" } },
  ];
  const fields: [string, string | undefined][] = [
    ["utm_perfil", find(/^perfil/i)],
    ["utm_especialidad", find(/^área de especialidad/i)],
    ["utm_subespecialidad", find(/^especialidad\/sub/i)],
  ];
  for (const [name, key] of fields) {
    if (key) rows.push({ id: nextId++, name, val: { mode: "field", fieldKey: key } });
  }
  return rows;
}
