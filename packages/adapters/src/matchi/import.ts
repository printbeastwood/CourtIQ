import type {
  PlayerImportAdapter,
  PlatformCredentials,
  ImportedPlayerProfile,
  ImportedMatchRecord,
  ImportedBookingRecord,
  ImportedContact,
} from "@courtiq/shared";

/**
 * MATCHi player import adapter.
 *
 * MATCHi (matchi.se) — Grails/Java backend, mostly server-rendered.
 * User data endpoints (session auth required):
 *   GET /user/show                  — user profile
 *   GET /user/bookings              — booking history (HTML)
 *   GET /user/matches               — match history (HTML, if available)
 *
 * MATCHi is primarily a booking platform (not match-tracking),
 * so match history is limited. Booking history is the primary data source.
 */

const MATCHI_BASE = "https://matchi.se";

export class MatchiImportAdapter implements PlayerImportAdapter {
  readonly platform = "matchi" as const;

  private async authedFetch(url: string, credentials: PlatformCredentials): Promise<Response> {
    const token = credentials.accessToken;
    if (!token) throw new Error("MATCHi session token required");

    return fetch(url, {
      headers: { Cookie: `JSESSIONID=${token}` },
    });
  }

  async fetchPlayerProfile(credentials: PlatformCredentials): Promise<ImportedPlayerProfile | null> {
    try {
      const resp = await this.authedFetch(`${MATCHI_BASE}/user/show`, credentials);
      if (!resp.ok) return null;

      const html = await resp.text();

      const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
      const avatarMatch = html.match(/class="profile-image"[^>]*src="([^"]+)"/);
      const memberSinceMatch = html.match(/Member since[:\s]*(\d{4})/i);

      return {
        platform: "matchi",
        platformUserId: credentials.email ?? "unknown",
        displayName: nameMatch?.[1]?.trim() ?? null,
        avatarUrl: avatarMatch?.[1] ?? null,
        rating: null,
        ratingLabel: null,
        preferredHand: null,
        preferredPosition: null,
        memberSince: memberSinceMatch?.[1] ?? null,
      };
    } catch {
      return null;
    }
  }

  async fetchMatchHistory(_credentials: PlatformCredentials): Promise<ImportedMatchRecord[]> {
    // MATCHi is booking-focused — no structured match history available
    return [];
  }

  async fetchBookingHistory(credentials: PlatformCredentials): Promise<ImportedBookingRecord[]> {
    try {
      const resp = await this.authedFetch(`${MATCHI_BASE}/user/bookings?max=200`, credentials);
      if (!resp.ok) return [];

      const html = await resp.text();
      const bookings: ImportedBookingRecord[] = [];

      // Parse booking rows from HTML table
      const rowPattern =
        /data-booking-id="(\d+)"[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]*)<\/td>/g;

      let match: RegExpExecArray | null;
      while ((match = rowPattern.exec(html)) !== null) {
        const [, bookingId, dateStr, timeStr, venueName, courtName] = match;
        if (!bookingId || !dateStr || !venueName) continue;

        const startDate = parseMatchiDateTime(dateStr.trim(), timeStr?.trim());
        if (!startDate) continue;

        bookings.push({
          platform: "matchi",
          platformBookingId: bookingId,
          venueName: venueName.trim(),
          courtName: courtName?.trim() || null,
          startsAt: startDate.toISOString(),
          endsAt: null,
          priceCents: null,
          currency: null,
        });
      }

      return bookings;
    } catch {
      return [];
    }
  }

  async fetchContacts(_credentials: PlatformCredentials): Promise<ImportedContact[]> {
    // MATCHi doesn't expose a friend/contact list
    return [];
  }
}

function parseMatchiDateTime(dateStr: string, timeStr?: string): Date | null {
  try {
    // MATCHi typically shows dates like "2024-03-15" and times like "10:00"
    const isoDate = dateStr.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (!isoDate) return null;
    const time = timeStr?.match(/\d{2}:\d{2}/)?.[0] ?? "00:00";
    return new Date(`${isoDate}T${time}:00+07:00`);
  } catch {
    return null;
  }
}
