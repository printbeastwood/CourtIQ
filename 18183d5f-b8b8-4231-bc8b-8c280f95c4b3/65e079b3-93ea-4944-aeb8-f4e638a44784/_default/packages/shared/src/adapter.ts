import type { AdapterHealth, DateRange, Region, Slot, Venue } from "./types.js";

export interface PlatformAdapter {
  readonly platform: string;
  fetchVenues(region: Region): Promise<Venue[]>;
  fetchAvailability(venueSourceId: string, dateRange: DateRange): Promise<{ venue: Venue; courts: { court: { name: string; surface: string; indoor: boolean; metadata: Record<string, unknown> }; slots: Omit<Slot, "id" | "courtId">[] }[] }>;
  getBookingUrl(slot: Slot): string;
  healthCheck(): Promise<AdapterHealth>;
}
