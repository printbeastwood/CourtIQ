import { useState, type FormEvent } from "react";
import { useClaimVenue } from "../api/hooks";

export function ClaimPage() {
  const [step, setStep] = useState<"search" | "verify" | "done">("search");
  const [search, setSearch] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [selectedVenueName, setSelectedVenueName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; address: string | null }[]>([]);
  const [searching, setSearching] = useState(false);

  const claim = useClaimVenue();

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    try {
      const res = await fetch(`/api/v1/venues?search=${encodeURIComponent(search)}&limit=10`);
      const data = await res.json();
      setResults(data.venues ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function selectVenue(id: string, name: string) {
    setSelectedVenueId(id);
    setSelectedVenueName(name);
    setStep("verify");
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    try {
      await claim.mutateAsync({ venueId: selectedVenueId, verificationCode });
      setStep("done");
    } catch {
      // error handled by mutation state
    }
  }

  if (step === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm space-y-4 text-center">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl font-bold text-gray-900">Venue Claimed!</h2>
          <p className="text-sm text-gray-500">
            Your claim for <strong>{selectedVenueName}</strong> is being reviewed.
            You'll receive an email once approved.
          </p>
          <a
            href="/login"
            className="inline-block rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand-900">🎾 Claim Your Venue</h1>
          <p className="mt-1 text-sm text-gray-500">
            Search for your venue and verify ownership
          </p>
        </div>

        {step === "search" && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="Search venue name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={searching || !search}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {searching ? "..." : "Search"}
              </button>
            </form>

            {results.length > 0 && (
              <ul className="mt-4 divide-y">
                {results.map((v) => (
                  <li key={v.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{v.name}</p>
                      <p className="text-xs text-gray-500">{v.address ?? "No address"}</p>
                    </div>
                    <button
                      onClick={() => selectVenue(v.id, v.name)}
                      className="rounded-lg border border-brand-500 px-3 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                    >
                      Claim
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === "verify" && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm text-gray-600">
              Claiming: <strong>{selectedVenueName}</strong>
            </p>
            <p className="mb-4 text-xs text-gray-500">
              We've sent a verification code to the venue's registered contact.
              Enter it below.
            </p>
            <form onSubmit={handleVerify} className="space-y-4">
              <input
                type="text"
                placeholder="Verification code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {claim.isError && (
                <p className="text-sm text-red-600">Verification failed. Please try again.</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep("search")}
                  className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={claim.isPending || !verificationCode}
                  className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {claim.isPending ? "Verifying..." : "Verify & Claim"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
