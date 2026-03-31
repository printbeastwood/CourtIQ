import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { ChatBubble, ActionCard, RacketIcon } from "@courtiq/ui";
import { useConciergeWs, type WsMessageType } from "../../src/lib/websocket";
import { useAuthStore } from "../../src/stores/auth";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolsUsed?: string[];
}

const QUICK_REPLIES = [
  "Find me a court tonight",
  "What's available near Sukhumvit?",
  "Show glass courts under 500 THB",
  "Any outdoor courts this weekend?",
];

export default function ConciergeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const msgCounter = useRef(0);

  const onMessage = useCallback(
    (msg: WsMessageType) => {
      switch (msg.type) {
        case "message":
          setThinking(false);
          setActiveTools([]);
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${++msgCounter.current}`,
              role: "assistant",
              content: msg.content,
              toolsUsed: msg.toolsUsed,
            },
          ]);
          break;
        case "tool_start":
          setThinking(true);
          setActiveTools((prev) => [...prev, msg.tool]);
          break;
        case "tool_end":
          setActiveTools((prev) => prev.filter((t) => t !== msg.tool));
          break;
        case "error":
          setThinking(false);
          setActiveTools([]);
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${++msgCounter.current}`,
              role: "system",
              content: `Error: ${msg.error}`,
            },
          ]);
          break;
      }
    },
    [],
  );

  const { connect, send, connected } = useConciergeWs({
    onMessage,
  });

  useEffect(() => {
    if (userId) connect();
  }, [userId, connect]);

  const handleSend = (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || !connected) return;
    if (!text) setInput("");
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${++msgCounter.current}`,
        role: "user",
        content: message,
      },
    ]);
    setThinking(true);
    send(message);
  };

  const toolLabel = (tool: string) => {
    const labels: Record<string, string> = {
      search_courts: "Searching courts...",
      get_user_preferences: "Checking your preferences...",
      check_weather: "Checking weather...",
      initiate_booking: "Initiating booking...",
      update_preference: "Updating preferences...",
    };
    return labels[tool] ?? `Using ${tool}...`;
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <Animated.View entering={FadeIn.duration(200)} className="mb-3">
      <ChatBubble
        role={item.role}
        content={item.content}
        toolsUsed={item.toolsUsed}
      />
    </Animated.View>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3 border-b border-gray-100 bg-white">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-brand-100 items-center justify-center mr-3">
            <RacketIcon size={20} color="#2563EB" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">
              {t("concierge.title")}
            </Text>
            <View className="flex-row items-center mt-0.5">
              <View
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  connected ? "bg-green-500" : "bg-gray-300"
                }`}
              />
              <Text className="text-xs text-gray-400">
                {connected ? "Online" : "Connecting..."}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center">
              <Animated.View entering={FadeInUp.delay(100).duration(400)}>
                <View className="w-16 h-16 rounded-full bg-brand-100 items-center justify-center mb-4 self-center">
                  <RacketIcon size={32} color="#2563EB" />
                </View>
              </Animated.View>
              <Animated.View entering={FadeInUp.delay(200).duration(400)}>
                <Text className="text-lg font-semibold text-gray-800 text-center">
                  Your Padel Concierge
                </Text>
                <Text className="text-sm text-gray-400 mt-1.5 text-center px-8 leading-5">
                  I can find courts, check availability, compare prices, and
                  book slots for you
                </Text>
              </Animated.View>

              {/* Quick replies */}
              <Animated.View
                entering={FadeInUp.delay(400).duration(400)}
                className="mt-6 w-full px-2"
              >
                <View className="flex-row flex-wrap justify-center gap-2">
                  {QUICK_REPLIES.map((reply) => (
                    <Pressable
                      key={reply}
                      className="bg-white border border-brand-200 rounded-full px-4 py-2.5"
                      onPress={() => handleSend(reply)}
                    >
                      <Text className="text-sm text-brand-600 font-medium">
                        {reply}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            </View>
          }
        />

        {/* Thinking indicator */}
        {thinking && (
          <View className="px-5 pb-2">
            <View className="flex-row items-center">
              <View className="flex-row gap-1 mr-2">
                <Animated.View
                  entering={FadeIn.duration(300)}
                  className="w-1.5 h-1.5 rounded-full bg-brand-400"
                />
                <Animated.View
                  entering={FadeIn.delay(150).duration(300)}
                  className="w-1.5 h-1.5 rounded-full bg-brand-300"
                />
                <Animated.View
                  entering={FadeIn.delay(300).duration(300)}
                  className="w-1.5 h-1.5 rounded-full bg-brand-200"
                />
              </View>
              <Text className="text-sm text-brand-500">
                {activeTools.length > 0
                  ? toolLabel(activeTools[activeTools.length - 1])
                  : t("concierge.thinking")}
              </Text>
            </View>
          </View>
        )}

        {/* Input */}
        <View className="flex-row items-end px-4 pb-4 pt-2 bg-white border-t border-gray-100">
          <TextInput
            className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 text-base text-gray-900 max-h-[100px] border border-gray-100"
            placeholder={t("concierge.placeholder")}
            placeholderTextColor="#94A3B8"
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
          />
          <Pressable
            className={`ml-2 w-11 h-11 rounded-full items-center justify-center ${
              input.trim() && connected ? "bg-brand-600" : "bg-gray-200"
            }`}
            onPress={() => handleSend()}
            disabled={!input.trim() || !connected}
          >
            <Text className="text-white text-base font-bold">↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
