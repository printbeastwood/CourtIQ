import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const REFERRAL_CODE_KEY = "courtiq_pending_referral";

interface ReferralState {
  /** Referral code captured from deep link, not yet claimed */
  pendingCode: string | null;
  /** Save a referral code from a deep link for later claiming */
  setPendingCode: (code: string) => void;
  /** Clear pending code after successful claim */
  clearPendingCode: () => void;
  /** Load any persisted pending code from storage */
  hydrate: () => Promise<void>;
}

export const useReferralStore = create<ReferralState>((set) => ({
  pendingCode: null,

  setPendingCode: async (code: string) => {
    await SecureStore.setItemAsync(REFERRAL_CODE_KEY, code);
    set({ pendingCode: code });
  },

  clearPendingCode: async () => {
    await SecureStore.deleteItemAsync(REFERRAL_CODE_KEY);
    set({ pendingCode: null });
  },

  hydrate: async () => {
    try {
      const code = await SecureStore.getItemAsync(REFERRAL_CODE_KEY);
      if (code) {
        set({ pendingCode: code });
      }
    } catch {
      // Storage read failure — ignore
    }
  },
}));
