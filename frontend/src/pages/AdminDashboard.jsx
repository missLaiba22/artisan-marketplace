import { useEffect, useState } from "react";
import * as artisansApi from "../api/artisans";

export default function AdminDashboard() {
  const [pending, setPending] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  // Track which artisan id is mid-approve, so only that row's button
  // disables — approving one shouldn't block acting on another.
  const [approvingId, setApprovingId] = useState(null);

  function loadPending() {
    setStatus("loading");
    artisansApi
      .listPendingArtisans()
      .then((data) => {
        setPending(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  useEffect(loadPending, []);

  async function handleApprove(artisanId) {
    setApprovingId(artisanId);
    try {
      await artisansApi.approveArtisan(artisanId);
      // Remove locally rather than refetching the whole list — approved
      // shops leave the "pending" set, no need for a round-trip to know that.
      setPending((prev) => prev.filter((a) => a.id !== artisanId));
    } catch {
      // If it fails, refetch to get back to a known-correct state rather
      // than leaving a stale row that looks actionable but isn't.
      loadPending();
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl mb-1">Pending Shops</h1>
      <p className="text-ink-soft text-sm mb-8">
        Artisan accounts awaiting approval before they can list products.
      </p>

      {status === "loading" && <p className="font-mono text-sm text-ink-soft">Loading…</p>}
      {status === "error" && (
        <p className="text-clay text-sm">Couldn't load pending shops.</p>
      )}

      {status === "ready" && pending.length === 0 && (
        <p className="text-ink-soft text-sm">Nothing pending — all caught up.</p>
      )}

      {status === "ready" && pending.length > 0 && (
        <div className="divide-y divide-ink/10">
          {pending.map((artisan) => (
            <div key={artisan.id} className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">{artisan.shop_name}</p>
                {artisan.location && (
                  <p className="text-xs text-ink-soft mt-0.5">{artisan.location}</p>
                )}
                {artisan.description && (
                  <p className="text-sm text-ink-soft mt-1 max-w-md">{artisan.description}</p>
                )}
              </div>
              <button
                onClick={() => handleApprove(artisan.id)}
                disabled={approvingId === artisan.id}
                className="font-mono text-xs uppercase bg-ink text-parchment rounded px-4 py-2 hover:bg-ink-soft transition-colors disabled:opacity-50 shrink-0 ml-4"
              >
                {approvingId === artisan.id ? "Approving…" : "Approve"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}