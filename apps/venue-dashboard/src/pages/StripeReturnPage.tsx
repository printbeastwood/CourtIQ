import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useStripeAccountStatus } from "../api/hooks";

type ReturnState = "loading" | "success" | "incomplete" | "error";

export function StripeReturnPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: stripeStatus, refetch } = useStripeAccountStatus(user?.venueId);
  const [state, setState] = useState<ReturnState>("loading");

  const isRefresh = searchParams.get("refresh") === "true";

  useEffect(() => {
    if (!stripeStatus) return;

    if (isRefresh) {
      // User was sent back to re-complete onboarding
      setState("incomplete");
      return;
    }

    if (stripeStatus.connected && stripeStatus.detailsSubmitted) {
      if (stripeStatus.chargesEnabled && stripeStatus.payoutsEnabled) {
        setState("success");
      } else {
        // Account created but still pending Stripe verification
        setState("incomplete");
      }
    } else if (stripeStatus.connected && !stripeStatus.detailsSubmitted) {
      setState("incomplete");
    } else {
      setState("error");
    }
  }, [stripeStatus, isRefresh]);

  // Re-poll status once on mount (Stripe may take a moment to propagate)
  useEffect(() => {
    const timer = setTimeout(() => refetch(), 2000);
    return () => clearTimeout(timer);
  }, [refetch]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {state === "loading" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-8 w-8 animate-spin text-brand-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Verifying your Stripe account...</h2>
            <p className="text-sm text-gray-500">This should only take a moment.</p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Stripe Connected!</h2>
            <p className="text-sm text-gray-500">
              Your account is fully set up. You can now receive payouts from CourtIQ bookings.
            </p>

            <div className="rounded-xl bg-white p-5 shadow-sm text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Charges</span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Payouts</span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Enabled</span>
              </div>
              {stripeStatus?.dashboardUrl && (
                <a
                  href={stripeStatus.dashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-purple-600 hover:text-purple-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Stripe Dashboard
                </a>
              )}
            </div>

            <button
              onClick={() => navigate("/payouts")}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Go to Payouts
            </button>
          </>
        )}

        {state === "incomplete" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Almost There</h2>
            <p className="text-sm text-gray-500">
              Your Stripe account setup is incomplete. Please complete the remaining steps to start receiving payouts.
            </p>

            {stripeStatus?.requirements && stripeStatus.requirements.length > 0 && (
              <div className="rounded-xl bg-white p-5 shadow-sm text-left">
                <p className="mb-3 text-xs font-semibold text-gray-700">Remaining requirements:</p>
                <ul className="space-y-2">
                  {stripeStatus.requirements.map((req) => (
                    <li key={req} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="mt-0.5 text-yellow-500">*</span>
                      {req.replace(/_/g, " ").replace(/\./g, " > ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => navigate("/payouts")}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Complete Later
              </button>
              <button
                onClick={() => navigate("/payouts")}
                className="flex-1 rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
              >
                Continue Setup
              </button>
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Connection Failed</h2>
            <p className="text-sm text-gray-500">
              We couldn't connect your Stripe account. This may be a temporary issue — please try again.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => navigate("/payouts")}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Go to Payouts
              </button>
              <button
                onClick={() => navigate("/payouts")}
                className="flex-1 rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
              >
                Try Again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
