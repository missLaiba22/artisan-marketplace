import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import * as ordersApi from "../api/orders";

export default function Cart() {
  const { items, updateQuantity, removeItem, clearCart, totalPrice } = useCart();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCheckout() {
    setError(null);
    setSubmitting(true);
    try {
      const checkoutResult = await ordersApi.checkout({
        items: items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
      });
      clearCart();
      navigate("/order-confirmation", { state: { checkout: checkoutResult } });
    } catch (err) {
      // Most likely case here: stock changed between add-to-cart and checkout
      // (backend re-validates and locks rows at checkout time).
      setError(err.response?.data?.detail ?? "Checkout failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-ink-soft mb-4">Your cart is empty.</p>
        <Link to="/" className="text-brass font-medium hover:underline">
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl mb-8">Your Cart</h1>

      <div className="divide-y divide-ink/10">
        {items.map(({ product, quantity }) => (
          <div key={product.id} className="flex items-center gap-4 py-4">
            <img
              src={product.image_url}
              alt={product.name}
              className="w-16 h-16 object-cover rounded"
              onError={(e) => {
                e.currentTarget.src =
                  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23E0DCD0'/></svg>";
              }}
            />
            <div className="flex-1">
              <p className="font-medium">{product.name}</p>
              <p className="font-mono text-sm text-brass">${Number(product.price).toFixed(2)}</p>
            </div>
            <input
              type="number"
              min={1}
              max={product.stock_quantity}
              value={quantity}
              onChange={(e) => updateQuantity(product.id, Number(e.target.value))}
              className="w-16 border border-ink/25 rounded px-2 py-1 bg-white/40"
            />
            <button
              onClick={() => removeItem(product.id)}
              className="text-xs font-mono uppercase text-clay hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-8 pt-4 border-t border-ink/20">
        <span className="font-medium">Total</span>
        <span className="font-mono text-xl text-brass">${totalPrice.toFixed(2)}</span>
      </div>

      {error && (
        <p className="text-clay text-sm mt-4" role="alert">
          {error}
        </p>
      )}

      <button
        onClick={handleCheckout}
        disabled={submitting}
        className="w-full mt-6 bg-ink text-parchment rounded py-3 font-medium hover:bg-ink-soft transition-colors disabled:opacity-50"
      >
        {submitting ? "Placing order…" : "Place order"}
      </button>
    </div>
  );
}
