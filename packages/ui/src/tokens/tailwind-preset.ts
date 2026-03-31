import { colors } from "./colors";

/**
 * Shared Tailwind preset for CourtIQ design tokens.
 *
 * Usage in tailwind.config.js:
 *   presets: [require("nativewind/preset"), require("@courtiq/ui/tailwind")]
 */
const courtiqPreset = {
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        court: colors.court,
        success: { DEFAULT: colors.semantic.success, light: colors.semantic.successLight },
        warning: { DEFAULT: colors.semantic.warning, light: colors.semantic.warningLight },
        error: { DEFAULT: colors.semantic.error, light: colors.semantic.errorLight },
        info: { DEFAULT: colors.semantic.info, light: colors.semantic.infoLight },
        surface: colors.surface,
      },
      fontFamily: {
        sans: ["System"],
      },
      borderRadius: {
        "4xl": "24px",
      },
    },
  },
};

export default courtiqPreset;
