import { create } from "zustand";
import * as Location from "expo-location";

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  granted: boolean | null;
  requestLocation: () => Promise<void>;
}

// Default to central Bangkok
const BANGKOK_LAT = 13.7563;
const BANGKOK_LNG = 100.5018;

export const useLocationStore = create<LocationState>((set) => ({
  latitude: null,
  longitude: null,
  granted: null,

  requestLocation: async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        set({ granted: false, latitude: BANGKOK_LAT, longitude: BANGKOK_LNG });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      set({
        granted: true,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {
      set({ granted: false, latitude: BANGKOK_LAT, longitude: BANGKOK_LNG });
    }
  },
}));
