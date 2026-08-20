import { useEffect, useState } from "react";
import * as productsApi from "../api/products";
import * as ordersApi from "../api/orders";
import * as promotionsApi from "../api/promotions";
import { getImageFallbackDataUri } from "../utils/imageFallback";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  stock_quantity: "",
  image_url: "",
};

const emptyPromoForm = {
  code: "",
  discount_type: "percentage",
  discount_value: "",
  max_uses: "",
  product_ids: [],
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

  const [orders, setOrders] = useState([]);
  const [ordersStatus, setOrdersStatus] = useState("loading");
  const [promotions, setPromotions] = useState([]);
  const [promotionsStatus, setPromotionsStatus] = useState("loading");
  const [promoForm, setPromoForm] = useState(emptyPromoForm);
  const [promoError, setPromoError] = useState(null);
  const [promoSubmitting, setPromoSubmitting] = useState(false);

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
          setPendingMessage(
            err.response.data?.detail ?? "Your shop is pending approval."
          );
          setStatus("pending_approval");
        } else {
          setStatus("error");
        }
      });
  }

  function loadOrders() {
    setOrdersStatus("loading");
    ordersApi
      .listMyArtisanOrders()
      .then((data) => {
        setOrders(data);
        setOrdersStatus("ready");
      })
      .catch(() => setOrdersStatus("error"));
  }

  function loadPromotions() {
    setPromotionsStatus("loading");
    promotionsApi
      .listMyPromotions()
      .then((data) => {
        setPromotions(data);
        setPromotionsStatus("ready");
      })
      .catch(() => setPromotionsStatus("error"));
  }

  useEffect(loadProducts, []);

  // Orders share the same require_approved_artisan gate as products, so
  // don't fetch them until we know the shop is actually approved — otherwise
  // a pending artisan hits a second, redundant 403 for no reason.
  useEffect(() => {
    if (status === "ready") {
      loadOrders();
      loadPromotions();
    }
  }, [status]);

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

  function togglePromoProduct(productId) {
    setPromoForm((prev) => {
      const selected = prev.product_ids.includes(productId);

      return {
        ...prev,
        product_ids: selected
          ? prev.product_ids.filter((id) => id !== productId)
          : [...prev.product_ids, productId],
      };
    });
  }

  async function handleCreatePromotion(e) {
    e.preventDefault();
    setPromoError(null);

    if (promoForm.product_ids.length === 0) {
      setPromoError("Select at least one product this code should apply to.");
      return;
    }

    setPromoSubmitting(true);

    try {
      await promotionsApi.createPromotion({
        code: promoForm.code,
        discount_type: promoForm.discount_type,
        discount_value: Number(promoForm.discount_value),
        max_uses: promoForm.max_uses
          ? Number(promoForm.max_uses)
          : null,
        product_ids: promoForm.product_ids,
      });

      setPromoForm(emptyPromoForm);
      loadPromotions();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setPromoError(
        Array.isArray(detail)
          ? detail.map((d) => d.msg).join(", ")
          : detail ?? "Couldn't create promo code."
      );
    } finally {
      setPromoSubmitting(false);
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

        {status === "loading" && (
          <p className="font-mono text-sm text-ink-soft">Loading…</p>
        )}

        {status === "error" && (
          <p className="text-clay text-sm">
            Couldn't load your products.
          </p>
        )}

        {status === "ready" && products.length === 0 && (
          <p className="text-ink-soft text-sm">
            No products yet — add your first one.
          </p>
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
                    e.currentTarget.src = getImageFallbackDataUri();
                  }}
                />

                <div className="flex-1">
                  <p className="font-medium">
                    {p.name}{" "}
                    {!p.is_active && (
                      <span className="text-xs text-clay ml-2">
                        (removed)
                      </span>
                    )}
                  </p>

                  <p className="font-mono text-sm text-ink-soft">
                    ${Number(p.price).toFixed(2)} · {p.stock_quantity} in
                    stock
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

        <div className="mt-12">
          <h2 className="font-display text-2xl mb-6">Orders</h2>

          {ordersStatus === "loading" && (
            <p className="font-mono text-sm text-ink-soft">
              Loading orders…
            </p>
          )}

          {ordersStatus === "error" && (
            <p className="text-clay text-sm">
              Couldn't load your orders.
            </p>
          )}

          {ordersStatus === "ready" && orders.length === 0 && (
            <p className="text-ink-soft text-sm">No orders yet.</p>
          )}

          {ordersStatus === "ready" && orders.length > 0 && (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="bg-white/50 rounded p-4">
                  <p className="font-mono text-xs uppercase text-ink-soft mb-2">
                    Order {order.id.slice(0, 8)} · {order.status}
                  </p>

                  <ul className="divide-y divide-ink/10">
                    {order.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <span>
                          {item.product_name} × {item.quantity}
                        </span>

                        <span className="font-mono text-brass">
                          {item.discounted_unit_price ? (
                            <>
                              <span className="line-through text-ink-soft mr-2">
                                $
                                {(
                                  Number(item.unit_price) * item.quantity
                                ).toFixed(2)}
                              </span>
                              $
                              {(
                                Number(item.discounted_unit_price) *
                                item.quantity
                              ).toFixed(2)}
                            </>
                          ) : (
                            `$${(
                              Number(item.unit_price) * item.quantity
                            ).toFixed(2)}`
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-12">
          <h2 className="font-display text-2xl mb-6">Promo Codes</h2>

          {promotionsStatus === "loading" && (
            <p className="font-mono text-sm text-ink-soft">Loading…</p>
          )}

          {promotionsStatus === "error" && (
            <p className="text-clay text-sm">
              Couldn't load your promo codes.
            </p>
          )}

          {promotionsStatus === "ready" && promotions.length === 0 && (
            <p className="text-ink-soft text-sm mb-6">
              No promo codes yet.
            </p>
          )}

          {promotionsStatus === "ready" && promotions.length > 0 && (
            <div className="divide-y divide-ink/10 mb-6">
              {promotions.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-mono font-medium">{p.code}</p>

                    <p className="text-xs text-ink-soft mt-0.5">
                      {p.discount_type === "percentage"
                        ? `${p.discount_value}% off`
                        : `$${p.discount_value} off`}
                      {" · "}
                      {p.product_ids.length} product
                      {p.product_ids.length === 1 ? "" : "s"}
                      {" · "}
                      {p.times_used} used
                      {p.max_uses ? ` / ${p.max_uses}` : ""}
                    </p>
                  </div>

                  {!p.is_active && (
                    <span className="text-xs font-mono uppercase text-clay">
                      Inactive
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={handleCreatePromotion}
            className="bg-white/50 rounded p-5 space-y-3"
          >
            <h3 className="font-display text-lg mb-1">
              New promo code
            </h3>

            <input
              required
              placeholder="Code (e.g. SUMMER20)"
              value={promoForm.code}
              onChange={(e) =>
                setPromoForm({
                  ...promoForm,
                  code: e.target.value.toUpperCase(),
                })
              }
              className="w-full border border-ink/25 rounded px-3 py-2 bg-white/60 text-sm focus:border-brass outline-none"
            />

            <div className="flex gap-2">
              <select
                value={promoForm.discount_type}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    discount_type: e.target.value,
                  })
                }
                className="w-1/2 border border-ink/25 rounded px-3 py-2 bg-white/60 text-sm focus:border-brass outline-none"
              >
                <option value="percentage">Percentage off</option>
                <option value="fixed">Fixed amount off</option>
              </select>

              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                placeholder={
                  promoForm.discount_type === "percentage"
                    ? "e.g. 20"
                    : "e.g. 500"
                }
                value={promoForm.discount_value}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    discount_value: e.target.value,
                  })
                }
                className="w-1/2 border border-ink/25 rounded px-3 py-2 bg-white/60 text-sm focus:border-brass outline-none"
              />
            </div>

            <input
              type="number"
              min="1"
              placeholder="Max uses (optional — leave blank for unlimited)"
              value={promoForm.max_uses}
              onChange={(e) =>
                setPromoForm({
                  ...promoForm,
                  max_uses: e.target.value,
                })
              }
              className="w-full border border-ink/25 rounded px-3 py-2 bg-white/60 text-sm focus:border-brass outline-none"
            />

            <div>
              <p className="text-xs font-mono uppercase tracking-wide text-ink-soft mb-2">
                Applies to
              </p>

              <div className="max-h-40 overflow-y-auto space-y-1.5 border border-ink/15 rounded p-3">
                {products
                  .filter((p) => p.is_active)
                  .map((product) => (
                    <label
                      key={product.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={promoForm.product_ids.includes(
                          product.id
                        )}
                        onChange={() =>
                          togglePromoProduct(product.id)
                        }
                      />
                      {product.name}
                    </label>
                  ))}

                {products.filter((p) => p.is_active).length === 0 && (
                  <p className="text-xs text-ink-soft">
                    Add a product first.
                  </p>
                )}
              </div>
            </div>

            {promoError && (
              <p className="text-clay text-xs">{promoError}</p>
            )}

            <button
              type="submit"
              disabled={promoSubmitting}
              className="w-full bg-ink text-parchment rounded py-2 text-sm font-medium hover:bg-ink-soft transition-colors disabled:opacity-50"
            >
              {promoSubmitting
                ? "Creating…"
                : "Create promo code"}
            </button>
          </form>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white/50 rounded p-5 h-fit sticky top-24 space-y-3"
      >
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
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
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
            onChange={(e) =>
              setForm({ ...form, price: e.target.value })
            }
            className="w-1/2 border border-ink/25 rounded px-3 py-2 bg-white/60 text-sm focus:border-brass outline-none"
          />

          <input
            required
            type="number"
            min="0"
            placeholder="Stock"
            value={form.stock_quantity}
            onChange={(e) =>
              setForm({
                ...form,
                stock_quantity: e.target.value,
              })
            }
            className="w-1/2 border border-ink/25 rounded px-3 py-2 bg-white/60 text-sm focus:border-brass outline-none"
          />
        </div>

        <input
          required
          type="url"
          placeholder="Image URL"
          value={form.image_url}
          onChange={(e) =>
            setForm({ ...form, image_url: e.target.value })
          }
          className="w-full border border-ink/25 rounded px-3 py-2 bg-white/60 text-sm focus:border-brass outline-none"
        />

        {formError && (
          <p className="text-clay text-xs">{formError}</p>
        )}

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