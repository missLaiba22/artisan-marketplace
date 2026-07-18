import axios from "axios";

// Single shared axios instance. Every request goes through here so token
// attachment and 401 handling live in one place, not scattered across pages.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Attach the JWT on every outgoing request, if we have one.
// Reading localStorage per-request (not caching in a variable) means a
// login/logout in another tab is picked up immediately, not stale.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 means the token is invalid/expired. Clear it and bounce to login
// rather than letting the app sit in a broken "logged in but every call fails" state.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      // Full reload (not client-side navigate) to guarantee all in-memory
      // auth state resets — simplest correct thing for a token expiry.
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default client;
