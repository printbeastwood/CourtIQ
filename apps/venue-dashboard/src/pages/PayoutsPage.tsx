import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useVenuePayouts, useStripeAccountStatus, useStripeOnboardingUrl, useStripeDisconnect } from "../api/hooks";

export function PayoutsPage() {
  const { user } = useAuth();
  const { data, isLoading } = useVenuePayouts(user?.venueId);
  const { data: stripeAccount } = useStripeAccountStatus(user?.venueId);
  const onboard = useStripeOnboardingUrl(user?.venueId ?? "");
  const disconnect = useStripeDisconnect(user?.venueId ?? "");
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const payouts = data?.payouts ?? [];
  const stripeConnected = stripeAccount?.connected ?? data?.stripeConnected ?? false;
  const pendingBalance = data?.pendingBalance ?? 0;
  const totalPaid = data?.totalPaid ?? 0;
  const commissionRate = data?.commissionRate ?? 10;

  const statusColors: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
    processing: "bg-blue-100 text-blue-700",
  };

  async function handleConnectStripe() {
    try {
      const result = await onboard.mutateAsync();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      // mutation error handled by react-query
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect.mutateAsync();
      setShowDisconnectConfirm(false);
    } catch {
      // mutation error handled by react-query
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Payouts & Commission</h2>

      {/* Stripe Not Connected */}
      {!stripeConnected && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">Stripe Not Connected</p>
              <p className="mt-1 text-xs text-yellow-700">
                Connect your Stripe account to start receiving payouts from CourtIQ bookings.
              </p>
              <button
                onClick={handleConnectStripe}
                disabled={onboard.isPending}
                className="mt-3 rounded-lg bg-purple-600 px-4 py-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {onboard.isPending ? "Redirecting..." : "Connect Stripe"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Connected but incomplete */}
      {stripeConnected && stripeAccount && !stripeAccount.chargesEnabled && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-orange-800">Stripe Setup Incomplete</p>
              <p className="mt-1 text-xs text-orange-700">
                Your Stripe account is connected but requires additional information before you can receive payments.
              </p>
              {stripeAccount.requirements.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {stripeAccount.requirements.slice(0, 3).map((req) => (
                    <li key={req} className="text-xs text-orange-600">
                      * {req.replace(/_/g, " ").replace(/\./g, " > ")}
                    </li>
                  ))}
                  {stripeAccount.requirements.length > 3 && (
                    <li className="text-xs text-orange-500">
                      +{stripeAccount.requirements.length - 3} more
                    </li>
                  )}
                </ul>
              )}
              <button
                onClick={handleConnectStripe}
                disabled={onboard.isPending}
                className="mt-3 rounded-lg bg-purple-600 px-4 py-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {onboard.isPending ? "Redirecting..." : "Complete Setup"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Connected & Fully Active */}
      {stripeConnected && stripeAccount?.chargesEnabled && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-800">Stripe Connected</p>
                <p className="mt-1 text-xs text-green-700">
                  Your account is fully set up and ready to receive payments.
                </p>
                <div className="mt-2 flex items-center gap-3">
                  {stripeAccount.dashboardUrl && (
                    <a
                      href={stripeAccount.dashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Stripe Dashboard
                    </a>
                  )}
                  <button
                    onClick={() => setShowDisconnectConfirm(true)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                {stripeAccount.chargesEnabled ? "Charges OK" : "Charges Pending"}
              </span>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                {stripeAccount.payoutsEnabled ? "Payouts OK" : "Payouts Pending"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Disconnect Stripe?</h3>
            <p className="mt-2 text-sm text-gray-500">
              This will stop all payouts from CourtIQ. You can reconnect at any time.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnect.isPending}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {disconnect.isPending ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Total Earned</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {"\u0E3F"}{(totalPaid / 100).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">after commission</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Pending</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600">
            {"\u0E3F"}{(pendingBalance / 100).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">next payout</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Commission Rate</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{commissionRate}%</p>
          <p className="text-xs text-gray-400">CourtIQ platform fee</p>
        </div>
      </div>

      {/* Commission Breakdown */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">How Payouts Work</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">1</div>
            <div>
              <p className="text-sm font-medium text-gray-900">Player books a court</p>
              <p className="text-xs text-gray-500">Payment is collected by CourtIQ via Stripe</p>
            </div>
          </div>
          <div className="ml-4 h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">2</div>
            <div>
              <p className="text-sm font-medium text-gray-900">CourtIQ deducts {commissionRate}% commission</p>
              <p className="text-xs text-gray-500">Example: {"\u0E3F"}1,000 booking = {"\u0E3F"}{1000 - (1000 * commissionRate / 100)} to you</p>
            </div>
          </div>
          <div className="ml-4 h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-600">3</div>
            <div>
              <p className="text-sm font-medium text-gray-900">Weekly payout to your Stripe account</p>
              <p className="text-xs text-gray-500">Every Monday, accumulated earnings are transferred</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payout History */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Payout History</h3>

        {isLoading ? (
          <p className="text-sm text-gray-500">Loading payouts...</p>
        ) : payouts.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400">No payouts yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Payouts will appear here once bookings are confirmed and processed.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {payouts.map((payout) => (
              <div
                key={payout.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(payout.periodStart).toLocaleDateString("en-GB", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    -{" "}
                    {new Date(payout.periodEnd).toLocaleDateString("en-GB", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {payout.bookingCount} booking{payout.bookingCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">
                    {"\u0E3F"}{(payout.amountCents / 100).toLocaleString()}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      statusColors[payout.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {payout.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
