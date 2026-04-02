import type {
  PlatformImportResult,
  ImportedMatchRecord,
  ImportedBookingRecord,
  ImportedPlayerProfile,
  PreferenceCategory,
} from "@courtiq/shared";

/**
 * Converts imported player data into natural language preference entries
 * that seed the Preference Store on day one.
 *
 * The goal: a migrated user gets AI recommendations as good as a returning user
 * from their very first session.
 */

export interface SeededPreference {
  text: string;
  category: PreferenceCategory;
}

export function seedPreferencesFromImport(
  results: PlatformImportResult[]
): SeededPreference[] {
  const prefs: SeededPreference[] = [];

  for (const result of results) {
    if (result.profile) {
      prefs.push(...extractProfilePreferences(result.profile));
    }
    if (result.matches.length > 0) {
      prefs.push(...extractMatchPreferences(result.matches));
    }
    if (result.bookings.length > 0) {
      prefs.push(...extractBookingPreferences(result.bookings));
    }
  }

  return deduplicatePreferences(prefs);
}

function extractProfilePreferences(profile: ImportedPlayerProfile): SeededPreference[] {
  const prefs: SeededPreference[] = [];

  if (profile.rating != null) {
    const label = profile.ratingLabel ?? `${profile.rating}`;
    prefs.push({
      text: `Player self-reported skill level: ${label} (imported from ${profile.platform})`,
      category: "skill_level",
    });
  }

  if (profile.preferredHand) {
    prefs.push({
      text: `Prefers playing ${profile.preferredHand}-handed`,
      category: "play_style",
    });
  }

  if (profile.preferredPosition) {
    prefs.push({
      text: `Preferred position on court: ${profile.preferredPosition}`,
      category: "play_style",
    });
  }

  return prefs;
}

function extractMatchPreferences(matches: ImportedMatchRecord[]): SeededPreference[] {
  const prefs: SeededPreference[] = [];

  // Determine format preference
  const formatCounts = { singles: 0, doubles: 0 };
  for (const m of matches) {
    if (m.format === "singles") formatCounts.singles++;
    else formatCounts.doubles++;
  }

  const total = formatCounts.singles + formatCounts.doubles;
  if (total > 0) {
    const doublesRatio = formatCounts.doubles / total;
    if (doublesRatio > 0.8) {
      prefs.push({
        text: `Plays almost exclusively doubles (${formatCounts.doubles}/${total} matches)`,
        category: "play_style",
      });
    } else if (doublesRatio > 0.5) {
      prefs.push({
        text: `Prefers doubles but also plays singles (${formatCounts.doubles} doubles, ${formatCounts.singles} singles)`,
        category: "play_style",
      });
    } else if (doublesRatio < 0.2) {
      prefs.push({
        text: `Primarily a singles player (${formatCounts.singles}/${total} matches)`,
        category: "play_style",
      });
    }
  }

  // Win rate → competitive intent signal
  const resultsWithOutcome = matches.filter((m) => m.result != null);
  if (resultsWithOutcome.length >= 5) {
    const wins = resultsWithOutcome.filter((m) => m.result === "win").length;
    const winRate = wins / resultsWithOutcome.length;

    prefs.push({
      text: `Historical win rate: ${Math.round(winRate * 100)}% across ${resultsWithOutcome.length} matches with recorded outcomes`,
      category: "skill_level",
    });
  }

  // Play frequency
  if (matches.length >= 2) {
    const sorted = [...matches].sort(
      (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
    );
    const firstMatch = new Date(sorted[0].playedAt);
    const lastMatch = new Date(sorted[sorted.length - 1].playedAt);
    const spanDays = Math.max(1, (lastMatch.getTime() - firstMatch.getTime()) / (1000 * 60 * 60 * 24));
    const matchesPerWeek = (matches.length / spanDays) * 7;

    let frequency: string;
    if (matchesPerWeek >= 3) frequency = "very active player (3+ sessions/week)";
    else if (matchesPerWeek >= 1.5) frequency = "active player (about 2 sessions/week)";
    else if (matchesPerWeek >= 0.8) frequency = "regular player (about once a week)";
    else if (matchesPerWeek >= 0.4) frequency = "casual player (every couple of weeks)";
    else frequency = "occasional player (less than monthly)";

    prefs.push({
      text: `Play frequency based on history: ${frequency}`,
      category: "time",
    });
  }

  // Venue preferences — extract top venues
  const venueCounts = new Map<string, number>();
  for (const m of matches) {
    if (m.venueName) {
      venueCounts.set(m.venueName, (venueCounts.get(m.venueName) ?? 0) + 1);
    }
  }

  const topVenues = [...venueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (topVenues.length > 0) {
    const venueList = topVenues
      .map(([name, count]) => `${name} (${count} matches)`)
      .join(", ");
    prefs.push({
      text: `Most frequently played venues: ${venueList}`,
      category: "location",
    });
  }

  // Regular opponents
  const opponentCounts = new Map<string, number>();
  for (const m of matches) {
    if (m.opponentName) {
      opponentCounts.set(m.opponentName, (opponentCounts.get(m.opponentName) ?? 0) + 1);
    }
  }

  const regularOpponents = [...opponentCounts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (regularOpponents.length > 0) {
    const oppList = regularOpponents
      .map(([name, count]) => `${name} (${count} matches)`)
      .join(", ");
    prefs.push({
      text: `Regular playing partners/opponents: ${oppList}`,
      category: "group_size",
    });
  }

  return prefs;
}

function extractBookingPreferences(bookings: ImportedBookingRecord[]): SeededPreference[] {
  const prefs: SeededPreference[] = [];

  // Time-of-day preference
  const hourCounts = new Map<string, number>();
  for (const b of bookings) {
    const hour = new Date(b.startsAt).getHours();
    let slot: string;
    if (hour < 9) slot = "early morning (before 9am)";
    else if (hour < 12) slot = "morning (9am–12pm)";
    else if (hour < 15) slot = "early afternoon (12pm–3pm)";
    else if (hour < 18) slot = "late afternoon (3pm–6pm)";
    else slot = "evening (after 6pm)";

    hourCounts.set(slot, (hourCounts.get(slot) ?? 0) + 1);
  }

  const topSlot = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topSlot && topSlot[1] >= 3) {
    prefs.push({
      text: `Prefers playing in the ${topSlot[0]} — ${topSlot[1]} out of ${bookings.length} bookings in this time slot`,
      category: "time",
    });
  }

  // Day-of-week preference
  const dayCounts = new Map<string, number>();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  for (const b of bookings) {
    const day = dayNames[new Date(b.startsAt).getDay()];
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }

  const topDays = [...dayCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  if (topDays.length > 0 && topDays[0][1] >= 3) {
    const weekendDays = topDays.filter(([d]) => d === "Saturday" || d === "Sunday");
    const weekdayDays = topDays.filter(([d]) => d !== "Saturday" && d !== "Sunday");

    if (weekendDays.length === topDays.length) {
      prefs.push({
        text: `Primarily plays on weekends`,
        category: "time",
      });
    } else if (weekdayDays.length === topDays.length) {
      const dayStr = topDays.map(([d, c]) => `${d} (${c}x)`).join(" and ");
      prefs.push({
        text: `Most common play days: ${dayStr}`,
        category: "time",
      });
    }
  }

  // Venue preference from bookings
  const venueCounts = new Map<string, number>();
  for (const b of bookings) {
    venueCounts.set(b.venueName, (venueCounts.get(b.venueName) ?? 0) + 1);
  }

  const topBookingVenues = [...venueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (topBookingVenues.length > 0 && topBookingVenues[0][1] >= 3) {
    const venueList = topBookingVenues
      .map(([name, count]) => `${name} (${count} bookings)`)
      .join(", ");
    prefs.push({
      text: `Most booked venues: ${venueList}`,
      category: "location",
    });
  }

  // Price range
  const prices = bookings
    .filter((b) => b.priceCents != null && b.priceCents > 0)
    .map((b) => b.priceCents!);

  if (prices.length >= 3) {
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length / 100);
    const min = Math.round(Math.min(...prices) / 100);
    const max = Math.round(Math.max(...prices) / 100);
    const currency = bookings.find((b) => b.currency)?.currency ?? "THB";

    prefs.push({
      text: `Typical booking price range: ${min}–${max} ${currency} (average ${avg} ${currency})`,
      category: "court_surface",
    });
  }

  return prefs;
}

function deduplicatePreferences(prefs: SeededPreference[]): SeededPreference[] {
  const seen = new Set<string>();
  return prefs.filter((p) => {
    const key = `${p.category}:${p.text.slice(0, 60)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
