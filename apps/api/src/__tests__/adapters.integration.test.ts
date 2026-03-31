/**
 * Integration tests for the adapter registry and adapter healthCheck / fetchVenues / getBookingUrl.
 * External HTTP calls are mocked via vi.stubGlobal('fetch').
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAdapter, getAllAdapters, getAdapterPlatforms } from "@courtiq/adapters";
import type { Slot } from "@courtiq/shared";

describe("adapter registry", () => {
  it("registers all six platform adapters", () => {
    const platforms = getAdapterPlatforms();
    expect(platforms).toContain("playtomic");
    expect(platforms).toContain("reclub");
    expect(platforms).toContain("book_and_go");
    expect(platforms).toContain("matchi");
    expect(platforms).toContain("padel_mates");
    expect(platforms).toContain("padel_society");
    expect(platforms.length).toBe(6);
  });

  it("returns undefined for unknown platform", () => {
    expect(getAdapter("nonexistent")).toBeUndefined();
  });

  it("getAllAdapters returns adapter instances with correct platform property", () => {
    const adapters = getAllAdapters();
    expect(adapters.length).toBe(6);
    for (const adapter of adapters) {
      expect(typeof adapter.platform).toBe("string");
      expect(typeof adapter.fetchVenues).toBe("function");
      expect(typeof adapter.fetchAvailability).toBe("function");
      expect(typeof adapter.getBookingUrl).toBe("function");
      expect(typeof adapter.healthCheck).toBe("function");
    }
  });
});

describe("adapter healthCheck", () => {
  it("each adapter returns a valid AdapterHealth object", async () => {
    const adapters = getAllAdapters();
    for (const adapter of adapters) {
      const health = await adapter.healthCheck();
      expect(health).toHaveProperty("platform", adapter.platform);
      expect(typeof health.healthy).toBe("boolean");
      expect(typeof health.successRate).toBe("number");
      expect(health.successRate).toBeGreaterThanOrEqual(0);
      expect(health.successRate).toBeLessThanOrEqual(1);
    }
  });
});

describe("PlaytomicAdapter fetchVenues (mocked HTTP)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("parses Playtomic API tenant response into Venue[]", async () => {
    const mockTenants = [
      {
        tenant_id: "abc-123",
        tenant_name: "Padel City BKK",
        address: { street: "123 Sukhumvit", city: "Bangkok", country: "Thailand" },
        coord: { lat: 13.7563, lon: 100.5018 },
        properties: { indoor: false, surface_type: "glass" },
      },
    ];

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTenants),
    });

    const adapter = getAdapter("playtomic")!;
    const venues = await adapter.fetchVenues({
      center: { lat: 13.75, lng: 100.5 },
      radiusKm: 20,
    });

    expect(venues).toHaveLength(1);
    expect(venues[0].name).toBe("Padel City BKK");
    expect(venues[0].slug).toBe("playtomic-abc-123");
    expect(venues[0].sourcePlatform).toBe("playtomic");
    expect(venues[0].sourceId).toBe("abc-123");
    expect(venues[0].location).toEqual({ lat: 13.7563, lng: 100.5018 });
    expect(venues[0].address).toContain("Bangkok");
  });

  it("throws on API error and tracks failure in healthCheck", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const adapter = getAdapter("playtomic")!;

    await expect(
      adapter.fetchVenues({ center: { lat: 13.75, lng: 100.5 }, radiusKm: 10 })
    ).rejects.toThrow("Playtomic API 500");

    const health = await adapter.healthCheck();
    expect(health.lastError).toContain("500");
  });
});

describe("adapter getBookingUrl", () => {
  it("Playtomic returns the source booking URL from the slot", () => {
    const adapter = getAdapter("playtomic")!;
    const slot: Slot = {
      id: "slot-1",
      courtId: "court-1",
      startsAt: new Date(),
      endsAt: new Date(),
      priceCents: 80000,
      currency: "THB",
      status: "available",
      sourceBookingUrl: "https://playtomic.io/tenant/venue-1?date=2026-04-02",
      fetchedAt: new Date(),
    };

    const url = adapter.getBookingUrl(slot);
    expect(url).toBe("https://playtomic.io/tenant/venue-1?date=2026-04-02");
  });
});
