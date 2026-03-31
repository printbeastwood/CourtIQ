/**
 * CourtIQ Color Palette
 *
 * Brand: Court-inspired blue — energetic, trustworthy, premium.
 * Court surfaces map to distinct hues for instant visual recognition.
 */

export const colors = {
  brand: {
    50: "#EFF6FF",
    100: "#DBEAFE",
    200: "#BFDBFE",
    300: "#93C5FD",
    400: "#60A5FA",
    500: "#3B82F6",
    600: "#2563EB",
    700: "#1D4ED8",
    800: "#1E40AF",
    900: "#1E3A8A",
    950: "#0F172A",
  },

  court: {
    glass: "#06B6D4",
    panoramic: "#8B5CF6",
    concrete: "#6B7280",
    turf: "#22C55E",
  },

  semantic: {
    success: "#22C55E",
    successLight: "#DCFCE7",
    warning: "#F59E0B",
    warningLight: "#FEF3C7",
    error: "#EF4444",
    errorLight: "#FEE2E2",
    info: "#3B82F6",
    infoLight: "#DBEAFE",
  },

  surface: {
    background: "#F8FAFC",
    card: "#FFFFFF",
    elevated: "#FFFFFF",
    border: "#F1F5F9",
    borderStrong: "#E2E8F0",
  },

  text: {
    primary: "#0F172A",
    secondary: "#475569",
    tertiary: "#94A3B8",
    inverse: "#FFFFFF",
    brand: "#2563EB",
  },

  dark: {
    background: "#0F172A",
    card: "#1E293B",
    elevated: "#334155",
    border: "#334155",
    borderStrong: "#475569",
    textPrimary: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textTertiary: "#64748B",
  },
} as const;

export type BrandShade = keyof typeof colors.brand;
export type CourtSurface = keyof typeof colors.court;
