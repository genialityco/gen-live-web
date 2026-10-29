// src/components/events/HerdOverlay.tsx
import { useEffect, useRef, useState } from "react";
import { Button, CloseButton, Group, Paper, Stack, Text } from "@mantine/core";
import { getServerNow, type BannerState } from "../../api/live-stage-service";
import {
  DEFAULT_HERD_GREETING,
  DEFAULT_HERD_PRIVATE,
  DEFAULT_HERD_PUBLIC,
  findOwnHerdGroup,
  herdBannerStyle,
  herdOrdinal,
  renderHerdTemplate,
  replyHerdGreeting,
  reportHerdImpression,
  sendHerdGreeting,
  subscribeHerdConfig,
  subscribeHerdGreetings,
  subscribeHerdGreetReplies,
  subscribeHerdCounts,
  subscribeHerdMember,
  subscribeHerdPrivateTrigger,
  subscribeHerdPublic,
  type HerdCounts,
  type HerdGreetingSource,
  type HerdGroupRef,
  type HerdLiveConfig,
  type HerdMember,
  type HerdMessageConfig,
} from "../../api/herd";
import { AnnouncementBanner } from "../studio/AnnouncementBanner";
import { EXIT_MS } from "../studio/announcement-templates";
import { trackEvent } from "../../lib/utmTracking";

// Espera tras entrar antes del mensaje privado: el backend agrupa la presencia
// en ventanas de 2-5 s, así el conteo ya incluye a quien acaba de llegar.
const PRIVATE_DELAY_MS = 6000;
// La bienvenida espera hasta ~9 s más a que el backend publique el grupo y el
// orden de llegada ("eres la primera…"); si no llega, sale la genérica.
const MEMBER_RETRY_MS = 3000;
const MEMBER_MAX_RETRIES = 3;

// Inscritos de ejemplo para la demo cuando el backend aún no los publica
const DEMO_REGISTERED = 50;
const DEMO_REGISTERED_TOTAL = 300;

const DEMO_GROUP = { key: "_demo", label: "endocrinólogos", singular: "endocrinólogo" };

/** Momento del último privado mostrado en esta sesión del navegador (null = nunca) */
function readLastPrivate(key: string): number | null {
  try {
    const v = sessionStorage.getItem(key);
    // Versiones anteriores guardaban "1": cuenta como ya visto hace tiempo
    return v ? Number(v) || 0 : null;
  } catch {
    return null;
  }
}

function writeLastPrivate(key: string, at: number) {
  try {
    sessionStorage.setItem(key, String(at));
  } catch {
    /* sin storage: se muestra igual */
  }
}

// greeting: saludos recibidos / devueltos entre colegas del mismo grupo
type Kind = "private" | "public" | "greeting";
const KINDS: Kind[] = ["private", "public", "greeting"];

// Tras saludar o devolver, el mensaje de confirmación se queda este tiempo
const CONFIRM_MS = 3500;

/**
 * Un banner por tipo de mensaje. Si dos tipos comparten posición, el que
 * llega después espera a que salga el otro para no encimarse. `show` devuelve
 * el id del banner (su publishedAt) para editarlo luego con `edit` sin
 * reanimarlo (p. ej. «👋 Saludar» → «Saludaste a 12 colegas»).
 */
function useHerdBanners() {
  const [banners, setBanners] = useState<Record<Kind, BannerState | null>>({
    private: null,
    public: null,
    greeting: null,
  });
  const busy = useRef<Record<Kind, { slot: string; until: number } | null>>({
    private: null,
    public: null,
    greeting: null,
  });
  // Solo el último ocultamiento programado de cada tipo cuenta (edit lo alarga)
  const hideToken = useRef<Record<Kind, number>>({ private: 0, public: 0, greeting: 0 });
  const seq = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const hideLater = (kind: Kind, id: number, ms: number) => {
    const token = ++hideToken.current[kind];
    busy.current[kind] = { slot: busy.current[kind]?.slot ?? "", until: Date.now() + ms };
    timers.current.push(
      setTimeout(() => {
        if (hideToken.current[kind] !== token) return;
        // AnnouncementBanner anima la salida al recibir null
        setBanners((b) => (b[kind]?.publishedAt === id ? { ...b, [kind]: null } : b));
      }, ms),
    );
  };

  const show = (
    kind: Kind,
    text: string,
    msg: HerdMessageConfig,
    durationSec: number,
    accent?: string,
    action?: BannerState["action"],
  ) => {
    const slot = msg.position ?? "";
    const now = Date.now();
    const wait = Math.max(
      0,
      ...KINDS.filter((k) => k !== kind).map((k) => {
        const other = busy.current[k];
        return other && other.slot === slot && other.until > now ? other.until - now + EXIT_MS : 0;
      }),
    );
    // Clave única: cada mensaje entra con su animación aunque el texto se repita
    const id = now * 1000 + (seq.current++ % 1000);

    const start = () => {
      const ms = Math.max(2, durationSec) * 1000;
      const banner: BannerState = {
        visible: true,
        text,
        label: msg.label?.trim() || null,
        style: herdBannerStyle(msg, accent),
        publishedAt: id,
        action: action ?? null,
      };
      busy.current[kind] = { slot, until: Date.now() + ms };
      setBanners((b) => ({ ...b, [kind]: banner }));
      hideLater(kind, id, ms);
    };

    if (wait) timers.current.push(setTimeout(start, wait));
    else start();
    return id;
  };

  /** Cambia texto/botón del banner `id` si sigue en pantalla; `keepMs` lo deja ese tiempo más */
  const edit = (kind: Kind, id: number, patch: Partial<BannerState>, keepMs?: number) => {
    setBanners((b) => (b[kind]?.publishedAt === id ? { ...b, [kind]: { ...b[kind]!, ...patch } } : b));
    if (keepMs) hideLater(kind, id, keepMs);
  };

  /** ¿El banner `id` de este tipo sigue en pantalla? */
  const isShowing = (kind: Kind, id: number | null) =>
    id !== null && (busy.current[kind]?.until ?? 0) > Date.now() && bannersRef.current[kind]?.publishedAt === id;
  const bannersRef = useRef(banners);
  bannersRef.current = banners;

  return { banners, show, edit, isShowing };
}

/** "Ana" · "Ana y Carlos" · "Ana, Carlos y Laura" · "Ana, Carlos y 3 colegas más" */
function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} y ${names[2]}`;
  return `${names[0]}, ${names[1]} y ${names.length - 2} colegas más`;
}

/**
 * Anuncios de manada sobre el reproductor del asistente:
 * - individual (privateMessage): al llegar, "¡Hola Ana! Contigo ya son 34 endocrinólogos conectados" (solo él/ella)
 * - grupal (publicMessage): cuando crece un grupo, "¡Ya son 35 endocrinólogos conectados!" (todos)
 * Se pintan con el mismo banner de los anuncios del estudio.
 */
export function HerdOverlay({
  eventId,
  enabled,
  uid,
  registrationData,
  name,
  demo = false,
}: {
  eventId: string | null | undefined;
  enabled: boolean;
  uid?: string | null;
  registrationData: Record<string, unknown> | null | undefined;
  name?: string | null;
  demo?: boolean; // panel para disparar los mensajes a mano (solo local)
}) {
  const [config, setConfig] = useState<HerdLiveConfig | null>(null);
  const [counts, setCounts] = useState<HerdCounts | null>(null);
  const [memberGroup, setMemberGroup] = useState<HerdMember | null>(null);
  const countsRef = useRef<HerdCounts | null>(null);
  countsRef.current = counts;
  const { banners, show, edit, isShowing } = useHerdBanners();

  const active = enabled && !!eventId;
  const on = active && !!config?.enabled;

  useEffect(() => {
    if (!active) return;
    const unsub = subscribeHerdConfig(eventId!, setConfig);
    return () => {
      unsub();
      setConfig(null);
    };
  }, [active, eventId]);

  useEffect(() => {
    if (!on) return;
    const unsub = subscribeHerdCounts(eventId!, setCounts);
    return () => {
      unsub();
      setCounts(null);
    };
  }, [on, eventId]);

  useEffect(() => {
    if (!on || !uid) return;
    const unsub = subscribeHerdMember(eventId!, uid, setMemberGroup);
    return () => {
      unsub();
      setMemberGroup(null);
    };
  }, [on, eventId, uid]);

  // ── Mensaje privado: bienvenida una vez por sesión del navegador y evento,
  // y luego cada repeatEverySec con los conteos del momento ──────────────
  const priv = { ...DEFAULT_HERD_PRIVATE, ...(config?.privateMessage ?? {}) };
  // El grupo que publica el backend manda; el registrationData local es respaldo
  const ownGroup =
    memberGroup ?? (config ? findOwnHerdGroup(config, registrationData) : null);

  // Silenciado (grupo excluido o grupo de control): no ve ningún mensaje. Lo
  // decide el backend; sin su respuesta y con experimento activo no se sabe
  // si cayó en control, así que se calla para no contaminar la medición.
  const experiment = (config?.holdoutPercent ?? 0) > 0;
  const muted = memberGroup
    ? !!memberGroup.muted
    : experiment || !!config?.groups?.find((g) => g.key === ownGroup?.key)?.excluded;

  useEffect(() => {
    if (!active) return;
    console.info("[herd]", {
      configEnabled: config?.enabled ?? null,
      fieldId: config?.fieldId ?? null,
      ownGroup,
      fromBackend: !!memberGroup,
      muted,
      counts,
    });
  }, [active, config?.enabled, config?.fieldId, ownGroup?.key, !!memberGroup, muted, counts]); // eslint-disable-line react-hooks/exhaustive-deps
  const firstName = (name ?? "").trim().split(/\s+/)[0] ?? "";
  const privateReady = on && priv.enabled && !!ownGroup && counts !== null;

  // Grupo para la demostración: el propio si lo hay; si no (p. ej. el admin sin
  // registro), el primero del formulario
  const firstGroup = config?.groups?.[0];
  const sampleGroup = ownGroup ?? (firstGroup ? { key: firstGroup.key, label: firstGroup.label, singular: firstGroup.singular } : DEMO_GROUP);

  // Saludo entre colegas: el botón lo decide el backend (member.greet); en la
  // demostración se muestra siempre para poder revisarlo
  const greetCfg = { ...DEFAULT_HERD_GREETING, ...(config?.greeting ?? {}) };
  const canGreet = greetCfg.enabled && (demo || !!memberGroup?.greet);

  const privateArgs = useRef({ priv, ownGroup, memberGroup, sampleGroup, firstName, muted, accent: config?.accentColor, greetCfg, canGreet });
  privateArgs.current = { priv, ownGroup, memberGroup, sampleGroup, firstName, muted, accent: config?.accentColor, greetCfg, canGreet };

  /**
   * Arma y muestra el mensaje privado con el grupo y conteo actuales:
   * - welcome: los primeros N del grupo ven firstTemplate ("eres la segunda…")
   * - repeat: repeatTemplate (o la plantilla normal)
   * - manual: el texto lanzado desde el admin (o la plantilla normal)
   * `demo` simula el orden de llegada sin depender del backend.
   */
  const firePrivate = (
    mode: "welcome" | "repeat" | "manual",
    textOverride?: string,
    demo?: { position?: number },
  ) => {
    const { priv: p, ownGroup, memberGroup: member, sampleGroup: sample, firstName: nombre, muted, accent } =
      privateArgs.current;
    if (muted && !demo) return false;
    const g = ownGroup ?? (demo ? sample : null);
    if (!g) return false;
    const c = countsRef.current;
    const position = demo ? demo.position : member?.key === g.key ? member.position : undefined;
    const isFirst =
      mode === "welcome" &&
      !!position &&
      position <= p.firstCount &&
      !!p.firstTemplate.trim();
    const template =
      textOverride ||
      (isFirst
        ? p.firstTemplate
        : mode === "repeat" && p.repeatTemplate.trim()
          ? p.repeatTemplate
          : p.template);
    // Al menos 1: quien llega siempre cuenta, aunque el conteo aún no lo refleje
    const cantidad = Math.max(demo?.position ?? 1, c?.counts[g.key] ?? 0);
    const total = Math.max(1, c?.total ?? 0);
    const text = renderHerdTemplate(template, {
      nombre,
      grupo: g.label,
      grupoSingular: g.singular,
      cantidad,
      total,
      posicion: position ? herdOrdinal(position, p.ordinalGender) : "",
      // Nunca menos inscritos que conectados; en demo, de ejemplo si aún no hay datos
      inscritos: Math.max(cantidad, c?.registered[g.key] || (demo ? DEMO_REGISTERED : 0)),
      inscritosTotal: Math.max(total, c?.registeredTotal || (demo ? DEMO_REGISTERED_TOTAL : 0)),
    });
    const { canGreet: withButton } = privateArgs.current;
    const source: HerdGreetingSource = mode;
    // Con botón, el anuncio dura un poco más para dar tiempo a tocarlo
    const idRef = { current: 0 };
    idRef.current = show(
      "private",
      text,
      p,
      withButton ? Math.max(p.durationSec, 10) : p.durationSec,
      accent,
      withButton
        ? { label: "👋 Saludar a mis colegas", onClick: () => void greetGroup(idRef.current, source, g) }
        : null,
    );
    if (!demo) {
      // Para medir la tasa de saludo: cuántos vieron el anuncio (con o sin botón)
      void reportHerdImpression(eventId!, source, nombre).catch(() => {});
      trackEvent("herd_announcement_shown", {
        event_id: eventId,
        herd_group: g.key,
        source,
        has_greet_button: withButton,
      });
    }
    return true;
  };

  /** «👋 Saludar a mis colegas»: avisa a los conectados de su grupo */
  const greetGroup = async (bannerId: number, source: HerdGreetingSource, g: HerdGroupRef) => {
    edit("private", bannerId, { action: { label: "Enviando…", onClick: () => {}, disabled: true } }, CONFIRM_MS + 2000);
    const sent = (recipients: number) =>
      recipients > 0
        ? `👋 Saludaste a ${recipients} ${recipients === 1 ? "colega" : "colegas"} de ${g.label}`
        : `👋 ¡Saludo enviado a tus colegas de ${g.label}!`;
    if (demo) {
      edit("private", bannerId, { text: sent(Math.max(1, (countsRef.current?.counts[g.key] ?? 13) - 1)), action: null }, CONFIRM_MS);
      return;
    }
    try {
      const r = await sendHerdGreeting(eventId!, source, privateArgs.current.firstName);
      edit("private", bannerId, { text: sent(r.recipients), action: null }, CONFIRM_MS);
      trackEvent("herd_greeting_sent", {
        event_id: eventId,
        herd_group: g.key,
        source,
        recipients: r.recipients,
      });
    } catch (err) {
      const retry = (err as { response?: { data?: { retryInSec?: number } } })?.response?.data?.retryInSec;
      edit(
        "private",
        bannerId,
        { text: retry ? "Ya saludaste hace un momento 🙂" : "No se pudo enviar el saludo", action: null },
        CONFIRM_MS,
      );
    }
  };

  const privateRepeatMs = Math.max(0, priv.repeatEverySec) * 1000;

  useEffect(() => {
    if (!privateReady) return;
    const storageKey = `herd-private-${eventId}`;
    const last = readLastPrivate(storageKey);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;

    const run = () => {
      const welcome = readLastPrivate(storageKey) === null;
      if (welcome && !privateArgs.current.memberGroup && retries++ < MEMBER_MAX_RETRIES) {
        timer = setTimeout(run, MEMBER_RETRY_MS);
        return;
      }
      if (firePrivate(welcome ? "welcome" : "repeat")) writeLastPrivate(storageKey, Date.now());
      if (privateRepeatMs) timer = setTimeout(run, privateRepeatMs);
    };

    // Primera vez: bienvenida. Si ya la vio (recargó la página): la próxima
    // repetición respeta el intervalo desde el último mensaje.
    if (last === null) timer = setTimeout(run, PRIVATE_DELAY_MS);
    else if (privateRepeatMs) {
      timer = setTimeout(run, Math.max(PRIVATE_DELAY_MS, last + privateRepeatMs - Date.now()));
    }
    return () => clearTimeout(timer);
    // show es estable en la práctica (solo usa setState y refs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privateReady, eventId, privateRepeatMs]);

  // ── Mensaje público: cada vez que el backend publica uno nuevo ───────────
  const pubRef = useRef({ msg: config?.publicMessage, accent: config?.accentColor });
  pubRef.current = { msg: config?.publicMessage, accent: config?.accentColor };

  useEffect(() => {
    if (!on) return;
    let lastAt: number | null = null;
    const unsub = subscribeHerdPublic(eventId!, (e) => {
      if (!e?.at || e.at === lastAt) return;
      const first = lastAt === null;
      lastAt = e.at;
      if (privateArgs.current.muted) return;
      const p = { ...DEFAULT_HERD_PUBLIC, ...(pubRef.current.msg ?? {}) };
      // Los lanzados a mano desde el admin se muestran aunque el automático esté apagado
      if (!p.enabled && !e.manual) return;
      // Al cargar la página llega el último anuncio guardado: solo se muestra si sigue vigente
      if (first && getServerNow() - e.at > p.durationSec * 1000) return;
      const template = e.text || (e.repeat && p.repeatTemplate.trim() ? p.repeatTemplate : p.template);
      const text = renderHerdTemplate(template, {
        nombre: "",
        grupo: e.label,
        grupoSingular: e.singular,
        cantidad: e.count,
        total: e.total,
        inscritos: Math.max(e.count, e.registered ?? 0),
        inscritosTotal: Math.max(e.total, e.registeredTotal ?? 0),
      });
      show("public", text, p, p.durationSec, pubRef.current.accent);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, eventId]);

  // ── Privado lanzado a mano desde el admin: se repite aunque ya se haya visto ─
  useEffect(() => {
    if (!on) return;
    let lastAt: number | null = null;
    const unsub = subscribeHerdPrivateTrigger(eventId!, (t) => {
      if (!t?.at || t.at === lastAt) return;
      const first = lastAt === null;
      lastAt = t.at;
      const { priv: p, ownGroup: g } = privateArgs.current;
      // Al cargar la página llega el último disparo guardado: solo si sigue vigente
      if (first && getServerNow() - t.at > p.durationSec * 1000) return;
      if (t.key && g?.key !== t.key) {
        console.info("[herd] privado manual para otro grupo", { para: t.key, miGrupo: g?.key ?? null });
        return;
      }
      const shown = firePrivate("manual", t.text);
      console.info("[herd] privado manual", shown ? "mostrado" : "sin grupo propio, no se muestra", t);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, eventId]);

  // ── Saludo entre colegas: recibidos del propio grupo y devoluciones ──────
  // Saludos del banner en pantalla: varios seguidos se agrupan en uno
  const incoming = useRef<{ bannerId: number | null; items: Array<{ id: string; name: string }> }>({
    bannerId: null,
    items: [],
  });

  const greetingMsg = (): HerdMessageConfig => ({
    ...priv,
    position: greetCfg.position,
    label: null,
  });
  const greetingArgs = useRef({ greetingMsg, greetCfg });
  greetingArgs.current = { greetingMsg, greetCfg };

  const showGreetingReceived = (from: { id: string; name: string }, group: HerdGroupRef) => {
    const { greetingMsg: msg, greetCfg: gc } = greetingArgs.current;
    const accent = privateArgs.current.accent;
    const cur = incoming.current;
    const stillShowing = isShowing("greeting", cur.bannerId);
    const items = stillShowing ? [...cur.items.filter((i) => i.id !== from.id), from] : [from];
    const names = items.map((i) => i.name).reverse(); // el más reciente primero
    const text =
      items.length === 1
        ? `👋 ${names[0]} te saluda desde ${group.label}`
        : `👋 ${joinNames(names)} de ${group.label} te saludan`;
    const action = privateArgs.current.canGreet
      ? { label: "🙌 Devolver saludo", onClick: () => void replyGreetings(group) }
      : null;
    if (stillShowing && cur.bannerId !== null) {
      edit("greeting", cur.bannerId, { text, action }, gc.durationSec * 1000);
      incoming.current = { bannerId: cur.bannerId, items };
    } else {
      const id = show("greeting", text, msg(), gc.durationSec, accent, action);
      incoming.current = { bannerId: id, items };
    }
  };

  /** «🙌 Devolver saludo»: a todos los del banner en pantalla */
  const replyGreetings = async (group: HerdGroupRef) => {
    const { bannerId, items } = incoming.current;
    if (bannerId === null || !items.length) return;
    edit("greeting", bannerId, { action: { label: "Enviando…", onClick: () => {}, disabled: true } });
    const names = joinNames(items.map((i) => i.name).reverse());
    if (!demo) {
      const results = await Promise.allSettled(
        items.map((i) => replyHerdGreeting(eventId!, i.id, privateArgs.current.firstName)),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      trackEvent("herd_greeting_reply_sent", { event_id: eventId, herd_group: group.key, replies: ok });
    }
    edit("greeting", bannerId, { text: `🙌 Le devolviste el saludo a ${names}`, action: null }, CONFIRM_MS);
    incoming.current = { bannerId: null, items: [] };
  };

  const ownGroupKey = ownGroup?.key ?? null;
  const greetingOn = on && greetCfg.enabled && !muted && !!ownGroupKey;

  useEffect(() => {
    if (!greetingOn || !uid) return;
    // Al suscribirse llegan los últimos guardados: solo cuentan los recientes
    const since = getServerNow() - 3000;
    const unsub = subscribeHerdGreetings(eventId!, ownGroupKey!, (gr) => {
      if (gr.at < since || gr.fromUid === uid) return;
      const group = privateArgs.current.ownGroup;
      if (!group) return;
      showGreetingReceived({ id: gr.id, name: gr.name }, group);
      trackEvent("herd_greeting_received", { event_id: eventId, herd_group: group.key });
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greetingOn, eventId, ownGroupKey, uid]);

  useEffect(() => {
    if (!greetingOn || !uid) return;
    const since = getServerNow() - 3000;
    const unsub = subscribeHerdGreetReplies(eventId!, uid, (r) => {
      if (r.at < since) return;
      show("greeting", `🙌 ${r.name} te devolvió el saludo`, greetingArgs.current.greetingMsg(), 5, privateArgs.current.accent);
      trackEvent("herd_greeting_reply_received", { event_id: eventId, herd_group: ownGroupKey });
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greetingOn, eventId, uid]);

  /** Demostración del público: el estado actual (o de ejemplo) del grupo de muestra */
  const fireDemoPublic = (repeat: boolean) => {
    const p = { ...DEFAULT_HERD_PUBLIC, ...(pubRef.current.msg ?? {}) };
    const g = privateArgs.current.sampleGroup;
    const c = countsRef.current;
    const cantidad = Math.max(1, c?.counts[g.key] ?? 0);
    const template = repeat && p.repeatTemplate.trim() ? p.repeatTemplate : p.template;
    const text = renderHerdTemplate(template, {
      nombre: "",
      grupo: g.label,
      grupoSingular: g.singular,
      cantidad,
      total: Math.max(cantidad, c?.total ?? 0),
      inscritos: Math.max(cantidad, c?.registered[g.key] || DEMO_REGISTERED),
      inscritosTotal: Math.max(cantidad, c?.registeredTotal || DEMO_REGISTERED_TOTAL),
    });
    show("public", text, p, p.durationSec, pubRef.current.accent);
  };

  // En demostración se pinta aunque los anuncios estén apagados, para revisarlos antes del evento
  if (!on && !(active && demo)) return null;
  return (
    <>
      <AnnouncementBanner banner={banners.private} zIndex={6} />
      <AnnouncementBanner banner={banners.public} zIndex={6} />
      <AnnouncementBanner banner={banners.greeting} zIndex={7} />
      {demo && (
        <HerdDemoPanel
          herdEnabled={!!config?.enabled}
          priv={priv}
          publicEnabled={config?.publicMessage?.enabled ?? DEFAULT_HERD_PUBLIC.enabled}
          groupLabel={sampleGroup.label}
          onPrivate={(mode, position) => firePrivate(mode, undefined, { position })}
          onPublic={fireDemoPublic}
          greetingEnabled={greetCfg.enabled}
          onGreeting={(kind) => {
            const g = privateArgs.current.ownGroup ?? sampleGroup;
            if (kind === "received") {
              const demoNames = ["Carlos", "Laura", "Andrés", "Sofía"];
              const n = incoming.current.items.length;
              showGreetingReceived({ id: `demo-${Date.now()}`, name: demoNames[n % demoNames.length] }, g);
            } else {
              show("greeting", "🙌 Carlos te devolvió el saludo", greetingMsg(), 5, config?.accentColor);
            }
          }}
        />
      )}
    </>
  );
}

/**
 * Panel flotante del modo demostración (?herdDemo=1): dispara cada variante de
 * los mensajes solo en este navegador, sin escribir nada en el backend.
 */
function HerdDemoPanel({
  herdEnabled,
  priv,
  publicEnabled,
  groupLabel,
  onPrivate,
  onPublic,
  greetingEnabled,
  onGreeting,
}: {
  herdEnabled: boolean;
  priv: typeof DEFAULT_HERD_PRIVATE;
  publicEnabled: boolean;
  groupLabel: string;
  onPrivate: (mode: "welcome" | "repeat", position?: number) => void;
  onPublic: (repeat: boolean) => void;
  greetingEnabled: boolean;
  onGreeting: (kind: "received" | "reply") => void;
}) {
  const [open, setOpen] = useState(true);
  const firsts = Array.from({ length: priv.firstCount }, (_, i) => i + 1);

  if (!open) {
    return (
      <Button size="compact-xs" style={{ position: "fixed", right: 16, bottom: 16, zIndex: 1000 }} onClick={() => setOpen(true)}>
        🧪 Demo manada
      </Button>
    );
  }

  return (
    <Paper
      shadow="lg"
      radius="md"
      p="sm"
      withBorder
      style={{ position: "fixed", right: 16, bottom: 16, zIndex: 1000, width: 300, maxWidth: "calc(100vw - 32px)" }}
    >
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={700}>🧪 Demo de anuncios de manada</Text>
          <CloseButton size="sm" onClick={() => setOpen(false)} />
        </Group>
        <Text size="xs" c="dimmed">
          Solo se ve en este navegador. Grupo de ejemplo: <b>{groupLabel}</b>
        </Text>
        {!herdEnabled && (
          <Text size="xs" c="orange">Los anuncios de manada están apagados: los asistentes no los ven.</Text>
        )}

        <Text size="xs" fw={600} mt={4}>
          👋 Individual {!priv.enabled && <Text span size="xs" c="orange">(apagado)</Text>}
        </Text>
        {firsts.length > 0 && (
          <Group gap={4}>
            {firsts.map((n) => (
              <Button key={n} size="compact-xs" variant="light" onClick={() => onPrivate("welcome", n)}>
                {n}.º en llegar
              </Button>
            ))}
          </Group>
        )}
        <Group gap={4}>
          <Button size="compact-xs" variant="light" onClick={() => onPrivate("welcome", priv.firstCount + 1)}>
            Genérico ({priv.firstCount + 1}.º+)
          </Button>
          <Button size="compact-xs" variant="light" onClick={() => onPrivate("repeat")}>
            Repetición
          </Button>
        </Group>

        <Text size="xs" fw={600} mt={4}>
          👥 Grupal {!publicEnabled && <Text span size="xs" c="orange">(apagado)</Text>}
        </Text>
        <Group gap={4}>
          <Button size="compact-xs" variant="light" color="teal" onClick={() => onPublic(false)}>
            Al crecer un grupo
          </Button>
          <Button size="compact-xs" variant="light" color="teal" onClick={() => onPublic(true)}>
            Repetición
          </Button>
        </Group>

        <Text size="xs" fw={600} mt={4}>
          🤝 Saludo entre colegas {!greetingEnabled && <Text span size="xs" c="orange">(apagado)</Text>}
        </Text>
        <Text size="xs" c="dimmed">
          El botón «Saludar» sale en el anuncio individual. Aquí: lo que ve quien lo recibe.
        </Text>
        <Group gap={4}>
          <Button size="compact-xs" variant="light" color="grape" onClick={() => onGreeting("received")}>
            Saludo recibido (repite para agrupar)
          </Button>
          <Button size="compact-xs" variant="light" color="grape" onClick={() => onGreeting("reply")}>
            Me devuelven el saludo
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
