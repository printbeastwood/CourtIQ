import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { auth, signOut as firebaseSignOut, getIdToken } from "../lib/firebase";
import type { FirebaseAuthTypes } from "../lib/firebase";

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
  refreshToken: () => Promise<string | null>;
}

const TOKEN_KEY = "courtiq_jwt";
const USER_KEY = "courtiq_user";

export const useAuthStore = create<AuthState>((set, get) => ({
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
    try {
      await firebaseSignOut();
    } catch {
      // Firebase sign-out failure is non-critical; clear local state regardless
    }
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

  refreshToken: async () => {
    const idToken = await getIdToken(true);
    if (idToken) {
      await SecureStore.setItemAsync(TOKEN_KEY, idToken);
      set({ token: idToken });
    }
    return idToken;
  },

  hydrate: async () => {
    try {
      // Check if Firebase has a current user session
      const firebaseUser = auth().currentUser;
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken(true);
        const userJson = await SecureStore.getItemAsync(USER_KEY);
        const onboarded = await SecureStore.getItemAsync("courtiq_onboarded");

        const stored = userJson ? JSON.parse(userJson) : {};
        await SecureStore.setItemAsync(TOKEN_KEY, idToken);

        set({
          token: idToken,
          userId: firebaseUser.uid,
          phone: firebaseUser.phoneNumber ?? stored.phone ?? null,
          displayName: firebaseUser.displayName ?? stored.displayName ?? null,
          isOnboarded: onboarded === "1",
          isLoading: false,
        });
        return;
      }

      // Fallback: check SecureStore for persisted session
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

// Listen for Firebase auth state changes to keep the store in sync
let _unsubscribe: (() => void) | null = null;

export function subscribeToAuthState() {
  if (_unsubscribe) return _unsubscribe;

  _unsubscribe = auth().onIdTokenChanged(
    async (user: FirebaseAuthTypes.User | null) => {
      const store = useAuthStore.getState();
      if (user) {
        const idToken = await user.getIdToken();
        await SecureStore.setItemAsync(TOKEN_KEY, idToken);
        useAuthStore.setState({ token: idToken });
      } else if (store.token) {
        // Firebase user signed out externally
        store.logout();
      }
    },
  );

  return _unsubscribe;
}
