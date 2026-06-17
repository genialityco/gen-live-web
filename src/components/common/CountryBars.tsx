import { Stack, Group, Text, Progress, Tooltip } from "@mantine/core";
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
  flag: string;
  name: string;
  value: number; // métrica principal (count o uniqueClickers)
  secondary?: number; // métrica secundaria opcional (total clics)
}

/** Lista de barras por país, ordenada de mayor a menor, con color configurable. */
export function CountryBars({
  rows,
  color,
  unknown,
  unknownLabel,
}: {
  rows: CountryRow[];
  color: string;
  unknown?: number;
  unknownLabel: string;
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
              <Text span mr={6}>{r.flag}</Text>
              {r.name}
            </Text>
            <Group gap={8}>
              <Text size="xs" fw={700} c={color}>
                {r.value.toLocaleString()}
              </Text>
              {r.secondary != null && (
                <Tooltip label="Total clics">
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
