import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link, Navigate } from "react-router-dom";
import * as ordersApi from "../api/orders";

function money(value) {
  return `$${Number(value).toFixed(2)}`;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 8; // ~16s total before giving up

export default function OrderConfirmation() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [checkout, setCheckout] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error | missing_session
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setStatus("missing_session");
      return;
    }

    let cancelled = false;

    function poll() {
      ordersApi
        .getCheckoutBySession(sessionId)
        .then((data) => {
          if (cancelled) return;

          setCheckout(data);
          attemptsRef.current += 1;

          if (
            data.payment_status === "paid" ||
            data.payment_status === "expired"
          ) {
            setStatus("ready");
            return;
          }

          // Still pending — the webhook may not have landed yet.
          // Keep polling until MAX_POLL_ATTEMPTS, then show what we have.
          if (attemptsRef.current < MAX_POLL_ATTEMPTS) {
            setTimeout(poll, POLL_INTERVAL_MS);
          } else {
            setStatus("ready"); // show "Payment Pending" state, give up polling
          }
        })
        .catch(() => {
          if (!cancelled) setStatus("error");
        });
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (status === "missing_session") {
    return <Navigate to="/" replace />;
  }

  if (status === "loading") {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <p className="font-mono text-sm text-ink-soft">
          Confirming your payment…
        </p>
      </div>
    );
  }

  if (status === "error" || !checkout) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <p className="text-clay text-sm mb-4">
          Couldn't load your order. Check My Orders shortly.
        </p>

        <Link
          to="/orders"
          className="text-brass font-medium hover:underline"
        >
          Go to My Orders
        </Link>
      </div>
    );
  }

  const orderCount = checkout.orders.length;
  const isPaid = checkout.payment_status === "paid";
  const isPending = checkout.payment_status === "pending";

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 sm:py-16">
      {isPending && (
        <div className="bg-brass-soft/30 border border-brass/30 rounded-2xl px-5 py-4 mb-8 text-sm">
          Payment is still confirming — this can take a few seconds. Refresh
          this page or check{" "}
          <Link to="/orders" className="underline font-medium">
            My Orders
          </Link>{" "}
          shortly.
        </div>
      )}

      <section>
        <p className="font-mono text-[11px] uppercase tracking-widest text-brass mb-4">
          Order receipt
        </p>

        <h1 className="font-display text-4xl sm:text-5xl mb-3">
          {isPaid ? "Order placed" : "Order pending"}
        </h1>

        <p className="text-ink-soft text-sm sm:text-base mb-6 max-w-2xl leading-relaxed">
          {isPaid
            ? `Payment confirmed — split into ${orderCount} shop ${
                orderCount === 1 ? "order" : "orders"
              }.`
            : "We're still confirming your payment with Stripe."}
        </p>

        <div className="bg-white/70 border border-ink/10 rounded-3xl p-5 sm:p-6 shadow-[0_12px_30px_rgba(66,40,25,0.06)] mb-6">
          {checkout.orders.map((order) => (
            <div
              key={order.id}
              className="border-b border-ink/10 last:border-0 py-4 first:pt-0 last:pb-0"
            >
              <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft mb-2">
                Order {order.id.slice(0, 8)}
              </p>

              <ul className="divide-y divide-ink/10">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.product_name}</p>

                      <p className="text-ink-soft mt-1">
                        Qty {item.quantity} · Unit {money(item.unit_price)}
                        {item.discounted_unit_price && (
                          <span className="text-brass ml-1">
                            → {money(item.discounted_unit_price)} (promo
                            applied)
                          </span>
                        )}
                      </p>
                    </div>

                    <span className="font-mono text-brass">
                      {money(
                        (item.discounted_unit_price
                          ? Number(item.discounted_unit_price)
                          : Number(item.unit_price)) * item.quantity
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bg-maroon text-white rounded-3xl p-6 shadow-[0_18px_50px_rgba(62,15,26,0.18)] mb-8">
          <div className="flex items-center justify-between gap-4">
            <span className="text-lg font-medium">Total</span>

            <span className="font-mono text-xl text-brass-soft">
              {money(checkout.total_amount)}
            </span>
          </div>
        </div>

        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-full bg-ink text-parchment px-6 py-3 font-medium hover:bg-ink-soft transition-colors"
        >
          Continue shopping
        </Link>
      </section>
    </div>
  );
}