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

export async function uploadMediaItem(
  eventSlug: string,
  file: File,
  metadata: CreateMediaItemDto
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
    }
  );
  return data.item;
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
