// Lee la caja `moov` de un MP4 en el browser (sin cargar el archivo completo en
// memoria) para detectar el codec de video declarado en `stsd`. Lo necesitamos
// porque HEVC/H.265 (comun en videos exportados directo de iPhone) produce
// pantalla negra en el compositor de LiveKit: el Chromium headless del egress
// no trae decoder de HEVC, aunque el archivo reproduzca bien en cualquier
// browser normal o en herramientas como Vimeo/QuickTime.

const CONTAINER_BOXES = new Set(["moov", "trak", "mdia", "minf", "stbl"]);
const HEVC_FOURCCS = new Set(["hvc1", "hev1", "dvh1", "dvhe"]);
const H264_FOURCCS = new Set(["avc1", "avc2", "avc3", "avc4"]);
const MAX_MOOV_SIZE = 50 * 1024 * 1024; // moov es metadata, no debería pasar de esto
const MAX_TOP_LEVEL_BOXES = 10_000;

interface BoxHeader {
  type: string;
  start: number;
  headerSize: number;
  size: number;
}

function readBoxHeader(view: DataView, offset: number): BoxHeader | null {
  if (offset + 8 > view.byteLength) return null;

  let size = view.getUint32(offset);
  const type = String.fromCharCode(
    view.getUint8(offset + 4),
    view.getUint8(offset + 5),
    view.getUint8(offset + 6),
    view.getUint8(offset + 7),
  );
  let headerSize = 8;

  if (size === 1) {
    if (offset + 16 > view.byteLength) return null;
    const hi = view.getUint32(offset + 8);
    const lo = view.getUint32(offset + 12);
    size = hi * 2 ** 32 + lo;
    headerSize = 16;
  } else if (size === 0) {
    size = view.byteLength - offset;
  }

  if (size < headerSize) return null;
  return { type, start: offset, headerSize, size };
}

async function findMoovBox(
  file: File,
): Promise<{ offset: number; headerSize: number; size: number } | null> {
  let offset = 0;
  let iterations = 0;

  while (offset < file.size && iterations < MAX_TOP_LEVEL_BOXES) {
    iterations++;
    const headerBuf = await file.slice(offset, offset + 16).arrayBuffer();
    const view = new DataView(headerBuf);
    const box = readBoxHeader(view, 0);
    if (!box) break;

    if (box.type === "moov") {
      return { offset, headerSize: box.headerSize, size: box.size };
    }
    offset += box.size;
  }

  return null;
}

function parseStsdCodecs(view: DataView, box: BoxHeader): string[] {
  const codecs: string[] = [];
  const contentStart = box.start + box.headerSize; // version(1) + flags(3) + entryCount(4)
  const end = box.start + box.size;
  if (contentStart + 8 > end) return codecs;

  const entryCount = view.getUint32(contentStart + 4);
  let pos = contentStart + 8;

  for (let i = 0; i < entryCount && pos + 8 <= end; i++) {
    const entrySize = view.getUint32(pos);
    const format = String.fromCharCode(
      view.getUint8(pos + 4),
      view.getUint8(pos + 5),
      view.getUint8(pos + 6),
      view.getUint8(pos + 7),
    );
    codecs.push(format);
    if (entrySize <= 0) break;
    pos += entrySize;
  }

  return codecs;
}

function findStsdCodecs(
  view: DataView,
  start: number,
  end: number,
  results: string[],
  depth = 0,
) {
  if (depth > 10) return; // guard contra estructuras corruptas/circulares
  let offset = start;
  let iterations = 0;

  while (offset < end && iterations < MAX_TOP_LEVEL_BOXES) {
    iterations++;
    const box = readBoxHeader(view, offset);
    if (!box) break;

    if (box.type === "stsd") {
      results.push(...parseStsdCodecs(view, box));
    } else if (CONTAINER_BOXES.has(box.type)) {
      findStsdCodecs(
        view,
        box.start + box.headerSize,
        box.start + box.size,
        results,
        depth + 1,
      );
    }
    offset = box.start + box.size;
  }
}

async function probeMp4VideoCodecFourccs(file: File): Promise<string[]> {
  const moov = await findMoovBox(file);
  if (!moov) return [];

  const readSize = Math.min(moov.size, MAX_MOOV_SIZE);
  const moovBuf = await file
    .slice(moov.offset, moov.offset + readSize)
    .arrayBuffer();
  const view = new DataView(moovBuf);

  const codecs: string[] = [];
  findStsdCodecs(view, moov.headerSize, view.byteLength, codecs);
  return codecs;
}

export type VideoCodecCheckResult =
  | { status: "ok"; codec: string }
  | { status: "unsupported"; codec: string }
  | { status: "unknown" };

/**
 * Solo aplica a contenedores MP4 (moov/stsd). WebM usa un contenedor distinto
 * (Matroska/EBML) y no presenta este problema de HEVC, así que no se valida.
 */
export async function checkVideoCodec(file: File): Promise<VideoCodecCheckResult> {
  try {
    const fourccs = await probeMp4VideoCodecFourccs(file);
    const hevc = fourccs.find((c) => HEVC_FOURCCS.has(c));
    if (hevc) return { status: "unsupported", codec: hevc };

    const h264 = fourccs.find((c) => H264_FOURCCS.has(c));
    if (h264) return { status: "ok", codec: h264 };

    return { status: "unknown" };
  } catch {
    return { status: "unknown" };
  }
}
