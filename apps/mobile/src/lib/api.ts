import { config } from "../config";
import { useAuthStore } from "../stores/auth";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${config.apiUrl}${path}`, {
    ...options,
    headers,
  });

  // On 401, attempt a single token refresh and retry
  if (res.status === 401 && token) {
    const newToken = await useAuthStore.getState().refreshToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      const retry = await fetch(`${config.apiUrl}${path}`, {
        ...options,
        headers,
      });
      if (retry.ok) return retry.json() as Promise<T>;
      const retryBody = await retry.text();
      throw new Error(`API ${retry.status}: ${retryBody}`);
    }
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// --- Venues ---

export interface VenueListResponse {
  venues: Array<{
    id: string;
    name: string;
    slug: string;
    lat: number;
    lng: number;
    address: string;
    amenities: string[];
    sourcePlatform: string;
    courtCount?: number;
    distance_km?: number;
  }>;
  total: number;
  page: number;
  limit: number;
}

export interface VenueDetailResponse {
  venue: {
    id: string;
    name: string;
    slug: string;
    lat: number;
    lng: number;
    address: string;
    amenities: string[];
    sourcePlatform: string;
    courts: Array<{
      id: string;
      name: string;
      surface: string;
      indoor: boolean;
    }>;
  };
}

export interface SlotSearchResponse {
  results: Array<{
    venue: { id: string; name: string; slug: string; address: string; lat: number; lng: number };
    court: { id: string; name: string; surface: string; indoor: boolean };
    slot: {
      id: string;
      startsAt: string;
      endsAt: string;
      priceCents: number;
      currency: string;
      status: string;
      sourceBookingUrl: string;
    };
    stalenessMinutes: number;
  }>;
  total: number;
  page: number;
  limit: number;
}

export function fetchVenues(params: {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null) qs.set(k, String(v));
  }
  return api.get<VenueListResponse>(`/venues?${qs}`);
}

export function fetchVenueDetail(venueId: string) {
  return api.get<VenueDetailResponse>(`/venues/${venueId}`);
}

export function searchSlots(params: {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  dateFrom?: string;
  dateTo?: string;
  surface?: string[];
  indoor?: boolean;
  minPrice?: number;
  maxPrice?: number;
  venueId?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      v.forEach((item) => qs.append(k, item));
    } else {
      qs.set(k, String(v));
    }
  }
  return api.get<SlotSearchResponse>(`/slots/search?${qs}`);
}

export function fetchVenueSlots(venueId: string, date?: string) {
  const qs = date ? `?date=${date}` : "";
  return api.get<{ slots: SlotSearchResponse["results"] }>(
    `/venues/${venueId}/slots${qs}`,
  );
}

// --- Preferences ---

export function storePreferences(
  userId: string,
  preferences: Array<{ text: string; category?: string }>,
) {
  return api.post("/preferences", { userId, preferences });
}

export function getUserPreferences(userId: string) {
  return api.get<{
    preferences: Array<{
      id: string;
      category: string;
      text: string;
      active: boolean;
    }>;
  }>(`/users/${userId}/preferences`);
}

export function deletePreference(userId: string, prefId: string) {
  return api.delete(`/users/${userId}/preferences/${prefId}`);
}

// --- Concierge ---

export function createConversation(userId: string) {
  return api.post<{ conversationId: string }>("/concierge/conversations", {
    userId,
  });
}

export function sendMessage(conversationId: string, userId: string, message: string) {
  return api.post<{
    response: string;
    conversationId: string;
    toolsUsed: string[];
  }>(`/concierge/conversations/${conversationId}/messages`, {
    userId,
    message,
  });
}

export function getConversationMessages(conversationId: string) {
  return api.get<{
    messages: Array<{ role: string; content: string }>;
    conversationId: string;
  }>(`/concierge/conversations/${conversationId}/messages`);
}

export function listConversations(userId: string) {
  return api.get<{
    conversations: Array<{
      id: string;
      userId: string;
      startedAt: string;
    }>;
  }>(`/users/${userId}/concierge/conversations`);
}
