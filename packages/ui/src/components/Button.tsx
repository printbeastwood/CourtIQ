import { Pressable, Text, ActivityIndicator, type PressableProps } from "react-native";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<PressableProps, "children"> {
  children: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: "bg-brand-600 active:bg-brand-700",
    text: "text-white font-semibold",
  },
  secondary: {
    container: "bg-brand-50 border border-brand-200 active:bg-brand-100",
    text: "text-brand-700 font-semibold",
  },
  ghost: {
    container: "active:bg-gray-100",
    text: "text-gray-700 font-medium",
  },
};

const sizeClasses: Record<ButtonSize, { container: string; text: string }> = {
  sm: { container: "px-3 py-2 rounded-lg", text: "text-sm" },
  md: { container: "px-5 py-3 rounded-xl", text: "text-base" },
  lg: { container: "px-6 py-4 rounded-2xl", text: "text-lg" },
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  ...props
}: ButtonProps) {
  const v = variantClasses[variant];
  const s = sizeClasses[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      className={`flex-row items-center justify-center ${s.container} ${v.container} ${fullWidth ? "w-full" : ""} ${isDisabled ? "opacity-50" : ""}`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? "#FFFFFF" : "#2563EB"}
          className="mr-2"
        />
      ) : null}
      <Text className={`${s.text} ${v.text}`}>{children}</Text>
    </Pressable>
  );
}
