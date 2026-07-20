import { useEffect, useState } from "react";
import { useLocation, Navigate, Link } from "react-router-dom";
import * as ordersApi from "../api/orders";
import { getCheckoutHistory, getLastCheckout } from "../utils/orderHistory";

function money(value) {
  return `$${Number(value).toFixed(2)}`;
}

export default function OrderConfirmation() {
  const location = useLocation();
  const [checkout, setCheckout] = useState(location.state?.checkout ?? getLastCheckout());
  const [loading, setLoading] = useState(!checkout);
  const history = getCheckoutHistory();

  useEffect(() => {
    if (checkout) {
      return;
    }

    let cancelled = false;
    ordersApi
      .getMyLatestOrder()
      .then((data) => {
        if (!cancelled) {
          setCheckout(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCheckout(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [checkout]);

  // Landing here directly (refresh, bookmark) with no persisted checkout
  // means there's nothing useful to show.
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16">
        <p className="font-mono text-sm text-ink-soft">Loading your receipt…</p>
      </div>
    );
  }

  if (!checkout) {
    return <Navigate to="/" replace />;
  }

  const orderCount = checkout.orders.length;
  const latestOrder = checkout.orders[0];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
        <section>
          <p className="font-mono text-[11px] uppercase tracking-widest text-brass mb-4">
            Order receipt
          </p>
          <h1 className="font-display text-4xl sm:text-5xl mb-3">Order placed</h1>
          <p className="text-ink-soft text-sm sm:text-base mb-6 max-w-2xl leading-relaxed">
            Confirmation <span className="font-mono">{checkout.payment_reference}</span> — split into {orderCount} shop {orderCount === 1 ? "order" : "orders"}. Your latest order stays saved here after refresh.
          </p>

          <div className="bg-white/70 border border-ink/10 rounded-3xl p-5 sm:p-6 shadow-[0_12px_30px_rgba(66,40,25,0.06)] mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-ink/10">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">Latest shop order</p>
                <h2 className="font-display text-2xl mt-1">Order {latestOrder.id.slice(0, 8)}</h2>
              </div>
              <div className="text-right">
                <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">Items</p>
                <p className="font-mono text-brass">{latestOrder.items.length}</p>
              </div>
            </div>

            <ul className="divide-y divide-ink/10 mt-1">
              {latestOrder.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 py-4 text-sm">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-ink-soft mt-1">Qty {item.quantity} · Unit {money(item.unit_price)}</p>
                  </div>
                  <span className="font-mono text-brass">{money(Number(item.unit_price) * item.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>

          {checkout.orders.length > 1 && (
            <div className="space-y-4">
              <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">Other shop orders</p>
              {checkout.orders.slice(1).map((order) => (
                <div key={order.id} className="bg-white/55 border border-ink/10 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">Order {order.id.slice(0, 8)}</p>
                    <p className="text-ink-soft text-sm">{order.items.length} item{order.items.length === 1 ? "" : "s"}</p>
                  </div>
                  <span className="font-mono text-brass">{money(order.items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0))}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6 lg:sticky lg:top-8 h-fit">
          <div className="bg-maroon text-white rounded-3xl p-6 shadow-[0_18px_50px_rgba(62,15,26,0.18)]">
            <p className="font-mono text-[11px] uppercase tracking-widest text-brass-soft mb-3">Summary</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-white/75">Payment reference</span>
                <span className="font-mono text-sm break-all text-right">{checkout.payment_reference}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-white/75">Shop orders</span>
                <span className="font-mono">{orderCount}</span>
              </div>
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/15">
                <span className="text-lg font-medium">Total paid</span>
                <span className="font-mono text-xl text-brass-soft">{money(checkout.total_amount)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/70 border border-ink/10 rounded-3xl p-6">
            <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft mb-4">Saved receipts</p>
            <div className="space-y-3">
              {history.slice(0, 3).map((entry) => (
                <div key={`${entry.payment_reference}-${entry.saved_at}`} className="flex items-center justify-between gap-4 text-sm">
                  <div>
                    <p className="font-medium">{entry.payment_reference}</p>
                    <p className="text-ink-soft">{entry.orders.length} order{entry.orders.length === 1 ? "" : "s"}</p>
                  </div>
                  <span className="font-mono text-brass">{money(entry.total_amount)}</span>
                </div>
              ))}
              {history.length === 0 && <p className="text-sm text-ink-soft">This is your first saved receipt.</p>}
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Link to="/" className="inline-flex items-center justify-center rounded-full bg-ink text-parchment px-6 py-3 font-medium hover:bg-ink-soft transition-colors">
          Continue shopping
        </Link>
        <p className="text-sm text-ink-soft">You can return here anytime to review the most recent saved order.</p>
      </div>
    </div>
  );
}
