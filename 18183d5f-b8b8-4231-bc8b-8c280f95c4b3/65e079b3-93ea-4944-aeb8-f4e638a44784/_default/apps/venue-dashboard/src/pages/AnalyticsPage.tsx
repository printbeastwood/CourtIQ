import { useAuth } from "../auth/AuthProvider";
import { useVenueAnalytics } from "../api/hooks";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export function AnalyticsPage() {
  const { user } = useAuth();
  const { data, isLoading } = useVenueAnalytics(user?.venueId);

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading analytics...</div>;
  }

  const stats = data ?? {
    totalBookings: 0,
    revenue: 0,
    popularSlots: [],
    weeklyBookings: [],
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Booking Analytics</h2>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Bookings"
          value={stats.totalBookings.toLocaleString()}
          sub="via CourtIQ"
        />
        <StatCard
          label="Revenue"
          value={`฿${(stats.revenue / 100).toLocaleString()}`}
          sub="referral commissions"
        />
        <StatCard
          label="Top Hour"
          value={
            stats.popularSlots.length > 0
              ? `${stats.popularSlots[0].hour}:00`
              : "—"
          }
          sub="most booked time"
        />
        <StatCard
          label="This Week"
          value={
            stats.weeklyBookings.length > 0
              ? stats.weeklyBookings[stats.weeklyBookings.length - 1].count.toString()
              : "0"
          }
          sub="bookings"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Popular time slots */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Popular Time Slots
          </h3>
          {stats.popularSlots.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.popularSlots}>
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h: number) => `${h}:00`}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  labelFormatter={(h: number) => `${h}:00`}
                  formatter={(v: number) => [v, "Bookings"]}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-gray-400">
              No booking data yet
            </p>
          )}
        </div>

        {/* Weekly trend */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Weekly Booking Trend
          </h3>
          {stats.weeklyBookings.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={stats.weeklyBookings}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-gray-400">
              No weekly data yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
