import { createContext, useEffect, useState } from "react";
import * as authApi from "../api/auth";
import * as artisansApi from "../api/artisans";

const AuthContext = createContext(null);

// Only meaningful for role=artisan. ONLY a definite 404 means "no profile
// yet". Any other error (network, 5xx) is inconclusive, so we fail OPEN —
// a transient blip must not strand a real artisan on the onboarding screen.
// Safe because the backend's write endpoints gate on require_approved_artisan
// regardless of what we decide here.
async function resolveArtisanOnboarding(me) {
  if (!me || me.role !== "artisan") return false;
  try {
    await artisansApi.getMyArtisanProfile();
    return false; // profile exists -> onboarded
  } catch (err) {
    if (err.response?.status === 404) return true; // definitively missing
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [needsArtisanOnboarding, setNeedsArtisanOnboarding] = useState(false);
  // "loading" covers the initial "do we already have a valid token" check
  // on page load, so routes don't flash a login screen before we know.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .getMe()
      .then(async (me) => {
        setUser(me);
        setNeedsArtisanOnboarding(await resolveArtisanOnboarding(me));
      })
      // If the stored token is stale/invalid, getMe() 401s, our axios
      // interceptor clears it — we just fall through with no user.
      .catch(() => {
        setUser(null);
        setNeedsArtisanOnboarding(false);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(credentials) {
    const { access_token } = await authApi.login(credentials);
    localStorage.setItem("access_token", access_token);
    const me = await authApi.getMe();
    setUser(me);
    setNeedsArtisanOnboarding(await resolveArtisanOnboarding(me));
    return me;
  }

  // Used by the OAuth callback AND the profile-completion page: the backend
  // already issued a valid JWT (handed to us via the URL fragment); we just
  // store it and hydrate the user, then work out onboarding state.
  async function loginWithToken(token) {
    localStorage.setItem("access_token", token);
    const me = await authApi.getMe();
    setUser(me);
    setNeedsArtisanOnboarding(await resolveArtisanOnboarding(me));
    return me;
  }

  async function register(data) {
    return authApi.register(data);
  }

  // Called by the completion form once the shop profile is created, so the
  // gate stops redirecting mid-session without needing a full re-fetch.
  function markArtisanOnboarded() {
    setNeedsArtisanOnboarding(false);
  }

  function logout() {
    localStorage.removeItem("access_token");
    setUser(null);
    setNeedsArtisanOnboarding(false);
  }

  const value = {
    user,
    loading,
    needsArtisanOnboarding,
    login,
    loginWithToken,
    register,
    markArtisanOnboarded,
    logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };