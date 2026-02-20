import { ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "../core/firebase";
import { api } from "../core/api";

export interface MediaItem {
  _id: string;
  eventSlug: string;
  name: string;
  type: "image" | "gif" | "video" | "audio";
  url: string;
  thumbnailUrl?: string;
  description?: string;
  tags: string[];
  duration?: number;
  fileSize: number;
  mimeType: string;
  uploadedBy?: string;
  defaultMode: "overlay" | "full";
  defaultLoop: boolean;
  defaultMuted: boolean;
  defaultFit: "cover" | "contain";
  defaultOpacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMediaItemDto {
  name: string;
  description?: string;
  tags?: string[];
  defaultMode?: "overlay" | "full";
  defaultLoop?: boolean;
  defaultMuted?: boolean;
  defaultFit?: "cover" | "contain";
  defaultOpacity?: number;
}

export interface UpdateMediaItemDto {
  name?: string;
  description?: string;
  tags?: string[];
  defaultMode?: "overlay" | "full";
  defaultLoop?: boolean;
  defaultMuted?: boolean;
  defaultFit?: "cover" | "contain";
  defaultOpacity?: number;
}

export interface MediaOverrides {
  mode?: "overlay" | "full";
  loop?: boolean;
  muted?: boolean;
  fit?: "cover" | "contain";
  opacity?: number;
}

export interface EffectiveMediaConfig {
  enabled: boolean;
  showFrame?: boolean;
  frameUrl?: string;
  // Nueva estructura con visual y audio separados
  visual?: {
    item: {
      id: string;
      name: string;
      type: "image" | "gif" | "video";
      url: string;
      thumbnailUrl?: string;
    };
    config: {
      mode: "overlay" | "full";
      loop: boolean;
      muted: boolean;
      fit: "cover" | "contain";
      opacity: number;
    };
  };
  audio?: {
    item: {
      id: string;
      name: string;
      type: "audio";
      url: string;
    };
    config: {
      loop: boolean;
      muted: boolean;
      opacity: number;
    };
  };
  // Legacy para backward compatibility
  item?: {
    id: string;
    name: string;
    type: "image" | "gif" | "video" | "audio";
    url: string;
    thumbnailUrl?: string;
  };
  config?: {
    mode: "overlay" | "full";
    loop: boolean;
    muted: boolean;
    fit: "cover" | "contain";
    opacity: number;
  };
}

export async function listMediaItems(eventSlug: string): Promise<MediaItem[]> {
  const { data } = await api.get<{ items: MediaItem[] }>(
    `/livekit/media-library?eventSlug=${encodeURIComponent(eventSlug)}`
  );
  return data.items;
}

export async function getMediaItem(id: string): Promise<MediaItem> {
  const { data } = await api.get<MediaItem>(`/livekit/media-library/${id}`);
  return data;
}

// Umbral: videos mayores a este tamaño usan signed URL (upload directo a Firebase)
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50 MB

// Función principal unificada — elige el flujo internamente según tamaño del archivo
export async function uploadMediaItemWithProgress(
  eventSlug: string,
  file: File,
  metadata: CreateMediaItemDto,
  onProgress: (percent: number) => void
): Promise<MediaItem> {
  const isLargeVideo =
    file.type.startsWith("video/") && file.size > LARGE_FILE_THRESHOLD;

  if (isLargeVideo) {
    return uploadLargeMediaItem(eventSlug, file, metadata, onProgress);
  }
  return uploadSmallMediaItem(eventSlug, file, metadata, onProgress);
}

// Flujo directo: archivo pequeño → POST al servidor → Firebase Storage
async function uploadSmallMediaItem(
  eventSlug: string,
  file: File,
  metadata: CreateMediaItemDto,
  onProgress: (percent: number) => void
): Promise<MediaItem> {
  const formData = new FormData();
  formData.append("eventSlug", eventSlug);
  formData.append("file", file);
  formData.append("name", metadata.name);
  if (metadata.description) formData.append("description", metadata.description);
  if (metadata.tags) formData.append("tags", JSON.stringify(metadata.tags));
  if (metadata.defaultMode) formData.append("defaultMode", metadata.defaultMode);
  if (metadata.defaultLoop !== undefined)
    formData.append("defaultLoop", String(metadata.defaultLoop));
  if (metadata.defaultMuted !== undefined)
    formData.append("defaultMuted", String(metadata.defaultMuted));
  if (metadata.defaultFit) formData.append("defaultFit", metadata.defaultFit);
  if (metadata.defaultOpacity !== undefined)
    formData.append("defaultOpacity", String(metadata.defaultOpacity));

  const { data } = await api.post<{ ok: boolean; item: MediaItem }>(
    "/livekit/media-library/upload",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }
  );
  return data.item;
}

// Flujo Firebase SDK: archivo grande → Firebase Storage directo con el token del usuario
async function uploadLargeMediaItem(
  eventSlug: string,
  file: File,
  metadata: CreateMediaItemDto,
  onProgress: (percent: number) => void
): Promise<MediaItem> {
  // Paso 1: pedir al backend el path donde guardar el archivo
  const { data: urlData } = await api.post<{ filePath: string }>(
    "/livekit/media-library/request-upload",
    {
      eventSlug,
      name: metadata.name,
      mimeType: file.type,
      fileSize: file.size,
    }
  );

  // Paso 2: subir directo a Firebase Storage usando el SDK (maneja auth + progreso nativamente)
  await uploadFileWithFirebaseSDK(urlData.filePath, file, onProgress);

  // Paso 3: confirmar al backend para hacer público + crear documento en MongoDB
  const { data: confirmData } = await api.post<{ ok: boolean; item: MediaItem }>(
    "/livekit/media-library/confirm-upload",
    {
      filePath: urlData.filePath,
      eventSlug,
      name: metadata.name,
      mimeType: file.type,
      fileSize: file.size,
      description: metadata.description,
      tags: metadata.tags,
      defaultMode: metadata.defaultMode,
      defaultLoop: metadata.defaultLoop,
      defaultMuted: metadata.defaultMuted,
      defaultFit: metadata.defaultFit,
      defaultOpacity: metadata.defaultOpacity,
    }
  );
  return confirmData.item;
}

// Upload con Firebase Web SDK — usa el token de autenticación del usuario actual
function uploadFileWithFirebaseSDK(
  filePath: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        onProgress(percent);
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

// Mantener compatibilidad con código existente que use uploadMediaItem
export async function uploadMediaItem(
  eventSlug: string,
  file: File,
  metadata: CreateMediaItemDto
): Promise<MediaItem> {
  return uploadSmallMediaItem(eventSlug, file, metadata, () => {});
}

export async function updateMediaItem(
  id: string,
  updates: UpdateMediaItemDto
): Promise<MediaItem> {
  const { data } = await api.patch<{ ok: boolean; item: MediaItem }>(
    `/livekit/media-library/${id}`,
    updates
  );
  return data.item;
}

export async function deleteMediaItem(id: string): Promise<void> {
  await api.delete(`/livekit/media-library/${id}`);
}

export async function activateMediaItem(
  id: string,
  eventSlug: string,
  overrides?: MediaOverrides
): Promise<void> {
  await api.post(`/livekit/media-library/${id}/activate`, {
    eventSlug,
    overrides,
  });
}

export async function deactivateMedia(
  eventSlug: string,
  type: "visual" | "audio" | "all" = "all"
): Promise<void> {
  await api.post("/livekit/media-library/deactivate", { eventSlug, type });
}

export async function getEffectiveMediaConfig(
  eventSlug: string
): Promise<EffectiveMediaConfig> {
  const { data } = await api.get<EffectiveMediaConfig>(
    `/livekit/media-library/effective-config?eventSlug=${encodeURIComponent(eventSlug)}`
  );
  return data;
}
