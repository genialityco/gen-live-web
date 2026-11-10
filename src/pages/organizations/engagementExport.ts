// Exportación a Excel del análisis de permanencia, pensada para pasarla a una
// IA o a otra herramienta de análisis: hojas en formato "largo" (una fila por
// asistencia), un diccionario de columnas y la matriz personas × eventos.
import dayjs from "dayjs";
import "dayjs/locale/es";
import type {
  EngagementAttendee,
  EngagementData,
  EngagementEvent,
  EngagementKind,
  ExposureStatus,
  GreetingVisit,
} from "../../api/engagement";

export const STATUS_LABEL: Record<ExposureStatus, string> = {
  T: "Recibió mensajes",
  C: "Control sorteado",
  X: "Grupo excluido",
  N: "Sin mensajes personales",
  B: "Evento sin funciones",
};

export const KIND_LABEL: Record<EngagementKind, string> = {
  base: "Sin funciones",
  herd: "Anuncios",
  milestones: "Logros",
  both: "Anuncios + logros",
};

export type ExportRow = {
  attendee: EngagementAttendee;
  event: EngagementEvent;
  min: number;
  pct: number;
  untilEnd: boolean;
  status: ExposureStatus;
  greet: GreetingVisit | null;
};

type Options = {
  data: EngagementData;
  rows: ExportRow[];
  included: Set<string>;
  prefs: { excluded: string[]; asBase: string[] };
  anonymous: boolean;
  orgName?: string;
};

// Convierte el nombre de la org en un fragmento seguro para nombre de archivo
const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const r1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) =>
  xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
const day = (iso: string) => dayjs(iso).format("YYYY-MM-DD");
const NO_GROUP = "Sin grupo";

export async function exportEngagementExcel({
  data,
  rows,
  included,
  prefs,
  anonymous,
  orgName,
}: Options) {
  const XLSX = await import("xlsx");

  // Identificador por persona: código estable y, si no es anónimo, nombre y correo
  const codeOf = new Map<string, string>();
  data.attendees.forEach((a, i) =>
    codeOf.set(a.id, `A${String(i + 1).padStart(5, "0")}`)
  );
  const who = (a: EngagementAttendee): Record<string, string> =>
    anonymous
      ? { Asistente: codeOf.get(a.id)! }
      : {
          Asistente: codeOf.get(a.id)!,
          Nombre: a.name,
          Correo: a.email,
        };
  const eventCode = (e: EngagementEvent) =>
    `${day(e.date)} · ${e.title}`.slice(0, 120);

  // ── Eventos ────────────────────────────────────────────────────────────────
  const byEvent = new Map<string, ExportRow[]>();
  for (const r of rows) {
    const list = byEvent.get(r.event.id) ?? [];
    list.push(r);
    byEvent.set(r.event.id, list);
  }
  const eventsSheet = data.events.map((e) => {
    const list = byEvent.get(e.id) ?? [];
    const t = list.filter((r) => r.status === "T");
    const noT = list.filter((r) => r.status !== "T");
    const c = list.filter((r) => r.status === "C");
    const motivo = !e.hasPlayback || e.refMin <= 0
      ? "Sin datos de reproducción (anterior al 23-jun-2026)"
      : prefs.excluded.includes(e.id)
        ? "Excluido a mano"
        : "";
    return {
      Fecha: day(e.date),
      Evento: e.title,
      "Evento ID": e.id,
      Incluido: included.has(e.id) ? "Sí" : "No",
      "Motivo de exclusión": motivo,
      Funciones: KIND_LABEL[e.kind],
      "Tratado como sin funciones": prefs.asBase.includes(e.id) ? "Sí" : "No",
      "Anuncios de manada enviados": e.herd.announcements,
      "Control manada %": e.herd.holdoutPercent,
      "Logros configurados": e.milestones.items,
      "Logros otorgados": e.milestones.awards,
      "Logros mostrados": e.milestones.awardsShown,
      "Control logros %": e.milestones.holdoutPercent,
      "Saludo activado": e.greeting?.enabled ? "Sí" : "No",
      "Control saludo %": e.greeting?.holdoutPercent ?? 0,
      "Vieron botón de saludo (personas)": e.greeting?.withButton ?? 0,
      "Control sin botón (personas)": e.greeting?.noButton ?? 0,
      "Saludos enviados": e.greeting?.greets ?? 0,
      "Saludos devueltos": e.greeting?.replies ?? 0,
      "Prom. % del vivo · con botón": avg(
        list.filter((r) => r.greet?.[0] === 1).map((r) => r.pct)
      ),
      "Prom. % del vivo · control sin botón": avg(
        list.filter((r) => r.greet?.[0] === 0).map((r) => r.pct)
      ),
      "Espectadores en vivo": e.liveViewers,
      "Duración de referencia (min)": e.refMin,
      Finalizado: e.endedAt ? "Sí" : "No",
      "Asistencias analizadas": list.length,
      "Recibieron mensajes (n)": t.length,
      "No recibieron (n)": noT.length,
      "Control sorteado (n)": c.length,
      "Prom. % del vivo · recibieron": avg(t.map((r) => r.pct)),
      "Prom. % del vivo · no recibieron": avg(noT.map((r) => r.pct)),
      "Prom. % del vivo · control": avg(c.map((r) => r.pct)),
      "Prom. min · recibieron": avg(t.map((r) => r.min)),
      "Prom. min · no recibieron": avg(noT.map((r) => r.min)),
      "% hasta el final": e.endedAt && list.length
        ? r1((list.filter((r) => r.untilEnd).length / list.length) * 100)
        : null,
    };
  });

  // ── Asistencias (una fila por persona × evento incluido) ──────────────────
  const sortedRows = [...rows].sort(
    (a, b) =>
      a.event.date.localeCompare(b.event.date) ||
      (codeOf.get(a.attendee.id) ?? "").localeCompare(codeOf.get(b.attendee.id) ?? "")
  );
  const visitsSheet = sortedRows.map((r) => ({
    ...who(r.attendee),
    Grupo: r.attendee.group ?? NO_GROUP,
    "Fecha evento": day(r.event.date),
    Evento: r.event.title,
    "Evento ID": r.event.id,
    "Funciones del evento": prefs.asBase.includes(r.event.id)
      ? KIND_LABEL.base
      : KIND_LABEL[r.event.kind],
    "Estado (código)": r.status,
    Estado: STATUS_LABEL[r.status],
    "Recibió mensaje": r.status === "T" ? 1 : 0,
    "Minutos en vivo": r1(r.min),
    "% del vivo": r1(r.pct),
    "Duración de referencia (min)": r.event.refMin,
    "Se quedó hasta el final": r.event.endedAt ? (r.untilEnd ? 1 : 0) : null,
    "Botón de saludo": r.greet?.[0] ?? null,
    "Saludos enviados": r.greet?.[1] ?? 0,
    "Saludos que devolvió": r.greet?.[2] ?? 0,
    "Devoluciones recibidas": r.greet?.[3] ?? 0,
  }));

  // ── Asistentes (resumen por persona) ───────────────────────────────────────
  const byPerson = new Map<string, { a: EngagementAttendee; list: ExportRow[] }>();
  for (const r of rows) {
    const p = byPerson.get(r.attendee.id) ?? { a: r.attendee, list: [] };
    p.list.push(r);
    byPerson.set(r.attendee.id, p);
  }
  const peopleSheet = [...byPerson.values()]
    .sort((x, y) => y.list.length - x.list.length)
    .map(({ a, list }) => {
      const t = list.filter((r) => r.status === "T");
      const noT = list.filter((r) => r.status !== "T");
      const b = list.filter((r) => r.status === "B");
      const withV = avg(t.map((r) => r.pct));
      const withoutV = avg(noT.map((r) => r.pct));
      return {
        ...who(a),
        Grupo: a.group ?? NO_GROUP,
        "Eventos asistidos": list.length,
        "Eventos con mensaje": t.length,
        "Eventos sin mensaje": noT.length,
        "Eventos sin funciones": b.length,
        "Prom. % del vivo (todos)": avg(list.map((r) => r.pct)),
        "Prom. % del vivo · con mensaje": withV,
        "Prom. % del vivo · sin mensaje": withoutV,
        "Prom. % del vivo · eventos sin funciones": avg(b.map((r) => r.pct)),
        "Diferencia con − sin (pts)":
          withV !== null && withoutV !== null ? r1(withV - withoutV) : null,
        "Prom. minutos (todos)": avg(list.map((r) => r.min)),
        "Eventos con botón de saludo": list.filter((r) => r.greet?.[0] === 1).length,
        "Saludos enviados (total)": list.reduce((s, r) => s + (r.greet?.[1] ?? 0), 0),
        "Saludos que devolvió (total)": list.reduce((s, r) => s + (r.greet?.[2] ?? 0), 0),
        "Devoluciones recibidas (total)": list.reduce((s, r) => s + (r.greet?.[3] ?? 0), 0),
      };
    });

  // ── Matriz personas × eventos (% del vivo) ────────────────────────────────
  const gridEvents = data.events.filter((e) => included.has(e.id));
  const matrixSheet = [...byPerson.values()]
    .sort((x, y) => y.list.length - x.list.length)
    .map(({ a, list }) => {
      const cells = new Map(list.map((r) => [r.event.id, r]));
      const row: Record<string, string | number | null> = {
        ...who(a),
        Grupo: a.group ?? NO_GROUP,
      };
      for (const e of gridEvents) {
        const r = cells.get(e.id);
        row[eventCode(e)] = r
          ? `${r1(r.pct)}${r.status === "T" ? " ✉" : ""}${(r.greet?.[1] ?? 0) > 0 ? " 👋" : ""}`
          : null;
      }
      return row;
    });

  // ── Léeme: contexto y diccionario para quien analice ──────────────────────
  const readme: Array<[string, string]> = [
    ["Análisis de permanencia", `Exportado el ${dayjs().format("YYYY-MM-DD HH:mm")}`],
    ["Objetivo", "Medir si los anuncios de manada y los logros (mensajes) hacen que los asistentes se queden más tiempo en los eventos en vivo."],
    ["Métrica", "Tiempo de REPRODUCCIÓN en vivo: solo cuenta mientras el video se reproduce con el evento en vivo (no cuenta cuenta regresiva, pausas ni pestañas en segundo plano). Solo hay datos desde el 23-jun-2026."],
    ["% del vivo", "Minutos vistos / duración de referencia del evento × 100 (tope 100). La duración de referencia es el percentil 95 de lo que vieron los asistentes, para comparar eventos largos y cortos."],
    ["Hasta el final", "1 si su última señal fue a menos de 5 minutos del cierre del evento. Vacío si el evento no tiene hora de cierre."],
    ["Estado T", STATUS_LABEL.T + ": se le enviaron anuncios de manada o se le entregó un logro en privado."],
    ["Estado C", STATUS_LABEL.C + ": grupo de control elegido al azar; no recibió mensajes a propósito. Es la comparación más confiable contra T."],
    ["Estado X", STATUS_LABEL.X + ": su grupo de especialistas está excluido de los anuncios."],
    ["Estado N", STATUS_LABEL.N + ": el evento tuvo funciones, pero esta persona no tenía grupo/mensajes personales."],
    ["Estado B", STATUS_LABEL.B + ": el evento no tuvo anuncios ni logros (o el admin lo marcó como tal)."],
    ["Saludo entre colegas", "En los anuncios individuales de manada puede aparecer el botón «👋 Saludar»: el saludo lo ven los demás conectados del mismo grupo, que pueden devolverlo. Registro desde el 29-oct-2026."],
    ["Botón de saludo", "1 = vio el anuncio individual con el botón · 0 = grupo de control sorteado al azar que vio el anuncio SIN botón · vacío = no vio ningún anuncio individual en ese evento. Comparar 1 vs 0 mide el efecto del botón en la permanencia."],
    ["Saludos enviados / devueltos", "Cantidad de veces que la persona saludó, que devolvió un saludo de un colega y que le devolvieron sus saludos. No se registra quién recibe cada saludo (llega a todos los conectados del grupo)."],
    ["Grupo", "Grupo de especialistas del asistente según su registro en la organización."],
    ["Historial de mensajes", "El historial de anuncios y logros se guarda desde el 4-nov-2026; en eventos anteriores la clasificación T/C puede estar incompleta."],
    ["Hoja Eventos", "Una fila por evento con espectadores en vivo, incluido o no en el análisis, con sus totales."],
    ["Hoja Asistencias", "Una fila por asistente × evento incluido. Es la hoja principal para el análisis estadístico."],
    ["Hoja Asistentes", "Resumen por persona: promedios con y sin mensaje y su diferencia."],
    ["Hoja Matriz", "Personas × eventos con el % del vivo; ✉ indica que recibió mensaje y 👋 que saludó a colegas. Vacío = no asistió."],
    ["Anonimizado", anonymous ? "Sí: los asistentes solo se identifican con un código (A00001…)." : "No: incluye nombre y correo."],
    ["Eventos incluidos", String(included.size)],
    ["Asistencias", String(rows.length)],
  ];

  const wb = XLSX.utils.book_new();
  const add = (name: string, sheet: ReturnType<typeof XLSX.utils.json_to_sheet>) =>
    XLSX.utils.book_append_sheet(wb, sheet, name);
  const readmeSheet = XLSX.utils.aoa_to_sheet([["Campo", "Descripción"], ...readme]);
  readmeSheet["!cols"] = [{ wch: 24 }, { wch: 120 }];
  add("Léeme", readmeSheet);
  add("Eventos", XLSX.utils.json_to_sheet(eventsSheet));
  add("Asistencias", XLSX.utils.json_to_sheet(visitsSheet));
  add("Asistentes", XLSX.utils.json_to_sheet(peopleSheet));
  add("Matriz % del vivo", XLSX.utils.json_to_sheet(matrixSheet));

  XLSX.writeFile(
    wb,
    `analisis-permanencia-${orgName && slugify(orgName) ? `${slugify(orgName)}-` : ""}${dayjs().format("YYYY-MM-DD")}${anonymous ? "-anonimo" : ""}.xlsx`
  );
}
