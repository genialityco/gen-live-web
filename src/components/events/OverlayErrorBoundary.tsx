// src/components/events/OverlayErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from "react";

// Reintentos tras un fallo (un dato raro en RTDB puede corregirse solo)
const RETRY_MS = 30_000;
const MAX_RETRIES = 3;

type Props = { name: string; children: ReactNode };
type State = { failed: boolean };

/**
 * Aísla un overlay de la página del asistente (anuncios, manada, logros): si
 * falla al pintarse, se oculta en silencio en vez de desmontar la página
 * entera con el reproductor. Reintenta unas pocas veces por si el fallo era
 * pasajero.
 *
 * Solo atrapa errores de render y de ciclo de vida; los de callbacks y
 * suscripciones no desmontan la página y no llegan aquí.
 */
export class OverlayErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  private retries = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[overlay:${this.props.name}] falló y se ocultó; el video sigue normal`, error, info.componentStack);
    if (this.retries >= MAX_RETRIES) return;
    this.retries++;
    this.timer = setTimeout(() => this.setState({ failed: false }), RETRY_MS);
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
