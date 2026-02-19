/* eslint-disable @typescript-eslint/no-explicit-any */
// --------------------------------------------------------------
// Branding helpers (igual que Attend)
// --------------------------------------------------------------
export const DEFAULTS = {
  primary: "#228BE6",
  secondary: "#7C3AED",
  accent: "#14B8A6",
  background: "#F8FAFC",
  text: "#0F172A",
};

export type BrandingColors = {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
};

export function resolveBrandingColorsFromBranding(colors?: BrandingColors | null) {
  const c = colors || {};
  return {
    primary: c.primary || DEFAULTS.primary,
    secondary: c.secondary || DEFAULTS.secondary,
    accent: c.accent || DEFAULTS.accent,
    background: c.background || DEFAULTS.background,
    text: c.text || DEFAULTS.text,
  };
}

export function makeTheme(brand: ReturnType<typeof resolveBrandingColorsFromBranding>) {
  const toScale = (hex: string) =>
    new Array(10).fill(hex) as [
      string, string, string, string, string,
      string, string, string, string, string
    ];

  return {
    colors: {
      brand: toScale(brand.primary),
      accent: toScale(brand.accent),
    },
    primaryColor: "brand" as const,
    fontFamily:
      'Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    headings: { fontWeight: "800" },
    defaultRadius: "md" as const,
    components: {
      Card: {
        styles: {
          root: {
            border: "1px solid var(--mantine-color-gray-3)",
            boxShadow: "0 10px 24px rgba(2,6,23,0.06)",
          },
        },
      },
      Button: { defaultProps: { radius: "md", color: "brand" } },
    },
  };
}

export function cssVars(
  brand: ReturnType<typeof resolveBrandingColorsFromBranding>
): React.CSSProperties {
  return {
    ["--primary-color" as any]: brand.primary,
    ["--secondary-color" as any]: brand.secondary,
    ["--accent-color" as any]: brand.accent,
    ["--bg-color" as any]: brand.background,
    ["--text-color" as any]: brand.text,
  } as React.CSSProperties;
}

export function pageBackground(brand: ReturnType<typeof resolveBrandingColorsFromBranding>) {
  return {
    background:
      `radial-gradient(1200px 600px at 10% 0%, ${brand.primary}14, transparent 60%),` +
      `radial-gradient(900px 500px at 90% 10%, ${brand.secondary}14, transparent 55%),` +
      `radial-gradient(900px 500px at 50% 100%, ${brand.accent}10, transparent 60%),` +
      `var(--bg-color)`,
  } as React.CSSProperties;
}
