import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export const config = {
  apiUrl: (extra.apiUrl as string) ?? "http://localhost:3000/api/v1",
  wsUrl: (extra.wsUrl as string) ?? "ws://localhost:3000/api/v1/concierge/ws",
};
