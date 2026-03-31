import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { formatDistance } from "../lib/format";

interface VenueCardProps {
  id: string;
  name: string;
  address: string;
  amenities: string[];
  distance_km?: number;
  courtCount?: number;
}

export function VenueCard({
  id,
  name,
  address,
  amenities,
  distance_km,
  courtCount,
}: VenueCardProps) {
  const router = useRouter();

  return (
    <Pressable
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100"
      onPress={() => router.push(`/venue/${id}`)}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="text-lg font-semibold text-gray-900">{name}</Text>
          <Text className="text-sm text-gray-500 mt-1" numberOfLines={1}>
            {address}
          </Text>
        </View>
        {distance_km != null && (
          <View className="bg-brand-50 px-2 py-1 rounded-full">
            <Text className="text-xs font-medium text-brand-700">
              {formatDistance(distance_km)}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row mt-3 flex-wrap gap-1">
        {courtCount != null && (
          <View className="bg-gray-100 px-2 py-1 rounded-full">
            <Text className="text-xs text-gray-600">
              {courtCount} court{courtCount !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
        {amenities.slice(0, 3).map((a) => (
          <View key={a} className="bg-gray-100 px-2 py-1 rounded-full">
            <Text className="text-xs text-gray-600">{a}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}
