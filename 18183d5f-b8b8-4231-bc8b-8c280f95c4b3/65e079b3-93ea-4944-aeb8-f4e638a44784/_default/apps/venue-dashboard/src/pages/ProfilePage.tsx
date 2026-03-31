import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useVenue, useUpdateVenue } from "../api/hooks";

const COMMON_AMENITIES = [
  "Parking",
  "Changing rooms",
  "Showers",
  "Pro shop",
  "Café",
  "Lighting",
  "Air conditioning",
  "Equipment rental",
  "Coaching",
  "Spectator area",
];

export function ProfilePage() {
  const { user } = useAuth();
  const { data, isLoading } = useVenue(user?.venueId);
  const update = useUpdateVenue(user?.venueId ?? "");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  const venue = data?.venue;

  useEffect(() => {
    if (venue) {
      setName(venue.name ?? "");
      setAddress(venue.address ?? "");
      setAmenities(venue.amenities ?? []);
    }
  }, [venue]);

  function toggleAmenity(a: string) {
    setDirty(true);
    setAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    await update.mutateAsync({ name, address, amenities });
    setDirty(false);
  }

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading venue...</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Venue Profile</h2>

      <form
        onSubmit={handleSave}
        className="space-y-6 rounded-xl bg-white p-6 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Venue Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setDirty(true);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Amenities
          </label>
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

        {/* Photos section (placeholder) */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Photos
          </label>
          <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-sm text-gray-400">
              Photo upload coming soon
            </p>
          </div>
        </div>

        {update.isError && (
          <p className="text-sm text-red-600">
            Failed to save. Please try again.
          </p>
        )}

        {update.isSuccess && !dirty && (
          <p className="text-sm text-green-600">Saved successfully!</p>
        )}

        <button
          type="submit"
          disabled={!dirty || update.isPending}
          className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {update.isPending ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
