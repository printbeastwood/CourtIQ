import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../api/client";

type OnboardingMethod = "choose" | "import" | "manual";
type OnboardingStep = "business" | "courts" | "hours" | "pricing" | "stripe" | "verify" | "done";
type ImportStep = "select-platform" | "search" | "preview" | "confirm" | "done";

interface PlatformInfo {
  id: string;
  name: string;
  importSupported: boolean;
}

interface PlatformVenue {
  sourceId: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  platform: string;
  metadata: Record<string, unknown>;
}

interface ImportResult {
  venueId: string;
  name: string;
  address: string;
  platform: string;
  courts: { id: string; name: string; surface: string; indoor: boolean; slotCount: number }[];
  message: string;
}

interface CourtEntry {
  name: string;
  surface: "glass" | "panoramic" | "concrete" | "turf";
  indoor: boolean;
}

interface HoursEntry {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DEFAULT_HOURS: HoursEntry[] = DAYS.map((day) => ({
  day,
  open: "07:00",
  close: "22:00",
  closed: false,
}));

const SURFACES = [
  { value: "glass" as const, label: "Glass", color: "bg-cyan-100 text-cyan-700" },
  { value: "panoramic" as const, label: "Panoramic", color: "bg-purple-100 text-purple-700" },
  { value: "concrete" as const, label: "Concrete", color: "bg-gray-100 text-gray-700" },
  { value: "turf" as const, label: "Turf", color: "bg-green-100 text-green-700" },
];

const COMMON_AMENITIES = [
  "Parking", "Changing rooms", "Showers", "Pro shop", "Cafe",
  "Lighting", "Air conditioning", "Equipment rental", "Coaching",
  "Spectator area", "WiFi", "Lockers", "Water station",
];

function StepIndicator({ current, steps }: { current: OnboardingStep; steps: OnboardingStep[] }) {
  const idx = steps.indexOf(current);
  return (
    <div className="flex items-center justify-center gap-1">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              i < idx
                ? "bg-green-500 text-white"
                : i === idx
                  ? "bg-brand-600 text-white"
                  : "bg-gray-200 text-gray-500"
            }`}
          >
            {i < idx ? "\u2713" : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 w-6 sm:w-10 ${i < idx ? "bg-green-500" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function PlatformImportFlow({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [importStep, setImportStep] = useState<ImportStep>("select-platform");
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<PlatformVenue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<PlatformVenue | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [importing, setImporting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: PlatformInfo[] }>("/venue-onboarding/platforms")
      .then((res) => setPlatforms(res.data))
      .catch(() => {});
  }, []);

  async function searchPlatform(platform: string) {
    setSearching(true);
    setError(null);
    try {
      const res = await api.get<{ data: PlatformVenue[] }>(
        `/venue-onboarding/search-platform?platform=${platform}`
      );
      setSearchResults(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleImport() {
    if (!selectedVenue || !adminEmail) return;
    setImporting(true);
    setError(null);
    try {
      const res = await api.post<{ data: ImportResult }>("/venue-onboarding/import-from-platform", {
        platform: selectedVenue.platform,
        venueSourceId: selectedVenue.sourceId,
        adminEmail,
        adminPhone: adminPhone || undefined,
      });
      setImportResult(res.data);
      setImportStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  if (importStep === "done" && importResult) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Import Complete!</h2>
          <p className="text-sm text-gray-500">{importResult.message}</p>
          <div className="rounded-xl bg-white p-4 shadow-sm text-left">
            <p className="text-xs font-medium text-gray-500 uppercase mb-3">Imported Courts</p>
            {importResult.courts.map((court) => (
              <div key={court.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{court.name}</p>
                  <p className="text-xs text-gray-500">
                    {court.surface} {court.indoor ? "(indoor)" : "(outdoor)"}
                  </p>
                </div>
                <span className="text-xs text-gray-400">{court.slotCount} slots</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-green-50 p-3">
            <p className="text-xs font-medium text-green-700">First 90 days at 0% commission</p>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="rounded-lg bg-brand-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand-900">Import Your Venue</h1>
          <p className="mt-1 text-sm text-gray-500">
            Import your existing venue data from another platform in under 2 minutes.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Step 1: Select Platform */}
        {importStep === "select-platform" && (
          <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700">Select your current booking platform</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {platforms
                .filter((p) => p.importSupported)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPlatform(p.id);
                      setImportStep("search");
                      searchPlatform(p.id);
                    }}
                    className="flex items-center gap-3 rounded-lg border-2 border-gray-200 p-4 text-left transition hover:border-brand-500 hover:bg-brand-50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700 font-bold text-sm">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">Import courts & pricing</p>
                    </div>
                  </button>
                ))}
            </div>
            {platforms.some((p) => !p.importSupported) && (
              <div className="mt-4 border-t pt-4">
                <p className="text-xs text-gray-400 mb-2">Coming soon:</p>
                <div className="flex flex-wrap gap-2">
                  {platforms
                    .filter((p) => !p.importSupported)
                    .map((p) => (
                      <span key={p.id} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">
                        {p.name}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Search & Select Venue */}
        {importStep === "search" && (
          <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                Select your venue on {platforms.find((p) => p.id === selectedPlatform)?.name}
              </h3>
              <button
                onClick={() => { setImportStep("select-platform"); setSearchResults([]); }}
                className="text-xs text-brand-600 hover:text-brand-700"
              >
                Change platform
              </button>
            </div>

            {searching ? (
              <div className="py-8 text-center text-sm text-gray-400">Searching venues...</div>
            ) : searchResults.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No venues found in Bangkok area.</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.map((venue) => (
                  <button
                    key={venue.sourceId}
                    onClick={() => {
                      setSelectedVenue(venue);
                      setImportStep("preview");
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition hover:border-brand-500 hover:bg-brand-50"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{venue.name}</p>
                      <p className="text-xs text-gray-500">{venue.address}</p>
                    </div>
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Preview & Confirm */}
        {importStep === "preview" && selectedVenue && (
          <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Confirm Import</h3>
              <button
                onClick={() => setImportStep("search")}
                className="text-xs text-brand-600 hover:text-brand-700"
              >
                Back
              </button>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900">{selectedVenue.name}</p>
              <p className="text-xs text-gray-500">{selectedVenue.address}</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Admin Email *</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="venue@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone (optional)</label>
              <input
                type="tel"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="+66 XX XXX XXXX"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-xs font-medium text-green-700">Launch Promotion</p>
              <p className="mt-1 text-xs text-green-600">
                First 90 days at <strong>0% commission</strong>. After that, just 10% on bookings through CourtIQ.
              </p>
            </div>

            <button
              onClick={handleImport}
              disabled={!adminEmail || importing}
              className="w-full rounded-lg bg-brand-600 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {importing ? "Importing..." : `Import ${selectedVenue.name}`}
            </button>
          </div>
        )}

        {/* Back to method selection */}
        {importStep === "select-platform" && (
          <div className="mt-6 text-center">
            <button
              onClick={onDone}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Enter details manually instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [method, setMethod] = useState<OnboardingMethod>("choose");
  const [step, setStep] = useState<OnboardingStep>("business");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Business details
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Bangkok");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);

  // Courts
  const [courts, setCourts] = useState<CourtEntry[]>([
    { name: "Court 1", surface: "glass", indoor: false },
  ]);

  // Hours
  const [hours, setHours] = useState<HoursEntry[]>(DEFAULT_HOURS);

  // Pricing
  const [defaultPriceCents, setDefaultPriceCents] = useState(80000); // 800 THB
  const [peakPriceCents, setPeakPriceCents] = useState(120000); // 1200 THB
  const [peakHoursStart, setPeakHoursStart] = useState("17:00");
  const [peakHoursEnd, setPeakHoursEnd] = useState("21:00");
  const [currency] = useState("THB");

  // Verification
  const [verificationPhotos, setVerificationPhotos] = useState<File[]>([]);
  const [addressConfirmed, setAddressConfirmed] = useState(false);

  const STEPS: OnboardingStep[] = ["business", "courts", "hours", "pricing", "stripe", "verify", "done"];

  function toggleAmenity(a: string) {
    setAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );
  }

  function addCourt() {
    setCourts((prev) => [
      ...prev,
      { name: `Court ${prev.length + 1}`, surface: "glass", indoor: false },
    ]);
  }

  function removeCourt(idx: number) {
    setCourts((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCourt(idx: number, field: keyof CourtEntry, value: string | boolean) {
    setCourts((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    );
  }

  function updateHours(idx: number, field: keyof HoursEntry, value: string | boolean) {
    setHours((prev) =>
      prev.map((h, i) => (i === idx ? { ...h, [field]: value } : h)),
    );
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setVerificationPhotos(Array.from(e.target.files).slice(0, 5));
    }
  }

  async function handleSubmitOnboarding() {
    setSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem("venue_token");
      const res = await fetch("/api/v1/venue-onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          business: { name: venueName, address, city, phone, email, description, amenities },
          courts,
          hours: hours.filter((h) => !h.closed),
          pricing: { defaultPriceCents, peakPriceCents, peakHoursStart, peakHoursEnd, currency },
          addressConfirmed,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Submission failed");
      }
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function nextStep() {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }

  function prevStep() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  // Validation per step
  function canProceed(): boolean {
    switch (step) {
      case "business":
        return venueName.trim().length > 0 && address.trim().length > 0 && email.trim().length > 0;
      case "courts":
        return courts.length > 0 && courts.every((c) => c.name.trim().length > 0);
      case "hours":
        return hours.some((h) => !h.closed);
      case "pricing":
        return defaultPriceCents > 0;
      case "stripe":
        return true; // Stripe Connect is optional at onboarding
      case "verify":
        return addressConfirmed;
      default:
        return true;
    }
  }

  // Method chooser: Import vs Manual
  if (method === "choose") {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-lg space-y-8 text-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-900">List Your Venue on CourtIQ</h1>
            <p className="mt-2 text-sm text-gray-500">
              Reach thousands of padel players in Bangkok. Get listed in under 10 minutes.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setMethod("import")}
              className="flex w-full items-center gap-4 rounded-xl border-2 border-brand-200 bg-brand-50 p-5 text-left transition hover:border-brand-500"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Import from Existing Platform</p>
                <p className="text-xs text-gray-500">
                  Already on Playtomic, MATCHi, or Reclub? Import your courts and pricing in 2 minutes.
                </p>
              </div>
              <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Fastest
              </span>
            </button>

            <button
              onClick={() => setMethod("manual")}
              className="flex w-full items-center gap-4 rounded-xl border-2 border-gray-200 p-5 text-left transition hover:border-gray-400"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200 text-gray-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Enter Details Manually</p>
                <p className="text-xs text-gray-500">
                  New venue or not on any platform yet? Enter your details step by step.
                </p>
              </div>
            </button>
          </div>

          <div className="rounded-lg bg-green-50 p-4">
            <p className="text-xs font-medium text-green-700">Launch Promotion</p>
            <p className="mt-1 text-xs text-green-600">
              First 90 days at <strong>0% commission</strong>. All features free for players.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (method === "import") {
    return <PlatformImportFlow onDone={() => setMethod("manual")} />;
  }

  if (step === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">You're All Set!</h2>
          <p className="text-sm text-gray-500">
            <strong>{venueName}</strong> is now being reviewed. You'll receive a confirmation
            email at <strong>{email}</strong> once your venue is live on CourtIQ.
          </p>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase">What's Next</p>
            <ul className="mt-3 space-y-2 text-left text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-green-500">1.</span>
                Our team reviews your venue details (usually within 24 hours)
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-green-500">2.</span>
                Connect Stripe to start receiving payments
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-green-500">3.</span>
                Your courts appear on CourtIQ for players to book
              </li>
            </ul>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="rounded-lg bg-brand-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand-900">List Your Venue on CourtIQ</h1>
          <p className="mt-1 text-sm text-gray-500">
            Get listed in under 10 minutes. Reach thousands of padel players in Bangkok.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <StepIndicator current={step} steps={STEPS.filter((s) => s !== "done")} />
          <p className="mt-3 text-center text-xs text-gray-500 capitalize">
            {step === "business" && "Business Details"}
            {step === "courts" && "Court Inventory"}
            {step === "hours" && "Operating Hours"}
            {step === "pricing" && "Pricing"}
            {step === "stripe" && "Payments Setup"}
            {step === "verify" && "Verification"}
          </p>
        </div>

        {/* Step: Business Details */}
        {step === "business" && (
          <div className="space-y-6 rounded-xl bg-white p-6 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Venue Name *</label>
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="e.g. Bangkok Padel Club"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Address *</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Sukhumvit Rd, Bangkok 10110"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+66 XX XXX XXXX"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="venue@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Tell players about your venue..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Amenities</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_AMENITIES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAmenity(a)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      amenities.includes(a)
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-gray-300 text-gray-500 hover:border-gray-400"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step: Courts */}
        {step === "courts" && (
          <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Your Courts</h3>
              <button
                type="button"
                onClick={addCourt}
                className="rounded-lg border border-brand-500 px-3 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
              >
                + Add Court
              </button>
            </div>

            {courts.map((court, idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={court.name}
                    onChange={(e) => updateCourt(idx, "name", e.target.value)}
                    className="text-sm font-medium text-gray-900 border-0 bg-transparent p-0 focus:outline-none focus:ring-0"
                    placeholder="Court name"
                  />
                  {courts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCourt(idx)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-xs text-gray-500">Surface Type</p>
                  <div className="flex flex-wrap gap-2">
                    {SURFACES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => updateCourt(idx, "surface", s.value)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          court.surface === s.value
                            ? s.color
                            : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={court.indoor}
                    onChange={(e) => updateCourt(idx, "indoor", e.target.checked)}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-xs text-gray-600">Indoor court</span>
                </label>
              </div>
            ))}

            <p className="text-xs text-gray-400">
              You can add more courts and edit details later from your dashboard.
            </p>
          </div>
        )}

        {/* Step: Operating Hours */}
        {step === "hours" && (
          <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700">Operating Hours</h3>
            <p className="text-xs text-gray-400">Set your opening and closing times for each day.</p>

            <div className="space-y-2">
              {hours.map((h, idx) => (
                <div key={h.day} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
                  <label className="flex items-center gap-2 w-28">
                    <input
                      type="checkbox"
                      checked={!h.closed}
                      onChange={(e) => updateHours(idx, "closed", !e.target.checked)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className={`text-sm ${h.closed ? "text-gray-400 line-through" : "text-gray-700"}`}>
                      {h.day.slice(0, 3)}
                    </span>
                  </label>

                  {!h.closed ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={h.open}
                        onChange={(e) => updateHours(idx, "open", e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
                      />
                      <span className="text-xs text-gray-400">to</span>
                      <input
                        type="time"
                        value={h.close}
                        onChange={(e) => updateHours(idx, "close", e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Closed</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Pricing */}
        {step === "pricing" && (
          <div className="space-y-6 rounded-xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700">Court Pricing</h3>
            <p className="text-xs text-gray-400">
              Set your default hourly rate. You can customize per-court and per-slot pricing later.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Standard Rate (per hour)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-gray-400">{currency === "THB" ? "\u0E3F" : "$"}</span>
                  <input
                    type="number"
                    value={defaultPriceCents / 100}
                    onChange={(e) => setDefaultPriceCents(Math.round(Number(e.target.value) * 100))}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Peak Rate (per hour)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-gray-400">{currency === "THB" ? "\u0E3F" : "$"}</span>
                  <input
                    type="number"
                    value={peakPriceCents / 100}
                    onChange={(e) => setPeakPriceCents(Math.round(Number(e.target.value) * 100))}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Peak Hours</label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={peakHoursStart}
                  onChange={(e) => setPeakHoursStart(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                />
                <span className="text-sm text-gray-400">to</span>
                <input
                  type="time"
                  value={peakHoursEnd}
                  onChange={(e) => setPeakHoursEnd(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-lg bg-brand-50 p-4">
              <p className="text-xs font-medium text-brand-700">Commission Info</p>
              <p className="mt-1 text-xs text-brand-600">
                CourtIQ charges a <strong>10% commission</strong> on bookings made through the platform.
                You keep 90% of every booking. Payouts are processed weekly to your connected Stripe account.
              </p>
            </div>
          </div>
        )}

        {/* Step: Stripe Connect */}
        {step === "stripe" && (
          <div className="space-y-6 rounded-xl bg-white p-6 shadow-sm">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Connect Your Stripe Account</h3>
              <p className="mt-1 text-sm text-gray-500">
                Link your Stripe account to receive payouts from CourtIQ bookings.
              </p>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem("venue_token");
                    const res = await fetch("/api/v1/stripe/connect/onboard", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify({ returnUrl: `${window.location.origin}/stripe/return` }),
                    });
                    const data = await res.json();
                    if (data.url) {
                      window.location.href = data.url;
                    }
                  } catch {
                    setError("Failed to start Stripe onboarding. Please try again.");
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-3 text-sm font-medium text-white hover:bg-purple-700"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
                </svg>
                Connect with Stripe
              </button>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 space-y-2">
              <p className="text-xs font-medium text-gray-600">How payments work</p>
              <ul className="space-y-1.5 text-xs text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-brand-500 font-bold">1</span>
                  Players book and pay through CourtIQ
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-brand-500 font-bold">2</span>
                  CourtIQ holds payment until booking is confirmed
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-brand-500 font-bold">3</span>
                  You receive 90% of the booking amount weekly via Stripe
                </li>
              </ul>
            </div>

            <p className="text-center text-xs text-gray-400">
              You can skip this step and connect Stripe later from your dashboard.
            </p>
          </div>
        )}

        {/* Step: Verification */}
        {step === "verify" && (
          <div className="space-y-6 rounded-xl bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Venue Verification</h3>
              <p className="mt-1 text-xs text-gray-400">
                Verified venues get a badge and rank higher in search results.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Upload Venue Photos (up to 5)
              </label>
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-6">
                <div className="text-center">
                  <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <label className="mt-2 block cursor-pointer text-sm font-medium text-brand-600 hover:text-brand-700">
                    Choose files
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="mt-1 text-xs text-gray-400">JPG, PNG up to 10MB each</p>
                </div>
              </div>
              {verificationPhotos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {verificationPhotos.map((f, i) => (
                    <span key={i} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                      {f.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
              <input
                type="checkbox"
                checked={addressConfirmed}
                onChange={(e) => setAddressConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">Confirm venue address</p>
                <p className="text-xs text-gray-500">
                  I confirm that <strong>{address || "the address provided"}</strong> is the correct
                  physical location of this venue and that I am authorized to list it on CourtIQ.
                </p>
              </div>
            </label>

            <div className="rounded-lg bg-green-50 p-4">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p className="text-xs font-medium text-green-700">Verification Badge</p>
              </div>
              <p className="mt-1 text-xs text-green-600">
                Verified venues see 40% more bookings on average. Verification typically takes 24-48 hours.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={prevStep}
              disabled={step === "business"}
              className="rounded-lg border px-5 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:invisible"
            >
              Back
            </button>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {step === "verify" ? (
              <button
                type="button"
                onClick={handleSubmitOnboarding}
                disabled={!canProceed() || submitting}
                className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit & Get Listed"}
              </button>
            ) : (
              <button
                type="button"
                onClick={nextStep}
                disabled={!canProceed()}
                className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Continue
              </button>
            )}
          </div>
      </div>
    </div>
  );
}
