import { useState } from "react";
import { View, TextInput, Text, type TextInputProps } from "react-native";

export type InputVariant = "default" | "search" | "otp";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  variant?: InputVariant;
}

export function Input({
  label,
  error,
  variant = "default",
  className = "",
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);

  const baseClass =
    "bg-gray-100 text-base text-gray-900 rounded-2xl px-4 py-3";
  const focusClass = focused ? "border-brand-500 border" : "border border-transparent";
  const errorClass = error ? "border-error border" : "";

  return (
    <View className={className}>
      {label && (
        <Text className="text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </Text>
      )}
      <TextInput
        className={`${baseClass} ${focusClass} ${errorClass}`}
        placeholderTextColor="#94A3B8"
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
      {error && (
        <Text className="text-xs text-error mt-1">{error}</Text>
      )}
    </View>
  );
}

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
}

export function OtpInput({ length = 6, value, onChange }: OtpInputProps) {
  return (
    <View className="flex-row justify-center gap-2">
      {Array.from({ length }).map((_, i) => (
        <View
          key={i}
          className={`w-12 h-14 rounded-xl border-2 items-center justify-center ${
            value[i] ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-gray-50"
          }`}
        >
          <Text className="text-2xl font-bold text-gray-900">
            {value[i] ?? ""}
          </Text>
        </View>
      ))}
      <TextInput
        className="absolute inset-0 opacity-0"
        value={value}
        onChangeText={(t) => onChange(t.slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
      />
    </View>
  );
}
