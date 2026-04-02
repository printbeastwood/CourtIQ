/**
 * App Store Metadata — CourtIQ
 *
 * Canonical text for iOS App Store and Google Play Store listings.
 * Exported as structured data for use in build scripts, CMS, or manual copy-paste.
 */

export const appStoreMetadata = {
  /** App name (max 30 chars for iOS, 50 for Android) */
  name: "CourtIQ — Padel Concierge",

  /** Short description (max 80 chars for Android) */
  shortDescription:
    "AI-powered padel court booking across every platform in Bangkok.",

  /** Full description (max 4000 chars for both stores) */
  fullDescription: `CourtIQ is your AI padel concierge — the only app that aggregates real-time availability from every booking platform in Bangkok, then matches you with the perfect court, time, and players.

FIND EVERY COURT IN ONE PLACE
Stop switching between Playtomic, MATCHi, Padel Mates, and venue apps. CourtIQ scans 50+ venues and 200+ courts across Bangkok to show you what's available right now.

YOUR PERSONAL AI CONCIERGE
Tell your concierge when you want to play, your skill level, and your preferred court type. It learns your preferences over time and surfaces personalized recommendations — the right court, the right opponent, the right time.

BOOK IN TWO TAPS
Found your slot? Book instantly with secure in-app payment. Get confirmation, reminders, and directions. No more copying codes between apps.

KNOW YOUR LEVEL
CourtIQ uses the Glicko-2 rating system to track your skill level across matches. Get matched with players at your level for better, more competitive games.

PLAY SOCIALLY
Create open matches and invite friends, or join games near you. Build your padel community in Bangkok and find regular partners.

RATE AND IMPROVE
After every match, rate the court and your experience. Your concierge uses this feedback to make even better recommendations next time.

FOR VENUE PARTNERS
Venue owners get a real-time dashboard with booking analytics, automated promotions, and direct payouts via Stripe. Fill every court, every hour.

---

CourtIQ is free to download. Premium features are available with a Pro subscription.

Questions? Email us at hello@courtiq.app`,

  /** Keywords (max 100 chars total for iOS, comma-separated) */
  keywords:
    "padel,court,booking,bangkok,tennis,racquet,sports,AI,concierge,rating",

  /** Category */
  primaryCategory: "Sports",
  secondaryCategory: "Lifestyle",

  /** Promotional text (max 170 chars, iOS only — can be updated without review) */
  promotionalText:
    "Now in Bangkok! Find and book padel courts across 50+ venues with your personal AI concierge.",

  /** What's New (for version updates) */
  whatsNew: `Welcome to CourtIQ! Your AI padel concierge is here.

- Search courts across all platforms in Bangkok
- AI-powered recommendations tailored to you
- Instant booking with secure in-app payments
- Glicko-2 skill ratings and match tracking
- Social features — create matches, invite friends
- Referral programme — invite friends and earn rewards`,

  /** Screenshots — captions for 5 key screens */
  screenshotCaptions: [
    {
      screen: "home",
      caption: "Every court in Bangkok, one app",
      subtitle: "Real-time availability across 50+ venues",
    },
    {
      screen: "concierge",
      caption: "Your AI padel concierge",
      subtitle: "Tell it what you want — it finds the perfect match",
    },
    {
      screen: "booking",
      caption: "Book in two taps",
      subtitle: "Secure payments, instant confirmation",
    },
    {
      screen: "ratings",
      caption: "Track your skill level",
      subtitle: "Glicko-2 ratings for competitive matchmaking",
    },
    {
      screen: "social",
      caption: "Play with your community",
      subtitle: "Create matches, find partners, grow your network",
    },
  ],

  /** Feature graphic text (Google Play, 1024x500) */
  featureGraphic: {
    headline: "Your AI Padel Concierge",
    subheadline: "Every court. Every platform. One app.",
  },

  /** App icon variants */
  iconVariants: {
    primary:
      "Blue rounded square with white 'C' lettermark, brand-600 background",
    monochrome:
      "White 'C' on transparent, for dark backgrounds and notifications",
    adaptive:
      "Brand-600 background layer + white 'C' foreground layer (Android adaptive icon)",
  },
} as const;
