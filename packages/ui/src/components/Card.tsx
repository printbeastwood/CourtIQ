import { View, type ViewProps } from "react-native";

export type CardVariant = "default" | "elevated" | "outline";

export interface CardProps extends ViewProps {
  variant?: CardVariant;
  padded?: boolean;
}

const variantClasses: Record<CardVariant, string> = {
  default: "bg-white rounded-2xl border border-gray-100",
  elevated: "bg-white rounded-2xl shadow-sm",
  outline: "bg-white rounded-2xl border border-gray-200",
};

export function Card({
  variant = "default",
  padded = true,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <View
      className={`${variantClasses[variant]} ${padded ? "p-4" : ""} ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
