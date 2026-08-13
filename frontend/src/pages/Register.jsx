import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

const API_URL = import.meta.env.VITE_API_URL;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "customer",
    shop_name: "",
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (payload.role !== "artisan") delete payload.shop_name;
      await register(payload);
      navigate("/login", { state: { justRegistered: true } });
    } catch (err) {
      // FastAPI validation errors come back as an array under `detail`;
      // a plain conflict (email taken) comes back as a string.
      const detail = err.response?.data?.detail;
      setError(
        Array.isArray(detail)
          ? detail.map((d) => d.msg).join(", ")
          : detail ?? "Registration failed. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-16">
      <h1 className="font-display text-3xl mb-1">Join Kiln &amp; Thread</h1>
      <p className="text-ink-soft text-sm mb-8">Create your account.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2" role="radiogroup" aria-label="Account type">
          {["customer", "artisan"].map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={form.role === r}
              onClick={() => setForm({ ...form, role: r })}
              className={`flex-1 rounded border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                form.role === r
                  ? "border-brass bg-brass-soft/30 text-ink"
                  : "border-ink/25 text-ink-soft hover:border-ink/40"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1.5">
            Name
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-ink/25 rounded px-3 py-2 bg-white/40 focus:border-brass outline-none"
          />
        </div>

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
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full border border-ink/25 rounded px-3 py-2 bg-white/40 focus:border-brass outline-none"
          />
        </div>

        {form.role === "artisan" && (
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1.5">
              Shop name
            </label>
            <input
              required
              value={form.shop_name}
              onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
              className="w-full border border-ink/25 rounded px-3 py-2 bg-white/40 focus:border-brass outline-none"
            />
            <p className="text-xs text-ink-soft mt-1.5">
              Your shop needs admin approval before you can list products.
            </p>
          </div>
        )}

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
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-ink/15" />
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">or</span>
        <div className="flex-1 h-px bg-ink/15" />
      </div>

      {/* Plain <a>, full-page navigation — same reasoning as Login.jsx.
          `intent` mirrors the role toggle above: if the person has
          "Artisan" selected when they click this, a brand-new Google
          account will be created as an artisan and sent through the
          shop-details onboarding step. It has no effect at all if their
          Google email already matches an existing account — see
          OAuthService.login_or_register for why that's intentional. */}
      <a
        href={`${API_URL}/auth/google/login?intent=${form.role === "artisan" ? "artisan" : "customer"}`}
        className="w-full flex items-center justify-center gap-2 border border-ink/25 rounded py-2.5 font-medium hover:border-ink/40 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/>
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
        </svg>
        {form.role === "artisan" ? "Sign up as an artisan with Google" : "Continue with Google"}
      </a>

      <p className="text-sm text-ink-soft mt-6">
        Already have an account?{" "}
        <Link to="/login" className="text-brass font-medium hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}