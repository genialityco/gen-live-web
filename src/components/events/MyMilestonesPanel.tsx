// src/components/events/MyMilestonesPanel.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Center,
  Group,
  Progress,
  RingProgress,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { MILESTONE_ATTENDEE_INFO, type MyMilestone } from "../../api/milestones";
import type { MyMilestonesShown } from "../../hooks/useMyMilestones";
import { trackEvent } from "../../lib/utmTracking";

// Re-render para el avance local de los minutos entre refrescos
const TICK_MS = 20_000;
const MINUTE_TYPES = new Set(["watchMinutes", "totalMinutes"]);
const FALLBACK_COLOR = "#228BE6";
const DARK_TEXT = "#111827";

/** "#abc" | "#aabbcc" | "rgb(r, g, b)" → [r, g, b]; null si no se reconoce */
function parseColor(c: string): [number, number, number] | null {
  const s = c.trim();
  const hex = s.match(/^#([\da-f]{3}|[\da-f]{6})([\da-f]{2})?$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((x) => x + x).join("") : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgb = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

/** Luminancia relativa (WCAG) de un color sRGB */
function luminance([r, g, b]: [number, number, number]) {
  const ch = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Texto blanco u oscuro, el que más contraste dé sobre `bg` */
function readableOn(bg: string) {
  const rgb = parseColor(bg);
  if (!rgb) return "#ffffff";
  const L = luminance(rgb);
  // Contraste contra blanco (1.05/(L+0.05)) vs. contra el oscuro (~L+0.05 / 0.0636)
  return 1.05 / (L + 0.05) >= (L + 0.05) / (luminance(parseColor(DARK_TEXT)!) + 0.05) ? "#ffffff" : DARK_TEXT;
}

/** Etiqueta de la pestaña con el contador de logros nuevos sin ver */
export function MyMilestonesTabLabel({ unseen, short }: { unseen: number; short?: boolean }) {
  return (
    <Group gap={6} wrap="nowrap" justify="center">
      <span>{short ? "🏆 Logros" : "🏆 Mis logros"}</span>
      {unseen > 0 && (
        <Badge size="xs" color="red" variant="filled" circle className="mm-pulse">
          {unseen}
        </Badge>
      )}
    </Group>
  );
}

type View = "all" | "done" | "todo";

/** Lista interactiva de hitos con el avance del asistente */
export function MyMilestonesPanel({
  eventId,
  data,
  fetchedAt,
  fresh,
  onCelebrated,
  height,
  color,
}: {
  eventId: string;
  data: MyMilestonesShown;
  fetchedAt: number;
  fresh: string[];
  onCelebrated: () => void;
  height: number | string;
  color?: string; // color principal del evento (branding)
}) {
  const [view, setView] = useState<View>("all");
  const [, setTick] = useState(0);
  // Color principal del evento; si no hay, el de los banners de logros
  const accent = color || data.accentColor || FALLBACK_COLOR;
  const fg = readableOn(accent);
  const light = fg !== "#ffffff";

  useEffect(() => {
    trackEvent("milestones_panel_open", { event_id: eventId });
  }, [eventId]);

  useEffect(() => {
    if (!data.live) return;
    const t = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(t);
  }, [data.live]);

  // Se celebra lo recién conseguido y se limpia al terminar la animación
  useEffect(() => {
    if (!fresh.length) return;
    const t = setTimeout(onCelebrated, 2_400);
    return () => clearTimeout(t);
  }, [fresh, onCelebrated]);

  // Avance de minutos estimado entre refrescos (el servidor manda al recargar)
  const elapsedMin = data.live ? Math.floor((Date.now() - fetchedAt) / 60_000) : 0;
  const items = useMemo(
    () =>
      data.items.map((i) => {
        if (i.achieved || i.progress === null || !MINUTE_TYPES.has(i.type)) return i;
        return { ...i, progress: Math.min(i.threshold, i.progress + elapsedMin) };
      }),
    [data.items, elapsedMin],
  );

  const done = items.filter((i) => i.achieved);
  const total = items.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;

  const ratio = (i: MyMilestone) => (i.achieved ? 1 : i.progress !== null ? i.progress / i.threshold : 0);
  const sorted = [...items].sort((a, b) => {
    if (a.achieved !== b.achieved) return a.achieved ? -1 : 1;
    if (a.achieved) return String(b.achievedAt ?? "").localeCompare(String(a.achievedAt ?? ""));
    return ratio(b) - ratio(a);
  });
  const list = sorted.filter((i) => (view === "done" ? i.achieved : view === "todo" ? !i.achieved : true));

  // El pendiente más cercano, para empujar al siguiente paso
  const next = items
    .filter((i) => !i.achieved && i.progress !== null && i.type !== "manual")
    .sort((a, b) => ratio(b) - ratio(a))[0];

  return (
    <Box style={{ height, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <MilestonesStyles />
      {/* Resumen */}
      <Box
        p="sm"
        style={{
          flexShrink: 0,
          borderRadius: 14,
          margin: 8,
          color: fg,
          // Degradado hacia el mismo lado del texto elegido: el contraste se mantiene
          background: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 78%, ${light ? "#fff" : "#000"}) 100%)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Group gap="sm" wrap="nowrap">
          <RingProgress
            size={74}
            thickness={7}
            roundCaps
            rootColor={light ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.25)"}
            sections={[{ value: pct, color: fg }]}
            label={
              <Text ta="center" fw={800} size="sm" c={fg}>
                {done.length}/{total}
              </Text>
            }
          />
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text fw={800} size="md" lh={1.2} c={fg}>
              {headline(done.length, total)}
            </Text>
            <Text size="xs" style={{ opacity: 0.9 }} lh={1.35} c={fg}>
              {next
                ? `Próximo: ${MILESTONE_ATTENDEE_INFO[next.type].title} — ${remaining(next)}`
                : done.length === total
                  ? "¡Completaste todos los logros del evento!"
                  : data.live
                    ? "Sigue participando para desbloquear más logros."
                    : "Los logros se desbloquean durante la transmisión en vivo."}
            </Text>
          </Stack>
        </Group>
      </Box>

      <Box px={8} pb={6} style={{ flexShrink: 0 }}>
        <SegmentedControl
          size="xs"
          fullWidth
          radius="xl"
          value={view}
          onChange={(v) => setView(v as View)}
          data={[
            { value: "all", label: `Todos (${total})` },
            { value: "done", label: `Logrados (${done.length})` },
            { value: "todo", label: `Por lograr (${total - done.length})` },
          ]}
        />
      </Box>

      <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto" offsetScrollbars>
        <Stack gap={8} px={8} pb={10}>
          {list.length === 0 ? (
            <Center py="lg">
              <Text size="sm" c="dimmed" ta="center">
                {view === "done" ? "Aún no tienes logros. ¡El primero está cerca!" : "¡No te queda ninguno por lograr!"}
              </Text>
            </Center>
          ) : (
            list.map((i) => (
              <MilestoneRow key={i.id} item={i} accent={accent} live={data.live} celebrate={fresh.includes(i.id)} />
            ))
          )}
        </Stack>
      </ScrollArea>
    </Box>
  );
}

function headline(done: number, total: number) {
  if (!done) return "¡Tus logros te esperan!";
  if (done === total) return "¡Leyenda del evento! 🏆";
  if (done / total >= 0.5) return "¡Vas excelente!";
  return "¡Buen comienzo!";
}

function remaining(i: MyMilestone) {
  const info = MILESTONE_ATTENDEE_INFO[i.type];
  const left = Math.max(0, i.threshold - (i.progress ?? 0));
  if (!left) return "¡a punto de lograrlo!";
  return `te ${left === 1 ? "falta" : "faltan"} ${left} ${info.unit ?? ""}`.trim();
}

const timeOf = (s: string | null) =>
  s ? new Date(s).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "";

function MilestoneRow({
  item,
  accent,
  live,
  celebrate,
}: {
  item: MyMilestone;
  accent: string;
  live: boolean;
  celebrate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const info = MILESTONE_ATTENDEE_INFO[item.type];
  const secret = item.type === "manual" && !item.achieved;
  const pct = item.achieved ? 100 : item.progress !== null ? Math.round((item.progress / item.threshold) * 100) : 0;
  const expandable = item.achieved && !!item.text;

  return (
    <UnstyledButton
      className={`mm-row${item.achieved ? " mm-done" : ""}${celebrate ? " mm-celebrate" : ""}`}
      onClick={() => expandable && setOpen((o) => !o)}
      style={{
        cursor: expandable ? "pointer" : "default",
        borderRadius: 12,
        padding: 10,
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${item.achieved ? `color-mix(in srgb, ${accent} 45%, transparent)` : "var(--mantine-color-gray-3)"}`,
        background: item.achieved
          ? `linear-gradient(135deg, color-mix(in srgb, ${accent} 12%, white) 0%, white 70%)`
          : "white",
      }}
      aria-expanded={expandable ? open : undefined}
    >
      {celebrate && <Confetti accent={accent} />}
      <Group gap={10} wrap="nowrap" align="flex-start">
        <Center
          className={item.achieved ? "mm-badge-on" : undefined}
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: "50%",
            fontSize: 22,
            background: item.achieved ? accent : "var(--mantine-color-gray-1)",
            boxShadow: item.achieved ? `0 0 0 3px color-mix(in srgb, ${accent} 25%, transparent)` : undefined,
            filter: item.achieved ? undefined : "grayscale(1)",
            opacity: item.achieved ? 1 : 0.7,
          }}
        >
          {secret ? "❔" : info.emoji}
        </Center>
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" gap={6} wrap="nowrap">
            <Text fw={700} size="sm" c="dark.8" truncate>
              {info.title}
            </Text>
            {item.achieved ? (
              <Badge size="xs" variant="filled" style={{ background: accent, color: readableOn(accent), flexShrink: 0 }}>
                ✓ {timeOf(item.achievedAt) || "Logrado"}
              </Badge>
            ) : (
              <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                🔒
              </Text>
            )}
          </Group>
          <Text size="xs" c="dimmed" lh={1.35}>
            {info.goal(item.threshold)}
          </Text>
          {!item.achieved && item.progress !== null && (
            <Group gap={8} wrap="nowrap" align="center">
              <Progress
                value={pct}
                size="sm"
                radius="xl"
                animated={live && pct > 0}
                striped={live && pct > 0}
                color={accent}
                style={{ flex: 1 }}
              />
              <Text size="xs" fw={600} c="dark.6" style={{ flexShrink: 0 }}>
                {item.progress}/{item.threshold}
                {info.unit ? ` ${info.unit}` : ""}
              </Text>
            </Group>
          )}
          {!item.achieved && item.progress === null && !secret && (
            <Text size="xs" c="dimmed" fs="italic">
              {live ? "¡Atento! Este reto se gana siendo rápido." : "Disponible durante el vivo."}
            </Text>
          )}
          {expandable && (
            <Text
              size="xs"
              fs="italic"
              c="dark.6"
              lh={1.4}
              lineClamp={open ? undefined : 1}
              style={{ transition: "all 200ms ease" }}
            >
              “{item.text}”
            </Text>
          )}
        </Stack>
      </Group>
    </UnstyledButton>
  );
}

/** Lluvia corta de confeti sobre la tarjeta recién conseguida */
function Confetti({ accent }: { accent: string }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 18 }, (_, n) => ({
        left: `${(n * 53) % 100}%`,
        delay: `${(n % 6) * 60}ms`,
        rot: `${(n * 47) % 360}deg`,
        color: [accent, "#FFC53D", "#40C057", "#FF6B6B", "#4DABF7"][n % 5],
      })),
    [accent],
  );
  return (
    <Box aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
      {pieces.map((p, n) => (
        <span
          key={n}
          className="mm-confetti"
          style={{ left: p.left, animationDelay: p.delay, background: p.color, rotate: p.rot }}
        />
      ))}
    </Box>
  );
}

function MilestonesStyles() {
  return (
    <style>{`
      .mm-row { transition: transform 160ms ease, box-shadow 160ms ease; }
      .mm-row:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
      .mm-done .mm-badge-on { animation: mm-glow 2.8s ease-in-out infinite; }
      .mm-celebrate { animation: mm-pop 700ms cubic-bezier(.2,1.4,.4,1); }
      .mm-confetti {
        position: absolute; top: -8px; width: 7px; height: 11px; border-radius: 2px;
        animation: mm-fall 1.6s ease-in forwards; opacity: 0;
      }
      .mm-pulse { animation: mm-beat 1.4s ease-in-out infinite; }
      @keyframes mm-pop { 0% { transform: scale(.94); } 60% { transform: scale(1.03); } 100% { transform: scale(1); } }
      @keyframes mm-glow { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.15); } }
      @keyframes mm-fall {
        0% { opacity: 1; transform: translateY(0) rotate(0); }
        100% { opacity: 0; transform: translateY(110px) rotate(540deg); }
      }
      @keyframes mm-beat { 0%,100% { transform: scale(1); } 50% { transform: scale(1.18); } }
      @media (prefers-reduced-motion: reduce) {
        .mm-row, .mm-done .mm-badge-on, .mm-celebrate, .mm-confetti, .mm-pulse { animation: none !important; transition: none !important; }
        .mm-confetti { display: none; }
      }
    `}</style>
  );
}
