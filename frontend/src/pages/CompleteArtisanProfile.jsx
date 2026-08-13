import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import * as artisansApi from "../api/artisans";

export default function CompleteArtisanProfile() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  // "loading": consuming the token from the URL fragment, same as
  // OAuthCallback. "ready": authenticated, showing the form. "error": no
  // usable token, or auth hydration failed.
  const [status, setStatus] = useState("loading");
  const [form, setForm] = useState({ shop_name: "", location: "", description: "" });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("access_token");

    if (!token) {
      setStatus("error");
      return;
    }

    loginWithToken(token)
      .then(() => setStatus("ready"))
      .catch(() => setStatus("error"));
    // Runs once on mount — the token only ever exists in the URL on this
    // first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await artisansApi.completeProfile(form);
      // Backend already set is_approved=false for this brand-new shop —
      // ArtisanDashboard already knows how to show the pending-approval
      // message, nothing special needed here.
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(
        Array.isArray(detail)
          ? detail.map((d) => d.msg).join(", ")
          : detail ?? "Couldn't save your shop details. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="max-w-sm mx-auto px-6 py-16 text-center">
        <p className="font-mono text-sm text-ink-soft">Signing you in…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="max-w-sm mx-auto px-6 py-16 text-center">
        <p className="text-clay text-sm mb-4">Couldn't complete sign-in. Please try again.</p>
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
    <div className="max-w-sm mx-auto px-6 py-16">
      <h1 className="font-display text-3xl mb-1">Almost there</h1>
      <p className="text-ink-soft text-sm mb-8">
        You're signed in with Google. Just a couple of details about your shop
        before you can start listing products.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
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
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1.5">
            Location <span className="normal-case text-ink-soft/70">(optional)</span>
          </label>
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full border border-ink/25 rounded px-3 py-2 bg-white/40 focus:border-brass outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1.5">
            Description <span className="normal-case text-ink-soft/70">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border border-ink/25 rounded px-3 py-2 bg-white/40 focus:border-brass outline-none"
          />
        </div>

        {formError && (
          <p className="text-clay text-sm" role="alert">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-ink text-parchment rounded py-2.5 font-medium hover:bg-ink-soft transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Finish setting up my shop"}
        </button>

        <p className="text-xs text-ink-soft text-center">
          Your shop will need admin approval before it appears publicly.
        </p>
      </form>
    </div>
  );
}