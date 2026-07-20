import { Link } from "react-router-dom";
import { getImageFallbackDataUri } from "../utils/imageFallback";

export default function ProductCard({ product }) {
  const outOfStock = product.stock_quantity === 0;

  return (
    <Link
      to={`/products/${product.id}`}
      className="block bg-white/50 rounded-b rounded-t-sm overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all"
    >
      <div className="hang-tag">
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full aspect-square object-cover"
          onError={(e) => {
            e.currentTarget.src = getImageFallbackDataUri({ width: 400, height: 400 });
          }}
        />
      </div>
      <div className="p-4">
        <h3 className="font-display text-lg leading-snug">{product.name}</h3>
        <div className="flex items-baseline justify-between mt-2">
          <span className="font-mono text-brass">${Number(product.price).toFixed(2)}</span>
          {outOfStock ? (
            <span className="font-mono text-xs uppercase text-clay">Sold out</span>
          ) : (
            <span className="font-mono text-xs text-ink-soft">{product.stock_quantity} left</span>
          )}
        </div>
      </div>
    </Link>
  );
}
