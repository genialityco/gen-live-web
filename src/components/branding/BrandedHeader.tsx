import { Box } from '@mantine/core';
import type { BrandingHeader } from '../../api/orgs';

interface BrandedHeaderProps {
  config?: BrandingHeader;
}

export default function BrandedHeader({ config }: BrandedHeaderProps) {
  if (!config?.enabled) return null;

  const backgroundImage = config.backgroundImageUrl;
  const backgroundImageMobile = config.backgroundImageMobileUrl || backgroundImage;

  return (
    <>
      {/* Header Desktop */}
      <Box
        hiddenFrom="sm"
        style={{
          width: '100%',
          height: '500px',
          backgroundImage: backgroundImageMobile ? `url(${backgroundImageMobile})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}
      />
      
      {/* Header Mobile */}
      <Box
        visibleFrom="sm"
        style={{
          width: '100%',
          height: '300px',
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}
      />
    </>
  );
}
