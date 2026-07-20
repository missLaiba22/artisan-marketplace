import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="bg-maroon sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link
          to="/"
          className="font-display text-2xl tracking-tight text-white"
        >
          Karigar
        </Link>

        <nav className="flex items-center gap-8 text-xs font-mono uppercase tracking-wide text-white/85">
          <Link to="/shop" className="hover:text-brass-soft transition-colors">
            Shop
          </Link>

          {user?.role === "artisan" && (
            <Link to="/dashboard" className="hover:text-brass-soft transition-colors">
              My Shop
            </Link>
          )}

          {user?.role === "customer" && (
            <>
              <Link to="/orders" className="hover:text-brass-soft transition-colors">
                Orders
              </Link>
              <Link to="/cart" className="hover:text-brass-soft transition-colors">
                Cart
              </Link>
            </>
          )}

          {user?.role === "admin" && (
            <Link to="/admin" className="hover:text-brass-soft transition-colors">
              Admin
            </Link>
          )}

          {user ? (
            <button
              onClick={handleLogout}
              className="border border-white/40 rounded px-4 py-2 hover:border-white active:bg-crimson active:border-crimson transition-colors normal-case font-body text-sm text-white"
            >
              Log out
            </button>
          ) : (
            <>
              <Link to="/login" className="hover:text-brass-soft active:text-crimson transition-colors">
                Log in
              </Link>
              <Link
                to="/register"
                className="border border-white rounded px-4 py-2 hover:bg-white hover:text-maroon active:bg-crimson active:text-white active:border-crimson transition-colors"
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