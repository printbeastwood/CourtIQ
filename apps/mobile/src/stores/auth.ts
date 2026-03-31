import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

interface AuthState {
  token: string | null;
  userId: string | null;
  phone: string | null;
  displayName: string | null;
  isOnboarded: boolean;
  isLoading: boolean;

  setAuth: (params: {
    token: string;
    userId: string;
    phone: string;
    displayName?: string;
  }) => void;
  setOnboarded: (value: boolean) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

const TOKEN_KEY = "courtiq_jwt";
const USER_KEY = "courtiq_user";

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  phone: null,
  displayName: null,
  isOnboarded: false,
  isLoading: true,

  setAuth: async ({ token, userId, phone, displayName }) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(
      USER_KEY,
      JSON.stringify({ userId, phone, displayName }),
    );
    set({ token, userId, phone, displayName: displayName ?? null });
  },

  setOnboarded: async (value: boolean) => {
    await SecureStore.setItemAsync("courtiq_onboarded", value ? "1" : "0");
    set({ isOnboarded: value });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync("courtiq_onboarded");
    set({
      token: null,
      userId: null,
      phone: null,
      displayName: null,
      isOnboarded: false,
    });
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      const onboarded = await SecureStore.getItemAsync("courtiq_onboarded");

      if (token && userJson) {
        const user = JSON.parse(userJson);
        set({
          token,
          userId: user.userId,
          phone: user.phone,
          displayName: user.displayName ?? null,
          isOnboarded: onboarded === "1",
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
