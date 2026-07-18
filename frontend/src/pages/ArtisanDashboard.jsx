import { useEffect, useState } from "react";
import * as productsApi from "../api/products";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  stock_quantity: "",
  image_url: "",
};

export default function ArtisanDashboard() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error | pending_approval
  const [pendingMessage, setPendingMessage] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // null = "add" mode. A product id = "edit" mode, form is prefilled from that product.
  const [editingId, setEditingId] = useState(null);

  function loadProducts() {
    setStatus("loading");
    productsApi
      .listMyProducts()
      .then((data) => {
        setProducts(data);
        setStatus("ready");
      })
      .catch((err) => {
        // 403 here specifically means require_approved_artisan blocked us —
        // distinguish that from a real failure so the message is actionable.
        if (err.response?.status === 403) {
          setPendingMessage(err.response.data?.detail ?? "Your shop is pending approval.");
          setStatus("pending_approval");
        } else {
          setStatus("error");
        }
      });
  }

  useEffect(loadProducts, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const payload = {
      ...form,
      price: Number(form.price),
      stock_quantity: Number(form.stock_quantity),
    };
    try {
      if (editingId) {
        await productsApi.updateProduct(editingId, payload);
      } else {
        await productsApi.createProduct(payload);
      }
      setForm(emptyForm);
      setEditingId(null);
      loadProducts();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(
        Array.isArray(detail)
          ? detail.map((d) => d.msg).join(", ")
          : detail ?? `Couldn't ${editingId ? "update" : "create"} product.`
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleStartEdit(product) {
    setEditingId(product.id);
    setFormError(null);
    // Prefill from the existing product. Price/stock come back as numbers
    // from the API; the inputs are controlled as strings, which is fine —
    // React coerces on render either way.
    setForm({
      name: product.name,
      description: product.description ?? "",
      price: String(product.price),
      stock_quantity: String(product.stock_quantity),
      image_url: product.image_url,
    });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  async function handleDelete(productId) {
    // Soft delete on the backend — sets is_active false, doesn't destroy history.
    await productsApi.deleteProduct(productId);
    // If you were mid-edit on the product you just removed, drop out of edit mode
    // rather than leaving a stale form pointed at a now-inactive product.
    if (editingId === productId) handleCancelEdit();
    loadProducts();
  }

  async function handleRestore(productId) {
    await productsApi.restoreProduct(productId);
    loadProducts();
  }

  if (status === "pending_approval") {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <h1 className="font-display text-2xl mb-2">Almost there</h1>
        <p className="text-ink-soft text-sm">{pendingMessage}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 grid sm:grid-cols-[1fr_320px] gap-10">
      <div>
        <h1 className="font-display text-3xl mb-6">My Shop</h1>

        {status === "loading" && <p className="font-mono text-sm text-ink-soft">Loading…</p>}
        {status === "error" && <p className="text-clay text-sm">Couldn't load your products.</p>}

        {status === "ready" && products.length === 0 && (
          <p className="text-ink-soft text-sm">No products yet — add your first one.</p>
        )}

        {status === "ready" && products.length > 0 && (
          <div className="divide-y divide-ink/10">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-4 py-4">
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="w-14 h-14 object-cover rounded"
                  onError={(e) => {
                    e.currentTarget.src =
                      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23E0DCD0'/></svg>";
                  }}
                />
                <div className="flex-1">
                  <p className="font-medium">
                    {p.name} {!p.is_active && <span className="text-xs text-clay ml-2">(removed)</span>}
                  </p>
                  <p className="font-mono text-sm text-ink-soft">
                    ${Number(p.price).toFixed(2)} · {p.stock_quantity} in stock
                  </p>
                </div>
                {p.is_active ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleStartEdit(p)}
                      className="text-xs font-mono uppercase text-brass hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-xs font-mono uppercase text-clay hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleRestore(p.id)}
                    className="text-xs font-mono uppercase text-ink-soft hover:text-brass hover:underline"
                  >
                    Restore
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white/50 rounded p-5 h-fit sticky top-24 space-y-3">
        <h2 className="font-display text-lg mb-1">
          {editingId ? "Edit product" : "Add a product"}
        </h2>

        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full border border-ink/25 rounded px-3 py-2 bg-white/60 text-sm focus:border-brass outline-none"
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full border border-ink/25 rounded px-3 py-2 bg-white/60 text-sm focus:border-brass outline-none"
        />
        <div className="flex gap-2">
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-1/2 border border-ink/25 rounded px-3 py-2 bg-white/60 text-sm focus:border-brass outline-none"
          />
          <input
            required
            type="number"
            min="0"
            placeholder="Stock"
            value={form.stock_quantity}
            onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
            className="w-1/2 border border-ink/25 rounded px-3 py-2 bg-white/60 text-sm focus:border-brass outline-none"
          />
        </div>
        <input
          required
          type="url"
          placeholder="Image URL"
          value={form.image_url}
          onChange={(e) => setForm({ ...form, image_url: e.target.value })}
          className="w-full border border-ink/25 rounded px-3 py-2 bg-white/60 text-sm focus:border-brass outline-none"
        />

        {formError && <p className="text-clay text-xs">{formError}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-ink text-parchment rounded py-2 text-sm font-medium hover:bg-ink-soft transition-colors disabled:opacity-50"
          >
            {submitting
              ? editingId
                ? "Saving…"
                : "Adding…"
              : editingId
              ? "Save changes"
              : "Add product"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 rounded border border-ink/25 text-sm hover:border-ink/40 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}