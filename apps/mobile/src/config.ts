import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export const config = {
  apiUrl: (extra.apiUrl as string) ?? "https://courtiq-api.fly.dev/api/v1",
  wsUrl: (extra.wsUrl as string) ?? "wss://courtiq-api.fly.dev/api/v1/concierge/ws",
};
