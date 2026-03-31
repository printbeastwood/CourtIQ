import { type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";

export interface TabItem {
  key: string;
  label: string;
  icon?: ReactNode;
}

export interface TabBarProps {
  tabs: TabItem[];
  activeKey: string;
  onTabPress: (key: string) => void;
}

export function TabBar({ tabs, activeKey, onTabPress }: TabBarProps) {
  return (
    <View className="flex-row bg-white border-t border-gray-100 pb-5 pt-2 px-2">
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            className="flex-1 items-center py-1"
            onPress={() => onTabPress(tab.key)}
          >
            {tab.icon && (
              <View className={isActive ? "text-brand-600" : "text-gray-400"}>
                {tab.icon}
              </View>
            )}
            <Text
              className={`text-xs mt-1 ${
                isActive
                  ? "text-brand-600 font-semibold"
                  : "text-gray-400 font-normal"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
