import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

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

      <p className="text-sm text-ink-soft mt-6">
        Already have an account?{" "}
        <Link to="/login" className="text-brass font-medium hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
