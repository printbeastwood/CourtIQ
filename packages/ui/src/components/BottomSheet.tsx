import { type ReactNode } from "react";
import { View, Text, Pressable, Modal, type ModalProps } from "react-native";

export interface BottomSheetProps extends Omit<ModalProps, "children"> {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  snapHeight?: "auto" | "half" | "full";
}

const heightClasses: Record<string, string> = {
  auto: "",
  half: "h-[50%]",
  full: "h-[90%]",
};

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  snapHeight = "auto",
  ...props
}: BottomSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      {...props}
    >
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View
        className={`bg-white rounded-t-3xl pb-8 ${heightClasses[snapHeight]}`}
      >
        <View className="items-center pt-3 pb-2">
          <View className="w-10 h-1 rounded-full bg-gray-300" />
        </View>

        {title && (
          <View className="px-5 pb-3 border-b border-gray-100">
            <Text className="text-lg font-semibold text-gray-900">{title}</Text>
          </View>
        )}

        <View className="px-5 pt-4">{children}</View>
      </View>
    </Modal>
  );
}
