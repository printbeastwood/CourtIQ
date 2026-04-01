import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, Badge, Card } from "@courtiq/ui";
import { useAuthStore } from "../../src/stores/auth";
import {
  discoverPlayers,
  getMyConnections,
  getConnectionRequests,
  sendConnectionRequest,
  respondToConnection,
  type DiscoveredPlayerItem,
  type ConnectionItem,
  type ConnectionRequest,
} from "../../src/lib/api";
import Svg, { Path, Circle } from "react-native-svg";

type Tab = "discover" | "friends" | "requests";

function SearchIcon({ color = "#94A3B8" }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={1.5} />
      <Path
        d="M16.5 16.5L21 21"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function PersonAddIcon({ color = "#FFFFFF" }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={10} cy={8} r={4} stroke={color} strokeWidth={1.5} />
      <Path
        d="M18 21c0-3.31-3.58-6-8-6s-8 2.69-8 6"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path d="M20 8v6M17 11h6" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function PlayerCard({
  player,
  onPress,
  onConnect,
  connectingId,
  t,
}: {
  player: DiscoveredPlayerItem;
  onPress: () => void;
  onConnect: () => void;
  connectingId: string | null;
  t: (key: string) => string;
}) {
  const isConnecting = connectingId === player.userId;

  return (
    <Pressable onPress={onPress} className="mb-3">
      <Card variant="default">
        <View className="flex-row items-center">
          <Avatar size="md" name={player.displayName} />
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-gray-900">
              {player.displayName}
            </Text>
            {player.bio && (
              <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={1}>
                {player.bio}
              </Text>
            )}
            <View className="flex-row items-center mt-1 gap-2">
              {player.rating != null ? (
                <Badge variant="brand">
                  {player.rating} · {player.gamesPlayed}G
                </Badge>
              ) : (
                <Badge variant="default">{t("players.unrated")}</Badge>
              )}
              {player.playFrequency && (
                <Text className="text-xs text-gray-400">
                  {t(`players.frequency.${player.playFrequency}`)}
                </Text>
              )}
            </View>
          </View>

          {/* Connection action */}
          {player.connectionStatus === "accepted" ? (
            <View className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
              <Text className="text-xs font-medium text-emerald-600">
                {t("players.connected")}
              </Text>
            </View>
          ) : player.connectionStatus === "pending" ? (
            <View className="bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
              <Text className="text-xs font-medium text-amber-600">
                {t("players.pending")}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onConnect();
              }}
              disabled={isConnecting}
              className="bg-brand-600 px-3 py-2 rounded-lg flex-row items-center"
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <PersonAddIcon />
                  <Text className="text-xs font-semibold text-white ml-1.5">
                    {t("players.connect")}
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

function FriendCard({
  item,
  onPress,
  t,
}: {
  item: ConnectionItem;
  onPress: () => void;
  t: (key: string) => string;
}) {
  return (
    <Pressable onPress={onPress} className="mb-3">
      <Card variant="default">
        <View className="flex-row items-center">
          <Avatar size="md" name={item.profile.displayName} />
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-gray-900">
              {item.profile.displayName}
            </Text>
            <View className="flex-row items-center mt-1 gap-2">
              {item.profile.rating != null ? (
                <Badge variant="brand">
                  {item.profile.rating} · {item.profile.gamesPlayed}G
                </Badge>
              ) : (
                <Badge variant="default">{t("players.unrated")}</Badge>
              )}
            </View>
          </View>
          <View className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <Text className="text-xs font-medium text-emerald-600">
              {t("players.connected")}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function RequestCard({
  request,
  onAccept,
  onDecline,
  responding,
  t,
}: {
  request: ConnectionRequest;
  onAccept: () => void;
  onDecline: () => void;
  responding: boolean;
  t: (key: string) => string;
}) {
  return (
    <Card variant="default">
      <View className="flex-row items-center mb-3">
        <Avatar size="md" name={request.displayName} />
        <View className="ml-3 flex-1">
          <Text className="text-base font-semibold text-gray-900">
            {request.displayName}
          </Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            {new Date(request.sentAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-3">
        <Pressable
          onPress={onAccept}
          disabled={responding}
          className="flex-1 bg-brand-600 py-2.5 rounded-lg items-center"
        >
          <Text className="text-sm font-semibold text-white">
            {t("players.accept")}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDecline}
          disabled={responding}
          className="flex-1 bg-white py-2.5 rounded-lg items-center border border-gray-200"
        >
          <Text className="text-sm font-semibold text-gray-600">
            {t("players.decline")}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

export default function PlayersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>("discover");
  const [search, setSearch] = useState("");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const discoverQuery = useQuery({
    queryKey: ["players", "discover", search],
    queryFn: () => discoverPlayers({ search: search || undefined, limit: 30 }),
    enabled: activeTab === "discover",
  });

  const friendsQuery = useQuery({
    queryKey: ["players", "connections"],
    queryFn: () => getMyConnections("accepted"),
    enabled: activeTab === "friends",
  });

  const requestsQuery = useQuery({
    queryKey: ["players", "requests"],
    queryFn: () => getConnectionRequests(),
    enabled: activeTab === "requests",
  });

  const connectMutation = useMutation({
    mutationFn: (playerId: string) => sendConnectionRequest(playerId),
    onMutate: (playerId) => setConnectingId(playerId),
    onSettled: () => setConnectingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
    },
  });

  const respondMutation = useMutation({
    mutationFn: ({
      connectionId,
      action,
    }: {
      connectionId: string;
      action: "accept" | "decline";
    }) => respondToConnection(connectionId, action),
    onMutate: ({ connectionId }) => setRespondingId(connectionId),
    onSettled: () => setRespondingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
    },
  });

  const requestCount = requestsQuery.data?.requests?.length ?? 0;

  const onRefresh = useCallback(() => {
    if (activeTab === "discover") discoverQuery.refetch();
    if (activeTab === "friends") friendsQuery.refetch();
    if (activeTab === "requests") requestsQuery.refetch();
  }, [activeTab]);

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "discover", label: t("players.discover") },
    { key: "friends", label: t("players.friends") },
    { key: "requests", label: t("players.requests"), badge: requestCount },
  ];

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-gray-900">
          {t("players.title")}
        </Text>
      </View>

      {/* Tab bar */}
      <View className="flex-row px-5 mb-3 gap-2">
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-full flex-row items-center ${
              activeTab === tab.key ? "bg-brand-600" : "bg-white border border-gray-200"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === tab.key ? "text-white" : "text-gray-600"
              }`}
            >
              {tab.label}
            </Text>
            {tab.badge != null && tab.badge > 0 && (
              <View className="ml-1.5 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                <Text className="text-[10px] font-bold text-white">
                  {tab.badge}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Search (discover tab only) */}
      {activeTab === "discover" && (
        <View className="px-5 mb-3">
          <View className="flex-row items-center bg-white rounded-xl border border-gray-200 px-3 py-2.5">
            <SearchIcon />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("players.search_placeholder")}
              placeholderTextColor="#94A3B8"
              className="flex-1 ml-2 text-base text-gray-900"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      )}

      {/* Content */}
      {activeTab === "discover" && (
        <FlatList
          data={discoverQuery.data?.players ?? []}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <PlayerCard
              player={item}
              onPress={() => router.push(`/player/${item.userId}`)}
              onConnect={() => connectMutation.mutate(item.userId)}
              connectingId={connectingId}
              t={t}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={discoverQuery.isRefetching}
              onRefresh={onRefresh}
            />
          }
          ListEmptyComponent={
            discoverQuery.isLoading ? (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color="#2563EB" />
              </View>
            ) : (
              <View className="items-center py-12">
                <Text className="text-base text-gray-400">
                  {t("players.no_players")}
                </Text>
              </View>
            )
          }
        />
      )}

      {activeTab === "friends" && (
        <FlatList
          data={friendsQuery.data?.connections ?? []}
          keyExtractor={(item) => item.connectionId}
          renderItem={({ item }) => (
            <FriendCard
              item={item}
              onPress={() => router.push(`/player/${item.profile.userId}`)}
              t={t}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={friendsQuery.isRefetching}
              onRefresh={onRefresh}
            />
          }
          ListEmptyComponent={
            friendsQuery.isLoading ? (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color="#2563EB" />
              </View>
            ) : (
              <View className="items-center py-12">
                <Text className="text-base text-gray-400">
                  {t("players.no_friends")}
                </Text>
              </View>
            )
          }
        />
      )}

      {activeTab === "requests" && (
        <FlatList
          data={requestsQuery.data?.requests ?? []}
          keyExtractor={(item) => item.connectionId}
          renderItem={({ item }) => (
            <View className="mb-3">
              <RequestCard
                request={item}
                onAccept={() =>
                  respondMutation.mutate({
                    connectionId: item.connectionId,
                    action: "accept",
                  })
                }
                onDecline={() =>
                  respondMutation.mutate({
                    connectionId: item.connectionId,
                    action: "decline",
                  })
                }
                responding={respondingId === item.connectionId}
                t={t}
              />
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={requestsQuery.isRefetching}
              onRefresh={onRefresh}
            />
          }
          ListEmptyComponent={
            requestsQuery.isLoading ? (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color="#2563EB" />
              </View>
            ) : (
              <View className="items-center py-12">
                <Text className="text-base text-gray-400">
                  {t("players.no_requests")}
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}
