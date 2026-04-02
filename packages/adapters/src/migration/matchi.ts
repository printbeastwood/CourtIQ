import type { MigrationAdapter } from "@courtiq/shared";
import type {
  MigrationCredentials,
  MigrationData,
  ImportedMatch,
  ImportedBooking,
  MigrationPlayerProfile,
} from "@courtiq/shared";

const MATCHI_BASE = "https://www.matchi.se";

interface MatchiProfileData {
  name?: string;
  level?: string;
  memberSince?: string;
  sports?: string[];
}

interface MatchiBookingRow {
  date: string;
  time: string;
  facility: string;
  court: string;
  price?: string;
  currency?: string;
}

export class MatchiMigrationAdapter implements MigrationAdapter {
  readonly platform = "matchi";

  async validateCredentials(credentials: MigrationCredentials): Promise<boolean> {
    try {
      const cookies = await this.login(credentials);
      const resp = await fetch(`${MATCHI_BASE}/profiles/account`, {
        headers: { Cookie: formatCookies(cookies) },
        redirect: "manual",
      });
      return resp.status === 200;
    } catch {
      return false;
    }
  }

  async extractUserData(credentials: MigrationCredentials): Promise<MigrationData> {
    const cookies = await this.login(credentials);
    const cookieHeader = formatCookies(cookies);

    const [profile, bookings] = await Promise.all([
      this.scrapeProfile(cookieHeader),
      this.scrapeBookingHistory(cookieHeader),
    ]);

    // MATCHi doesn't expose match results or friend lists via web UI
    const matches = this.deriveMatchesFromBookings(bookings);

    return { profile, matches, bookings, connections: [] };
  }

  private async login(credentials: MigrationCredentials): Promise<Record<string, string>> {
    if (credentials.cookies) return credentials.cookies;

    if (!credentials.email) {
      throw new Error("MATCHi migration requires email/password or session cookies");
    }

    // MATCHi uses form-based login with CSRF
    const loginPage = await fetch(`${MATCHI_BASE}/login`);
    const html = await loginPage.text();
    const csrfMatch = html.match(/name="_csrf"\s+value="([^"]+)"/);
    const csrf = csrfMatch?.[1] ?? "";

    const setCookies = loginPage.headers.getSetCookie?.() ?? [];
    const sessionCookies = parseCookieHeaders(setCookies);

    const resp = await fetch(`${MATCHI_BASE}/login/authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: formatCookies(sessionCookies),
      },
      body: new URLSearchParams({
        _csrf: csrf,
        username: credentials.email,
        password: credentials.accessToken ?? "",
      }),
      redirect: "manual",
    });

    const authCookies = parseCookieHeaders(resp.headers.getSetCookie?.() ?? []);
    return { ...sessionCookies, ...authCookies };
  }

  private async scrapeProfile(cookieHeader: string): Promise<MigrationPlayerProfile> {
    try {
      const resp = await fetch(`${MATCHI_BASE}/profiles/account`, {
        headers: { Cookie: cookieHeader },
      });
      if (!resp.ok) return { metadata: {} };

      const html = await resp.text();
      const data: MatchiProfileData = {};

      const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
      if (nameMatch) data.name = nameMatch[1]?.trim();

      const levelMatch = html.match(/skill[_-]?level[^>]*>([^<]+)/i);
      if (levelMatch) data.level = levelMatch[1]?.trim();

      return {
        displayName: data.name,
        rating: data.level ? parseFloat(data.level) : undefined,
        ratingSystem: "matchi_level",
        metadata: { source: "matchi_scrape" },
      };
    } catch {
      return { metadata: {} };
    }
  }

  private async scrapeBookingHistory(cookieHeader: string): Promise<ImportedBooking[]> {
    try {
      const resp = await fetch(`${MATCHI_BASE}/profiles/bookings?max=100`, {
        headers: { Cookie: cookieHeader },
      });
      if (!resp.ok) return [];

      const html = await resp.text();
      const rows = this.parseBookingTable(html);

      return rows.map((r) => ({
        bookedAt: new Date(`${r.date}T${r.time}`),
        venueName: r.facility,
        courtName: r.court,
        timeSlot: r.time,
        pricePaid: r.price ? parseFloat(r.price) : undefined,
        currency: r.currency ?? "THB",
        metadata: { source: "matchi_scrape" },
      }));
    } catch {
      return [];
    }
  }

  private parseBookingTable(html: string): MatchiBookingRow[] {
    const rows: MatchiBookingRow[] = [];
    const rowRegex = /<tr[^>]*class="[^"]*booking[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    let match: RegExpExecArray | null;

    while ((match = rowRegex.exec(html)) !== null) {
      const cells = (match[1] ?? "").match(/<td[^>]*>([\s\S]*?)<\/td>/gi) ?? [];
      const texts = cells.map((c) => c.replace(/<[^>]+>/g, "").trim());

      if (texts.length >= 3) {
        rows.push({
          date: texts[0] ?? "",
          time: texts[1] ?? "",
          facility: texts[2] ?? "",
          court: texts[3] ?? "",
          price: texts[4],
          currency: texts[5],
        });
      }
    }

    return rows;
  }

  private deriveMatchesFromBookings(bookings: ImportedBooking[]): ImportedMatch[] {
    return bookings.map((b) => ({
      playedAt: b.bookedAt,
      venueName: b.venueName,
      courtName: b.courtName,
      partnerNames: [],
      opponentNames: [],
      metadata: { derivedFromBooking: true, source: "matchi" },
    }));
  }
}

function parseCookieHeaders(headers: string[]): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const header of headers) {
    const parts = header.split(";")[0]?.split("=");
    if (parts && parts.length >= 2) {
      const key = parts[0]?.trim();
      const value = parts.slice(1).join("=").trim();
      if (key) cookies[key] = value;
    }
  }
  return cookies;
}

function formatCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}
