import { View, Text, Pressable, ScrollView } from "react-native";

export interface TimeSlot {
  id: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
  priceCents?: number;
  currency?: string;
}

export interface SlotPickerProps {
  slots: TimeSlot[];
  selectedId?: string | null;
  onSelect: (slot: TimeSlot) => void;
  formatTime?: (iso: string) => string;
  formatPrice?: (cents: number, currency: string) => string;
}

function defaultFormatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function defaultFormatPrice(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(0)}`;
}

export function SlotPicker({
  slots,
  selectedId,
  onSelect,
  formatTime = defaultFormatTime,
  formatPrice = defaultFormatPrice,
}: SlotPickerProps) {
  return (
    <ScrollView
      horizontal={false}
      showsVerticalScrollIndicator={false}
      className="flex-1"
    >
      <View className="flex-row flex-wrap gap-2 p-1">
        {slots.map((slot) => {
          const isSelected = slot.id === selectedId;
          const isUnavailable = !slot.available;

          return (
            <Pressable
              key={slot.id}
              onPress={() => !isUnavailable && onSelect(slot)}
              disabled={isUnavailable}
              className={`min-w-[100px] rounded-xl border px-3 py-2.5 items-center ${
                isSelected
                  ? "bg-brand-600 border-brand-600"
                  : isUnavailable
                    ? "bg-gray-50 border-gray-100 opacity-40"
                    : "bg-white border-gray-200 active:border-brand-300 active:bg-brand-50"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  isSelected ? "text-white" : "text-gray-900"
                }`}
              >
                {formatTime(slot.startsAt)}
              </Text>
              <Text
                className={`text-xs mt-0.5 ${
                  isSelected ? "text-brand-100" : "text-gray-500"
                }`}
              >
                {formatTime(slot.endsAt)}
              </Text>
              {slot.priceCents != null && slot.currency && (
                <Text
                  className={`text-xs font-medium mt-1 ${
                    isSelected ? "text-white" : "text-brand-600"
                  }`}
                >
                  {formatPrice(slot.priceCents, slot.currency)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
