/**
 * CourtIQ Typography Scale
 *
 * Uses system fonts for performance. Each level maps to
 * nativewind classes for consistent cross-platform rendering.
 */

export const fontFamily = {
  sans: "System",
  mono: "monospace",
} as const;

export const typeScale = {
  h1: { fontSize: 32, lineHeight: 40, fontWeight: "800" as const },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: "700" as const },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: "600" as const },
  h4: { fontSize: 18, lineHeight: 24, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  bodyMedium: { fontSize: 16, lineHeight: 24, fontWeight: "500" as const },
  bodySm: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
  captionMedium: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
  overline: { fontSize: 11, lineHeight: 16, fontWeight: "600" as const, letterSpacing: 0.5 },
} as const;

/** Tailwind class equivalents for each type scale level */
export const typeClasses = {
  h1: "text-3xl font-extrabold leading-10",
  h2: "text-2xl font-bold leading-8",
  h3: "text-xl font-semibold leading-7",
  h4: "text-lg font-semibold leading-6",
  body: "text-base font-normal leading-6",
  bodyMedium: "text-base font-medium leading-6",
  bodySm: "text-sm font-normal leading-5",
  caption: "text-xs font-normal leading-4",
  captionMedium: "text-xs font-medium leading-4",
  overline: "text-[11px] font-semibold leading-4 tracking-wide uppercase",
} as const;

export type TypeLevel = keyof typeof typeScale;
