import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { usePromotions, useCreatePromotion, type Promotion } from "../api/hooks";

function PromotionCard({ promo }: { promo: Promotion }) {
  const start = new Date(promo.startsAt);
  const end = new Date(promo.endsAt);
  const isActive = promo.active && end > new Date();

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{promo.title}</h3>
          <p className="mt-1 text-2xl font-bold text-brand-600">
            {promo.discountPercent}% off
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isActive
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {isActive ? "Active" : "Expired"}
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {start.toLocaleDateString("en-GB")} –{" "}
        {end.toLocaleDateString("en-GB")}
      </p>
    </div>
  );
}

export function PromotionsPage() {
  const { user } = useAuth();
  const { data, isLoading } = usePromotions(user?.venueId);
  const createPromo = useCreatePromotion(user?.venueId ?? "");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [discount, setDiscount] = useState("10");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const promotions = data?.promotions ?? [];

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    await createPromo.mutateAsync({
      title,
      discountPercent: parseInt(discount, 10),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      active: true,
    });
    setShowForm(false);
    setTitle("");
    setDiscount("10");
    setStartsAt("");
    setEndsAt("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Promotions</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showForm ? "Cancel" : "+ New Promotion"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-xl bg-white p-6 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Promotion Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekend Special"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Discount %
              </label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                End Date
              </label>
              <input
                type="date"
                required
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {createPromo.isError && (
            <p className="text-sm text-red-600">
              Failed to create promotion. Please try again.
            </p>
          )}

          <button
            type="submit"
            disabled={createPromo.isPending}
            className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {createPromo.isPending ? "Creating..." : "Create Promotion"}
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading promotions...</p>
      ) : promotions.length === 0 ? (
        <div className="rounded-xl bg-white py-12 text-center shadow-sm">
          <p className="text-gray-400">No promotions yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Create your first promotion to attract more bookings
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {promotions.map((p) => (
            <PromotionCard key={p.id} promo={p} />
          ))}
        </div>
      )}
    </div>
  );
}
