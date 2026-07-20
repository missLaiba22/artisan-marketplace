import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as ordersApi from "../api/orders";
import { getCheckoutHistory } from "../utils/orderHistory";

function money(value) {
  return `$${Number(value).toFixed(2)}`;
}

function OrderCard({ checkout, expanded = false }) {
  const orderCount = checkout.orders.length;
  const totalItems = checkout.orders.reduce(
    (count, order) => count + order.items.reduce((sum, item) => sum + item.quantity, 0),
    0
  );

  return (
    <article className="bg-white/75 border border-ink/10 rounded-3xl overflow-hidden shadow-[0_12px_30px_rgba(66,40,25,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 border-b border-ink/10 bg-parchment/50">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">Checkout</p>
          <h2 className="font-display text-2xl mt-1">{checkout.payment_reference}</h2>
          <p className="text-sm text-ink-soft mt-2">
            {orderCount} shop {orderCount === 1 ? "order" : "orders"} · {totalItems} total item{totalItems === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">Total paid</p>
          <p className="font-mono text-xl text-brass mt-1">{money(checkout.total_amount)}</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {(expanded ? checkout.orders : checkout.orders.slice(0, 2)).map((order) => (
          <div key={order.id} className="rounded-2xl border border-ink/10 bg-white p-4">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">Order {order.id.slice(0, 8)}</p>
                <p className="font-medium mt-1">{order.items.length} item{order.items.length === 1 ? "" : "s"}</p>
              </div>
              <span className="font-mono text-brass">
                {money(order.items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0))}
              </span>
            </div>

            <ul className="space-y-3">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 text-sm">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-ink-soft mt-1">
                      Qty {item.quantity} · Unit {money(item.unit_price)}
                    </p>
                  </div>
                  <span className="font-mono text-brass">{money(Number(item.unit_price) * item.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {!expanded && checkout.orders.length > 2 && (
          <p className="text-sm text-ink-soft">Showing the first 2 shop orders from this checkout.</p>
        )}
      </div>
    </article>
  );
}

export default function MyOrders() {
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;

    function mergeHistory(remoteHistory, localHistory) {
      const combined = [...remoteHistory, ...localHistory];
      const seen = new Set();
      return combined.filter((checkout) => {
        const key = checkout.id ?? checkout.payment_reference;
        if (!key || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }

    const localHistory = getCheckoutHistory();

    ordersApi
      .listMyOrderHistory()
      .then((data) => {
        if (!cancelled) {
          setHistory(mergeHistory(data, localHistory));
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (localHistory.length > 0) {
            setHistory(localHistory);
            setStatus("ready");
          } else {
            setStatus("error");
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 sm:py-16">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-brass mb-4">Customer area</p>
          <h1 className="font-display text-4xl sm:text-5xl mb-3">My Orders</h1>
          <p className="text-ink-soft text-sm sm:text-base max-w-2xl leading-relaxed">
            Review every checkout you’ve placed, with the latest receipt at the top and the item breakdown saved by the backend.
          </p>
        </div>

        <Link to="/shop" className="inline-flex items-center justify-center rounded-full bg-ink text-parchment px-5 py-3 font-medium hover:bg-ink-soft transition-colors">
          Continue shopping
        </Link>
      </div>

      {status === "loading" && <p className="font-mono text-sm text-ink-soft">Loading your orders…</p>}

      {status === "error" && (
        <div className="bg-white/70 border border-ink/10 rounded-3xl p-6 text-sm text-clay">
          Couldn’t load your order history. Please try again after refreshing.
        </div>
      )}

      {status === "ready" && history.length === 0 && (
        <div className="bg-white/70 border border-ink/10 rounded-3xl p-8 text-center">
          <p className="font-display text-2xl mb-2">No orders yet</p>
          <p className="text-ink-soft text-sm mb-6">Your purchases will appear here after your first checkout.</p>
          <Link to="/shop" className="inline-flex items-center justify-center rounded-full bg-maroon text-white px-5 py-3 font-medium hover:bg-crimson transition-colors">
            Browse the shop
          </Link>
        </div>
      )}

      {status === "ready" && history.length > 0 && (
        <div className="space-y-6">
          {history.map((checkout, index) => (
            <OrderCard key={checkout.id} checkout={checkout} expanded={index === 0} />
          ))}
        </div>
      )}
    </div>
  );
}