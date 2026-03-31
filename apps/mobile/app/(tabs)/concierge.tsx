import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn } from "react-native-reanimated";
import { useConciergeWs, type WsMessageType } from "../../src/lib/websocket";
import { useAuthStore } from "../../src/stores/auth";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolsUsed?: string[];
}

export default function ConciergeScreen() {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.userId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  let msgCounter = useRef(0);

  const onMessage = useCallback((msg: WsMessageType) => {
    switch (msg.type) {
      case "message":
        setThinking(false);
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
        break;
      case "tool_end":
        break;
      case "error":
        setThinking(false);
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
  }, []);

  const { connect, send, connected, conversationId } = useConciergeWs({
    onMessage,
  });

  useEffect(() => {
    if (userId) connect();
  }, [userId, connect]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !connected) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${++msgCounter.current}`,
        role: "user",
        content: text,
      },
    ]);
    setThinking(true);
    send(text);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const isSystem = item.role === "system";

    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        className={`mb-3 max-w-[85%] ${
          isUser ? "self-end" : "self-start"
        }`}
      >
        <View
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? "bg-brand-600 rounded-br-sm"
              : isSystem
                ? "bg-red-50 border border-red-200 rounded-bl-sm"
                : "bg-white border border-gray-100 rounded-bl-sm"
          }`}
        >
          <Text
            className={`text-base ${
              isUser ? "text-white" : isSystem ? "text-red-700" : "text-gray-900"
            }`}
          >
            {item.content}
          </Text>
        </View>
        {item.toolsUsed && item.toolsUsed.length > 0 && (
          <Text className="text-xs text-gray-400 mt-1">
            Used: {item.toolsUsed.join(", ")}
          </Text>
        )}
      </Animated.View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-4 pt-4 pb-2 border-b border-gray-100 bg-white">
        <Text className="text-xl font-bold text-gray-900">
          {t("concierge.title")}
        </Text>
        <View className="flex-row items-center mt-1">
          <View
            className={`w-2 h-2 rounded-full mr-2 ${
              connected ? "bg-green-500" : "bg-gray-300"
            }`}
          />
          <Text className="text-xs text-gray-500">
            {connected ? "Connected" : "Connecting..."}
          </Text>
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
              <Text className="text-6xl mb-4">🏸</Text>
              <Text className="text-lg font-semibold text-gray-700">
                {t("concierge.title")}
              </Text>
              <Text className="text-sm text-gray-400 mt-1 text-center px-8">
                Ask me to find courts, check availability, or book a slot
              </Text>
            </View>
          }
        />

        {thinking && (
          <View className="px-4 pb-2">
            <Text className="text-sm text-brand-500 italic">
              {t("concierge.thinking")}
            </Text>
          </View>
        )}

        <View className="flex-row items-end px-4 pb-4 pt-2 bg-white border-t border-gray-100">
          <TextInput
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-base text-gray-900 max-h-[100px]"
            placeholder={t("concierge.placeholder")}
            placeholderTextColor="#94A3B8"
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            className={`ml-2 w-12 h-12 rounded-full items-center justify-center ${
              input.trim() && connected ? "bg-brand-600" : "bg-gray-200"
            }`}
            onPress={handleSend}
            disabled={!input.trim() || !connected}
          >
            <Text className="text-white text-lg">↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
