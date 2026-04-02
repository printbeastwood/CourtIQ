import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useVenue, useUpdateVenue } from "../api/hooks";
import type { SurfaceType } from "../types";

const SURFACE_COLORS: Record<SurfaceType, string> = {
  glass: "bg-cyan-100 text-cyan-700",
  panoramic: "bg-purple-100 text-purple-700",
  concrete: "bg-gray-100 text-gray-700",
  turf: "bg-green-100 text-green-700",
};

const SURFACES: { value: SurfaceType; label: string }[] = [
  { value: "glass", label: "Glass" },
  { value: "panoramic", label: "Panoramic" },
  { value: "concrete", label: "Concrete" },
  { value: "turf", label: "Turf" },
];

interface CourtForm {
  id?: string;
  name: string;
  surface: SurfaceType;
  indoor: boolean;
}

export function ListingPage() {
  const { user } = useAuth();
  const { data, isLoading } = useVenue(user?.venueId);
  const update = useUpdateVenue(user?.venueId ?? "");

  const [editingCourt, setEditingCourt] = useState<CourtForm | null>(null);
  const [showAddCourt, setShowAddCourt] = useState(false);
  const [newCourt, setNewCourt] = useState<CourtForm>({
    name: "",
    surface: "glass",
    indoor: false,
  });

  const venue = data?.venue;
  const courts = data?.courts ?? [];

  async function handleAddCourt(e: FormEvent) {
    e.preventDefault();
    try {
      const token = localStorage.getItem("venue_token");
      await fetch(`/api/v1/venues/${user?.venueId}/courts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newCourt),
      });
      setNewCourt({ name: "", surface: "glass", indoor: false });
      setShowAddCourt(false);
      // Refresh venue data
      window.location.reload();
    } catch {
      // handled by UI
    }
  }

  async function handleUpdateCourt(court: CourtForm) {
    if (!court.id) return;
    try {
      const token = localStorage.getItem("venue_token");
      await fetch(`/api/v1/venues/${user?.venueId}/courts/${court.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: court.name,
          surface: court.surface,
          indoor: court.indoor,
        }),
      });
      setEditingCourt(null);
      window.location.reload();
    } catch {
      // handled by UI
    }
  }

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading listing...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Listing Management</h2>
          <p className="text-sm text-gray-500">Manage how your venue appears to players</p>
        </div>
        <div className="flex items-center gap-2">
          {venue && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                (venue.metadata as Record<string, unknown>)?.verified
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {(venue.metadata as Record<string, unknown>)?.verified ? "Verified" : "Pending Verification"}
            </span>
          )}
        </div>
      </div>

      {/* Venue Preview Card */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Player-Facing Preview</h3>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-brand-100 text-2xl">
              {venue?.name?.charAt(0) ?? "V"}
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold text-gray-900">{venue?.name}</h4>
              <p className="text-sm text-gray-500">{venue?.address}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(venue?.amenities ?? []).slice(0, 5).map((a) => (
                  <span key={a} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {a}
                  </span>
                ))}
                {(venue?.amenities ?? []).length > 5 && (
                  <span className="text-xs text-gray-400">
                    +{(venue?.amenities ?? []).length - 5} more
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-xs text-gray-500">{courts.length} courts</span>
                <span className="text-xs text-gray-400">|</span>
                <span className="text-xs text-gray-500">
                  {courts.filter((c) => c.indoor).length} indoor
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Court Management */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Courts ({courts.length})</h3>
          <button
            type="button"
            onClick={() => setShowAddCourt(true)}
            className="rounded-lg border border-brand-500 px-3 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
          >
            + Add Court
          </button>
        </div>

        {/* Add Court Form */}
        {showAddCourt && (
          <form onSubmit={handleAddCourt} className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-4 space-y-3">
            <input
              type="text"
              value={newCourt.name}
              onChange={(e) => setNewCourt((p) => ({ ...p, name: e.target.value }))}
              placeholder="Court name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="flex flex-wrap gap-2">
              {SURFACES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setNewCourt((p) => ({ ...p, surface: s.value }))}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    newCourt.surface === s.value
                      ? SURFACE_COLORS[s.value]
                      : "bg-gray-50 text-gray-400"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newCourt.indoor}
                onChange={(e) => setNewCourt((p) => ({ ...p, indoor: e.target.checked }))}
                className="rounded border-gray-300 text-brand-600"
              />
              <span className="text-xs text-gray-600">Indoor</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddCourt(false)}
                className="rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newCourt.name.trim()}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Add Court
              </button>
            </div>
          </form>
        )}

        {/* Court List */}
        <div className="space-y-2">
          {courts.map((court) => (
            <div key={court.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
              {editingCourt?.id === court.id ? (
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={editingCourt.name}
                    onChange={(e) => setEditingCourt((p) => p ? { ...p, name: e.target.value } : null)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    {SURFACES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setEditingCourt((p) => p ? { ...p, surface: s.value } : null)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          editingCourt.surface === s.value
                            ? SURFACE_COLORS[s.value]
                            : "bg-gray-50 text-gray-400"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingCourt(null)}
                      className="rounded border px-2 py-1 text-xs text-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUpdateCourt(editingCourt)}
                      className="rounded bg-brand-600 px-2 py-1 text-xs text-white"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-gray-900">{court.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SURFACE_COLORS[court.surface as SurfaceType] ?? "bg-gray-100 text-gray-600"}`}>
                      {court.surface}
                    </span>
                    <span className="text-xs text-gray-500">
                      {court.indoor ? "Indoor" : "Outdoor"}
                    </span>
                  </div>
                  <button
                    onClick={() => setEditingCourt({
                      id: court.id,
                      name: court.name,
                      surface: court.surface as SurfaceType,
                      indoor: court.indoor,
                    })}
                    className="text-xs text-brand-600 hover:text-brand-700"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          ))}
          {courts.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">No courts added yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
