import { useMemo, useState } from "react";
import { Card, Group, Text, SegmentedControl, Center, Stack } from "@mantine/core";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";
import dayjs from "dayjs";
import "dayjs/locale/es";
import type { TimelineBucket } from "../../api/events";

export type Granularity = "week" | "day" | "hour" | "minute";

const GRAN_LABELS: Record<Granularity, string> = {
  week: "Semana",
  day: "Día",
  hour: "Hora",
  minute: "Minuto",
};

/** Inicio del bucket (en hora local) para una marca de tiempo y granularidad. */
function bucketStart(d: dayjs.Dayjs, g: Granularity): dayjs.Dayjs {
  switch (g) {
    case "minute":
      return d.startOf("minute");
    case "hour":
      return d.startOf("hour");
    case "day":
      return d.startOf("day");
    case "week": {
      // Semana que empieza el lunes (independiente del locale).
      const sd = d.startOf("day");
      return sd.subtract((sd.day() + 6) % 7, "day");
    }
  }
}

function bucketLabel(d: dayjs.Dayjs, g: Granularity): string {
  const es = d.locale("es");
  switch (g) {
    case "minute":
      return es.format("DD/MM HH:mm");
    case "hour":
      return es.format("DD/MM HH:00");
    case "day":
      return es.format("DD MMM");
    case "week":
      return `Sem. ${es.format("DD MMM")}`;
  }
}

interface TimelineChartProps {
  title: string;
  description?: string;
  points: TimelineBucket[];
  granularities: Granularity[];
  defaultGranularity: Granularity;
  color: string;
  /** Etiqueta de la métrica en el tooltip (ej: "inscripciones"). */
  metricLabel: string;
}

/**
 * Gráfica de barras de una serie temporal con selector de granularidad. Recibe
 * buckets por minuto y los reagrupa en la zona horaria local del navegador.
 */
export default function TimelineChart({
  title,
  description,
  points,
  granularities,
  defaultGranularity,
  color,
  metricLabel,
}: TimelineChartProps) {
  const [gran, setGran] = useState<Granularity>(defaultGranularity);

  const data = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of points) {
      const d = dayjs(p.t);
      if (!d.isValid()) continue;
      const key = bucketStart(d, gran).valueOf();
      map.set(key, (map.get(key) ?? 0) + p.c);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, c]) => ({ label: bucketLabel(dayjs(t), gran), c }));
  }, [points, gran]);

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start" mb="sm" wrap="nowrap">
        <div>
          <Text fw={600}>{title}</Text>
          {description && (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          )}
        </div>
        {granularities.length > 1 && (
          <SegmentedControl
            size="xs"
            value={gran}
            onChange={(v) => setGran(v as Granularity)}
            data={granularities.map((g) => ({
              label: GRAN_LABELS[g],
              value: g,
            }))}
          />
        )}
      </Group>

      {data.length === 0 ? (
        <Center h={240}>
          <Stack align="center" gap={4}>
            <Text size="sm" c="dimmed">
              Sin datos todavía.
            </Text>
          </Stack>
        </Center>
      ) : (
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={16}
                angle={-25}
                textAnchor="end"
                height={50}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
              <RTooltip
                formatter={(value: number) => [value, metricLabel]}
                labelStyle={{ fontSize: 12 }}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="c" fill={color} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
