import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

const NAV_ITEMS = [
  { to: "/", label: "Analytics", icon: "📊" },
  { to: "/bookings", label: "Bookings", icon: "📋" },
  { to: "/availability", label: "Availability", icon: "📅" },
  { to: "/listing", label: "Listing", icon: "✏️" },
  { to: "/payouts", label: "Payouts", icon: "💰" },
  { to: "/promotions", label: "Promotions", icon: "🏷️" },
  { to: "/profile", label: "Venue Profile", icon: "🏢" },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-brand-900 text-white transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 px-6 text-lg font-bold">
          <span>🎾</span>
          <span>CourtIQ Venue</span>
        </div>

        <nav className="mt-4 space-y-1 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full border-t border-white/10 p-4">
          <p className="truncate text-sm text-white/60">
            {user?.venueName ?? "Venue"}
          </p>
          <button
            onClick={logout}
            className="mt-2 text-sm text-white/50 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-white px-4 lg:px-8">
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-800">
            {user?.venueName ?? "Venue Dashboard"}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
