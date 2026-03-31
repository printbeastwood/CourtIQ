import { createDb } from "./index.js";
import { venues, courts, availabilitySlots, users } from "./schema.js";

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(DATABASE_URL);

async function seed() {
  console.log("Seeding CourtIQ database...\n");

  // --- Venues ---
  const [padelCity, racquetClub, bangkokPadel, slamPadel] = await db
    .insert(venues)
    .values([
      {
        name: "Padel City Bangkok",
        slug: "padel-city-bangkok",
        lat: 13.7367,
        lng: 100.5232,
        address: "123 Sukhumvit Soi 39, Khlong Toei, Bangkok 10110",
        amenities: ["parking", "changing_room", "pro_shop", "cafe"],
        sourcePlatform: "club_direct",
        sourceId: "padel-city-bkk",
      },
      {
        name: "The Racquet Club",
        slug: "the-racquet-club",
        lat: 13.7249,
        lng: 100.5847,
        address: "456 Thonglor Soi 5, Watthana, Bangkok 10110",
        amenities: ["parking", "changing_room", "coaching"],
        sourcePlatform: "club_direct",
        sourceId: "racquet-club-bkk",
      },
      {
        name: "Bangkok Padel Club",
        slug: "bangkok-padel-club",
        lat: 13.7462,
        lng: 100.5347,
        address: "789 Ekkamai Soi 10, Phra Khanong, Bangkok 10110",
        amenities: ["parking", "changing_room", "restaurant", "pool"],
        sourcePlatform: "playtomic",
        sourceId: "bkk-padel-club-01",
      },
      {
        name: "SLAM Padel",
        slug: "slam-padel",
        lat: 13.7184,
        lng: 100.5141,
        address: "321 Sathorn Soi 12, Silom, Bangkok 10500",
        amenities: ["parking", "changing_room", "pro_shop"],
        sourcePlatform: "club_direct",
        sourceId: "slam-padel-bkk",
      },
    ])
    .returning();

  console.log(`Created ${4} venues`);

  // --- Courts ---
  const courtData = [
    // Padel City — 4 courts
    { venueId: padelCity.id, name: "Court 1", surface: "panoramic", indoor: false },
    { venueId: padelCity.id, name: "Court 2", surface: "panoramic", indoor: false },
    { venueId: padelCity.id, name: "Court 3", surface: "glass", indoor: true },
    { venueId: padelCity.id, name: "Court 4", surface: "glass", indoor: true },
    // Racquet Club — 3 courts
    { venueId: racquetClub.id, name: "Court A", surface: "glass", indoor: true },
    { venueId: racquetClub.id, name: "Court B", surface: "glass", indoor: true },
    { venueId: racquetClub.id, name: "Court C", surface: "panoramic", indoor: false },
    // Bangkok Padel Club — 3 courts
    { venueId: bangkokPadel.id, name: "Center Court", surface: "panoramic", indoor: false },
    { venueId: bangkokPadel.id, name: "Side Court 1", surface: "panoramic", indoor: false },
    { venueId: bangkokPadel.id, name: "Side Court 2", surface: "glass", indoor: true },
    // SLAM Padel — 2 courts
    { venueId: slamPadel.id, name: "Main Court", surface: "glass", indoor: true },
    { venueId: slamPadel.id, name: "Training Court", surface: "turf", indoor: true },
  ];

  const insertedCourts = await db.insert(courts).values(courtData).returning();
  console.log(`Created ${insertedCourts.length} courts`);

  // --- Availability Slots (next 7 days) ---
  const now = new Date();
  const slotValues: Array<{
    courtId: string;
    startsAt: Date;
    endsAt: Date;
    priceCents: number;
    currency: string;
    status: string;
    fetchedAt: Date;
  }> = [];

  for (const court of insertedCourts) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      // Create slots from 7:00 to 22:00 (each 1.5 hours)
      for (let hour = 7; hour <= 20; hour += 2) {
        const startsAt = new Date(now);
        startsAt.setDate(startsAt.getDate() + dayOffset);
        startsAt.setHours(hour, 0, 0, 0);

        const endsAt = new Date(startsAt);
        endsAt.setMinutes(endsAt.getMinutes() + 90);

        // Price varies: peak hours (17-21) cost more
        const isPeak = hour >= 17 && hour <= 21;
        const priceCents = isPeak ? 100000 : 60000; // 1000 THB peak, 600 THB off-peak

        slotValues.push({
          courtId: court.id,
          startsAt,
          endsAt,
          priceCents,
          currency: "THB",
          status: "available",
          fetchedAt: now,
        });
      }
    }
  }

  // Insert in batches to avoid query size limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < slotValues.length; i += BATCH_SIZE) {
    await db.insert(availabilitySlots).values(slotValues.slice(i, i + BATCH_SIZE));
  }
  console.log(`Created ${slotValues.length} availability slots`);

  // --- Demo Users ---
  await db.insert(users).values([
    {
      phone: "+66800000001",
      displayName: "Demo Player",
      skillLevel: "intermediate",
    },
    {
      phone: "+66800000002",
      displayName: "Test User",
      skillLevel: "beginner",
    },
  ]);
  console.log("Created 2 demo users");

  console.log("\nSeed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
