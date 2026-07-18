import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="border-b border-ink/15 bg-parchment sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="font-display text-xl tracking-tight text-ink"
        >
          Kiln &amp; Thread
        </Link>

        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link to="/" className="hover:text-brass transition-colors">
            Shop
          </Link>

          {user?.role === "artisan" && (
            <Link to="/dashboard" className="hover:text-brass transition-colors">
              My Shop
            </Link>
          )}

          {user?.role === "customer" && (
            <Link to="/cart" className="hover:text-brass transition-colors">
              Cart
            </Link>
          )}

          {user?.role === "admin" && (
            <Link to="/admin" className="hover:text-brass transition-colors">
              Admin
            </Link>
          )}

          {user ? (
            <button
              onClick={handleLogout}
              className="font-mono text-xs uppercase tracking-wide border border-ink/30 rounded px-3 py-1.5 hover:border-brass hover:text-brass transition-colors"
            >
              Log out
            </button>
          ) : (
            <>
              <Link to="/login" className="hover:text-brass transition-colors">
                Log in
              </Link>
              <Link
                to="/register"
                className="font-mono text-xs uppercase tracking-wide bg-ink text-parchment rounded px-3 py-1.5 hover:bg-ink-soft transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}