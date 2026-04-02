import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { DashboardLayout } from "./components/DashboardLayout";
import { LoginPage } from "./pages/LoginPage";
import { ClaimPage } from "./pages/ClaimPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AvailabilityPage } from "./pages/AvailabilityPage";
import { BookingsPage } from "./pages/BookingsPage";
import { ListingPage } from "./pages/ListingPage";
import { PayoutsPage } from "./pages/PayoutsPage";
import { StripeReturnPage } from "./pages/StripeReturnPage";
import { PromotionsPage } from "./pages/PromotionsPage";
import { ProfilePage } from "./pages/ProfilePage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/claim" element={<ClaimPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/stripe/return" element={<ProtectedRoute><StripeReturnPage /></ProtectedRoute>} />

      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AnalyticsPage />} />
        <Route path="availability" element={<AvailabilityPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="listing" element={<ListingPage />} />
        <Route path="payouts" element={<PayoutsPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
