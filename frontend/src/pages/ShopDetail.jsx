import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as artisansApi from "../api/artisans";
import ProductCard from "../components/ProductCard";

export default function ShopDetail() {
  const { artisanId } = useParams();
  const [artisan, setArtisan] = useState(null);
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    Promise.all([
      artisansApi.getArtisan(artisanId),
      artisansApi.listArtisanProducts(artisanId),
    ])
      .then(([artisanData, productsData]) => {
        setArtisan(artisanData);
        setProducts(productsData);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [artisanId]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {status === "loading" && <p className="font-mono text-sm text-ink-soft">Loading shop…</p>}

      {status === "error" && (
        <p className="text-clay text-sm">Couldn't load this shop. It may not exist or may not be approved.</p>
      )}

      {status === "ready" && artisan && (
        <>
          <div className="mb-10">
            <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-2">Shop profile</p>
            <h1 className="font-display text-4xl mb-3">{artisan.shop_name}</h1>
            {artisan.location && <p className="text-ink-soft text-sm mb-4">{artisan.location}</p>}
            {artisan.description && <p className="max-w-3xl leading-relaxed">{artisan.description}</p>}
          </div>

          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl">Products from this shop</h2>
            <Link to="/shop" className="font-mono text-xs uppercase tracking-wide text-maroon hover:text-crimson">
              Back to all products
            </Link>
          </div>

          {products.length === 0 ? (
            <p className="text-ink-soft text-sm">This shop has no active products yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}