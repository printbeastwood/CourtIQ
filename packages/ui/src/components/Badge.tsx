import { View, Text } from "react-native";
import { colors } from "../tokens/colors";

export type BadgeVariant =
  | "default"
  | "brand"
  | "success"
  | "warning"
  | "error"
  | "surface";

export type BadgeSurface = "glass" | "panoramic" | "concrete" | "turf";

export interface BadgeProps {
  children: string;
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: "bg-gray-100", text: "text-gray-600" },
  brand: { bg: "bg-brand-50", text: "text-brand-700" },
  success: { bg: "bg-green-50", text: "text-green-700" },
  warning: { bg: "bg-amber-50", text: "text-amber-700" },
  error: { bg: "bg-red-50", text: "text-red-700" },
  surface: { bg: "bg-gray-100", text: "text-gray-600" },
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  const v = variantClasses[variant];
  return (
    <View className={`${v.bg} px-2.5 py-1 rounded-full`}>
      <Text className={`text-xs font-medium ${v.text}`}>{children}</Text>
    </View>
  );
}

export interface SurfaceBadgeProps {
  surface: BadgeSurface;
  label?: string;
}

const surfaceLabels: Record<BadgeSurface, string> = {
  glass: "Glass",
  panoramic: "Panoramic",
  concrete: "Concrete",
  turf: "Artificial Turf",
};

export function SurfaceBadge({ surface, label }: SurfaceBadgeProps) {
  const color = colors.court[surface];
  return (
    <View
      className="px-2.5 py-1 rounded-full"
      style={{ backgroundColor: color + "20" }}
    >
      <Text className="text-xs font-medium" style={{ color }}>
        {label ?? surfaceLabels[surface]}
      </Text>
    </View>
  );
}
