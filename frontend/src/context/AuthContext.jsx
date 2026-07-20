import { createContext, useEffect, useState } from "react";
import * as authApi from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
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
      .then(setUser)
      // If the stored token is stale/invalid, getMe() 401s, our axios
      // interceptor clears it — we just need to fall through with no user.
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(credentials) {
    const { access_token } = await authApi.login(credentials);
    localStorage.setItem("access_token", access_token);
    const me = await authApi.getMe();
    setUser(me);
    return me;
  }

  async function register(data) {
    // Registration doesn't log the user in automatically on the backend —
    // it just creates the account. Caller decides whether to redirect to login.
    return authApi.register(data);
  }

  function logout() {
    localStorage.removeItem("access_token");
    setUser(null);
  }

  const value = { user, loading, login, register, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
