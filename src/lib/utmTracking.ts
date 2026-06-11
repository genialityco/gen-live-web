const UTM_KEYS = ['utm_perfil', 'utm_especialidad', 'utm_subespecialidad'] as const;
type UtmKey = (typeof UTM_KEYS)[number];

const STORAGE_KEY = 'custom_utms';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function captureUtms(): void {
  const params = new URLSearchParams(window.location.search);
  const captured: Partial<Record<UtmKey, string>> = {};

  UTM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) captured[key] = value;
  });

  if (Object.keys(captured).length === 0) return;

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(captured));

  // User-scoped: asocia el valor al usuario, no solo al page_view
  window.gtag?.('set', 'user_properties', {
    utm_perfil: captured.utm_perfil,
    utm_especialidad: captured.utm_especialidad,
    utm_subespecialidad: captured.utm_subespecialidad,
  });
}

export function getStoredUtms(): Partial<Record<UtmKey, string>> {
  try {
    return (JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Record<UtmKey, string>>) ?? {};
  } catch {
    return {};
  }
}

export function sendPageView(pathname: string, search: string): void {
  const utms = getStoredUtms();
  window.gtag?.('event', 'page_view', {
    page_path: pathname + search,
    page_location: window.location.origin + pathname + search,
    page_title: document.title,
    ...(utms.utm_perfil && { utm_perfil: utms.utm_perfil }),
    ...(utms.utm_especialidad && { utm_especialidad: utms.utm_especialidad }),
    ...(utms.utm_subespecialidad && { utm_subespecialidad: utms.utm_subespecialidad }),
  });
}

/**
 * Envía un evento personalizado a GA4, incluyendo los UTMs custom
 * almacenados en sesión para poder segmentar las conversiones.
 */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  const utms = getStoredUtms();
  window.gtag?.('event', name, {
    ...params,
    ...(utms.utm_perfil && { utm_perfil: utms.utm_perfil }),
    ...(utms.utm_especialidad && { utm_especialidad: utms.utm_especialidad }),
    ...(utms.utm_subespecialidad && { utm_subespecialidad: utms.utm_subespecialidad }),
  });
}
