import { Box } from '@mantine/core';
import type { BrandingFooter } from '../../api/orgs';

interface BrandedFooterProps {
  config?: BrandingFooter;
}

export default function BrandedFooter({ config }: BrandedFooterProps) {
  if (!config?.enabled) return null;

  const backgroundImage = config.backgroundImageUrl;
  const backgroundImageMobile = config.backgroundImageMobileUrl || backgroundImage;

  return (
    <>
      {/* Footer Mobile */}
      <Box
        component="footer"
        hiddenFrom="sm"
        style={{
          width: '100%',
          height: '150px',
          backgroundImage: backgroundImageMobile ? `url(${backgroundImageMobile})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          marginTop: '4rem',
        }}
      />

      {/* Footer Desktop */}
      <Box
        component="footer"
        visibleFrom="sm"
        style={{
          width: '100%',
          height: '200px',
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          marginTop: '4rem',
        }}
      />
    </>
  );
}
