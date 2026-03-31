import { View, Text, Image, type ImageSourcePropType } from "react-native";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  size?: AvatarSize;
  source?: ImageSourcePropType | null;
  name?: string;
  isVenue?: boolean;
}

const sizeMap: Record<AvatarSize, { container: string; text: string; px: number }> = {
  sm: { container: "w-8 h-8", text: "text-xs", px: 32 },
  md: { container: "w-10 h-10", text: "text-sm", px: 40 },
  lg: { container: "w-14 h-14", text: "text-lg", px: 56 },
  xl: { container: "w-20 h-20", text: "text-2xl", px: 80 },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({ size = "md", source, name, isVenue }: AvatarProps) {
  const s = sizeMap[size];
  const borderRadius = isVenue ? "rounded-xl" : "rounded-full";

  if (source) {
    return (
      <Image
        source={source}
        className={`${s.container} ${borderRadius}`}
        style={{ width: s.px, height: s.px }}
      />
    );
  }

  return (
    <View
      className={`${s.container} ${borderRadius} bg-brand-100 items-center justify-center`}
    >
      <Text className={`${s.text} font-semibold text-brand-700`}>
        {name ? getInitials(name) : "?"}
      </Text>
    </View>
  );
}
