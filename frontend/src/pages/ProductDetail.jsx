import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as productsApi from "../api/products";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState("loading");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    productsApi
      .getProduct(productId)
      .then((data) => {
        setProduct(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [productId]);

  if (status === "loading") {
    return <p className="max-w-3xl mx-auto px-6 py-16 font-mono text-sm text-ink-soft">Loading…</p>;
  }

  if (status === "error" || !product) {
    return <p className="max-w-3xl mx-auto px-6 py-16 text-clay text-sm">Product not found.</p>;
  }

  const outOfStock = product.stock_quantity === 0;

  function handleAddToCart() {
    if (!user) {
      navigate("/login", { state: { from: `/products/${productId}` } });
      return;
    }
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 grid sm:grid-cols-2 gap-10">
      <img
        src={product.image_url}
        alt={product.name}
        className="w-full aspect-square object-cover rounded"
        onError={(e) => {
          e.currentTarget.src =
            "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='400' height='400' fill='%23E0DCD0'/></svg>";
        }}
      />

      <div>
        <h1 className="font-display text-3xl mb-2">{product.name}</h1>
        <p className="font-mono text-xl text-brass mb-4">
          ${Number(product.price).toFixed(2)}
        </p>

        {product.description && (
          <p className="text-ink-soft text-sm leading-relaxed mb-6">{product.description}</p>
        )}

        <p className="font-mono text-xs text-ink-soft mb-4">
          {outOfStock ? "Out of stock" : `${product.stock_quantity} in stock`}
        </p>

        {!outOfStock && (
          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs font-mono uppercase text-ink-soft">Qty</label>
            <input
              type="number"
              min={1}
              max={product.stock_quantity}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-16 border border-ink/25 rounded px-2 py-1 bg-white/40"
            />
          </div>
        )}

        <button
          onClick={handleAddToCart}
          disabled={outOfStock}
          className="w-full bg-ink text-parchment rounded py-2.5 font-medium hover:bg-ink-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {outOfStock ? "Sold out" : added ? "Added ✓" : "Add to cart"}
        </button>
      </div>
    </div>
  );
}
