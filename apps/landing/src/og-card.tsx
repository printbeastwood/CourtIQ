/**
 * OG / Share Card Template
 *
 * Renders a 1200x630 card for Open Graph and social sharing.
 * Can be rendered server-side to PNG via a screenshot service,
 * or used as a visual reference for static asset creation.
 *
 * Also reused for referral link share cards.
 */

export function OGCard({
  title = "Your AI Padel Concierge",
  subtitle = "Find and book the perfect padel court in Bangkok",
  variant = "default",
}: {
  title?: string;
  subtitle?: string;
  variant?: "default" | "referral";
}) {
  return (
    <div
      className="relative overflow-hidden bg-brand-950"
      style={{ width: 1200, height: 630 }}
    >
      {/* Background gradient orbs */}
      <div className="absolute top-[-100px] right-[-60px] w-[500px] h-[500px] rounded-full bg-brand-700/30 blur-[120px]" />
      <div className="absolute bottom-[-80px] left-[-40px] w-[400px] h-[400px] rounded-full bg-brand-600/20 blur-[100px]" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Content */}
      <div className="relative flex flex-col justify-between h-full p-16">
        {/* Top: Logo */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center">
            <span className="text-white font-extrabold text-xl">C</span>
          </div>
          <span className="font-extrabold text-3xl text-white">
            Court<span className="text-brand-400">IQ</span>
          </span>
        </div>

        {/* Center: Main copy */}
        <div className="max-w-[700px]">
          <h1 className="text-6xl font-extrabold text-white leading-tight tracking-tight">
            {title}
          </h1>
          <p className="mt-4 text-2xl text-brand-200 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Bottom: CTA + badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {variant === "referral" ? (
              <div className="flex items-center gap-3 rounded-full bg-brand-600 px-8 py-4">
                <span className="text-xl font-semibold text-white">
                  Join with my referral link
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-5 py-3">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <span className="text-base font-semibold text-white">App Store</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-5 py-3">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .61-.92zm10.89 9.48l2.706-2.706-10.89-6.302 8.184 9.008zm-8.184 9.008l10.89-6.302-2.706-2.706-8.184 9.008zM20.16 10.95l-2.457-1.423-2.88 2.88 2.88 2.88 2.456-1.423a1.124 1.124 0 0 0 0-1.914z" />
                  </svg>
                  <span className="text-base font-semibold text-white">Google Play</span>
                </div>
              </>
            )}
          </div>
          <p className="text-lg text-brand-300 font-medium">courtiq.app</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Referral Share Card — variant for the referral programme.
 * Uses the same base template with a personalized referral CTA.
 */
export function ReferralShareCard({ referrerName }: { referrerName: string }) {
  return (
    <OGCard
      title={`${referrerName} invited you to play padel`}
      subtitle="Get matched with players at your level. Book courts across every platform in Bangkok."
      variant="referral"
    />
  );
}
