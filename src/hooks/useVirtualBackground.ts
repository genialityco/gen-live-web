// src/hooks/useVirtualBackground.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track, LocalVideoTrack } from "livekit-client";
import { BackgroundBlur, VirtualBackground } from "@livekit/track-processors";

export type VirtualBgType = "none" | "blur" | "image";

export interface VirtualBgState {
  type: VirtualBgType;
  blurIntensity: number;
  imageUrl: string | null;
  isProcessing: boolean;
  isSupported: boolean;
  error: string | null;
}

interface StoredVirtualBg {
  type: VirtualBgType;
  blurIntensity?: number;
  imageUrl?: string | null;
  lastUsed: number;
}

const STORAGE_KEY_PREFIX = "virtual_bg_";

function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function getStorageKey(eventSlug: string, identity?: string): string {
  return `${STORAGE_KEY_PREFIX}${eventSlug}${identity ? `_${identity}` : ""}`;
}

function loadStoredPreferences(storageKey: string): StoredVirtualBg | null {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error loading virtual bg preferences:", e);
  }
  return null;
}

function savePreferences(storageKey: string, state: Partial<VirtualBgState>) {
  try {
    const data: StoredVirtualBg = {
      type: state.type || "none",
      blurIntensity: state.blurIntensity,
      imageUrl: state.imageUrl,
      lastUsed: Date.now(),
    };
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (e) {
    console.error("Error saving virtual bg preferences:", e);
  }
}

export function useVirtualBackground(eventSlug: string) {
  const { localParticipant } = useLocalParticipant();
  const processorRef = useRef<ReturnType<typeof BackgroundBlur> | ReturnType<typeof VirtualBackground> | null>(null);
  const appliedRef = useRef(false);
  const storageKey = getStorageKey(eventSlug, localParticipant?.identity);

  const [state, setState] = useState<VirtualBgState>({
    type: "none",
    blurIntensity: 10,
    imageUrl: null,
    isProcessing: false,
    isSupported: checkWebGLSupport(),
    error: null,
  });

  // Cargar preferencias guardadas
  useEffect(() => {
    const saved = loadStoredPreferences(storageKey);
    if (saved) {
      setState((prev) => ({
        ...prev,
        type: saved.type || "none",
        blurIntensity: saved.blurIntensity ?? 10,
        imageUrl: saved.imageUrl ?? null,
      }));
    }
  }, [storageKey]);

  const getVideoTrack = useCallback((): LocalVideoTrack | null => {
    if (!localParticipant) return null;
    const pub = localParticipant.getTrackPublication(Track.Source.Camera);
    return pub?.videoTrack as LocalVideoTrack | null;
  }, [localParticipant]);

  const applyProcessor = useCallback(
    async (
      processor: ReturnType<typeof BackgroundBlur> | ReturnType<typeof VirtualBackground> | null
    ) => {
      const track = getVideoTrack();
      if (!track) {
        setState((prev) => ({ ...prev, error: "No hay video track disponible" }));
        return false;
      }

      setState((prev) => ({ ...prev, isProcessing: true, error: null }));

      try {
        // Limpiar procesador anterior
        if (processorRef.current) {
          await track.stopProcessor();
          processorRef.current = null;
        }

        // Aplicar nuevo procesador
        if (processor) {
          await track.setProcessor(processor);
          processorRef.current = processor;
        }

        return true;
      } catch (err: unknown) {
        console.error("Error applying processor:", err);
        const errorMessage = err instanceof Error ? err.message : "Error desconocido";
        setState((prev) => ({ ...prev, error: errorMessage }));
        return false;
      } finally {
        setState((prev) => ({ ...prev, isProcessing: false }));
      }
    },
    [getVideoTrack]
  );

  const setBlur = useCallback(
    async (intensity: number = 10) => {
      if (!state.isSupported) {
        setState((prev) => ({ ...prev, error: "WebGL no soportado" }));
        return;
      }

      const processor = BackgroundBlur(intensity);
      const success = await applyProcessor(processor);

      if (success) {
        const newState = {
          type: "blur" as const,
          blurIntensity: intensity,
          imageUrl: null,
        };
        setState((prev) => ({ ...prev, ...newState }));
        savePreferences(storageKey, newState);
      }
    },
    [state.isSupported, applyProcessor, storageKey]
  );

  const setImage = useCallback(
    async (url: string) => {
      if (!state.isSupported) {
        setState((prev) => ({ ...prev, error: "WebGL no soportado" }));
        return;
      }

      const processor = VirtualBackground(url);
      const success = await applyProcessor(processor);

      if (success) {
        const newState = {
          type: "image" as const,
          imageUrl: url,
        };
        setState((prev) => ({ ...prev, ...newState }));
        savePreferences(storageKey, newState);
      }
    },
    [state.isSupported, applyProcessor, storageKey]
  );

  const clear = useCallback(async () => {
    const success = await applyProcessor(null);

    if (success) {
      const newState = { type: "none" as const, imageUrl: null };
      setState((prev) => ({ ...prev, ...newState }));
      savePreferences(storageKey, newState);
    }
  }, [applyProcessor, storageKey]);

  // Aplicar efecto guardado cuando el video track esté disponible
  useEffect(() => {
    const track = getVideoTrack();
    if (!track || state.type === "none" || appliedRef.current) return;

    // Evitar aplicar múltiples veces
    appliedRef.current = true;

    const applyStoredEffect = async () => {
      if (state.type === "blur") {
        await setBlur(state.blurIntensity);
      } else if (state.type === "image" && state.imageUrl) {
        await setImage(state.imageUrl);
      }
    };

    // Pequeño delay para asegurar que el track esté listo
    const timeout = setTimeout(applyStoredEffect, 500);

    return () => clearTimeout(timeout);
  }, [getVideoTrack, state.type, state.blurIntensity, state.imageUrl, setBlur, setImage]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      const track = getVideoTrack();
      if (track && processorRef.current) {
        track.stopProcessor().catch(console.error);
      }
    };
  }, [getVideoTrack]);

  return {
    state,
    setBlur,
    setImage,
    clear,
  };
}
