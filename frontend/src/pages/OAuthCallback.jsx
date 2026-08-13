import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function OAuthCallback() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    // window.location.hash is "#access_token=xyz" (leading # included).
    // URLSearchParams can parse it directly once we strip that leading
    // character — it doesn't understand the # itself as a delimiter.
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("access_token");

    if (!token) {
      setError("Google sign-in didn't return a token. Please try again.");
      return;
    }

    loginWithToken(token)
      .then((user) => {
        const redirectTo =
          user.role === "artisan" ? "/dashboard" : user.role === "admin" ? "/admin" : "/";
        navigate(redirectTo, { replace: true });
      })
      .catch(() => {
        setError("Couldn't complete sign-in. Please try again.");
      });
    // Intentionally runs once on mount — the token is only ever present in
    // the URL on this first render; there's nothing to re-run on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="max-w-sm mx-auto px-6 py-16 text-center">
        <p className="text-clay text-sm mb-4">{error}</p>
        <button
          onClick={() => navigate("/login", { replace: true })}
          className="text-brass font-medium hover:underline"
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-16 text-center">
      <p className="font-mono text-sm text-ink-soft">Signing you in…</p>
    </div>
  );
}