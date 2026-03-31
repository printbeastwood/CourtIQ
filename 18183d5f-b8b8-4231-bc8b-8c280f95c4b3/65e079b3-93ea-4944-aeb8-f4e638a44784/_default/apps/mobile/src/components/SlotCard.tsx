import { View, Text, Pressable } from "react-native";
import { formatPrice, formatTime, surfaceLabel, surfaceColor } from "../lib/format";

interface SlotCardProps {
  venueName: string;
  courtName: string;
  surface: string;
  indoor: boolean;
  startsAt: string;
  endsAt: string;
  priceCents: number;
  currency: string;
  onPress?: () => void;
}

export function SlotCard({
  venueName,
  courtName,
  surface,
  indoor,
  startsAt,
  endsAt,
  priceCents,
  currency,
  onPress,
}: SlotCardProps) {
  return (
    <Pressable
      className="bg-white rounded-xl p-4 mb-2 border border-gray-100"
      onPress={onPress}
    >
      <View className="flex-row justify-between items-center">
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">
            {formatTime(startsAt)} – {formatTime(endsAt)}
          </Text>
          <Text className="text-sm text-gray-500 mt-1">
            {venueName} · {courtName}
          </Text>
        </View>
        <Text className="text-lg font-bold text-brand-600">
          {formatPrice(priceCents, currency)}
        </Text>
      </View>

      <View className="flex-row mt-2 gap-2">
        <View
          className="px-2 py-0.5 rounded-full"
          style={{ backgroundColor: surfaceColor(surface) + "20" }}
        >
          <Text
            className="text-xs font-medium"
            style={{ color: surfaceColor(surface) }}
          >
            {surfaceLabel(surface)}
          </Text>
        </View>
        <View className="bg-gray-100 px-2 py-0.5 rounded-full">
          <Text className="text-xs text-gray-600">
            {indoor ? "Indoor" : "Outdoor"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
