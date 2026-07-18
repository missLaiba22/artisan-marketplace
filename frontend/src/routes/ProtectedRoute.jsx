import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Wraps a route element. If `roles` is given, the user's role must be in
// that list, mirroring the backend's require_role() — this is a UX
// convenience only, the real enforcement is server-side.
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

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

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
