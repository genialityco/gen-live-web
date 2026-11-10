import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Group,
  Loader,
  Menu,
  Modal,
  Pagination,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IconDownload } from "@tabler/icons-react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import {
  fetchEngagementAnalysis,
  type EngagementAttendee,
  type EngagementData,
  type EngagementEvent,
  type ExposureStatus,
  type GreetingVisit,
} from "../../api/engagement";

import { exportEngagementExcel, KIND_LABEL, STATUS_LABEL } from "./engagementExport";

// ── Textos y colores ──────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ExposureStatus, string> = {
  T: "blue",
  C: "orange",
  X: "gray",
  N: "gray",
  B: "teal",
};
// Paleta categórica validada (slots 1 y 2)
const COLOR_WITH = "#2a78d6";
const COLOR_WITHOUT = "#eb6834";

const NO_GROUP = "Sin grupo";
const PAGE_SIZE = 25;
const GRID_PAGE_SIZE = 50;

// Primera columna fija al desplazar la cuadrícula horizontalmente
const stickyCell: CSSProperties = {
  position: "sticky",
  left: 0,
  zIndex: 1,
  background: "var(--mantine-color-body)",
};

const cellBackground = (s: ExposureStatus) =>
  s === "T"
    ? "var(--mantine-color-blue-1)"
    : s === "C"
      ? "var(--mantine-color-orange-1)"
      : undefined;
/** Texto del saludo entre colegas para el título de una celda */
const greetLabel = (g: GreetingVisit | null) => {
  if (!g) return "";
  const parts = [
    g[0] === 1 ? "vio el botón de saludo" : g[0] === 0 ? "control sin botón de saludo" : "",
    g[1] ? `saludó ${g[1]} vez/veces` : "",
    g[2] ? `devolvió ${g[2]} saludo(s)` : "",
    g[3] ? `le devolvieron ${g[3]} saludo(s)` : "",
  ].filter(Boolean);
  return parts.length ? ` · ${parts.join(" · ")}` : "";
};

const MIN_N = 10; // por debajo, la muestra no permite concluir

type Metric = "pct" | "min";

// ── Estadística ───────────────────────────────────────────────────────────────

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

const variance = (xs: number[]) => {
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
};

/** Distribución normal estándar (aprox. Abramowitz-Stegun) */
function normalCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Valor p bilateral de la diferencia de medias (Welch, aproximación normal) */
function welchP(a: number[], b: number[]): number | null {
  if (a.length < 2 || b.length < 2) return null;
  const se = Math.sqrt(variance(a) / a.length + variance(b) / b.length);
  if (!se) return null;
  return 2 * (1 - normalCdf(Math.abs((mean(a) - mean(b)) / se)));
}

/** Valor p bilateral de diferencias pareadas (misma persona, con vs. sin) */
function pairedP(diffs: number[]): number | null {
  if (diffs.length < 2) return null;
  const se = Math.sqrt(variance(diffs) / diffs.length);
  if (!se) return null;
  return 2 * (1 - normalCdf(Math.abs(mean(diffs) / se)));
}

function verdict(diff: number, p: number | null, nA: number, nB: number) {
  if (nA < MIN_N || nB < MIN_N)
    return { label: "Muestra pequeña", color: "gray" };
  if (p !== null && p < 0.05)
    return diff > 0
      ? { label: "Se quedan más", color: "green" }
      : { label: "Se quedan menos", color: "red" };
  return { label: "Sin diferencia clara", color: "yellow" };
}

const fmtP = (p: number | null) =>
  p === null ? "—" : p < 0.001 ? "< 0,001" : p.toFixed(3).replace(".", ",");

// ── Datos derivados ───────────────────────────────────────────────────────────

type Row = {
  attendee: EngagementAttendee;
  event: EngagementEvent;
  min: number;
  pct: number;
  untilEnd: boolean;
  status: ExposureStatus;
  greet: GreetingVisit | null;
};

const storageKey = (orgId: string) => `engagement-analysis:${orgId}`;

function loadPrefs(orgId: string): { excluded: string[]; asBase: string[] } {
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    if (raw) return JSON.parse(raw);
  } catch {
    // sin almacenamiento: valores por defecto
  }
  return { excluded: [], asBase: [] };
}

function savePrefs(orgId: string, prefs: { excluded: string[]; asBase: string[] }) {
  try {
    localStorage.setItem(storageKey(orgId), JSON.stringify(prefs));
  } catch {
    // ignorar
  }
}

// ── Componentes pequeños ──────────────────────────────────────────────────────

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card withBorder padding="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700} mt={4}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed" mt={2}>
          {hint}
        </Text>
      )}
    </Card>
  );
}

function StatusBadge({ s }: { s: ExposureStatus }) {
  return (
    <Badge color={STATUS_COLOR[s]} variant="light" size="sm">
      {STATUS_LABEL[s]}
    </Badge>
  );
}

// ── Vista ─────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  orgName?: string;
}

export default function AdminEngagementView({ orgId, orgName }: Props) {
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [metric, setMetric] = useState<Metric>("pct");
  const [prefs, setPrefs] = useState(() => loadPrefs(orgId));

  // Mismo grupo
  const [groupBaseline, setGroupBaseline] = useState<"C" | "noT" | "B">("noT");
  // Misma persona
  const [personBaseline, setPersonBaseline] = useState<"all" | "B">("all");
  const [personEvent, setPersonEvent] = useState<string | null>(null);
  const [personGroup, setPersonGroup] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"diff" | "-diff" | "name">("diff");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<EngagementAttendee | null>(null);
  // Cuadrícula
  const [gridFilter, setGridFilter] = useState<"all" | "T" | "noT">("all");
  const [gridGroup, setGridGroup] = useState<string | null>(null);
  const [gridSearch, setGridSearch] = useState("");
  const [gridPage, setGridPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchEngagementAnalysis(orgId)
      .then((d) => alive && setData(d))
      .catch((e) => {
        console.error("Error cargando el análisis de permanencia:", e);
        if (alive) setError("No se pudo cargar el análisis");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [orgId]);

  const updatePrefs = (next: typeof prefs) => {
    setPrefs(next);
    savePrefs(orgId, next);
  };

  const fmt = (v: number) =>
    metric === "pct" ? `${v.toFixed(1)} %` : `${v.toFixed(1)} min`;
  const fmtDiff = (v: number) =>
    `${v > 0 ? "+" : ""}${metric === "pct" ? `${v.toFixed(1)} pts` : `${v.toFixed(1)} min`}`;

  // Eventos utilizables: con reproducción registrada y no excluidos a mano
  const included = useMemo(() => {
    const set = new Set<string>();
    for (const e of data?.events ?? []) {
      if (e.hasPlayback && e.refMin > 0 && !prefs.excluded.includes(e.id)) set.add(e.id);
    }
    return set;
  }, [data, prefs.excluded]);

  // Todas las visitas (asistente × evento) de los eventos incluidos
  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const out: Row[] = [];
    for (const a of data.attendees) {
      for (const [idx, min, untilEnd, status, greet] of a.visits) {
        const event = data.events[idx];
        if (!event || !included.has(event.id)) continue;
        out.push({
          attendee: a,
          event,
          min,
          pct: Math.min(100, (min / event.refMin) * 100),
          untilEnd: untilEnd === 1,
          // Evento marcado a mano como "sin funciones"
          status: prefs.asBase.includes(event.id) ? "B" : status,
          greet: greet ?? null,
        });
      }
    }
    return out;
  }, [data, included, prefs.asBase]);

  const val = (r: Row) => (metric === "pct" ? r.pct : r.min);
  const groupOf = (a: EngagementAttendee) => a.group ?? NO_GROUP;

  // ── 1) Mismo grupo: recibieron vs. no recibieron ───────────────────────────
  const groupComparison = useMemo(() => {
    // Eventos donde alguien recibió mensajes: la comparación se hace dentro
    // de esos mismos eventos (salvo contra eventos sin funciones)
    const eventsWithT = new Set(rows.filter((r) => r.status === "T").map((r) => r.event.id));
    const isBaseline = (r: Row) =>
      groupBaseline === "B"
        ? r.status === "B"
        : eventsWithT.has(r.event.id) &&
          (groupBaseline === "C" ? r.status === "C" : r.status !== "T");

    const byGroup = new Map<string, { t: Row[]; c: Row[] }>();
    const all = { t: [] as Row[], c: [] as Row[] };
    for (const r of rows) {
      const side = r.status === "T" ? "t" : isBaseline(r) ? "c" : null;
      if (!side) continue;
      const g = groupOf(r.attendee);
      const entry = byGroup.get(g) ?? { t: [], c: [] };
      entry[side].push(r);
      byGroup.set(g, entry);
      all[side].push(r);
    }
    const summarize = (group: string, t: Row[], c: Row[]) => {
      const tv = t.map(val);
      const cv = c.map(val);
      const diff = mean(tv) - mean(cv);
      const p = welchP(tv, cv);
      return {
        group,
        nT: t.length,
        nC: c.length,
        meanT: mean(tv),
        meanC: mean(cv),
        untilEndT: t.length ? (t.filter((r) => r.untilEnd).length / t.length) * 100 : 0,
        untilEndC: c.length ? (c.filter((r) => r.untilEnd).length / c.length) * 100 : 0,
        diff,
        p,
        verdict: verdict(diff, p, t.length, c.length),
      };
    };
    const groups = [...byGroup.entries()]
      .map(([g, e]) => summarize(g, e.t, e.c))
      .filter((g) => g.nT > 0 || g.nC > 0)
      .sort((a, b) => b.nT + b.nC - (a.nT + a.nC));
    return { total: summarize("Todos los grupos", all.t, all.c), groups };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, groupBaseline, metric]);

  // ── 2) Misma persona: eventos con mensajes vs. sin mensajes ────────────────
  const eventsWithMessages = useMemo(() => {
    const ids = new Set(rows.filter((r) => r.status === "T").map((r) => r.event.id));
    return (data?.events ?? []).filter((e) => ids.has(e.id)).reverse();
  }, [rows, data]);

  const personComparison = useMemo(() => {
    const byPerson = new Map<string, { a: EngagementAttendee; t: Row[]; c: Row[] }>();
    for (const r of rows) {
      if (personGroup && groupOf(r.attendee) !== personGroup) continue;
      const isT = r.status === "T" && (!personEvent || r.event.id === personEvent);
      const isC =
        r.status !== "T" &&
        (personBaseline === "B" ? r.status === "B" : true) &&
        r.event.id !== personEvent;
      if (!isT && !isC) continue;
      const entry = byPerson.get(r.attendee.id) ?? { a: r.attendee, t: [], c: [] };
      (isT ? entry.t : entry.c).push(r);
      byPerson.set(r.attendee.id, entry);
    }
    const people = [...byPerson.values()]
      .filter((p) => p.t.length && p.c.length)
      .map((p) => {
        const withV = mean(p.t.map(val));
        const withoutV = mean(p.c.map(val));
        return {
          attendee: p.a,
          nT: p.t.length,
          nC: p.c.length,
          withV,
          withoutV,
          diff: withV - withoutV,
        };
      });
    const diffs = people.map((p) => p.diff);
    return {
      people,
      n: people.length,
      withV: mean(people.map((p) => p.withV)),
      withoutV: mean(people.map((p) => p.withoutV)),
      diff: mean(diffs),
      improved: people.length
        ? (people.filter((p) => p.diff > 0).length / people.length) * 100
        : 0,
      p: pairedP(diffs),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, personBaseline, personEvent, personGroup, metric]);

  const peopleShown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = personComparison.people.filter(
      (p) =>
        !q ||
        p.attendee.name.toLowerCase().includes(q) ||
        p.attendee.email.toLowerCase().includes(q)
    );
    list.sort((a, b) =>
      sort === "name"
        ? a.attendee.name.localeCompare(b.attendee.name, "es")
        : sort === "diff"
          ? b.diff - a.diff
          : a.diff - b.diff
    );
    return list;
  }, [personComparison, search, sort]);

  useEffect(() => setPage(1), [search, sort, personBaseline, personEvent, personGroup]);

  const groupOptions = useMemo(() => {
    const set = new Set((data?.attendees ?? []).map(groupOf));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [data]);

  // ── Cuadrícula: personas × eventos ─────────────────────────────────────────
  // Columnas: eventos incluidos, del más reciente al más viejo
  const gridEvents = useMemo(
    () => (data?.events ?? []).filter((e) => included.has(e.id)).reverse(),
    [data, included]
  );

  // Filas: personas, de quien más eventos asistió a quien menos
  const gridPeople = useMemo(() => {
    const byPerson = new Map<
      string,
      { attendee: EngagementAttendee; cells: Map<string, Row>; nT: number }
    >();
    for (const r of rows) {
      const p = byPerson.get(r.attendee.id) ?? {
        attendee: r.attendee,
        cells: new Map<string, Row>(),
        nT: 0,
      };
      p.cells.set(r.event.id, r);
      if (r.status === "T") p.nT++;
      byPerson.set(r.attendee.id, p);
    }
    const q = gridSearch.trim().toLowerCase();
    return [...byPerson.values()]
      .filter((p) =>
        gridFilter === "T" ? p.nT > 0 : gridFilter === "noT" ? p.nT === 0 : true
      )
      .filter((p) => !gridGroup || groupOf(p.attendee) === gridGroup)
      .filter(
        (p) =>
          !q ||
          p.attendee.name.toLowerCase().includes(q) ||
          p.attendee.email.toLowerCase().includes(q)
      )
      .sort(
        (a, b) =>
          b.cells.size - a.cells.size ||
          b.nT - a.nT ||
          a.attendee.name.localeCompare(b.attendee.name, "es")
      );
     
  }, [rows, gridFilter, gridGroup, gridSearch]);

  useEffect(() => setGridPage(1), [gridFilter, gridGroup, gridSearch]);

  // Promedio de colegas (mismo grupo) que NO recibieron mensajes en cada evento
  const peersWithout = useMemo(() => {
    const acc = new Map<string, number[]>();
    for (const r of rows) {
      if (r.status === "T") continue;
      const k = `${r.event.id}:${groupOf(r.attendee)}`;
      const list = acc.get(k) ?? [];
      list.push(val(r));
      acc.set(k, list);
    }
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, metric]);

  // ── Por evento ─────────────────────────────────────────────────────────────
  const eventStats = useMemo(() => {
    if (!data) return [];
    const byEvent = new Map<string, Row[]>();
    for (const r of rows) {
      const list = byEvent.get(r.event.id) ?? [];
      list.push(r);
      byEvent.set(r.event.id, list);
    }
    return [...data.events].reverse().map((e) => {
      const list = byEvent.get(e.id) ?? [];
      const t = list.filter((r) => r.status === "T");
      const c = list.filter((r) => r.status !== "T");
      return {
        event: e,
        n: list.length,
        nT: t.length,
        nC: list.filter((r) => r.status === "C").length,
        meanT: t.length ? mean(t.map(val)) : null,
        meanNoT: c.length ? mean(c.map(val)) : null,
        untilEnd: list.length
          ? (list.filter((r) => r.untilEnd).length / list.length) * 100
          : null,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, rows, metric]);

  if (loading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }
  if (error || !data) {
    return (
      <Alert color="red" title="Error">
        {error ?? "Sin datos"}
      </Alert>
    );
  }

  const noPlayback = data.events.filter((e) => !e.hasPlayback).length;
  const baselineLabel =
    groupBaseline === "C"
      ? "Control sorteado"
      : groupBaseline === "B"
        ? "Eventos sin funciones"
        : "No recibieron";
  const chartData = groupComparison.groups.slice(0, 12).map((g) => ({
    group: g.group,
    recibio: Math.round(g.meanT * 10) / 10,
    noRecibio: Math.round(g.meanC * 10) / 10,
    nT: g.nT,
    nC: g.nC,
  }));

  const detailRows = detail
    ? rows
        .filter((r) => r.attendee.id === detail.id)
        .sort((a, b) => b.event.date.localeCompare(a.event.date))
    : [];

  return (
    <Stack gap="lg">
      <div>
        <Title order={1}>Análisis de permanencia</Title>
        <Text c="dimmed" size="lg">
          ¿Los anuncios de manada y los logros hacen que la gente se quede más?
        </Text>
      </div>

      <Alert color="blue" variant="light" title="Cómo leer este análisis">
        <Text size="sm">
          La permanencia es el tiempo de <b>reproducción en vivo</b> (no cuenta
          cuenta regresiva, pausas ni pestañas de fondo). En <b>% del vivo</b>{" "}
          se compara contra la duración de referencia de cada evento, para que
          eventos largos y cortos sean comparables. La comparación más
          confiable es contra el <b>control sorteado</b>: es la única donde
          quien recibe o no los mensajes se decide al azar. El historial de
          anuncios y logros se guarda desde el 4 de noviembre de 2026.
          {noPlayback > 0 &&
            ` ${noPlayback} evento(s) anteriores al registro de reproducción no entran.`}
        </Text>
      </Alert>

      <Group justify="space-between" wrap="wrap">
        <SegmentedControl
          value={metric}
          onChange={(v) => setMetric(v as Metric)}
          data={[
            { value: "pct", label: "% del vivo" },
            { value: "min", label: "Minutos" },
          ]}
        />
        <Group gap="sm">
          <Text size="sm" c="dimmed">
            {included.size} evento(s) en el análisis · {rows.length} asistencias
          </Text>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconDownload size={16} />}
                loading={exporting}
                disabled={!rows.length}
              >
                Exportar Excel
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {[
                { anonymous: false, label: "Con nombre y correo" },
                { anonymous: true, label: "Anónimo (sin nombre ni correo)" },
              ].map((o) => (
                <Menu.Item
                  key={o.label}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      await exportEngagementExcel({
                        data,
                        rows,
                        included,
                        prefs,
                        anonymous: o.anonymous,
                        orgName,
                      });
                    } catch (e) {
                      console.error("Error exportando el análisis:", e);
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  {o.label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Tabs defaultValue="grid" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="grid">Personas × eventos</Tabs.Tab>
          <Tabs.Tab value="group">Mismo grupo</Tabs.Tab>
          <Tabs.Tab value="person">Misma persona</Tabs.Tab>
          <Tabs.Tab value="events">Eventos</Tabs.Tab>
        </Tabs.List>

        {/* ── Cuadrícula personas × eventos ────────────────────────────── */}
        <Tabs.Panel value="grid" pt="md">
          <Stack gap="md">
            <Group align="flex-end" wrap="wrap">
              <SegmentedControl
                value={gridFilter}
                onChange={(v) => setGridFilter(v as typeof gridFilter)}
                data={[
                  { value: "all", label: "Todas las personas" },
                  { value: "T", label: "Se les envió mensaje" },
                  { value: "noT", label: "Nunca se les envió" },
                ]}
              />
              <Select
                placeholder="Grupo: todos"
                clearable
                searchable
                w={220}
                value={gridGroup}
                onChange={setGridGroup}
                data={groupOptions}
              />
              <TextInput
                placeholder="Buscar por nombre o correo"
                value={gridSearch}
                onChange={(e) => setGridSearch(e.currentTarget.value)}
                w={260}
              />
              <Text size="sm" c="dimmed">
                {gridPeople.length} persona(s)
              </Text>
            </Group>

            <Group gap="md">
              <Group gap={6}>
                <Box w={14} h={14} style={{ borderRadius: 3, background: "var(--mantine-color-blue-1)" }} />
                <Text size="xs">✉ Se le envió mensaje</Text>
              </Group>
              <Group gap={6}>
                <Box w={14} h={14} style={{ borderRadius: 3, background: "var(--mantine-color-orange-1)" }} />
                <Text size="xs">Control sorteado (no se le envió, al azar)</Text>
              </Group>
              <Group gap={6}>
                <Box w={14} h={14} style={{ borderRadius: 3, border: "1px solid var(--mantine-color-gray-4)" }} />
                <Text size="xs">Sin mensaje</Text>
              </Group>
              <Text size="xs" c="dimmed">
                · vacío = no asistió · ✓ = se quedó hasta el final · 👋 = saludó a colegas
              </Text>
            </Group>

            <Table.ScrollContainer minWidth={300 + gridEvents.length * 96}>
              <Table withTableBorder withColumnBorders fz="xs" verticalSpacing={4}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={stickyCell} miw={220}>
                      Asistente
                    </Table.Th>
                    <Table.Th ta="center">Eventos</Table.Th>
                    <Table.Th ta="center">Con ✉</Table.Th>
                    {gridEvents.map((e) => (
                      <Table.Th key={e.id} ta="center" w={96} title={e.title}>
                        <Text size="xs" fw={700}>
                          {dayjs(e.date).locale("es").format("DD MMM YY")}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={2} fw={400}>
                          {e.title}
                        </Text>
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {gridPeople
                    .slice((gridPage - 1) * GRID_PAGE_SIZE, gridPage * GRID_PAGE_SIZE)
                    .map((p) => (
                      <Table.Tr key={p.attendee.id}>
                        <Table.Td
                          style={{ ...stickyCell, cursor: "pointer" }}
                          onClick={() => setDetail(p.attendee)}
                        >
                          <Text size="xs" fw={600} lineClamp={1}>
                            {p.attendee.name || "(sin nombre)"}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {groupOf(p.attendee)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="center" fw={700}>
                          {p.cells.size}
                        </Table.Td>
                        <Table.Td ta="center">{p.nT}</Table.Td>
                        {gridEvents.map((e) => {
                          const r = p.cells.get(e.id);
                          if (!r) return <Table.Td key={e.id} />;
                          return (
                            <Table.Td
                              key={e.id}
                              ta="center"
                              style={{ background: cellBackground(r.status) }}
                              title={`${STATUS_LABEL[r.status]} · ${r.min.toFixed(0)} min (${r.pct.toFixed(0)} % del vivo)${
                                r.event.endedAt ? (r.untilEnd ? " · se quedó hasta el final" : "") : ""
                              }${greetLabel(r.greet)}`}
                            >
                              <Text size="xs" fw={600} span>
                                {r.status === "T" && "✉ "}
                                {metric === "pct" ? `${r.pct.toFixed(0)} %` : `${r.min.toFixed(0)} min`}
                                {r.untilEnd && " ✓"}
                                {(r.greet?.[1] ?? 0) > 0 && " 👋"}
                              </Text>
                            </Table.Td>
                          );
                        })}
                      </Table.Tr>
                    ))}
                  {!gridPeople.length && (
                    <Table.Tr>
                      <Table.Td colSpan={3 + gridEvents.length}>
                        <Text c="dimmed" ta="center" py="md">
                          Nadie coincide con estos filtros
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {gridPeople.length > GRID_PAGE_SIZE && (
              <Pagination
                total={Math.ceil(gridPeople.length / GRID_PAGE_SIZE)}
                value={gridPage}
                onChange={setGridPage}
              />
            )}
            <Text size="xs" c="dimmed">
              Pasa el cursor sobre una celda para ver minutos, % del vivo y
              estado. Haz clic en un nombre para ver el detalle de la persona.
            </Text>
          </Stack>
        </Tabs.Panel>

        {/* ── 1) Mismo grupo ───────────────────────────────────────────── */}
        <Tabs.Panel value="group" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Dentro de cada grupo de especialistas, compara a quienes
              recibieron mensajes contra quienes no, en los mismos eventos.
            </Text>
            <Group>
              <Text size="sm" fw={500}>
                Comparar contra:
              </Text>
              <SegmentedControl
                size="xs"
                value={groupBaseline}
                onChange={(v) => setGroupBaseline(v as typeof groupBaseline)}
                data={[
                  { value: "noT", label: "Todos los que no recibieron" },
                  { value: "C", label: "Solo control sorteado" },
                  { value: "B", label: "Mismo grupo en eventos sin funciones" },
                ]}
              />
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
              <Kpi
                label="Recibieron mensajes"
                value={fmt(groupComparison.total.meanT)}
                hint={`${groupComparison.total.nT} asistencias`}
              />
              <Kpi
                label={baselineLabel}
                value={fmt(groupComparison.total.meanC)}
                hint={`${groupComparison.total.nC} asistencias`}
              />
              <Kpi
                label="Diferencia"
                value={fmtDiff(groupComparison.total.diff)}
                hint={`p = ${fmtP(groupComparison.total.p)}`}
              />
              <Card withBorder padding="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Conclusión
                </Text>
                <Badge mt={8} size="lg" color={groupComparison.total.verdict.color}>
                  {groupComparison.total.verdict.label}
                </Badge>
              </Card>
            </SimpleGrid>

            {chartData.length > 0 && (
              <Card withBorder padding="md">
                <Text fw={600} mb="xs">
                  Permanencia por grupo ({metric === "pct" ? "% del vivo" : "minutos"})
                </Text>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} barGap={2} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9ecef" />
                    <XAxis dataKey="group" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip
                      formatter={(v, name, item) => {
                        const p = item?.payload as (typeof chartData)[number];
                        const n = name === "Recibieron" ? p.nT : p.nC;
                        return [`${fmt(Number(v))} (${n})`, name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="recibio" name="Recibieron" fill={COLOR_WITH} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="noRecibio" name={baselineLabel} fill={COLOR_WITHOUT} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            <Table.ScrollContainer minWidth={760}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Grupo</Table.Th>
                    <Table.Th ta="right">Recibieron</Table.Th>
                    <Table.Th ta="right">{baselineLabel}</Table.Th>
                    <Table.Th ta="right">Diferencia</Table.Th>
                    <Table.Th ta="right">Hasta el final</Table.Th>
                    <Table.Th ta="right">p</Table.Th>
                    <Table.Th>Conclusión</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {[groupComparison.total, ...groupComparison.groups].map((g, i) => (
                    <Table.Tr key={g.group} fw={i === 0 ? 700 : undefined}>
                      <Table.Td>{g.group}</Table.Td>
                      <Table.Td ta="right">
                        {g.nT ? fmt(g.meanT) : "—"} <Text span size="xs" c="dimmed">({g.nT})</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        {g.nC ? fmt(g.meanC) : "—"} <Text span size="xs" c="dimmed">({g.nC})</Text>
                      </Table.Td>
                      <Table.Td ta="right">{g.nT && g.nC ? fmtDiff(g.diff) : "—"}</Table.Td>
                      <Table.Td ta="right">
                        {g.nT ? `${g.untilEndT.toFixed(0)} %` : "—"} vs {g.nC ? `${g.untilEndC.toFixed(0)} %` : "—"}
                      </Table.Td>
                      <Table.Td ta="right">{fmtP(g.p)}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={g.verdict.color}>
                          {g.verdict.label}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            <Text size="xs" c="dimmed">
              Entre paréntesis, el número de asistencias. p &lt; 0,05 indica que
              la diferencia difícilmente es casualidad. Con menos de {MIN_N}{" "}
              asistencias por lado no se saca conclusión.
            </Text>
          </Stack>
        </Tabs.Panel>

        {/* ── 2) Misma persona ─────────────────────────────────────────── */}
        <Tabs.Panel value="person" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Compara a cada persona consigo misma: su permanencia en eventos
              donde recibió mensajes contra sus eventos donde no los recibió.
              Así se descarta que la diferencia venga de quién es cada uno.
            </Text>
            <Group align="flex-end" wrap="wrap">
              <Select
                label="Evento con mensajes"
                placeholder="Todos"
                clearable
                w={280}
                value={personEvent}
                onChange={setPersonEvent}
                data={eventsWithMessages.map((e) => ({
                  value: e.id,
                  label: `${dayjs(e.date).locale("es").format("DD MMM YYYY")} · ${e.title}`,
                }))}
              />
              <Select
                label="Grupo"
                placeholder="Todos"
                clearable
                searchable
                w={220}
                value={personGroup}
                onChange={setPersonGroup}
                data={groupOptions}
              />
              <SegmentedControl
                size="xs"
                value={personBaseline}
                onChange={(v) => setPersonBaseline(v as typeof personBaseline)}
                data={[
                  { value: "all", label: "Contra todos sus eventos sin mensajes" },
                  { value: "B", label: "Solo eventos sin funciones" },
                ]}
              />
            </Group>

            <SimpleGrid cols={{ base: 2, md: 5 }}>
              <Kpi label="Personas" value={String(personComparison.n)} hint="con eventos de ambos tipos" />
              <Kpi label="Con mensajes" value={fmt(personComparison.withV)} />
              <Kpi label="Sin mensajes" value={fmt(personComparison.withoutV)} />
              <Kpi
                label="Diferencia media"
                value={fmtDiff(personComparison.diff)}
                hint={`p = ${fmtP(personComparison.p)}`}
              />
              <Kpi
                label="Se quedaron más"
                value={`${personComparison.improved.toFixed(0)} %`}
                hint="de las personas"
              />
            </SimpleGrid>
            <Group>
              <Text size="sm" fw={500}>
                Conclusión:
              </Text>
              {(() => {
                const v = verdict(
                  personComparison.diff,
                  personComparison.p,
                  personComparison.n,
                  personComparison.n
                );
                return <Badge color={v.color}>{v.label}</Badge>;
              })()}
            </Group>

            <Group align="flex-end">
              <TextInput
                placeholder="Buscar por nombre o correo"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                w={280}
              />
              <Select
                w={220}
                value={sort}
                onChange={(v) => setSort((v as typeof sort) ?? "diff")}
                data={[
                  { value: "diff", label: "Más mejoraron primero" },
                  { value: "-diff", label: "Más empeoraron primero" },
                  { value: "name", label: "Nombre" },
                ]}
              />
            </Group>

            <Table.ScrollContainer minWidth={700}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Asistente</Table.Th>
                    <Table.Th>Grupo</Table.Th>
                    <Table.Th ta="right">Con mensajes</Table.Th>
                    <Table.Th ta="right">Sin mensajes</Table.Th>
                    <Table.Th ta="right">Diferencia</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {peopleShown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => (
                    <Table.Tr
                      key={p.attendee.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => setDetail(p.attendee)}
                    >
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {p.attendee.name || "(sin nombre)"}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {p.attendee.email}
                        </Text>
                      </Table.Td>
                      <Table.Td>{groupOf(p.attendee)}</Table.Td>
                      <Table.Td ta="right">
                        {fmt(p.withV)} <Text span size="xs" c="dimmed">({p.nT})</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        {fmt(p.withoutV)} <Text span size="xs" c="dimmed">({p.nC})</Text>
                      </Table.Td>
                      <Table.Td ta="right" c={p.diff > 0 ? "green.8" : p.diff < 0 ? "red.8" : undefined}>
                        {fmtDiff(p.diff)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {!peopleShown.length && (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text c="dimmed" ta="center" py="md">
                          Nadie asistió a eventos con y sin mensajes con estos filtros
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {peopleShown.length > PAGE_SIZE && (
              <Pagination
                total={Math.ceil(peopleShown.length / PAGE_SIZE)}
                value={page}
                onChange={setPage}
              />
            )}
            <Text size="xs" c="dimmed">
              Haz clic en una persona para ver su recorrido evento por evento.
              Ojo: los eventos difieren en tema, día y ponentes, así que esta
              comparación es menos limpia que la del control sorteado.
            </Text>
          </Stack>
        </Tabs.Panel>

        {/* ── Eventos ──────────────────────────────────────────────────── */}
        <Tabs.Panel value="events" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Elige qué eventos entran al análisis. Si un evento tiene funciones
              configuradas pero se hizo sin ellas (se activaron después), márcalo
              como “sin funciones”.
            </Text>
            <Table.ScrollContainer minWidth={900}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Incluir</Table.Th>
                    <Table.Th>Fecha</Table.Th>
                    <Table.Th>Evento</Table.Th>
                    <Table.Th>Funciones</Table.Th>
                    <Table.Th ta="right">En vivo</Table.Th>
                    <Table.Th ta="right">Duración ref.</Table.Th>
                    <Table.Th ta="right">Recibieron</Table.Th>
                    <Table.Th ta="right">No recibieron</Table.Th>
                    <Table.Th ta="right">Hasta el final</Table.Th>
                    <Table.Th>Tratar como sin funciones</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {eventStats.map(({ event: e, ...s }) => {
                    const usable = e.hasPlayback && e.refMin > 0;
                    return (
                      <Table.Tr key={e.id} opacity={included.has(e.id) ? 1 : 0.5}>
                        <Table.Td>
                          <Tooltip
                            label="Sin datos de reproducción"
                            disabled={usable}
                          >
                            <Checkbox
                              disabled={!usable}
                              checked={included.has(e.id)}
                              onChange={(ev) =>
                                updatePrefs({
                                  ...prefs,
                                  excluded: ev.currentTarget.checked
                                    ? prefs.excluded.filter((id) => id !== e.id)
                                    : [...prefs.excluded, e.id],
                                })
                              }
                            />
                          </Tooltip>
                        </Table.Td>
                        <Table.Td>{dayjs(e.date).locale("es").format("DD MMM YYYY")}</Table.Td>
                        <Table.Td>{e.title}</Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={e.kind === "base" ? "gray" : "blue"}>
                            {KIND_LABEL[e.kind]}
                          </Badge>
                          {(e.herd.holdoutPercent > 0 || e.milestones.holdoutPercent > 0) && (
                            <Text size="xs" c="dimmed">
                              control {Math.max(e.herd.holdoutPercent, e.milestones.holdoutPercent)} %
                            </Text>
                          )}
                          {(e.greeting?.enabled || (e.greeting?.withButton ?? 0) > 0) && (
                            <Text size="xs" c="dimmed">
                              👋 {e.greeting?.greets} saludo(s) · {e.greeting?.replies} devuelto(s)
                              {(e.greeting?.holdoutPercent ?? 0) > 0 &&
                                ` · control ${e.greeting?.holdoutPercent} %`}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td ta="right">{e.liveViewers}</Table.Td>
                        <Table.Td ta="right">{usable ? `${e.refMin.toFixed(0)} min` : "—"}</Table.Td>
                        <Table.Td ta="right">
                          {s.meanT !== null ? fmt(s.meanT) : "—"}{" "}
                          <Text span size="xs" c="dimmed">({s.nT})</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          {s.meanNoT !== null ? fmt(s.meanNoT) : "—"}{" "}
                          <Text span size="xs" c="dimmed">({s.n - s.nT})</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          {s.untilEnd !== null && e.endedAt ? `${s.untilEnd.toFixed(0)} %` : "—"}
                        </Table.Td>
                        <Table.Td>
                          {e.kind !== "base" && (
                            <Switch
                              size="xs"
                              checked={prefs.asBase.includes(e.id)}
                              onChange={(ev) =>
                                updatePrefs({
                                  ...prefs,
                                  asBase: ev.currentTarget.checked
                                    ? [...prefs.asBase, e.id]
                                    : prefs.asBase.filter((id) => id !== e.id),
                                })
                              }
                            />
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* ── Detalle de una persona ─────────────────────────────────────── */}
      <Modal
        opened={!!detail}
        onClose={() => setDetail(null)}
        size="xl"
        title={
          detail && (
            <div>
              <Text fw={700}>{detail.name || "(sin nombre)"}</Text>
              <Text size="xs" c="dimmed">
                {detail.email} · {groupOf(detail)}
              </Text>
            </div>
          )
        }
      >
        <Table.ScrollContainer minWidth={640}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Fecha</Table.Th>
                <Table.Th>Evento</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th ta="right">Permanencia</Table.Th>
                <Table.Th ta="right">
                  <Tooltip label="Promedio de su mismo grupo que no recibió mensajes en ese evento">
                    <span>Colegas sin mensajes</span>
                  </Tooltip>
                </Table.Th>
                <Table.Th>Hasta el final</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {detailRows.map((r) => {
                const own = peersWithout.get(`${r.event.id}:${groupOf(r.attendee)}`) ?? [];
                return (
                  <Table.Tr key={r.event.id}>
                    <Table.Td>{dayjs(r.event.date).locale("es").format("DD MMM YYYY")}</Table.Td>
                    <Table.Td>{r.event.title}</Table.Td>
                    <Table.Td>
                      <StatusBadge s={r.status} />
                    </Table.Td>
                    <Table.Td ta="right">
                      {fmt(val(r))}
                      {metric === "pct" && (
                        <Text span size="xs" c="dimmed"> ({r.min.toFixed(0)} min)</Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="right">
                      {r.status === "T" && own.length ? (
                        <>
                          {fmt(mean(own))} <Text span size="xs" c="dimmed">({own.length})</Text>
                        </>
                      ) : (
                        "—"
                      )}
                    </Table.Td>
                    <Table.Td>{r.event.endedAt ? (r.untilEnd ? "Sí" : "No") : "—"}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Modal>
    </Stack>
  );
}
