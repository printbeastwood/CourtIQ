import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlaytomicMigrationAdapter } from "../playtomic.js";
import { MatchiMigrationAdapter } from "../matchi.js";
import { ReclubMigrationAdapter } from "../reclub.js";
import { PadelMatesMigrationAdapter } from "../padel-mates.js";
import { getMigrationAdapter, getSupportedMigrationPlatforms } from "../index.js";

describe("Migration adapter registry", () => {
  it("returns all supported platforms", () => {
    const platforms = getSupportedMigrationPlatforms();
    expect(platforms).toContain("playtomic");
    expect(platforms).toContain("matchi");
    expect(platforms).toContain("reclub");
    expect(platforms).toContain("padel_mates");
    expect(platforms).toHaveLength(4);
  });

  it("returns adapter for valid platform", () => {
    const adapter = getMigrationAdapter("playtomic");
    expect(adapter).toBeDefined();
    expect(adapter?.platform).toBe("playtomic");
  });

  it("returns undefined for unknown platform", () => {
    const adapter = getMigrationAdapter("nonexistent" as never);
    expect(adapter).toBeUndefined();
  });
});

describe("PlaytomicMigrationAdapter", () => {
  const adapter = new PlaytomicMigrationAdapter();

  it("has correct platform identifier", () => {
    expect(adapter.platform).toBe("playtomic");
  });

  it("rejects credentials without token or email", async () => {
    const valid = await adapter.validateCredentials({
      platform: "playtomic",
    });
    expect(valid).toBe(false);
  });

  it("returns false for invalid token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 401 })
    );

    const valid = await adapter.validateCredentials({
      platform: "playtomic",
      accessToken: "invalid-token",
    });
    expect(valid).toBe(false);
    fetchSpy.mockRestore();
  });

  it("extracts user data with valid token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      // validateCredentials -> /users/me
      // extractUserData calls:
      // fetchProfile -> /users/me
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user_id: "u1",
            full_name: "Test Player",
            level_padel: 3.5,
            plays_right_handed: true,
            registered_at: "2024-01-01",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      // fetchMatches -> /users/me/matches (empty)
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      // fetchBookings -> /users/me/bookings (empty)
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      // fetchFriends -> /users/me/friends
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { user_id: "f1", full_name: "Friend One", level_padel: 4.0 },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const data = await adapter.extractUserData({
      platform: "playtomic",
      accessToken: "valid-token",
    });

    expect(data.profile?.displayName).toBe("Test Player");
    expect(data.profile?.rating).toBe(3.5);
    expect(data.profile?.ratingSystem).toBe("playtomic_level");
    expect(data.profile?.preferredHand).toBe("right");
    expect(data.matches).toHaveLength(0);
    expect(data.bookings).toHaveLength(0);
    expect(data.connections).toHaveLength(1);
    expect(data.connections[0]?.displayName).toBe("Friend One");

    fetchSpy.mockRestore();
  });

  it("extracts match history with results", async () => {
    const matchData = [
      {
        match_id: "m1",
        date: "2025-03-15",
        start_time: "18:00",
        duration: 90,
        tenant_name: "Padel Asia BKK",
        resource_name: "Court 1",
        sport_id: "PADEL",
        teams: [
          {
            players: [
              { user_id: "me", full_name: "Me", level: 3.5 },
              { user_id: "p2", full_name: "Partner", level: 3.0 },
            ],
            score: [6, 4],
          },
          {
            players: [
              { user_id: "o1", full_name: "Opp A", level: 3.5 },
              { user_id: "o2", full_name: "Opp B", level: 3.2 },
            ],
            score: [3, 6],
          },
        ],
        winner_team_index: 0,
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user_id: "me", full_name: "Me" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(matchData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const data = await adapter.extractUserData({
      platform: "playtomic",
      accessToken: "token",
    });

    expect(data.matches).toHaveLength(1);
    const match = data.matches[0]!;
    expect(match.venueName).toBe("Padel Asia BKK");
    expect(match.format).toBe("doubles");
    expect(match.result).toBe("won");
    expect(match.durationMinutes).toBe(90);

    fetchSpy.mockRestore();
  });
});

describe("ReclubMigrationAdapter", () => {
  const adapter = new ReclubMigrationAdapter();

  it("has correct platform identifier", () => {
    expect(adapter.platform).toBe("reclub");
  });

  it("rejects missing access token", async () => {
    const valid = await adapter.validateCredentials({
      platform: "reclub",
    });
    expect(valid).toBe(false);
  });
});

describe("MatchiMigrationAdapter", () => {
  const adapter = new MatchiMigrationAdapter();

  it("has correct platform identifier", () => {
    expect(adapter.platform).toBe("matchi");
  });
});

describe("PadelMatesMigrationAdapter", () => {
  const adapter = new PadelMatesMigrationAdapter();

  it("has correct platform identifier", () => {
    expect(adapter.platform).toBe("padel_mates");
  });

  it("rejects missing access token", async () => {
    const valid = await adapter.validateCredentials({
      platform: "padel_mates",
    });
    expect(valid).toBe(false);
  });
});
