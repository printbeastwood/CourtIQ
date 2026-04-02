import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Icons (inline SVGs to avoid external deps)                        */
/* ------------------------------------------------------------------ */

function IconSearch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconBrain(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2a6 6 0 0 0-6 6c0 1.66.68 3.16 1.76 4.24L12 16l4.24-3.76A6 6 0 0 0 12 2Z" />
      <path d="M12 16v6" />
      <path d="M8 22h8" />
      <circle cx="12" cy="8" r="2" />
    </svg>
  );
}

function IconStar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function IconCalendar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function IconTrophy(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function IconUsers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 12h16" />
      <path d="M4 6h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function IconX(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function IconApple(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function IconPlayStore(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .61-.92zm10.89 9.48l2.706-2.706-10.89-6.302 8.184 9.008zm-8.184 9.008l10.89-6.302-2.706-2.706-8.184 9.008zM20.16 10.95l-2.457-1.423-2.88 2.88 2.88 2.88 2.456-1.423a1.124 1.124 0 0 0 0-1.914z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Phone Mockup Component                                             */
/* ------------------------------------------------------------------ */

function PhoneMockup({ screen }: { screen: "home" | "concierge" | "booking" }) {
  const screens = {
    home: (
      <div className="flex flex-col h-full bg-slate-50">
        {/* Status bar */}
        <div className="flex items-center justify-between px-4 pt-2 pb-1 text-[8px] font-semibold text-brand-950">
          <span>9:41</span>
          <div className="flex gap-1">
            <div className="w-3 h-1.5 bg-brand-950 rounded-sm" />
            <div className="w-3 h-1.5 bg-brand-950 rounded-sm" />
            <div className="w-4 h-1.5 bg-brand-950 rounded-sm" />
          </div>
        </div>
        {/* Greeting */}
        <div className="px-4 pt-3 pb-2">
          <p className="text-[9px] text-slate-500">Good morning</p>
          <p className="text-[13px] font-bold text-brand-950">Find your court</p>
        </div>
        {/* Search bar */}
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
          <IconSearch className="w-3 h-3 text-slate-400" />
          <span className="text-[9px] text-slate-400">Search venues near you...</span>
        </div>
        {/* Venue cards */}
        <div className="px-4 space-y-2 flex-1">
          <p className="text-[10px] font-semibold text-brand-950">Nearby Courts</p>
          {[
            { name: "Padel Bangkok", courts: 6, color: "bg-brand-600" },
            { name: "The Racquet Club", courts: 4, color: "bg-court-turf" },
            { name: "X-Padel Thonglor", courts: 8, color: "bg-court-glass" },
          ].map((v) => (
            <div key={v.name} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm">
              <div className={`w-8 h-8 rounded-lg ${v.color} flex items-center justify-center`}>
                <span className="text-[8px] font-bold text-white">{v.courts}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-brand-950 truncate">{v.name}</p>
                <p className="text-[8px] text-slate-400">{v.courts} courts available</p>
              </div>
              <IconChevronRight className="w-3 h-3 text-slate-300" />
            </div>
          ))}
        </div>
        {/* Tab bar */}
        <div className="flex items-center justify-around border-t border-slate-100 bg-white py-2 mt-auto">
          {["Home", "Search", "AI", "Bookings", "Profile"].map((t, i) => (
            <div key={t} className="flex flex-col items-center gap-0.5">
              <div className={`w-4 h-4 rounded-full ${i === 0 ? "bg-brand-600" : "bg-slate-200"}`} />
              <span className={`text-[7px] ${i === 0 ? "font-semibold text-brand-600" : "text-slate-400"}`}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    concierge: (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="flex items-center justify-between px-4 pt-2 pb-1 text-[8px] font-semibold text-brand-950">
          <span>9:41</span>
          <div className="flex gap-1">
            <div className="w-3 h-1.5 bg-brand-950 rounded-sm" />
            <div className="w-3 h-1.5 bg-brand-950 rounded-sm" />
            <div className="w-4 h-1.5 bg-brand-950 rounded-sm" />
          </div>
        </div>
        <div className="px-4 py-2 border-b border-slate-100 bg-white">
          <p className="text-[12px] font-bold text-brand-950">AI Concierge</p>
          <p className="text-[8px] text-slate-400">Your personal padel assistant</p>
        </div>
        <div className="flex-1 px-4 py-3 space-y-2 overflow-hidden">
          {/* AI message */}
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex-shrink-0 flex items-center justify-center">
              <span className="text-[6px] font-bold text-white">AI</span>
            </div>
            <div className="bg-white rounded-xl rounded-tl-sm p-2 shadow-sm max-w-[75%]">
              <p className="text-[9px] text-brand-950 leading-tight">
                Hi! I found 3 glass courts available tonight near Sukhumvit. Want me to book your usual 7 PM slot?
              </p>
            </div>
          </div>
          {/* User message */}
          <div className="flex justify-end">
            <div className="bg-brand-600 rounded-xl rounded-tr-sm p-2 max-w-[75%]">
              <p className="text-[9px] text-white leading-tight">
                Yes! Book the one at Padel Bangkok please
              </p>
            </div>
          </div>
          {/* AI response */}
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex-shrink-0 flex items-center justify-center">
              <span className="text-[6px] font-bold text-white">AI</span>
            </div>
            <div className="bg-white rounded-xl rounded-tl-sm p-2 shadow-sm max-w-[75%]">
              <p className="text-[9px] text-brand-950 leading-tight">
                Done! Court 3 at Padel Bangkok, 7-8:30 PM. I've invited your regular group. See you on court!
              </p>
            </div>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm border border-slate-100">
            <span className="text-[9px] text-slate-400 flex-1">Ask your concierge...</span>
            <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center">
              <IconChevronRight className="w-3 h-3 text-white" />
            </div>
          </div>
        </div>
      </div>
    ),
    booking: (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="flex items-center justify-between px-4 pt-2 pb-1 text-[8px] font-semibold text-brand-950">
          <span>9:41</span>
          <div className="flex gap-1">
            <div className="w-3 h-1.5 bg-brand-950 rounded-sm" />
            <div className="w-3 h-1.5 bg-brand-950 rounded-sm" />
            <div className="w-4 h-1.5 bg-brand-950 rounded-sm" />
          </div>
        </div>
        <div className="px-4 py-2 border-b border-slate-100 bg-white">
          <p className="text-[12px] font-bold text-brand-950">Padel Bangkok</p>
          <p className="text-[8px] text-slate-400">Sukhumvit Soi 49 &bull; 6 courts</p>
        </div>
        {/* Court image placeholder */}
        <div className="mx-4 mt-3 h-20 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center">
          <span className="text-[10px] font-semibold text-white/80">Glass Court</span>
        </div>
        {/* Time slots */}
        <div className="px-4 mt-3">
          <p className="text-[10px] font-semibold text-brand-950 mb-2">Available Slots</p>
          <div className="grid grid-cols-3 gap-1.5">
            {["17:00", "17:30", "18:00", "18:30", "19:00", "19:30"].map((t, i) => (
              <div
                key={t}
                className={`rounded-lg py-1.5 text-center text-[9px] font-medium ${
                  i === 4
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-white text-brand-950 border border-slate-100"
                }`}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
        {/* Book button */}
        <div className="mt-auto px-4 pb-4">
          <div className="w-full rounded-xl bg-brand-600 py-2.5 text-center">
            <span className="text-[11px] font-semibold text-white">Book Court &mdash; 800 THB</span>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="relative mx-auto w-[220px] h-[440px]">
      {/* Phone frame */}
      <div className="absolute inset-0 rounded-[36px] bg-brand-950 shadow-2xl" />
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-brand-950 rounded-b-2xl z-10" />
      {/* Screen */}
      <div className="absolute inset-[3px] rounded-[33px] overflow-hidden bg-white">
        {screens[screen]}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature Card                                                       */
/* ------------------------------------------------------------------ */

function FeatureCard({
  icon,
  title,
  description,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className="group relative rounded-2xl bg-white p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-brand-100 transition-all duration-300">
      <div
        className={`mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl ${accent} transition-transform group-hover:scale-110`}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-brand-950 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats Bar                                                          */
/* ------------------------------------------------------------------ */

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl md:text-3xl font-extrabold text-brand-600">{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  How It Works Step                                                   */
/* ------------------------------------------------------------------ */

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-lg">
        {number}
      </div>
      <div>
        <h4 className="font-semibold text-brand-950 mb-1">{title}</h4>
        <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main App                                                           */
/* ------------------------------------------------------------------ */

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleEarlyAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) setSubmitted(true);
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ============== NAVBAR ============== */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white font-extrabold text-sm">C</span>
            </div>
            <span className="font-extrabold text-xl text-brand-950">
              Court<span className="text-brand-600">IQ</span>
            </span>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors">
              How It Works
            </a>
            <a href="#venues" className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors">
              For Venues
            </a>
            <a
              href="#early-access"
              className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              Get Early Access
            </a>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2 -mr-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <IconX className="w-6 h-6" /> : <IconMenu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-3">
            <a href="#features" className="block text-sm font-medium text-slate-600" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="block text-sm font-medium text-slate-600" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#venues" className="block text-sm font-medium text-slate-600" onClick={() => setMobileMenuOpen(false)}>For Venues</a>
            <a
              href="#early-access"
              className="block w-full text-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              Get Early Access
            </a>
          </div>
        )}
      </nav>

      {/* ============== HERO ============== */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/60 via-white to-white" />
        <div className="absolute top-20 -right-40 w-96 h-96 rounded-full bg-brand-100/40 blur-3xl" />
        <div className="absolute bottom-0 -left-40 w-96 h-96 rounded-full bg-brand-100/30 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Copy */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-4 py-1.5 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
                </span>
                <span className="text-sm font-medium text-brand-700">Now in Bangkok</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-brand-950 leading-[1.1] tracking-tight">
                Your AI Padel{" "}
                <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
                  Concierge
                </span>
              </h1>

              <p className="mt-6 text-lg text-slate-500 leading-relaxed max-w-md">
                Find and book the perfect court across every platform in Bangkok.
                AI-powered recommendations tailored to your level, schedule, and play style.
              </p>

              {/* CTA */}
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a
                  href="#early-access"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-7 py-3.5 text-base font-semibold text-white hover:bg-brand-700 shadow-lg shadow-brand-600/25 transition-all hover:shadow-xl hover:shadow-brand-600/30"
                >
                  Get Early Access
                  <IconChevronRight className="w-4 h-4" />
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-3.5 text-base font-semibold text-brand-950 hover:bg-slate-50 transition-colors"
                >
                  See How It Works
                </a>
              </div>

              {/* Store badges preview */}
              <div className="mt-8 flex items-center gap-4">
                <div className="flex items-center gap-2 rounded-lg bg-brand-950 px-4 py-2">
                  <IconApple className="w-5 h-5 text-white" />
                  <div className="leading-tight">
                    <div className="text-[9px] text-white/70">Download on the</div>
                    <div className="text-xs font-semibold text-white">App Store</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-brand-950 px-4 py-2">
                  <IconPlayStore className="w-5 h-5 text-white" />
                  <div className="leading-tight">
                    <div className="text-[9px] text-white/70">Get it on</div>
                    <div className="text-xs font-semibold text-white">Google Play</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Phone mockups */}
            <div className="relative hidden md:flex justify-center items-center h-[500px]">
              <div className="absolute -left-4 top-8 animate-float" style={{ animationDelay: "0s" }}>
                <PhoneMockup screen="home" />
              </div>
              <div className="absolute left-32 top-0 animate-float" style={{ animationDelay: "2s" }}>
                <PhoneMockup screen="concierge" />
              </div>
            </div>
            {/* Mobile: single phone */}
            <div className="md:hidden flex justify-center">
              <PhoneMockup screen="home" />
            </div>
          </div>
        </div>
      </section>

      {/* ============== STATS BAR ============== */}
      <section className="py-12 bg-white border-y border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatItem value="50+" label="Venues" />
          <StatItem value="200+" label="Courts" />
          <StatItem value="6" label="Platforms" />
          <StatItem value="24/7" label="AI Concierge" />
        </div>
      </section>

      {/* ============== FEATURES ============== */}
      <section id="features" className="py-20 md:py-28 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-brand-950 tracking-tight">
              Everything you need to play more padel
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              One app aggregates every court, every platform, every time slot in Bangkok.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<IconSearch className="w-6 h-6 text-brand-600" />}
              title="Cross-Platform Search"
              description="See real-time availability from Playtomic, MATCHi, Padel Mates, and more — all in one view. No more switching between apps."
              accent="bg-brand-50"
            />
            <FeatureCard
              icon={<IconBrain className="w-6 h-6 text-purple-600" />}
              title="AI Concierge"
              description="Tell your concierge what you want — it learns your preferences, skill level, and schedule to suggest perfect matches."
              accent="bg-purple-50"
            />
            <FeatureCard
              icon={<IconTrophy className="w-6 h-6 text-amber-600" />}
              title="Skill Ratings"
              description="Glicko-2 powered ratings track your progress. Get matched with players at your level for better, more competitive games."
              accent="bg-amber-50"
            />
            <FeatureCard
              icon={<IconCalendar className="w-6 h-6 text-emerald-600" />}
              title="Instant Booking"
              description="Book any court in two taps. Pay securely in-app. Get confirmation and reminders so you never miss a game."
              accent="bg-emerald-50"
            />
            <FeatureCard
              icon={<IconUsers className="w-6 h-6 text-cyan-600" />}
              title="Social Play"
              description="Create open matches, invite friends, or join games near you. Build your padel community organically."
              accent="bg-cyan-50"
            />
            <FeatureCard
              icon={<IconStar className="w-6 h-6 text-rose-500" />}
              title="Post-Match Insights"
              description="Rate venues, review partners, track your match history. Your concierge uses this to make even better recommendations."
              accent="bg-rose-50"
            />
          </div>
        </div>
      </section>

      {/* ============== HOW IT WORKS ============== */}
      <section id="how-it-works" className="py-20 md:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-brand-950 tracking-tight mb-10">
                From download to court in minutes
              </h2>
              <div className="space-y-8">
                <Step
                  number={1}
                  title="Tell us how you play"
                  description="Quick onboarding captures your skill level, preferred court type, favorite times, and location."
                />
                <Step
                  number={2}
                  title="Get personalized picks"
                  description="The AI concierge scans every platform and surfaces the best courts, times, and matches for you."
                />
                <Step
                  number={3}
                  title="Book and show up"
                  description="One-tap booking with in-app payment. We handle the rest — confirmations, reminders, and post-match follow-up."
                />
              </div>
            </div>
            <div className="flex justify-center">
              <PhoneMockup screen="booking" />
            </div>
          </div>
        </div>
      </section>

      {/* ============== FOR VENUES ============== */}
      <section id="venues" className="py-20 md:py-28 bg-brand-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 mb-6">
                <span className="text-sm font-medium text-brand-200">For Venue Partners</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">
                Fill every court, every hour
              </h2>
              <p className="text-lg text-brand-200 leading-relaxed mb-8">
                CourtIQ brings you more bookings from qualified players. Our AI matches your empty slots
                with the right players at the right time.
              </p>
              <ul className="space-y-4">
                {[
                  "Venue dashboard with real-time analytics",
                  "Automated pricing and promotions",
                  "Direct payouts via Stripe Connect",
                  "Player ratings for better court management",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-brand-100">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Dashboard preview card */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
                  <span className="text-white font-extrabold text-sm">C</span>
                </div>
                <div>
                  <p className="font-semibold text-white">Venue Dashboard</p>
                  <p className="text-sm text-brand-300">Real-time analytics</p>
                </div>
              </div>
              {/* Mock chart */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-brand-300">Bookings Today</span>
                  <span className="font-semibold text-white">24</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-brand-500 w-3/4" />
                </div>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-brand-300">Revenue This Week</span>
                  <span className="font-semibold text-white">92,400 THB</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-emerald-500 w-4/5" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Utilization", value: "87%" },
                  { label: "Avg Rating", value: "4.8" },
                  { label: "Repeat Rate", value: "64%" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-white/5 p-3 text-center">
                    <div className="text-lg font-bold text-white">{s.value}</div>
                    <div className="text-[11px] text-brand-300">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== EARLY ACCESS CTA ============== */}
      <section id="early-access" className="py-20 md:py-28 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-brand-950 tracking-tight mb-4">
            Be the first on court
          </h2>
          <p className="text-lg text-slate-500 mb-10">
            Join the early access list and get notified when CourtIQ launches in Bangkok.
            First 100 users get 3 months of Pro free.
          </p>

          {submitted ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-emerald-900 mb-2">You're on the list!</h3>
              <p className="text-emerald-700">We'll notify you at <strong>{email}</strong> when CourtIQ launches.</p>
            </div>
          ) : (
            <form onSubmit={handleEarlyAccess} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 rounded-full border border-slate-200 px-5 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              <button
                type="submit"
                className="rounded-full bg-brand-600 px-7 py-3.5 text-base font-semibold text-white hover:bg-brand-700 shadow-lg shadow-brand-600/25 transition-all whitespace-nowrap"
              >
                Join Waitlist
              </button>
            </form>
          )}

          {/* App store badges */}
          <div className="mt-10 flex items-center justify-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-brand-950 px-5 py-2.5 cursor-pointer hover:bg-brand-900 transition-colors">
              <IconApple className="w-6 h-6 text-white" />
              <div className="leading-tight text-left">
                <div className="text-[10px] text-white/70">Download on the</div>
                <div className="text-sm font-semibold text-white">App Store</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-brand-950 px-5 py-2.5 cursor-pointer hover:bg-brand-900 transition-colors">
              <IconPlayStore className="w-6 h-6 text-white" />
              <div className="leading-tight text-left">
                <div className="text-[10px] text-white/70">Get it on</div>
                <div className="text-sm font-semibold text-white">Google Play</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="py-12 bg-slate-50 border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
                <span className="text-white font-extrabold text-xs">C</span>
              </div>
              <span className="font-extrabold text-lg text-brand-950">
                Court<span className="text-brand-600">IQ</span>
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <a href="#" className="hover:text-brand-600 transition-colors">Privacy</a>
              <a href="#" className="hover:text-brand-600 transition-colors">Terms</a>
              <a href="#" className="hover:text-brand-600 transition-colors">Contact</a>
            </div>
            <p className="text-sm text-slate-400">
              &copy; {new Date().getFullYear()} CourtIQ. Made in Bangkok.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
