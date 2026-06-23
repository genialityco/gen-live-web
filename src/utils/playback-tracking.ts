// utils/playback-tracking.ts
// Instrumenta un elemento <video> para reportar cuándo está REALMENTE
// reproduciéndose (no pausado, no terminado, con datos suficientes). Se usa para
// medir tiempo de visualización real en vez de "pestaña abierta" (presencia).

/**
 * Conecta listeners a un <video> y notifica cada cambio de "está reproduciendo".
 *
 * Reproduciendo = !paused && !ended && readyState >= HAVE_CURRENT_DATA.
 * No se considera la visibilidad de la pestaña: reproducir en segundo plano
 * (escuchar el webinar) cuenta como consumo legítimo; lo que el arreglo elimina
 * es contar pausas, cuenta-regresiva y video terminado.
 *
 * @returns función de limpieza que quita los listeners y emite un último `false`.
 */
export function attachPlaybackTracking(
  video: HTMLVideoElement,
  onPlayingChange: (playing: boolean) => void,
): () => void {
  let last = false;

  const compute = () =>
    !video.paused &&
    !video.ended &&
    video.readyState >= 2; /* HAVE_CURRENT_DATA */

  const emit = () => {
    const now = compute();
    if (now !== last) {
      last = now;
      onPlayingChange(now);
    }
  };

  // timeupdate confirma avance real; el resto captura transiciones al instante.
  const events = [
    "play",
    "playing",
    "pause",
    "ended",
    "waiting",
    "stalled",
    "canplay",
    "seeking",
    "seeked",
    "emptied",
    "timeupdate",
  ];
  for (const ev of events) video.addEventListener(ev, emit);

  // Estado inicial
  emit();

  return () => {
    for (const ev of events) video.removeEventListener(ev, emit);
    if (last) {
      last = false;
      onPlayingChange(false);
    }
  };
}
