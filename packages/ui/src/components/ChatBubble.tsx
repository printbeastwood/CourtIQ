import { View, Text, type ViewProps } from "react-native";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatBubbleProps extends Omit<ViewProps, "role"> {
  role: ChatRole;
  content: string;
  toolsUsed?: string[];
  timestamp?: string;
}

const roleStyles: Record<ChatRole, { container: string; text: string }> = {
  user: {
    container: "bg-brand-600 rounded-2xl rounded-br-sm self-end",
    text: "text-white",
  },
  assistant: {
    container: "bg-white border border-gray-100 rounded-2xl rounded-bl-sm self-start",
    text: "text-gray-900",
  },
  system: {
    container: "bg-red-50 border border-red-200 rounded-2xl rounded-bl-sm self-start",
    text: "text-red-700",
  },
};

export function ChatBubble({
  role,
  content,
  toolsUsed,
  timestamp,
  ...props
}: ChatBubbleProps) {
  const s = roleStyles[role];

  return (
    <View className={`mb-3 max-w-[85%] ${role === "user" ? "self-end" : "self-start"}`} {...props}>
      <View className={`px-4 py-3 ${s.container}`}>
        <Text className={`text-base ${s.text}`}>{content}</Text>
      </View>
      <View className="flex-row items-center mt-1 gap-2">
        {toolsUsed && toolsUsed.length > 0 && (
          <Text className="text-xs text-gray-400">
            Used: {toolsUsed.join(", ")}
          </Text>
        )}
        {timestamp && (
          <Text className="text-xs text-gray-300">{timestamp}</Text>
        )}
      </View>
    </View>
  );
}

export interface ActionCardProps {
  title: string;
  description?: string;
  actions: Array<{ label: string; onPress: () => void }>;
}

export function ActionCard({ title, description, actions }: ActionCardProps) {
  return (
    <View className="mb-3 max-w-[85%] self-start">
      <View className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <Text className="text-base font-semibold text-gray-900">{title}</Text>
        {description && (
          <Text className="text-sm text-gray-500 mt-1">{description}</Text>
        )}
        <View className="flex-row flex-wrap gap-2 mt-3">
          {actions.map((action) => (
            <View
              key={action.label}
              className="bg-brand-50 px-3 py-1.5 rounded-lg"
              onTouchEnd={action.onPress}
            >
              <Text className="text-sm font-medium text-brand-700">
                {action.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
