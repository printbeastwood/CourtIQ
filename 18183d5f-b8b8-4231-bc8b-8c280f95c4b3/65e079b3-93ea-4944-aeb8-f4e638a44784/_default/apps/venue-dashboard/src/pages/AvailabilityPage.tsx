import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useVenueSlots, useVenue } from "../api/hooks";
import type { Slot, SurfaceType } from "../types";

const SURFACE_COLORS: Record<SurfaceType, string> = {
  glass: "bg-blue-100 text-blue-700",
  panoramic: "bg-emerald-100 text-emerald-700",
  concrete: "bg-gray-100 text-gray-700",
  turf: "bg-green-100 text-green-700",
};

function SlotCard({ slot }: { slot: Slot }) {
  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);
  const surface = slot.court?.surface as SurfaceType | undefined;

  return (
    <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {start.toLocaleDateString("en-GB", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="text-xs text-gray-500">
            {start.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            –{" "}
            {end.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        {slot.court && (
          <span className="text-xs text-gray-500">{slot.court.name}</span>
        )}
        {surface && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${SURFACE_COLORS[surface]}`}
          >
            {surface}
          </span>
        )}
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-gray-900">
          {slot.priceCents != null
            ? `฿${(slot.priceCents / 100).toFixed(0)}`
            : "—"}
        </p>
        <span
          className={`text-xs font-medium ${
            slot.status === "available"
              ? "text-green-600"
              : slot.status === "booked"
                ? "text-red-500"
                : "text-yellow-600"
          }`}
        >
          {slot.status}
        </span>
      </div>
    </div>
  );
}

export function AvailabilityPage() {
  const { user } = useAuth();
  const { data: venueData } = useVenue(user?.venueId);
  const { data: slotsData, isLoading } = useVenueSlots(user?.venueId);
  const [filter, setFilter] = useState<"all" | "available" | "booked">("all");

  const courts = venueData?.courts ?? [];
  const slots = slotsData?.slots ?? [];

  const filtered =
    filter === "all" ? slots : slots.filter((s) => s.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          Court Availability
        </h2>
        <div className="flex gap-2">
          {(["all", "available", "booked"] as const).map((f) => (
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

      {/* Courts summary */}
      {courts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courts.map((c) => (
            <div
              key={c.id}
              className="rounded-xl bg-white p-4 shadow-sm"
            >
              <p className="text-sm font-semibold text-gray-900">{c.name}</p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    SURFACE_COLORS[c.surface as SurfaceType] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {c.surface}
                </span>
                <span className="text-xs text-gray-500">
                  {c.indoor ? "Indoor" : "Outdoor"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slots list */}
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading slots...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white py-12 text-center shadow-sm">
          <p className="text-gray-400">No slots found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((slot) => (
            <SlotCard key={slot.id} slot={slot} />
          ))}
        </div>
      )}
    </div>
  );
}
