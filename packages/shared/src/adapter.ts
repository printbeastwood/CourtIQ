import type {
  AdapterHealth,
  DateRange,
  ImportPlatform,
  ImportedBookingRecord,
  ImportedContact,
  ImportedMatchRecord,
  ImportedPlayerProfile,
  MigrationCredentials,
  MigrationData,
  Region,
  Slot,
  Venue,
} from "./types.js";

export interface PlatformAdapter {
  readonly platform: string;
  fetchVenues(region: Region): Promise<Venue[]>;
  fetchAvailability(venueSourceId: string, dateRange: DateRange): Promise<{ venue: Venue; courts: { court: { name: string; surface: string; indoor: boolean; metadata: Record<string, unknown> }; slots: Omit<Slot, "id" | "courtId">[] }[] }>;
  getBookingUrl(slot: Slot): string;
  healthCheck(): Promise<AdapterHealth>;
}

export interface MigrationAdapter {
  readonly platform: string;

  /** Validate credentials before starting import. Returns true if the session is valid. */
  validateCredentials(credentials: MigrationCredentials): Promise<boolean>;

  /** Extract all available user data from the platform. */
  extractUserData(credentials: MigrationCredentials): Promise<MigrationData>;
}

export interface PlatformCredentials {
  accessToken?: string;
  refreshToken?: string;
  email?: string;
  password?: string;
  apiKey?: string;
}

export interface PlayerImportAdapter {
  readonly platform: ImportPlatform;
  fetchPlayerProfile(credentials: PlatformCredentials): Promise<ImportedPlayerProfile | null>;
  fetchMatchHistory(credentials: PlatformCredentials): Promise<ImportedMatchRecord[]>;
  fetchBookingHistory(credentials: PlatformCredentials): Promise<ImportedBookingRecord[]>;
  fetchContacts(credentials: PlatformCredentials): Promise<ImportedContact[]>;
}
