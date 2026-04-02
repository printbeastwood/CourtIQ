import { describe, it, expect } from "vitest";
import {
  REFLINK_TIER_DEFAULTS,
  type ReflinkTier,
} from "@courtiq/shared";

describe("Reflink tier defaults", () => {
  it("defines all four tiers", () => {
    const tiers: ReflinkTier[] = ["player", "influencer", "venue", "coach"];
    for (const tier of tiers) {
      expect(REFLINK_TIER_DEFAULTS[tier]).toBeDefined();
    }
  });

  it("player tier uses credit reward with 3 booking threshold", () => {
    const player = REFLINK_TIER_DEFAULTS.player;
    expect(player.rewardType).toBe("credit");
    expect(player.commissionRate).toBe(0);
    expect(player.rewardConfig.requiredReferralBookings).toBe(3);
    expect(player.rewardConfig.creditAmountCents).toBe(50000); // 500 THB
  });

  it("influencer tier uses 5% commission for 12 months", () => {
    const influencer = REFLINK_TIER_DEFAULTS.influencer;
    expect(influencer.rewardType).toBe("commission");
    expect(influencer.commissionRate).toBe(0.05);
    expect(influencer.rewardConfig.durationMonths).toBe(12);
  });

  it("venue tier uses 1% commission on all bookings", () => {
    const venue = REFLINK_TIER_DEFAULTS.venue;
    expect(venue.rewardType).toBe("commission");
    expect(venue.commissionRate).toBe(0.01);
    expect(venue.rewardConfig.appliesTo).toBe("all_courtiq_bookings");
  });

  it("coach tier uses 2% commission on referred player bookings", () => {
    const coach = REFLINK_TIER_DEFAULTS.coach;
    expect(coach.rewardType).toBe("commission");
    expect(coach.commissionRate).toBe(0.02);
    expect(coach.rewardConfig.appliesTo).toBe("referred_player_bookings");
  });
});

describe("Reflink code format", () => {
  it("validates code regex pattern", () => {
    const validCodes = ["ciq-abc123-def4", "maria-padel", "kross-bkk", "test-code-1"];
    const invalidCodes = ["CIQ-ABC", "has spaces", "special!chars", "UPPERCASE"];

    const pattern = /^[a-z0-9-]+$/;

    for (const code of validCodes) {
      expect(pattern.test(code), `${code} should be valid`).toBe(true);
    }

    for (const code of invalidCodes) {
      expect(pattern.test(code), `${code} should be invalid`).toBe(false);
    }
  });
});

describe("Commission calculation", () => {
  it("calculates influencer commission correctly", () => {
    const bookingAmountCents = 150000; // 1500 THB
    const rate = REFLINK_TIER_DEFAULTS.influencer.commissionRate;
    const commission = Math.round(bookingAmountCents * rate);
    expect(commission).toBe(7500); // 75 THB
  });

  it("calculates venue commission correctly", () => {
    const bookingAmountCents = 80000; // 800 THB
    const rate = REFLINK_TIER_DEFAULTS.venue.commissionRate;
    const commission = Math.round(bookingAmountCents * rate);
    expect(commission).toBe(800); // 8 THB
  });

  it("calculates coach commission correctly", () => {
    const bookingAmountCents = 200000; // 2000 THB
    const rate = REFLINK_TIER_DEFAULTS.coach.commissionRate;
    const commission = Math.round(bookingAmountCents * rate);
    expect(commission).toBe(4000); // 40 THB
  });

  it("player tier has zero commission", () => {
    const rate = REFLINK_TIER_DEFAULTS.player.commissionRate;
    expect(rate).toBe(0);
    expect(Math.round(100000 * rate)).toBe(0);
  });
});
