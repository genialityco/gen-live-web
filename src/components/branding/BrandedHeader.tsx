/* eslint-disable react-hooks/rules-of-hooks */
import { useState, useCallback } from "react";
import { Box } from "@mantine/core";
import type { BrandingHeader } from "../../api/orgs";

interface BrandedHeaderProps {
  config?: BrandingHeader;
}

export default function BrandedHeader({ config }: BrandedHeaderProps) {
  if (!config?.enabled) return null;

  const { backgroundImageUrl, backgroundImageMobileUrl } = config;
  if (!backgroundImageUrl && !backgroundImageMobileUrl) return null;

  const mobileSrc = backgroundImageMobileUrl || backgroundImageUrl;
  const desktopSrc = backgroundImageUrl || mobileSrc;

  const MOBILE_HEIGHT = 300; // px (fallback antes de conocer el ratio)
  const DESKTOP_HEIGHT = 500; // px (fallback antes de conocer el ratio)

  // Opción B — Sin recorte (altura fluida por ratio de la imagen)
  const [mobileAR, setMobileAR] = useState<number | null>(null); // width/height
  const [desktopAR, setDesktopAR] = useState<number | null>(null);

  const onLoadMobile = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      if (img.naturalWidth && img.naturalHeight) {
        setMobileAR(img.naturalWidth / img.naturalHeight);
      }
    },
    []
  );

  const onLoadDesktop = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      if (img.naturalWidth && img.naturalHeight) {
        setDesktopAR(img.naturalWidth / img.naturalHeight);
      }
    },
    []
  );

  return (
    <>
      {/* Mobile (xs): visible solo por debajo de "sm" */}
      <Box hiddenFrom="sm" style={{ width: "100%", position: "relative" }}>
        <img
          src={mobileSrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={onLoadMobile}
          style={{
            display: "block",
            width: "100%",
            // Fallback de altura fijo hasta que conozcamos el ratio
            height: mobileAR ? "auto" : `${MOBILE_HEIGHT}px`,
            // Reservar espacio con el mismo ratio => sin recortes, sin barras
            aspectRatio: mobileAR ? `${mobileAR} / 1` : undefined,
            objectFit: "contain", // clave: no recorta
            objectPosition: "center",
            userSelect: "none",
          }}
        />
      </Box>

      {/* Desktop (sm+): visible desde "sm" en adelante */}
      <Box visibleFrom="sm" style={{ width: "100%", position: "relative" }}>
        <img
          src={desktopSrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={onLoadDesktop}
          style={{
            display: "block",
            width: "100%",
            height: desktopAR ? "auto" : `${DESKTOP_HEIGHT}px`,
            aspectRatio: desktopAR ? `${desktopAR} / 1` : undefined,
            objectFit: "contain", // sin recorte
            objectPosition: "center",
            userSelect: "none",
          }}
        />
      </Box>
    </>
  );
}
