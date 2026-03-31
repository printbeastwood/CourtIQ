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

  // --- Venues (real Bangkok padel venues) ---
  const [baanPadel, noDrama, padelCo, krossIndoor, padThaiPadel, bangkokPadel] = await db
    .insert(venues)
    .values([
      {
        name: "Baan Padel",
        slug: "baan-padel",
        lat: 13.7157,
        lng: 100.5879,
        address: "Sukhumvit 67, Phra Khanong Nuea, Watthana, Bangkok 10110",
        amenities: ["parking", "changing_room", "pro_shop", "cafe"],
        sourcePlatform: "playtomic",
        sourceId: "baan-padel-bkk",
      },
      {
        name: "No Drama Padel",
        slug: "no-drama-padel",
        lat: 13.7066,
        lng: 100.5058,
        address: "Charoen Nakhon 19, Khlong Ton Sai, Khlong San, Bangkok 10600",
        amenities: ["parking", "changing_room", "cafe"],
        sourcePlatform: "playtomic",
        sourceId: "no-drama-padel-bkk",
      },
      {
        name: "The Padel Co.",
        slug: "the-padel-co",
        lat: 13.7021,
        lng: 100.5953,
        address: "605, 50 Soi Sawasdi 4, Phra Khanong, Khlong Toei, Bangkok 10260",
        amenities: ["parking", "changing_room"],
        sourcePlatform: "playtomic",
        sourceId: "the-padel-co-bkk",
      },
      {
        name: "Kross Padel Indoor / Rama IV",
        slug: "kross-padel-rama-iv",
        lat: 13.7175,
        lng: 100.5543,
        address: "135 Ardnarong Road, Khlong Toei, Bangkok 10110",
        amenities: ["parking", "changing_room", "pro_shop"],
        sourcePlatform: "book_and_go",
        sourceId: "kross-ramaiv",
      },
      {
        name: "Pad Thai Padel",
        slug: "pad-thai-padel",
        lat: 13.7168,
        lng: 100.5742,
        address: "3245 Soi Saen Sabai, Khwaeng Khlong Tan, Khlong Toei, Bangkok 10110",
        amenities: ["parking", "changing_room"],
        sourcePlatform: "padel_society",
        sourceId: "pad-thai-padel",
      },
      {
        name: "Bangkok Padel",
        slug: "bangkok-padel",
        lat: 13.7446,
        lng: 100.5578,
        address: "Ambassador Hotel, 171 Sukumvit 11, Khlong Toei Nuea, Watthana, Bangkok 10110",
        amenities: ["parking", "changing_room", "coaching", "cafe"],
        sourcePlatform: "matchi",
        sourceId: "1562",
      },
    ])
    .returning();

  console.log(`Created ${6} venues`);

  // --- Courts ---
  const courtData = [
    // Baan Padel — 7 courts
    { venueId: baanPadel.id, name: "Court 1", surface: "panoramic", indoor: false },
    { venueId: baanPadel.id, name: "Court 2", surface: "panoramic", indoor: false },
    { venueId: baanPadel.id, name: "Court 3", surface: "glass", indoor: true },
    { venueId: baanPadel.id, name: "Court 4", surface: "glass", indoor: true },
    { venueId: baanPadel.id, name: "Court 5", surface: "glass", indoor: true },
    { venueId: baanPadel.id, name: "Court 6", surface: "panoramic", indoor: false },
    { venueId: baanPadel.id, name: "Court 7", surface: "panoramic", indoor: false },
    // No Drama Padel — 5 courts
    { venueId: noDrama.id, name: "Court 1", surface: "glass", indoor: true },
    { venueId: noDrama.id, name: "Court 2", surface: "glass", indoor: true },
    { venueId: noDrama.id, name: "Court 3", surface: "glass", indoor: true },
    { venueId: noDrama.id, name: "Court 4", surface: "panoramic", indoor: false },
    { venueId: noDrama.id, name: "Court 5", surface: "panoramic", indoor: false },
    // The Padel Co. — 2 courts
    { venueId: padelCo.id, name: "Court 1", surface: "glass", indoor: true },
    { venueId: padelCo.id, name: "Court 2", surface: "glass", indoor: true },
    // Kross Padel Indoor — 3 courts
    { venueId: krossIndoor.id, name: "Court 1", surface: "glass", indoor: true },
    { venueId: krossIndoor.id, name: "Court 2", surface: "glass", indoor: true },
    { venueId: krossIndoor.id, name: "Court 3", surface: "glass", indoor: true },
    // Pad Thai Padel — 3 courts (2 indoor + 1 outdoor)
    { venueId: padThaiPadel.id, name: "Court 1", surface: "glass", indoor: true },
    { venueId: padThaiPadel.id, name: "Court 2", surface: "glass", indoor: true },
    { venueId: padThaiPadel.id, name: "Court 3", surface: "panoramic", indoor: false },
    // Bangkok Padel — 2 rooftop courts
    { venueId: bangkokPadel.id, name: "Rooftop Court 1", surface: "turf", indoor: false },
    { venueId: bangkokPadel.id, name: "Rooftop Court 2", surface: "turf", indoor: false },
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
