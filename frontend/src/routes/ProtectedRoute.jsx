import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";

// Wraps a route element. If `roles` is given, the user's role must be in
// that list, mirroring the backend's require_role() — this is a UX
// convenience only, the real enforcement is server-side.
export default function ProtectedRoute({ children, roles }) {
  const { user, loading, needsArtisanOnboarding } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] font-mono text-sm text-ink-soft">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Onboarding gate: an artisan who authenticated but never created a shop
  // profile is forced back to finish it before any protected route. The
  // pathname guard avoids a redirect loop if this route is ever wrapped too.
  if (
    user.role === "artisan" &&
    needsArtisanOnboarding &&
    location.pathname !== "/complete-artisan-profile"
  ) {
    return <Navigate to="/complete-artisan-profile" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}