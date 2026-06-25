import { Stack, Group, Text, Progress, Tooltip, Badge } from "@mantine/core";
import { getCountryByCode } from "../../data/form-catalogs";

// ─── País: helpers de presentación ───────────────────────────────────────────

/** ISO2 → emoji de bandera (ej: 'CO' → 🇨🇴). Vacío si no es código de 2 letras. */
export function isoToFlag(iso: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso)) return "";
  return iso
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/** Nombre legible de un país a partir de su ISO2; cae al código si no se encuentra. */
export function countryName(iso: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso)) return iso;
  return getCountryByCode(iso.toUpperCase())?.name ?? iso;
}

export interface CountryRow {
  key: string;
  flag?: string; // opcional: emoji de bandera (no aplica para UTM)
  name: string;
  value: number; // métrica principal (count o uniqueClickers)
  secondary?: number; // métrica secundaria opcional (total clics)
}

/** Lista de barras por país, ordenada de mayor a menor, con color configurable. */
export function CountryBars({
  rows,
  color,
  unknown,
  unknownLabel = "Sin determinar",
  secondaryLabel = "Total clics",
}: {
  rows: CountryRow[];
  color: string;
  unknown?: number;
  unknownLabel?: string;
  secondaryLabel?: string;
}) {
  if (rows.length === 0 && !unknown) {
    return (
      <Text size="sm" c="dimmed">
        Sin datos todavía.
      </Text>
    );
  }
  const max = rows[0]?.value ?? 1;
  return (
    <Stack gap={6}>
      {rows.slice(0, 15).map((r) => (
        <div key={r.key}>
          <Group justify="space-between" mb={2}>
            <Text size="xs" truncate maw={220}>
              {r.flag && <Text span mr={6}>{r.flag}</Text>}
              {r.name}
            </Text>
            <Group gap={8}>
              <Text size="xs" fw={700} c={color}>
                {r.value.toLocaleString()}
              </Text>
              {r.secondary != null && (
                <Tooltip label={secondaryLabel}>
                  <Text size="xs" c="dimmed">({r.secondary.toLocaleString()})</Text>
                </Tooltip>
              )}
            </Group>
          </Group>
          <Progress value={(r.value / max) * 100} size="sm" color={color} radius="xl" />
        </div>
      ))}
      {rows.length > 15 && (
        <Text size="xs" c="dimmed">+{rows.length - 15} países más</Text>
      )}
      {!!unknown && unknown > 0 && (
        <Text size="xs" c="dimmed" mt={4}>
          {unknownLabel}: {unknown.toLocaleString()}
        </Text>
      )}
    </Stack>
  );
}

// ─── Comparativa envío vs clic (barras agrupadas + % conversión) ──────────────

export interface ComparisonRow {
  key: string;
  label: string;
  flag?: string;
  sent: number; // enviados (destinatarios)
  clicked: number; // interactuados (clickers únicos)
}

/**
 * Barras agrupadas que comparan, por cada categoría (UTM o país), los
 * destinatarios enviados vs los que hicieron clic, con su % de conversión.
 * Ordena de mayor a menor por enviados; ambas barras comparten escala.
 */
export function ConversionBars({
  rows,
  sentLabel = "Enviados",
  clickedLabel = "Clics",
  limit = 15,
  printAll = false,
}: {
  rows: ComparisonRow[];
  sentLabel?: string;
  clickedLabel?: string;
  limit?: number;
  /**
   * Si es true, las filas que exceden `limit` se renderizan igualmente pero
   * ocultas en pantalla (clase `bar-print-row`) para que aparezcan al imprimir
   * el PDF. Requiere que la página defina la regla CSS de impresión.
   */
  printAll?: boolean;
}) {
  const sorted = [...rows].sort((a, b) => b.sent - a.sent || b.clicked - a.clicked);
  if (sorted.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Sin datos todavía.
      </Text>
    );
  }
  // reduce en vez de Math.max(...spread): con miles de filas el spread de un
  // array grande desborda la pila ("Maximum call stack size exceeded").
  const max = sorted.reduce(
    (m, r) => Math.max(m, r.sent, r.clicked),
    1,
  );

  const renderRow = (r: ComparisonRow) => {
    const conv = r.sent > 0 ? (r.clicked / r.sent) * 100 : null;
    return (
      <div key={r.key}>
        <Group justify="space-between" mb={3} wrap="nowrap">
          <Text size="xs" truncate maw={180}>
            {r.flag && (
              <Text span mr={6}>
                {r.flag}
              </Text>
            )}
            {r.label}
          </Text>
          <Group gap={8} wrap="nowrap">
            <Tooltip label={sentLabel}>
              <Text size="xs" fw={700} c="grape">
                {r.sent.toLocaleString()}
              </Text>
            </Tooltip>
            <Text size="xs" c="dimmed">
              →
            </Text>
            <Tooltip label={clickedLabel}>
              <Text size="xs" fw={700} c="blue">
                {r.clicked.toLocaleString()}
              </Text>
            </Tooltip>
            <Badge
              size="xs"
              variant="light"
              color={conv == null ? "gray" : conv >= 1 ? "teal" : "yellow"}
            >
              {conv == null ? "—" : `${conv.toFixed(0)}%`}
            </Badge>
          </Group>
        </Group>
        <Stack gap={2}>
          <Tooltip label={`${sentLabel}: ${r.sent.toLocaleString()}`} position="right">
            <Progress value={(r.sent / max) * 100} size="sm" color="grape" radius="xl" />
          </Tooltip>
          <Tooltip label={`${clickedLabel}: ${r.clicked.toLocaleString()}`} position="right">
            <Progress value={(r.clicked / max) * 100} size="sm" color="blue" radius="xl" />
          </Tooltip>
        </Stack>
      </div>
    );
  };

  // Tope de filas renderizadas en el PDF: evita inyectar miles de nodos ocultos
  // (y un PDF inmanejable) cuando un campo tiene altísima cardinalidad.
  const PRINT_MAX_ROWS = 250;
  const visible = sorted.slice(0, limit);
  const overflow = printAll ? sorted.slice(limit, PRINT_MAX_ROWS) : [];
  // Filas que no se muestran en ningún lado (ni pantalla ni PDF).
  const moreCount = sorted.length - limit - overflow.length;
  return (
    <Stack gap={10}>
      {visible.map(renderRow)}
      {overflow.map((r) => (
        <div key={r.key} className="bar-print-row">
          {renderRow(r)}
        </div>
      ))}
      {moreCount > 0 && (
        <Text size="xs" c="dimmed">
          +{moreCount} más
        </Text>
      )}
      {/* En pantalla, avisa que hay filas extra que sí saldrán en el PDF. */}
      {printAll && overflow.length > 0 && (
        <Text size="xs" c="dimmed" className="no-print">
          ({overflow.length} más en el PDF)
        </Text>
      )}
    </Stack>
  );
}
