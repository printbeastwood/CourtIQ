import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useVenueBookings } from "../api/hooks";

type BookingFilter = "all" | "upcoming" | "past" | "cancelled";

export function BookingsPage() {
  const { user } = useAuth();
  const { data, isLoading } = useVenueBookings(user?.venueId);
  const [filter, setFilter] = useState<BookingFilter>("upcoming");

  const bookings = data?.bookings ?? [];

  const now = new Date();
  const filtered = bookings.filter((b) => {
    if (filter === "all") return true;
    if (filter === "cancelled") return b.status === "cancelled";
    if (filter === "upcoming") return new Date(b.startsAt) > now && b.status !== "cancelled";
    if (filter === "past") return new Date(b.startsAt) <= now && b.status !== "cancelled";
    return true;
  });

  const statusColors: Record<string, string> = {
    confirmed: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Bookings</h2>
          <p className="text-sm text-gray-500">
            {filtered.length} booking{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {(["upcoming", "past", "all", "cancelled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                filter === f
                  ? "bg-brand-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Today</p>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {bookings.filter(
              (b) =>
                new Date(b.startsAt).toDateString() === now.toDateString() &&
                b.status !== "cancelled",
            ).length}
          </p>
          <p className="text-xs text-gray-400">bookings</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">This Week</p>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {bookings.filter((b) => {
              const d = new Date(b.startsAt);
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              return d >= weekAgo && d <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) && b.status !== "cancelled";
            }).length}
          </p>
          <p className="text-xs text-gray-400">bookings</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Revenue This Week</p>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {"\u0E3F"}
            {bookings
              .filter((b) => {
                const d = new Date(b.startsAt);
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return d >= weekAgo && b.status === "confirmed";
              })
              .reduce((sum, b) => sum + (b.priceCents ?? 0), 0) / 100}
          </p>
          <p className="text-xs text-gray-400">before commission</p>
        </div>
      </div>

      {/* Booking list */}
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading bookings...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white py-12 text-center shadow-sm">
          <p className="text-gray-400">No {filter === "all" ? "" : filter} bookings</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((booking) => {
            const start = new Date(booking.startsAt);
            const end = new Date(booking.endsAt);
            return (
              <div
                key={booking.id}
                className="flex items-center justify-between rounded-lg border bg-white px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-xs font-medium text-gray-500">
                      {start.toLocaleDateString("en-GB", { weekday: "short" })}
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {start.getDate()}
                    </p>
                    <p className="text-xs text-gray-400">
                      {start.toLocaleDateString("en-GB", { month: "short" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {start.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {end.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {booking.courtName ?? "Court"} | {booking.playerName ?? "Player"}
                    </p>
                    {booking.bookingMethod && (
                      <span className="text-xs text-gray-400">via {booking.bookingMethod}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {booking.priceCents != null
                      ? `\u0E3F${(booking.priceCents / 100).toFixed(0)}`
                      : "\u2014"}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      statusColors[booking.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
