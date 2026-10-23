// src/components/events/HerdOverlay.tsx
import { useEffect, useRef, useState } from "react";
import { getServerNow, type BannerState } from "../../api/live-stage-service";
import {
  DEFAULT_HERD_PRIVATE,
  DEFAULT_HERD_PUBLIC,
  findOwnHerdGroup,
  herdBannerStyle,
  renderHerdTemplate,
  subscribeHerdConfig,
  subscribeHerdCounts,
  subscribeHerdMember,
  subscribeHerdPrivateTrigger,
  subscribeHerdPublic,
  type HerdCounts,
  type HerdLiveConfig,
  type HerdMessageConfig,
} from "../../api/herd";
import { AnnouncementBanner } from "../studio/AnnouncementBanner";
import { EXIT_MS } from "../studio/announcement-templates";

// Espera tras entrar antes del mensaje privado: el backend agrupa la presencia
// en ventanas de 2-5 s, así el conteo ya incluye a quien acaba de llegar.
const PRIVATE_DELAY_MS = 6000;

type Kind = "private" | "public";

/**
 * Un banner por tipo de mensaje. Si el privado y el público comparten
 * posición, el que llega después espera a que salga el otro para no encimarse.
 */
function useHerdBanners() {
  const [banners, setBanners] = useState<Record<Kind, BannerState | null>>({
    private: null,
    public: null,
  });
  const busy = useRef<Record<Kind, { slot: string; until: number } | null>>({
    private: null,
    public: null,
  });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const show = (kind: Kind, text: string, msg: HerdMessageConfig, durationSec: number, accent?: string) => {
    const slot = msg.position ?? "";
    const other = busy.current[kind === "private" ? "public" : "private"];
    const now = Date.now();
    const wait = other && other.slot === slot && other.until > now ? other.until - now + EXIT_MS : 0;

    const start = () => {
      const ms = Math.max(2, durationSec) * 1000;
      const banner: BannerState = {
        visible: true,
        text,
        label: msg.label?.trim() || null,
        style: herdBannerStyle(msg, accent),
        // Clave única: cada mensaje entra con su animación aunque el texto se repita
        publishedAt: Date.now(),
      };
      busy.current[kind] = { slot, until: Date.now() + ms };
      setBanners((b) => ({ ...b, [kind]: banner }));
      timers.current.push(
        setTimeout(() => {
          // AnnouncementBanner anima la salida al recibir null
          setBanners((b) => (b[kind] === banner ? { ...b, [kind]: null } : b));
        }, ms),
      );
    };

    if (wait) timers.current.push(setTimeout(start, wait));
    else start();
  };

  return { banners, show };
}

/**
 * Anuncios de manada sobre el reproductor del asistente:
 * - privado: al llegar, "¡Hola Ana! Contigo ya son 34 endocrinólogos conectados" (solo él/ella)
 * - público: cuando crece un grupo, "¡Ya son 35 endocrinólogos conectados!" (todos)
 * Se pintan con el mismo banner de los anuncios del estudio.
 */
export function HerdOverlay({
  eventId,
  enabled,
  uid,
  registrationData,
  name,
}: {
  eventId: string | null | undefined;
  enabled: boolean;
  uid?: string | null;
  registrationData: Record<string, unknown> | null | undefined;
  name?: string | null;
}) {
  const [config, setConfig] = useState<HerdLiveConfig | null>(null);
  const [counts, setCounts] = useState<HerdCounts | null>(null);
  const [memberGroup, setMemberGroup] = useState<{ key: string; label: string } | null>(null);
  const countsRef = useRef<HerdCounts | null>(null);
  countsRef.current = counts;
  const { banners, show } = useHerdBanners();

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

  // ── Mensaje privado: una vez por sesión del navegador y evento ───────────
  const priv = { ...DEFAULT_HERD_PRIVATE, ...(config?.privateMessage ?? {}) };
  // El grupo que publica el backend manda; el registrationData local es respaldo
  const ownGroup =
    memberGroup ?? (config ? findOwnHerdGroup(config, registrationData) : null);

  useEffect(() => {
    if (!active) return;
    console.info("[herd]", {
      configEnabled: config?.enabled ?? null,
      fieldId: config?.fieldId ?? null,
      ownGroup,
      fromBackend: !!memberGroup,
      counts,
    });
  }, [active, config?.enabled, config?.fieldId, ownGroup?.key, !!memberGroup, counts]); // eslint-disable-line react-hooks/exhaustive-deps
  const firstName = (name ?? "").trim().split(/\s+/)[0] ?? "";
  const privateReady = on && priv.enabled && !!ownGroup && counts !== null;

  const privateArgs = useRef({ priv, ownGroup, firstName, accent: config?.accentColor });
  privateArgs.current = { priv, ownGroup, firstName, accent: config?.accentColor };

  /** Arma y muestra el mensaje privado con el grupo y conteo actuales */
  const firePrivate = (templateOverride?: string) => {
    const { priv: p, ownGroup: g, firstName: nombre, accent } = privateArgs.current;
    if (!g) return false;
    const c = countsRef.current;
    const text = renderHerdTemplate(templateOverride || p.template, {
      nombre,
      grupo: g.label,
      // Al menos 1: quien llega siempre cuenta, aunque el conteo aún no lo refleje
      cantidad: Math.max(1, c?.counts[g.key] ?? 0),
      total: Math.max(1, c?.total ?? 0),
    });
    show("private", text, p, p.durationSec, accent);
    return true;
  };

  useEffect(() => {
    if (!privateReady) return;
    const storageKey = `herd-private-${eventId}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch {
      /* sin storage: se muestra igual */
    }
    const t = setTimeout(() => {
      if (!firePrivate()) return;
      try {
        sessionStorage.setItem(storageKey, "1");
      } catch {
        /* ignorar */
      }
    }, PRIVATE_DELAY_MS);
    return () => clearTimeout(t);
    // show es estable en la práctica (solo usa setState y refs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privateReady, eventId]);

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
      const p = { ...DEFAULT_HERD_PUBLIC, ...(pubRef.current.msg ?? {}) };
      // Los lanzados a mano desde el admin se muestran aunque el automático esté apagado
      if (!p.enabled && !e.manual) return;
      // Al cargar la página llega el último anuncio guardado: solo se muestra si sigue vigente
      if (first && getServerNow() - e.at > p.durationSec * 1000) return;
      const text = renderHerdTemplate(e.text || p.template, {
        nombre: "",
        grupo: e.label,
        cantidad: e.count,
        total: e.total,
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
      const shown = firePrivate(t.text);
      console.info("[herd] privado manual", shown ? "mostrado" : "sin grupo propio, no se muestra", t);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, eventId]);

  if (!on) return null;
  return (
    <>
      <AnnouncementBanner banner={banners.private} zIndex={6} />
      <AnnouncementBanner banner={banners.public} zIndex={6} />
    </>
  );
}
