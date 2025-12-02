/* eslint-disable react-hooks/rules-of-hooks */
import { useState, useCallback } from "react";
import { Box } from "@mantine/core";
import type { BrandingFooter } from "../../api/orgs";

interface BrandedFooterProps {
  config?: BrandingFooter;
}

export default function BrandedFooter({ config }: BrandedFooterProps) {
  if (!config?.enabled) return null;

  const { backgroundImageUrl, backgroundImageMobileUrl } = config;
  if (!backgroundImageUrl && !backgroundImageMobileUrl) return null;

  const mobileSrc = backgroundImageMobileUrl || backgroundImageUrl;
  const desktopSrc = backgroundImageUrl || mobileSrc;

  const MOBILE_FALLBACK = 100; // px antes del ratio
  const DESKTOP_FALLBACK = 220; // px antes del ratio

  // Ratio dinámico (width/height)
  const [mobileAR, setMobileAR] = useState<number | null>(null);
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
      {/* Footer Mobile */}
      <Box hiddenFrom="sm" style={{ width: "100%", marginTop: "3rem" }}>
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
            height: mobileAR ? "auto" : `${MOBILE_FALLBACK}px`,
            aspectRatio: mobileAR ? `${mobileAR} / 1` : undefined,
            objectFit: "contain", // ✔ nunca recorta
            objectPosition: "center",
            userSelect: "none",
          }}
        />
      </Box>

      {/* Footer Desktop */}
      <Box visibleFrom="sm" style={{ width: "100%", marginTop: "3rem" }}>
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
            height: desktopAR ? "auto" : `${DESKTOP_FALLBACK}px`,
            aspectRatio: desktopAR ? `${desktopAR} / 1` : undefined,
            objectFit: "contain", // ✔ sin cortes en ningún navegador/zoom
            objectPosition: "center",
            userSelect: "none",
          }}
        />
      </Box>
    </>
  );
}
