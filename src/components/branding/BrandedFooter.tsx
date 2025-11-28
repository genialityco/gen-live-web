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
          height: '100px',
          backgroundImage: backgroundImageMobile ? `url(${backgroundImageMobile})` : undefined,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
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
          height: '220px',
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          position: 'relative',
          marginTop: '4rem',
        }}
      />
    </>
  );
}
