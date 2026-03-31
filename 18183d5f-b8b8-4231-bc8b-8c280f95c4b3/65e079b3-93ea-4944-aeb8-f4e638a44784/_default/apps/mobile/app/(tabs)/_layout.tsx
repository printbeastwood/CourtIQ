import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { View, Text } from "react-native";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View className="items-center pt-1">
      <Text
        className={`text-xs mt-1 ${
          focused ? "text-brand-600 font-semibold" : "text-gray-400"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#F1F5F9",
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#94A3B8",
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t("tabs.home")} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t("tabs.search")} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="concierge"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t("tabs.concierge")} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t("tabs.bookings")} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t("tabs.profile")} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
