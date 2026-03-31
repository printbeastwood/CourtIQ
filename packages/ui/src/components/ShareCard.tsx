import { View, Text } from "react-native";
import Svg, { Rect, Line, Circle } from "react-native-svg";
import { colors } from "../tokens/colors";

/** Inline mini logo for share cards */
function MiniLogo({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <Rect width="512" height="512" rx="108" fill={colors.brand[600]} />
      <Rect x="80" y="80" width="352" height="352" rx="40" fill={colors.brand[700]} opacity={0.5} />
      <Line x1="256" y1="112" x2="256" y2="400" stroke="white" strokeWidth={16} strokeLinecap="round" opacity={0.5} />
      <Line x1="112" y1="256" x2="400" y2="256" stroke="white" strokeWidth={12} strokeLinecap="round" opacity={0.3} />
      <Rect x="112" y="144" width="288" height="224" rx="24" stroke="white" strokeWidth={10} fill="none" opacity={0.25} />
      <Circle cx="380" cy="132" r="44" fill={colors.brand[400]} />
      <Circle cx="380" cy="132" r="22" fill="white" />
      <Circle cx="380" cy="132" r="8" fill={colors.brand[600]} />
    </Svg>
  );
}

export interface RefLinkCardProps {
  inviterName: string;
  message?: string;
}

/** Reflink invite card — "Join me on CourtIQ" */
export function RefLinkCard({
  inviterName,
  message = "Join me on CourtIQ — your AI padel concierge",
}: RefLinkCardProps) {
  return (
    <View
      className="w-full rounded-2xl overflow-hidden"
      style={{ backgroundColor: colors.brand[950] }}
    >
      {/* Header stripe */}
      <View
        className="h-2 w-full"
        style={{ backgroundColor: colors.brand[600] }}
      />
      <View className="p-6">
        {/* Logo + brand */}
        <View className="flex-row items-center mb-4">
          <MiniLogo size={36} />
          <View className="ml-3">
            <Text
              className="text-base font-semibold"
              style={{ color: colors.dark.textPrimary }}
            >
              Court<Text style={{ color: colors.brand[400] }}>IQ</Text>
            </Text>
            <Text
              className="text-xs"
              style={{ color: colors.dark.textTertiary }}
            >
              AI Padel Concierge
            </Text>
          </View>
        </View>
        {/* Invite message */}
        <Text
          className="text-xl font-bold mb-2"
          style={{ color: colors.dark.textPrimary }}
        >
          {inviterName} invited you!
        </Text>
        <Text
          className="text-sm mb-4"
          style={{ color: colors.dark.textSecondary }}
        >
          {message}
        </Text>
        {/* CTA */}
        <View
          className="rounded-xl py-3 px-6 items-center"
          style={{ backgroundColor: colors.brand[600] }}
        >
          <Text className="text-white font-semibold text-sm">
            Get Started Free
          </Text>
        </View>
      </View>
    </View>
  );
}

export interface VenueShareCardProps {
  venueName: string;
  address: string;
  surfaceType?: string;
  priceRange?: string;
  imageUri?: string;
}

/** Venue share card — when sharing a court link */
export function VenueShareCard({
  venueName,
  address,
  surfaceType,
  priceRange,
}: VenueShareCardProps) {
  return (
    <View className="w-full rounded-2xl overflow-hidden bg-white">
      {/* Venue hero placeholder */}
      <View
        className="h-40 w-full items-center justify-center"
        style={{ backgroundColor: colors.brand[100] }}
      >
        <MiniLogo size={56} />
      </View>
      {/* Info */}
      <View className="p-4">
        <Text
          className="text-lg font-bold mb-1"
          style={{ color: colors.text.primary }}
        >
          {venueName}
        </Text>
        <Text
          className="text-sm mb-3"
          style={{ color: colors.text.secondary }}
        >
          {address}
        </Text>
        {/* Meta badges */}
        <View className="flex-row gap-2">
          {surfaceType && (
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: colors.brand[50] }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: colors.brand[700] }}
              >
                {surfaceType}
              </Text>
            </View>
          )}
          {priceRange && (
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: colors.semantic.successLight }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: "#15803D" }}
              >
                {priceRange}
              </Text>
            </View>
          )}
        </View>
        {/* Brand footer */}
        <View className="flex-row items-center mt-3 pt-3 border-t border-gray-100">
          <MiniLogo size={20} />
          <Text
            className="text-xs ml-2"
            style={{ color: colors.text.tertiary }}
          >
            Book on CourtIQ
          </Text>
        </View>
      </View>
    </View>
  );
}

/** OG meta defaults for web pages */
export const ogDefaults = {
  siteName: "CourtIQ",
  title: "CourtIQ — Your AI Padel Concierge",
  description:
    "Find and book the perfect padel court in Bangkok. AI-powered recommendations, real-time availability across all platforms.",
  type: "website" as const,
  locale: "en_US",
  themeColor: colors.brand[600],
  backgroundColor: colors.brand[950],
} as const;
