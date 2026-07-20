import { useEffect, useState } from "react";
import * as productsApi from "../api/products";
import ProductCard from "../components/ProductCard";

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    productsApi
      .listProducts({ limit: 25 })
      .then((data) => {
        setProducts(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl mb-1">The Shop</h1>
      <p className="text-ink-soft text-sm mb-8">Handmade goods from independent artisans.</p>

      {status === "loading" && (
        <p className="font-mono text-sm text-ink-soft">Loading products…</p>
      )}

      {status === "error" && (
        <p className="text-clay text-sm">
          Couldn't load products. Is the API running?
        </p>
      )}

      {status === "ready" && products.length === 0 && (
        <p className="text-ink-soft text-sm">No products listed yet — check back soon.</p>
      )}

      {status === "ready" && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}