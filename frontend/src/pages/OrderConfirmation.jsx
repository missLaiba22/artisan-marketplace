import { useLocation, Navigate, Link } from "react-router-dom";

export default function OrderConfirmation() {
  const location = useLocation();
  const checkout = location.state?.checkout;

  // Landing here directly (refresh, bookmark) with no state means there's
  // nothing to show — send them somewhere useful instead of a blank page.
  if (!checkout) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="font-display text-3xl mb-1">Order placed</h1>
      <p className="text-ink-soft text-sm mb-8">
        Confirmation <span className="font-mono">{checkout.payment_reference}</span> — split into{" "}
        {checkout.orders.length} shop {checkout.orders.length === 1 ? "order" : "orders"}.
      </p>

      <div className="space-y-6">
        {checkout.orders.map((order) => (
          <div key={order.id} className="hang-tag bg-white/50 rounded-b p-4">
            <p className="font-mono text-xs uppercase text-ink-soft mb-3">
              Order {order.id.slice(0, 8)}
            </p>
            <ul className="divide-y divide-ink/10">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between py-2 text-sm">
                  <span>
                    {item.product_name} × {item.quantity}
                  </span>
                  <span className="font-mono text-brass">
                    ${(Number(item.unit_price) * item.quantity).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-8 pt-4 border-t border-ink/20">
        <span className="font-medium">Total paid</span>
        <span className="font-mono text-xl text-brass">
          ${Number(checkout.total_amount).toFixed(2)}
        </span>
      </div>

      <Link to="/" className="block text-center text-brass font-medium hover:underline mt-8">
        Continue shopping
      </Link>
    </div>
  );
}
