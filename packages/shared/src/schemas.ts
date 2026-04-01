import { z } from "zod";

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const regionSchema = z.object({
  center: coordinatesSchema,
  radiusKm: z.number().positive().max(100),
});

export const dateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const slotSearchSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(100).optional().default(15),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  surface: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .pipe(z.array(z.enum(["glass", "panoramic", "concrete", "turf"])))
    .optional(),
  indoor: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  venueId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type SlotSearchQuery = z.infer<typeof slotSearchSchema>;

// Preference schemas

export const preferenceCategorySchema = z.enum([
  "play_style",
  "skill_level",
  "competitive_intent",
  "time",
  "location",
  "court_surface",
  "group_size",
  "coaching",
]);

export const preferenceInputSchema = z.object({
  text: z.string().min(1).max(500),
  category: preferenceCategorySchema.optional(),
});

export const storePreferenceSchema = z.object({
  userId: z.string().uuid(),
  preferences: z.array(preferenceInputSchema).min(1).max(20),
});

export const queryPreferencesSchema = z.object({
  userId: z.string().uuid(),
  query: z.string().min(1).max(500),
  topK: z.coerce.number().int().positive().max(50).optional().default(10),
  categories: z.array(preferenceCategorySchema).optional(),
});

export const bulkPreferencesSchema = z.object({
  userId: z.string().uuid(),
  categories: z.array(preferenceCategorySchema).optional(),
  activeOnly: z.coerce.boolean().optional().default(true),
});

export type StorePreferenceInput = z.infer<typeof storePreferenceSchema>;
export type QueryPreferencesInput = z.infer<typeof queryPreferencesSchema>;
export type BulkPreferencesInput = z.infer<typeof bulkPreferencesSchema>;

// Player social schemas

export const playFrequencySchema = z.enum([
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "occasional",
]);

export const playerProfileInputSchema = z.object({
  displayName: z.string().min(1).max(100),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  preferredLocations: z.array(z.string().max(100)).max(10).optional().default([]),
  playFrequency: playFrequencySchema.optional(),
});

export const playerDiscoverySchema = z.object({
  minRating: z.coerce.number().optional(),
  maxRating: z.coerce.number().optional(),
  playFrequency: playFrequencySchema.optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});

export type PlayerDiscoveryQuery = z.infer<typeof playerDiscoverySchema>;
