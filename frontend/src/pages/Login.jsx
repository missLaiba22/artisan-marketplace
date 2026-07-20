import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(form);
      const redirectTo =
        location.state?.from ??
        (user.role === "artisan" ? "/dashboard" : user.role === "admin" ? "/admin" : "/");
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail ?? "Couldn't log in. Check your email and password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-16">
      <h1 className="font-display text-3xl mb-1">Welcome back</h1>
      <p className="text-ink-soft text-sm mb-8">Log in to your account.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1.5">
            Email
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-ink/25 rounded px-3 py-2 bg-white/40 focus:border-brass outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1.5">
            Password
          </label>
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full border border-ink/25 rounded px-3 py-2 bg-white/40 focus:border-brass outline-none"
          />
        </div>

        {error && (
          <p className="text-clay text-sm" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-ink text-parchment rounded py-2.5 font-medium hover:bg-ink-soft transition-colors disabled:opacity-50"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="text-sm text-ink-soft mt-6">
        Don't have an account?{" "}
        <Link to="/register" className="text-brass font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}