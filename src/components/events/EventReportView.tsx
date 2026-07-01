import { type ReactNode, useEffect, useRef } from "react";
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Grid,
  Button,
  Badge,
  Divider,
  SimpleGrid,
  SegmentedControl,
  CopyButton,
  Tooltip,
} from "@mantine/core";
import {
  IconMail,
  IconBrandWhatsapp,
  IconEye,
  IconRefresh,
  IconClock,
  IconUsers,
  IconPrinter,
  IconUserCheck,
  IconLink,
  IconCheck,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import {
  type EventReport,
  type RegistrationDistribution,
} from "../../api/event-report";
import { ConversionBars, isoToFlag, countryName } from "../common/CountryBars";

// Datos mínimos del evento/organización que el informe necesita para su
// cabecera. Tanto `EventItem` (admin) como la metadata del endpoint público
// satisfacen estas formas.
export interface ReportEventMeta {
  title: string;
  status?: string;
  schedule?: { startsAt?: string } | null;
  branding?: {
    header?: { backgroundImageUrl?: string };
    coverImageUrl?: string;
  } | null;
}

export interface ReportOrgMeta {
  name?: string | null;
  branding?: { logoUrl?: string | null } | null;
}

export type ReportMode = "general" | "detallado";

interface EventReportViewProps {
  report: EventReport;
  event: ReportEventMeta;
  org?: ReportOrgMeta | null;
  mode: ReportMode;
  onModeChange: (mode: ReportMode) => void;
  /** Si se provee, muestra el botón "Actualizar". */
  onRefresh?: () => void;
  /** Título de la cabecera en pantalla (no afecta al PDF). */
  screenTitle?: string;
  /** Si se provee, muestra un botón para copiar el enlace público compartible. */
  shareUrl?: string;
}

const DIST_TITLES: Record<RegistrationDistribution["key"], string> = {
  pais: "País",
  perfil: "Perfil",
  especialidad: "Especialidad",
  subespecialidad: "Subespecialidad",
};

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds < 0) return "0s";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Stack gap={2}>
      <Text size="xl" fw={700}>
        {value}
      </Text>
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
    </Stack>
  );
}

/** KPI grande y destacado para los indicadores clave de visualización. */
function BigStat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  color: string;
  icon: ReactNode;
}) {
  return (
    <Card withBorder radius="md" p="md">
      <Group gap="xs" mb={4}>
        {icon}
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {label}
        </Text>
      </Group>
      <Text className="big-stat-value" fz={28} fw={800} c={color}>
        {value}
      </Text>
    </Card>
  );
}

// CSS de impresión: oculta el chrome de la app (sidebar, botones de acción) y
// deja solo el contenido del informe, con un header propio (nombre + fecha) que
// solo aparece en el PDF. Técnica de visibility para ser robusta frente al
// layout que envuelve al componente.
const PRINT_CSS = `
/* Filas extra de las barras: ocultas en pantalla, visibles al imprimir. */
.print-only { display: none; }
.bar-print-row { display: none; }

@media print {
  /* Reescala todo el informe (Mantine usa rem) para que sea más compacto,
     ocupe menos ancho y no se extienda en tantas páginas. */
  html { font-size: 12px !important; }

  /* AISLAMIENTO DE IMPRESIÓN (sin position:absolute).
     El absolute rompía la paginación multipágina (contenido solapado/cortado).
     En su lugar, un efecto JS marca (en beforeprint) los hermanos fuera de la
     ruta del informe con [data-print-hidden] y colapsa los contenedores
     ancestros con [data-print-contents]. Así el informe queda en FLUJO NORMAL
     (el navegador pagina bien) y sin espacio en blanco arriba. */
  [data-print-hidden] { display: none !important; }
  [data-print-contents] {
    display: contents !important;
  }
  .event-report {
    box-sizing: border-box;
    /* El relleno reemplaza al margen de @page (que ponemos en 0) para que el
       navegador no dibuje su encabezado/pie con el título y la URL. */
    padding: 12mm 14mm;
    /* Conserva los colores de barras, badges y fondos en el PDF. */
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  /* Los KPIs grandes (px fijos) también se reducen para el PDF. */
  .event-report .big-stat-value { font-size: 20px !important; }
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .bar-print-row { display: block !important; }

  /* Tarjetas más limpias y sin cortes feos entre páginas. */
  .event-report .mantine-Card-root {
    break-inside: avoid;
    box-shadow: none !important;
    border-color: #dee2e6 !important;
  }
  /* Las tarjetas que pueden ser más altas que una página NO deben forzar
     break-inside:avoid: si no caben, el navegador las desborda y el contenido
     se solapa/corta entre páginas (bug visible en el texto explicativo). Se
     dejan fragmentar y se protegen sus bloques internos para cortes limpios. */
  .event-report .report-card-breakable { break-inside: auto !important; }
  .event-report .report-card-breakable .mantine-SimpleGrid-root {
    break-inside: avoid;
  }
  .event-report .report-legend { break-inside: avoid; }
  .report-print-header { break-after: avoid; break-inside: avoid; }
  .report-section { break-inside: avoid; }

  /* margin:0 → el navegador deja de imprimir su encabezado (título) y pie (URL). */
  @page { margin: 0; size: A4; }
}
`;

/**
 * Vista presentacional del informe del evento. No hace fetch ni gestiona el
 * estado de carga: recibe `report` ya resuelto. La usan tanto el panel de admin
 * (autenticado) como la página pública compartible.
 */
export default function EventReportView({
  report,
  event,
  org,
  mode,
  onModeChange,
  onRefresh,
  screenTitle,
  shareUrl,
}: EventReportViewProps) {
  const { email, whatsapp, viewing, registrations } = report;
  const detailed = mode === "detallado";

  // Aislamiento de impresión en FLUJO NORMAL (sin position:absolute, que rompía
  // la paginación y solapaba el contenido entre páginas). Antes de imprimir,
  // ocultamos los hermanos fuera de la ruta del informe y colapsamos sus
  // contenedores ancestros (display:contents); lo revertimos al terminar.
  const printCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const applyPrintIsolation = () => {
      if (printCleanupRef.current) return; // ya aplicado (idempotente)
      const report = document.querySelector<HTMLElement>(".event-report");
      if (!report) return;

      const hidden: HTMLElement[] = [];
      const collapsed: HTMLElement[] = [];

      let child: HTMLElement = report;
      let parent = report.parentElement;
      while (parent) {
        // Ocultar los hermanos que no forman parte de la ruta al informe
        for (const sib of Array.from(parent.children)) {
          if (sib !== child && sib instanceof HTMLElement) {
            sib.setAttribute("data-print-hidden", "");
            hidden.push(sib);
          }
        }
        // No colapsar <body>: es la caja de página. Los demás ancestros sí.
        if (parent === document.body) break;
        parent.setAttribute("data-print-contents", "");
        collapsed.push(parent);
        child = parent;
        parent = parent.parentElement;
      }

      printCleanupRef.current = () => {
        hidden.forEach((el) => el.removeAttribute("data-print-hidden"));
        collapsed.forEach((el) => el.removeAttribute("data-print-contents"));
      };
    };

    const revertPrintIsolation = () => {
      printCleanupRef.current?.();
      printCleanupRef.current = null;
    };

    window.addEventListener("beforeprint", applyPrintIsolation);
    window.addEventListener("afterprint", revertPrintIsolation);

    // Respaldo para navegadores que no disparan before/afterprint de forma fiable
    const mql = window.matchMedia("print");
    const onMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) applyPrintIsolation();
      else revertPrintIsolation();
    };
    mql.addEventListener?.("change", onMediaChange);

    return () => {
      window.removeEventListener("beforeprint", applyPrintIsolation);
      window.removeEventListener("afterprint", revertPrintIsolation);
      mql.removeEventListener?.("change", onMediaChange);
      revertPrintIsolation();
    };
  }, []);

  // Tasas derivadas (evita división por cero)
  const emailClickRate = email.totals.sent
    ? ((email.totals.clicked / email.totals.sent) * 100).toFixed(1)
    : "0.0";
  const waReadRate = whatsapp.totals.sent
    ? ((whatsapp.totals.read / whatsapp.totals.sent) * 100).toFixed(1)
    : "0.0";
  const waClickRate = whatsapp.totals.sent
    ? ((whatsapp.totals.clicked / whatsapp.totals.sent) * 100).toFixed(1)
    : "0.0";

  // Activos para el header de impresión
  const headerImageUrl =
    event.branding?.header?.backgroundImageUrl || event.branding?.coverImageUrl;
  const startsAt = event.schedule?.startsAt;
  const eventDateLabel = startsAt
    ? dayjs(startsAt).locale("es").format("D [de] MMMM [de] YYYY, HH:mm")
    : null;

  // Tasa global de asistencia (registrados que asistieron)
  const attendanceRate =
    registrations && registrations.total > 0
      ? Math.round((registrations.viewersTotal / registrations.total) * 100)
      : null;

  const defaultScreenTitle = detailed
    ? "Informe detallado del evento"
    : "Informe general del evento";

  return (
    <Stack gap="lg" className="event-report">
      <style>{PRINT_CSS}</style>

      {/* ─── Header SOLO para impresión / PDF ─── */}
      <div className="print-only report-print-header">
        {headerImageUrl && (
          <img
            src={headerImageUrl}
            alt={event.title}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              borderRadius: 8,
              marginBottom: 8,
            }}
          />
        )}
        <Text fz={11} tt="uppercase" fw={700} c="grape" style={{ letterSpacing: 1 }}>
          Informe del evento
        </Text>
        <Text fz={16} fw={700} style={{ lineHeight: 1.2 }}>
          {event.title}
        </Text>
        <Group gap={6} wrap="nowrap">
          {eventDateLabel && (
            <Text fz={11} c="dimmed">
              {eventDateLabel}
            </Text>
          )}
          {org?.name && (
            <Text fz={11} c="dimmed">
              · {org.name}
            </Text>
          )}
        </Group>
        <Text fz={9} c="dimmed" mt={2}>
          Generado {new Date(report.generatedAt).toLocaleString("es")}
        </Text>
        <Divider my="xs" />
      </div>

      {/* ─── Cabecera de pantalla (no se imprime) ─── */}
      <Group justify="space-between" align="center" className="no-print">
        <div>
          <Title order={3}>{screenTitle ?? defaultScreenTitle}</Title>
          <Text size="xs" c="dimmed">
            Generado {new Date(report.generatedAt).toLocaleString("es")}
          </Text>
        </div>
        <Group gap="sm">
          <SegmentedControl
            size="sm"
            value={mode}
            onChange={(v) => onModeChange(v as ReportMode)}
            data={[
              { label: "General", value: "general" },
              { label: "Detallado", value: "detallado" },
            ]}
          />
          {shareUrl && (
            <CopyButton value={shareUrl} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip
                  label={copied ? "¡Enlace copiado!" : "Copiar enlace público"}
                  withArrow
                >
                  <Button
                    leftSection={
                      copied ? <IconCheck size={16} /> : <IconLink size={16} />
                    }
                    onClick={copy}
                    variant="light"
                    color={copied ? "teal" : undefined}
                    size="sm"
                  >
                    {copied ? "Copiado" : "Enlace público"}
                  </Button>
                </Tooltip>
              )}
            </CopyButton>
          )}
          {onRefresh && (
            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={onRefresh}
              variant="light"
              size="sm"
            >
              Actualizar
            </Button>
          )}
          <Button
            leftSection={<IconPrinter size={16} />}
            onClick={() => window.print()}
            size="sm"
          >
            Imprimir PDF
          </Button>
        </Group>
      </Group>

      <Grid gutter="md">
        {/* ─── Email ─── */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="md" h="100%">
            <Group gap="xs" mb="md">
              <IconMail size={22} color="var(--mantine-color-blue-6)" />
              <Title order={4}>Email</Title>
              <Badge variant="light" color="blue">
                {email.campaignCount}{" "}
                {email.campaignCount === 1 ? "campaña" : "campañas"}
              </Badge>
            </Group>
            <SimpleGrid cols={3} spacing="sm">
              <Stat label="Enviados" value={email.totals.sent} />
              <Stat label="Clics únicos" value={email.totals.clicked} />
              <Stat label="CTR" value={`${emailClickRate}%`} />
              <Stat label="Clics totales" value={email.totals.totalClicks} />
              <Stat label="Rebotes" value={email.totals.bounced} />
              <Stat label="Fallidos" value={email.totals.failed} />
            </SimpleGrid>
          </Card>
        </Grid.Col>

        {/* ─── WhatsApp ─── */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="md" h="100%">
            <Group gap="xs" mb="md">
              <IconBrandWhatsapp size={22} color="var(--mantine-color-teal-6)" />
              <Title order={4}>WhatsApp</Title>
              <Badge variant="light" color="teal">
                {whatsapp.campaignCount}{" "}
                {whatsapp.campaignCount === 1 ? "campaña" : "campañas"}
              </Badge>
            </Group>
            <SimpleGrid cols={3} spacing="sm">
              <Stat label="Enviados" value={whatsapp.totals.sent} />
              <Stat label="Entregados" value={whatsapp.totals.delivered} />
              <Stat label="Leídos" value={`${whatsapp.totals.read} (${waReadRate}%)`} />
              <Stat label="Clics" value={`${whatsapp.totals.clicked} (${waClickRate}%)`} />
              <Stat label="Fallidos" value={whatsapp.totals.failed} />
              <Stat label="Bajas" value={whatsapp.totals.optedOut} />
            </SimpleGrid>
          </Card>
        </Grid.Col>

        {/* ─── Engagement / visualización ─── */}
        <Grid.Col span={12}>
          <Card withBorder radius="md" className="report-card-breakable">
            <Group gap="xs" mb="md">
              <IconEye size={22} color="var(--mantine-color-grape-6)" />
              <Title order={4}>Engagement y visualización</Title>
            </Group>

            {/* Indicadores clave, destacados aparte. */}
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
              <BigStat
                label="Registrados"
                value={registrations?.total ?? 0}
                color="teal"
                icon={<IconUserCheck size={18} color="var(--mantine-color-teal-6)" />}
              />
              <BigStat
                label="Espectadores únicos"
                value={viewing.uniqueViewers}
                color="grape"
                icon={<IconUsers size={18} color="var(--mantine-color-grape-6)" />}
              />
              <BigStat
                label="Vieron en vivo"
                value={viewing.liveViewers}
                color="red"
                icon={<IconEye size={18} color="var(--mantine-color-red-6)" />}
              />
              <BigStat
                label="Vieron en diferido"
                value={viewing.replayViewers}
                color="indigo"
                icon={<IconEye size={18} color="var(--mantine-color-indigo-6)" />}
              />
            </SimpleGrid>

            {/* En el informe detallado se añaden sesiones, pico concurrente y tiempos. */}
            {detailed && (
              <>
                <Divider my="md" />
                <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="lg">
                  <Stat label="Pico concurrente" value={viewing.peakConcurrentViewers} />
                  <Stat label="Sesiones totales" value={viewing.totalSessions} />
                  <Stack gap={2}>
                    <Group gap={4} wrap="nowrap">
                      <IconClock size={18} />
                      <Text size="xl" fw={700}>
                        {formatDuration(viewing.avgWatchTimeSeconds)}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" tt="uppercase">
                      Tiempo medio total / espectador
                    </Text>
                  </Stack>
                  <Stack gap={2}>
                    <Group gap={4} wrap="nowrap">
                      <IconClock size={18} />
                      <Text size="xl" fw={700}>
                        {formatDuration(viewing.avgLiveWatchTimeSeconds)}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" tt="uppercase">
                      Tiempo medio en vivo
                    </Text>
                  </Stack>
                  <Stack gap={2}>
                    <Group gap={4} wrap="nowrap">
                      <IconClock size={18} />
                      <Text size="xl" fw={700}>
                        {formatDuration(viewing.avgReplayWatchTimeSeconds)}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" tt="uppercase">
                      Tiempo medio en diferido
                    </Text>
                  </Stack>
                </SimpleGrid>
              </>
            )}

            <Divider my="md" />
            {detailed ? (
              <div className="report-legend">
                <Text size="xs" c="dimmed">
                  <b>Espectadores únicos</b> = personas distintas que se conectaron
                  (asistencia), reprodujeran o no. <b>Vieron en vivo</b> /{" "}
                  <b>en diferido</b> son quienes <b>reprodujeron de verdad</b> el
                  video durante el live o el replay (una misma persona puede estar en
                  ambos); pueden ser menos que los únicos, lo que revela cuántos
                  llegaron pero no llegaron a ver. Los <b>tiempos</b> miden{" "}
                  <b>reproducción real</b> (solo mientras el video se reproduce): no
                  cuentan la cuenta-regresiva, las pausas ni pestañas de fondo, y los
                  promedios se calculan sobre quienes reprodujeron cada tramo.{" "}
                  <b>Sesiones</b> cuenta conexiones por dispositivo/pestaña, mayor
                  cuando hay reconexiones o multidispositivo.
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  Tiempo total acumulado: {formatDuration(viewing.totalWatchTimeSeconds)}{" "}
                  (en vivo {formatDuration(viewing.totalLiveWatchTimeSeconds)} · diferido{" "}
                  {formatDuration(viewing.totalReplayWatchTimeSeconds)})
                  {(event.status === "live" || event.status === "replay") && (
                    <> · {viewing.currentConcurrentViewers} viendo ahora</>
                  )}
                </Text>
              </div>
            ) : (
              <Text size="xs" c="dimmed" className="report-legend">
                <b>Espectadores únicos</b> = personas distintas que se conectaron
                (asistencia). <b>Vieron en vivo</b> / <b>en diferido</b> son quienes
                reprodujeron de verdad el video. Cambia a <b>Detallado</b> para ver
                sesiones, pico concurrente y tiempos de reproducción.
              </Text>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      {/* ─── Comparativa: Registrados vs Asistieron, por segmento ─── */}
      {registrations && registrations.distributions.length > 0 && (
        <>
          <Divider />
          <Group gap="xs" align="center">
            <IconUserCheck size={22} color="var(--mantine-color-teal-6)" />
            <div>
              <Title order={4}>Registrados vs Asistieron</Title>
              <Text size="xs" c="dimmed">
                {registrations.total.toLocaleString()} registrados ·{" "}
                {registrations.viewersTotal.toLocaleString()} asistieron
                (espectadores únicos)
                {attendanceRate != null && (
                  <> · tasa de asistencia {attendanceRate}%</>
                )}
                . Comparativa por perfil, especialidad y subespecialidad.
              </Text>
            </div>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {registrations.distributions.map((d) => (
              <Card key={`cmp-${d.key}`} withBorder radius="md" p="sm">
                <Group justify="space-between" mb="sm">
                  <div>
                    <Text size="sm" fw={600}>
                      {DIST_TITLES[d.key]}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {d.fieldLabel}
                    </Text>
                  </div>
                  <Group gap={12}>
                    <Badge variant="light" color="grape" size="sm">
                      Registrados
                    </Badge>
                    <Badge variant="light" color="blue" size="sm">
                      Asistieron
                    </Badge>
                  </Group>
                </Group>
                <ConversionBars
                  sentLabel="Registrados"
                  clickedLabel="Asistieron"
                  printAll
                  rows={d.items.map((it) => ({
                    key: it.value,
                    flag: d.isCountry ? isoToFlag(it.value) : undefined,
                    label:
                      it.label ?? (d.isCountry ? countryName(it.value) : it.value),
                    sent: it.count,
                    clicked: it.viewers,
                  }))}
                />
              </Card>
            ))}
          </SimpleGrid>
        </>
      )}

      {detailed && (
        <Text size="xs" c="dimmed">
          Este informe yuxtapone el alcance de las campañas con la asistencia
          real. No correlaciona qué canal trajo a cada espectador (atribución por
          canal queda pendiente para una fase posterior).
        </Text>
      )}
    </Stack>
  );
}
