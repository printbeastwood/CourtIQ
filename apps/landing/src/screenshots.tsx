/**
 * App Store Screenshot Templates
 *
 * Each template renders at iPhone 6.7" (1290x2796) dimensions.
 * Use a screenshot tool (e.g. Puppeteer, Playwright) to capture as PNG.
 *
 * The templates wrap a phone mockup in a marketing frame with
 * headline, subtitle, and gradient background.
 */

/* ------------------------------------------------------------------ */
/*  Screenshot Frame                                                    */
/* ------------------------------------------------------------------ */

function ScreenshotFrame({
  headline,
  subtitle,
  gradient,
  children,
}: {
  headline: string;
  subtitle: string;
  gradient: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-col items-center justify-between overflow-hidden ${gradient}`}
      style={{ width: 1290, height: 2796 }}
    >
      {/* Background accent */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full bg-white/5 blur-[200px] -translate-y-1/4 translate-x-1/4" />

      {/* Copy block */}
      <div className="relative z-10 text-center pt-[200px] px-[120px]">
        <h2 className="text-[88px] font-extrabold text-white leading-[1.1] tracking-tight">
          {headline}
        </h2>
        <p className="mt-[32px] text-[44px] text-white/70 leading-snug">
          {subtitle}
        </p>
      </div>

      {/* Phone mockup area */}
      <div className="relative z-10 mt-auto mb-[80px]">
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Large Phone Mockup (for screenshots)                               */
/* ------------------------------------------------------------------ */

function LargePhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative" style={{ width: 740, height: 1520 }}>
      {/* Device frame */}
      <div className="absolute inset-0 rounded-[72px] bg-slate-900 shadow-2xl" />
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[44px] bg-slate-900 rounded-b-3xl z-10" />
      {/* Screen */}
      <div className="absolute inset-[6px] rounded-[66px] overflow-hidden bg-white">
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Screen Content Components                                          */
/* ------------------------------------------------------------------ */

function HomeScreen() {
  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900" style={{ fontSize: 42 }}>
      <div className="px-12 pt-16 pb-6">
        <p className="text-[32px] text-slate-400">Good morning</p>
        <p className="text-[52px] font-bold">Find your court</p>
      </div>
      <div className="mx-12 mb-8 flex items-center gap-4 rounded-3xl bg-white px-8 py-5 shadow-sm">
        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="text-[32px] text-slate-400">Search venues near you...</span>
      </div>
      <div className="px-12 mb-4">
        <p className="text-[36px] font-semibold">Nearby Courts</p>
      </div>
      <div className="px-12 space-y-4 flex-1">
        {[
          { name: "Padel Bangkok", courts: 6, dist: "1.2 km", color: "bg-blue-600" },
          { name: "The Racquet Club", courts: 4, dist: "2.8 km", color: "bg-emerald-500" },
          { name: "X-Padel Thonglor", courts: 8, dist: "3.1 km", color: "bg-cyan-500" },
          { name: "Padel Society BKK", courts: 5, dist: "4.5 km", color: "bg-purple-500" },
        ].map((v) => (
          <div key={v.name} className="flex items-center gap-5 rounded-3xl bg-white p-5 shadow-sm">
            <div className={`w-20 h-20 rounded-2xl ${v.color} flex items-center justify-center`}>
              <span className="text-[28px] font-bold text-white">{v.courts}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[34px] font-semibold truncate">{v.name}</p>
              <p className="text-[26px] text-slate-400">{v.dist} &bull; {v.courts} courts</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConciergeScreen() {
  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900" style={{ fontSize: 42 }}>
      <div className="px-12 py-8 border-b border-slate-100 bg-white">
        <p className="text-[48px] font-bold">AI Concierge</p>
        <p className="text-[28px] text-slate-400">Your personal padel assistant</p>
      </div>
      <div className="flex-1 px-12 py-8 space-y-6">
        {/* AI bubble */}
        <div className="flex gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex-shrink-0 flex items-center justify-center">
            <span className="text-[22px] font-bold text-white">AI</span>
          </div>
          <div className="bg-white rounded-3xl rounded-tl-lg p-6 shadow-sm max-w-[80%]">
            <p className="text-[30px] leading-relaxed">
              Hi! I found 3 glass courts available tonight near Sukhumvit. Want me to book your usual 7 PM slot at Padel Bangkok?
            </p>
          </div>
        </div>
        {/* User bubble */}
        <div className="flex justify-end">
          <div className="bg-blue-600 rounded-3xl rounded-tr-lg p-6 max-w-[80%]">
            <p className="text-[30px] text-white leading-relaxed">
              Yes please! And check if Tom and Sarah are free to join
            </p>
          </div>
        </div>
        {/* AI response */}
        <div className="flex gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex-shrink-0 flex items-center justify-center">
            <span className="text-[22px] font-bold text-white">AI</span>
          </div>
          <div className="bg-white rounded-3xl rounded-tl-lg p-6 shadow-sm max-w-[80%]">
            <p className="text-[30px] leading-relaxed">
              Booked! Court 3 at Padel Bangkok, 7-8:30 PM tonight. Tom confirmed, waiting on Sarah. You're all set!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingScreen() {
  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900" style={{ fontSize: 42 }}>
      <div className="px-12 py-8 border-b border-slate-100 bg-white">
        <p className="text-[48px] font-bold">Padel Bangkok</p>
        <p className="text-[28px] text-slate-400">Sukhumvit Soi 49 &bull; 6 courts</p>
      </div>
      <div className="mx-12 mt-8 h-[340px] rounded-3xl bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center">
        <span className="text-[36px] font-semibold text-white/80">Glass Court &bull; Indoor</span>
      </div>
      <div className="px-12 mt-8">
        <p className="text-[36px] font-semibold mb-5">Available Slots &bull; Today</p>
        <div className="grid grid-cols-3 gap-4">
          {["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"].map(
            (t, i) => (
              <div
                key={t}
                className={`rounded-2xl py-4 text-center text-[32px] font-medium ${
                  i === 4
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white text-slate-900 border border-slate-100"
                }`}
              >
                {t}
              </div>
            )
          )}
        </div>
      </div>
      <div className="mt-auto px-12 pb-12">
        <div className="w-full rounded-3xl bg-blue-600 py-6 text-center shadow-lg">
          <span className="text-[38px] font-semibold text-white">Book Court &mdash; 800 THB</span>
        </div>
      </div>
    </div>
  );
}

function RatingsScreen() {
  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900" style={{ fontSize: 42 }}>
      <div className="px-12 py-8 border-b border-slate-100 bg-white">
        <p className="text-[48px] font-bold">Your Profile</p>
      </div>
      <div className="px-12 pt-8">
        {/* Profile card */}
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="flex items-center gap-5 mb-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <span className="text-[32px] font-bold text-white">A</span>
            </div>
            <div>
              <p className="text-[38px] font-bold">Alex K.</p>
              <p className="text-[26px] text-slate-400">Intermediate &bull; Bangkok</p>
            </div>
          </div>
          {/* Rating card */}
          <div className="rounded-2xl bg-blue-50 p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[28px] font-semibold text-blue-900">Skill Rating</span>
              <span className="text-[48px] font-extrabold text-blue-600">1,847</span>
            </div>
            <div className="h-3 rounded-full bg-blue-100">
              <div className="h-3 rounded-full bg-blue-600 w-[68%]" />
            </div>
            <p className="text-[24px] text-blue-400 mt-2">Top 32% of Bangkok players</p>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Matches", value: "47" },
              { label: "Win Rate", value: "62%" },
              { label: "Streak", value: "4W" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-slate-50 p-4 text-center">
                <p className="text-[38px] font-bold text-slate-900">{s.value}</p>
                <p className="text-[24px] text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Recent matches */}
        <p className="text-[36px] font-semibold mt-8 mb-5">Recent Matches</p>
        {[
          { vs: "vs Tom & Sarah", result: "Won 6-4, 6-3", delta: "+18" },
          { vs: "vs Mike & Anna", result: "Lost 4-6, 6-7", delta: "-12" },
          { vs: "vs James & Lily", result: "Won 7-5, 6-2", delta: "+22" },
        ].map((m) => (
          <div key={m.vs} className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm mb-3">
            <div>
              <p className="text-[30px] font-semibold">{m.vs}</p>
              <p className="text-[24px] text-slate-400">{m.result}</p>
            </div>
            <span
              className={`text-[30px] font-bold ${
                m.delta.startsWith("+") ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {m.delta}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialScreen() {
  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900" style={{ fontSize: 42 }}>
      <div className="px-12 py-8 border-b border-slate-100 bg-white">
        <p className="text-[48px] font-bold">Open Matches</p>
        <p className="text-[28px] text-slate-400">Join a game near you</p>
      </div>
      <div className="px-12 pt-8 space-y-5">
        {[
          {
            title: "Evening Doubles",
            venue: "Padel Bangkok",
            time: "Today 7:00 PM",
            level: "Intermediate",
            spots: "1 spot left",
            color: "bg-blue-600",
          },
          {
            title: "Friendly Mix",
            venue: "X-Padel Thonglor",
            time: "Today 8:30 PM",
            level: "All levels",
            spots: "2 spots left",
            color: "bg-emerald-500",
          },
          {
            title: "Advanced Session",
            venue: "The Racquet Club",
            time: "Tomorrow 6:00 PM",
            level: "Advanced",
            spots: "3 spots left",
            color: "bg-purple-500",
          },
          {
            title: "Weekend Tournament",
            venue: "Padel Society BKK",
            time: "Sat 10:00 AM",
            level: "Intermediate+",
            spots: "6 spots left",
            color: "bg-amber-500",
          },
        ].map((match) => (
          <div key={match.title} className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[34px] font-semibold">{match.title}</p>
                <p className="text-[26px] text-slate-400">{match.venue}</p>
              </div>
              <span className={`text-[24px] font-semibold text-white ${match.color} rounded-full px-5 py-1.5`}>
                {match.level}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[28px] text-slate-500">{match.time}</p>
              <p className="text-[28px] font-medium text-blue-600">{match.spots}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto px-12 pb-12">
        <div className="w-full rounded-3xl bg-blue-600 py-6 text-center shadow-lg">
          <span className="text-[38px] font-semibold text-white">+ Create a Match</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Screenshot Templates (exported)                                     */
/* ------------------------------------------------------------------ */

export function Screenshot1_Home() {
  return (
    <ScreenshotFrame
      headline="Every court in Bangkok, one app"
      subtitle="Real-time availability across 50+ venues and 6 platforms"
      gradient="bg-gradient-to-b from-blue-700 to-blue-900"
    >
      <LargePhoneMockup>
        <HomeScreen />
      </LargePhoneMockup>
    </ScreenshotFrame>
  );
}

export function Screenshot2_Concierge() {
  return (
    <ScreenshotFrame
      headline="Your AI padel concierge"
      subtitle="Tell it what you want — it finds the perfect match"
      gradient="bg-gradient-to-b from-purple-700 to-blue-900"
    >
      <LargePhoneMockup>
        <ConciergeScreen />
      </LargePhoneMockup>
    </ScreenshotFrame>
  );
}

export function Screenshot3_Booking() {
  return (
    <ScreenshotFrame
      headline="Book in two taps"
      subtitle="Secure payments, instant confirmation"
      gradient="bg-gradient-to-b from-blue-600 to-slate-900"
    >
      <LargePhoneMockup>
        <BookingScreen />
      </LargePhoneMockup>
    </ScreenshotFrame>
  );
}

export function Screenshot4_Ratings() {
  return (
    <ScreenshotFrame
      headline="Track your skill level"
      subtitle="Glicko-2 ratings for competitive matchmaking"
      gradient="bg-gradient-to-b from-emerald-700 to-blue-900"
    >
      <LargePhoneMockup>
        <RatingsScreen />
      </LargePhoneMockup>
    </ScreenshotFrame>
  );
}

export function Screenshot5_Social() {
  return (
    <ScreenshotFrame
      headline="Play with your community"
      subtitle="Create matches, find partners, grow your network"
      gradient="bg-gradient-to-b from-amber-600 to-blue-900"
    >
      <LargePhoneMockup>
        <SocialScreen />
      </LargePhoneMockup>
    </ScreenshotFrame>
  );
}

/** All screenshots in order for batch rendering */
export const allScreenshots = [
  { id: "01-home", Component: Screenshot1_Home },
  { id: "02-concierge", Component: Screenshot2_Concierge },
  { id: "03-booking", Component: Screenshot3_Booking },
  { id: "04-ratings", Component: Screenshot4_Ratings },
  { id: "05-social", Component: Screenshot5_Social },
] as const;
