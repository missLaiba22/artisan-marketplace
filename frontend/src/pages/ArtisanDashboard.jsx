import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as productsApi from "../api/products";
import * as ordersApi from "../api/orders";
import * as promotionsApi from "../api/promotions";
import { useAuth } from "../context/useAuth";
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

// Sidebar sections. Products / Orders / Promotions are backed by real APIs;
// Analytics is derived client-side from products + orders + promotions already
// in state; Reviews / Settings are scaffolded sections (no endpoint yet).
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  { key: "products", label: "Products", icon: "box" },
  { key: "orders", label: "Orders", icon: "bag" },
  { key: "promotions", label: "Promotions", icon: "tag" },
  { key: "analytics", label: "Analytics", icon: "chart" },
  { key: "reviews", label: "Reviews", icon: "star" },
  { key: "settings", label: "Settings", icon: "gear" },
];

// Chart palette, drawn from the Karigar tokens so nothing looks bolted-on.
const CHART_COLORS = ["#5C1326", "#8C2641", "#A64B3C", "#C97A6C", "#E3B8C4", "#6E6A64"];

const money = (n) =>
  "$" +
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const compact = (n) => Number(n || 0).toLocaleString("en-US");

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function Ico({ name, className = "w-5 h-5" }) {
  const s = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const p = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    box: (
      <>
        <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
        <path d="m3 8 9 5 9-5" />
        <path d="M12 13v8" />
      </>
    ),
    bag: (
      <>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </>
    ),
    tag: (
      <>
        <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z" />
        <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
      </>
    ),
    chart: (
      <>
        <path d="M3 3v18h18" />
        <rect x="7" y="12" width="3" height="6" />
        <rect x="12" y="8" width="3" height="10" />
        <rect x="17" y="5" width="3" height="13" />
      </>
    ),
    star: (
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
    ),
    gear: (
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.1 5.1l2.1 2.1M16.8 16.8l2.1 2.1M18.9 5.1l-2.1 2.1M7.2 16.8l-2.1 2.1" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      </>
    ),
    x: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    restore: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
      </>
    ),
    trend: (
      <>
        <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
        <path d="M16 7h6v6" />
      </>
    ),
    coins: (
      <>
        <ellipse cx="9" cy="7" rx="6" ry="3" />
        <path d="M3 7v5c0 1.7 2.7 3 6 3" />
        <path d="M3 12v5c0 1.7 2.7 3 6 3" />
        <ellipse cx="15" cy="14" rx="6" ry="3" />
        <path d="M21 14v5c0 1.7-2.7 3-6 3" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
      </>
    ),
    alert: (
      <>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} {...s} aria-hidden="true">
      {p[name]}
    </svg>
  );
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  let cls = "bg-ink/5 text-ink-soft";
  if (/deliver|complete|fulfil|paid|success/.test(s)) cls = "bg-emerald-50 text-emerald-700";
  else if (/pending|await|unpaid|created|reserved/.test(s)) cls = "bg-amber-50 text-amber-700";
  else if (/process|ship/.test(s)) cls = "bg-sky-50 text-sky-700";
  else if (/cancel|refund|fail|expire|release/.test(s)) cls = "bg-rose-50 text-rose-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide ${cls}`}
    >
      {status}
    </span>
  );
}

function ProductStatusPill({ product }) {
  if (!product.is_active) {
    return (
      <span className="shrink-0 rounded-full bg-ink/5 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-soft">
        Removed
      </span>
    );
  }
  const stock = Number(product.stock_quantity);
  if (stock === 0) {
    return (
      <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-rose-700">
        Out of stock
      </span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-amber-700">
        Low stock
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-emerald-700">
      Live
    </span>
  );
}

function StatCard({ icon, label, value, sub, tone = "maroon" }) {
  const tones = {
    maroon: "bg-maroon/10 text-maroon",
    crimson: "bg-brass/10 text-brass",
    clay: "bg-clay/10 text-clay",
    ink: "bg-ink/5 text-ink-soft",
  };
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-5">
      <div className="flex items-start justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Ico name={icon} className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl leading-none text-ink">{value}</p>
      {sub && <p className="mt-2 text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="font-mono text-[11px] uppercase tracking-widest text-brass">{eyebrow}</p>
        )}
        <h1 className="mt-1 font-display text-3xl text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon = "box", title, hint }) {
  return (
    <div className="rounded-xl border border-dashed border-ink/15 bg-white/60 px-6 py-14 text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink/5 text-ink-soft">
        <Ico name={icon} className="h-6 w-6" />
      </span>
      <p className="font-display text-lg text-ink">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{hint}</p>}
    </div>
  );
}

function Donut({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const stops = data
    .map((d) => {
      const start = (acc / total) * 360;
      acc += d.value;
      const end = (acc / total) * 360;
      return `${d.color} ${start}deg ${end}deg`;
    })
    .join(", ");
  return (
    <div className="flex items-center gap-6">
      <div
        className="relative h-32 w-32 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops})` }}
      >
        <div className="absolute inset-[24%] flex flex-col items-center justify-center rounded-full bg-white">
          <span className="font-display text-2xl leading-none text-ink">{compact(total)}</span>
          <span className="font-mono text-[9px] uppercase tracking-wide text-ink-soft">Orders</span>
        </div>
      </div>
      <ul className="space-y-2">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="capitalize text-ink">{d.label}</span>
            <span className="font-mono text-xs text-ink-soft">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ArtisanDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

  // --- UI-only state (does not touch any existing data flow) ---
  const [activeView, setActiveView] = useState("dashboard");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productFilter, setProductFilter] = useState("all"); // all | active | low | removed
  const [orderFilter, setOrderFilter] = useState("all");

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

  // Close the product modal on Escape.
  useEffect(() => {
    if (!productModalOpen) return;
    function onKey(e) {
      if (e.key === "Escape") closeProductModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productModalOpen]);

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
      setProductModalOpen(false);
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
        max_uses: promoForm.max_uses ? Number(promoForm.max_uses) : null,
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
    setProductModalOpen(true);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function openAddProduct() {
    handleCancelEdit();
    setProductModalOpen(true);
  }

  function closeProductModal() {
    setProductModalOpen(false);
    handleCancelEdit();
  }

  async function handleDelete(productId) {
    // Soft delete on the backend — sets is_active false, doesn't destroy history.
    await productsApi.deleteProduct(productId);

    // If you were mid-edit on the product you just removed, drop out of edit mode
    // rather than leaving a stale form pointed at a now-inactive product.
    if (editingId === productId) {
      handleCancelEdit();
      setProductModalOpen(false);
    }

    loadProducts();
  }

  async function handleRestore(productId) {
    await productsApi.restoreProduct(productId);
    loadProducts();
  }

  // --- Derived metrics (all from data already in state) ---------------------
  const activeProducts = products.filter((p) => p.is_active);
  const liveCount = activeProducts.length;
  const unitsInStock = activeProducts.reduce((s, p) => s + Number(p.stock_quantity), 0);
  const lowStock = activeProducts.filter(
    (p) => Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= 5
  );
  const outOfStock = activeProducts.filter((p) => Number(p.stock_quantity) === 0);

  const orderTotal = (order) =>
    order.items.reduce(
      (s, it) => s + Number(it.discounted_unit_price ?? it.unit_price) * it.quantity,
      0
    );
  const revenue = orders.reduce((s, o) => s + orderTotal(o), 0);
  const unitsSold = orders.reduce(
    (s, o) => s + o.items.reduce((a, it) => a + it.quantity, 0),
    0
  );
  const avgOrder = orders.length ? revenue / orders.length : 0;
  const promoRedemptions = promotions.reduce((s, pr) => s + (pr.times_used || 0), 0);

  const statusCounts = orders.reduce((m, o) => {
    const k = o.status || "unknown";
    m[k] = (m[k] || 0) + 1;
    return m;
  }, {});
  const statusData = Object.entries(statusCounts).map(([label, value], i) => ({
    label,
    value,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const productRevenue = {};
  orders.forEach((o) =>
    o.items.forEach((it) => {
      const amt = Number(it.discounted_unit_price ?? it.unit_price) * it.quantity;
      productRevenue[it.product_name] = (productRevenue[it.product_name] || 0) + amt;
    })
  );
  const topProducts = Object.entries(productRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const topMax = Math.max(...topProducts.map(([, v]) => v), 1);

  const recentOrders = orders.slice(0, 6);

  const orderStatuses = ["all", ...Object.keys(statusCounts)];
  const visibleOrders =
    orderFilter === "all" ? orders : orders.filter((o) => o.status === orderFilter);

  const filteredProducts = products
    .filter((p) => {
      if (productFilter === "active") return p.is_active;
      if (productFilter === "removed") return !p.is_active;
      if (productFilter === "low")
        return p.is_active && Number(p.stock_quantity) <= 5;
      return true;
    })
    .filter((p) => p.name.toLowerCase().includes(productQuery.trim().toLowerCase()));

  // -------------------------------------------------------------------------
  // Pending-approval short circuit (unchanged behaviour, restyled)
  // -------------------------------------------------------------------------
  if (status === "pending_approval") {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <Ico name="alert" className="h-6 w-6" />
        </span>
        <h1 className="mb-2 font-display text-2xl text-ink">Almost there</h1>
        <p className="text-sm text-ink-soft">{pendingMessage}</p>
      </div>
    );
  }

  const shopName = user?.shop_name || "Your shop";

  return (
    <div className="min-h-screen bg-parchment pb-16">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="lg:grid lg:grid-cols-[248px_1fr] lg:gap-8">
          {/* ---------------- Sidebar (desktop) ---------------- */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-ink/10 bg-white p-4">
              <div className="px-2 pb-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-brass">
                  Seller Studio
                </p>
                <p className="mt-1 truncate font-display text-lg text-ink">{shopName}</p>
              </div>

              <nav className="space-y-1">
                {NAV.map((item) => {
                  const active = activeView === item.key;
                  const badge =
                    item.key === "orders" && orders.length
                      ? orders.length
                      : item.key === "products" && lowStock.length + outOfStock.length
                      ? lowStock.length + outOfStock.length
                      : null;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveView(item.key)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-maroon text-white"
                          : "text-ink-soft hover:bg-parchment-dark hover:text-ink"
                      }`}
                    >
                      <Ico name={item.icon} className="h-[18px] w-[18px]" />
                      <span className="flex-1 text-left font-medium">{item.label}</span>
                      {badge != null && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                            active ? "bg-white/20 text-white" : "bg-ink/5 text-ink-soft"
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-4 border-t border-ink/10 pt-4">
                <button
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-soft transition-colors hover:bg-parchment-dark hover:text-clay"
                >
                  <Ico name="logout" className="h-[18px] w-[18px]" />
                  <span className="font-medium">Log out</span>
                </button>
              </div>
            </div>
          </aside>

          {/* ---------------- Main ---------------- */}
          <main className="mt-6 lg:mt-0">
            {/* Section nav (mobile) */}
            <nav className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {NAV.map((item) => {
                const active = activeView === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveView(item.key)}
                    className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors ${
                      active
                        ? "bg-maroon text-white"
                        : "border border-ink/10 bg-white text-ink-soft"
                    }`}
                  >
                    <Ico name={item.icon} className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {status === "error" && activeView !== "reviews" && activeView !== "settings" && (
              <div className="mb-6 rounded-xl border border-clay/20 bg-clay/5 px-4 py-3 text-sm text-clay">
                Couldn't load your shop data. Refresh to try again.
              </div>
            )}

            {/* ===================== DASHBOARD ===================== */}
            {activeView === "dashboard" && (
              <>
                <SectionHeader
                  eyebrow="Overview"
                  title="Dashboard"
                  description="How your shop is doing at a glance."
                />

                {status === "loading" ? (
                  <p className="font-mono text-sm text-ink-soft">Loading…</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <StatCard
                        icon="coins"
                        tone="maroon"
                        label="Total sales"
                        value={money(revenue)}
                        sub={`${compact(orders.length)} order${orders.length === 1 ? "" : "s"} placed`}
                      />
                      <StatCard
                        icon="bag"
                        tone="crimson"
                        label="Orders"
                        value={compact(orders.length)}
                        sub={`${compact(unitsSold)} items sold`}
                      />
                      <StatCard
                        icon="box"
                        tone="ink"
                        label="Live products"
                        value={compact(liveCount)}
                        sub={`${compact(unitsInStock)} units in stock`}
                      />
                      <StatCard
                        icon="alert"
                        tone="clay"
                        label="Needs attention"
                        value={compact(lowStock.length + outOfStock.length)}
                        sub={`${outOfStock.length} out · ${lowStock.length} low on stock`}
                      />
                    </div>

                    <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
                      {/* Recent orders */}
                      <div className="rounded-xl border border-ink/10 bg-white p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <h2 className="font-display text-lg text-ink">Recent orders</h2>
                          {orders.length > 0 && (
                            <button
                              onClick={() => setActiveView("orders")}
                              className="font-mono text-xs uppercase tracking-wide text-brass hover:underline"
                            >
                              View all
                            </button>
                          )}
                        </div>

                        {ordersStatus === "loading" && (
                          <p className="font-mono text-sm text-ink-soft">Loading orders…</p>
                        )}
                        {ordersStatus === "error" && (
                          <p className="text-sm text-clay">Couldn't load your orders.</p>
                        )}
                        {ordersStatus === "ready" && orders.length === 0 && (
                          <p className="text-sm text-ink-soft">No orders yet.</p>
                        )}
                        {ordersStatus === "ready" && recentOrders.length > 0 && (
                          <div className="divide-y divide-ink/10">
                            {recentOrders.map((order) => (
                              <div
                                key={order.id}
                                className="flex items-center justify-between gap-3 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-mono text-sm text-ink">
                                    #{order.id.slice(0, 8)}
                                  </p>
                                  <p className="text-xs text-ink-soft">
                                    {order.items.length} item
                                    {order.items.length === 1 ? "" : "s"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <StatusBadge status={order.status} />
                                  <span className="w-20 text-right font-mono text-sm text-ink">
                                    {money(orderTotal(order))}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Stock snapshot */}
                      <div className="rounded-xl border border-ink/10 bg-white p-5">
                        <h2 className="mb-4 font-display text-lg text-ink">Stock snapshot</h2>
                        <div className="space-y-3">
                          <SnapshotRow label="In stock" value={liveCount - outOfStock.length} tone="emerald" />
                          <SnapshotRow label="Low stock (≤ 5)" value={lowStock.length} tone="amber" />
                          <SnapshotRow label="Out of stock" value={outOfStock.length} tone="rose" />
                          <SnapshotRow label="Removed" value={products.length - liveCount} tone="ink" />
                        </div>
                        {lowStock.length + outOfStock.length > 0 && (
                          <button
                            onClick={() => {
                              setProductFilter("low");
                              setActiveView("products");
                            }}
                            className="mt-4 w-full rounded-lg border border-ink/15 py-2 font-mono text-xs uppercase tracking-wide text-ink-soft transition-colors hover:border-brass hover:text-brass"
                          >
                            Restock products
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ===================== PRODUCTS ===================== */}
            {activeView === "products" && (
              <>
                <SectionHeader
                  eyebrow="Catalog"
                  title="Products"
                  description="Everything you've listed, active or removed."
                >
                  <button
                    onClick={openAddProduct}
                    className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-crimson"
                  >
                    <Ico name="plus" className="h-4 w-4" />
                    Add product
                  </button>
                </SectionHeader>

                {/* Search + filters */}
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative sm:max-w-xs sm:flex-1">
                    <Ico
                      name="search"
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
                    />
                    <input
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      placeholder="Search products"
                      className="w-full rounded-lg border border-ink/15 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brass"
                    />
                  </div>
                  <div className="flex gap-2">
                    {[
                      { key: "all", label: "All" },
                      { key: "active", label: "Active" },
                      { key: "low", label: "Low stock" },
                      { key: "removed", label: "Removed" },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setProductFilter(f.key)}
                        className={`rounded-full px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                          productFilter === f.key
                            ? "bg-maroon text-white"
                            : "border border-ink/10 bg-white text-ink-soft hover:text-ink"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {status === "loading" && (
                  <p className="font-mono text-sm text-ink-soft">Loading…</p>
                )}
                {status === "ready" && products.length === 0 && (
                  <EmptyState
                    icon="box"
                    title="No products yet"
                    hint="Add your first product to start selling."
                  />
                )}
                {status === "ready" && products.length > 0 && filteredProducts.length === 0 && (
                  <EmptyState
                    icon="search"
                    title="Nothing matches"
                    hint="Try a different search or filter."
                  />
                )}

                {status === "ready" && filteredProducts.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        className={`flex flex-col rounded-xl border border-ink/10 bg-white p-4 transition-shadow hover:shadow-sm ${
                          !p.is_active ? "opacity-70" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="h-16 w-16 shrink-0 rounded object-cover ring-1 ring-ink/10"
                            onError={(e) => {
                              e.currentTarget.src = getImageFallbackDataUri();
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="truncate font-display text-base leading-snug text-ink">
                                {p.name}
                              </h3>
                              <ProductStatusPill product={p} />
                            </div>
                            <p className="mt-1 font-mono text-sm text-brass">
                              {money(p.price)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-ink/10 pt-3">
                          <span className="font-mono text-xs text-ink-soft">
                            {p.stock_quantity} in stock
                          </span>

                          {p.is_active ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(p)}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs uppercase tracking-wide text-brass transition-colors hover:bg-brass/10"
                              >
                                <Ico name="edit" className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs uppercase tracking-wide text-clay transition-colors hover:bg-clay/10"
                              >
                                <Ico name="trash" className="h-3.5 w-3.5" />
                                Remove
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleRestore(p.id)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs uppercase tracking-wide text-ink-soft transition-colors hover:bg-ink/5 hover:text-brass"
                            >
                              <Ico name="restore" className="h-3.5 w-3.5" />
                              Restore
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ===================== ORDERS ===================== */}
            {activeView === "orders" && (
              <>
                <SectionHeader
                  eyebrow="Fulfilment"
                  title="Orders"
                  description="Orders that include your products."
                />

                {ordersStatus === "loading" && (
                  <p className="font-mono text-sm text-ink-soft">Loading orders…</p>
                )}
                {ordersStatus === "error" && (
                  <p className="text-sm text-clay">Couldn't load your orders.</p>
                )}
                {ordersStatus === "ready" && orders.length === 0 && (
                  <EmptyState
                    icon="bag"
                    title="No orders yet"
                    hint="When a customer buys one of your products, it'll show up here."
                  />
                )}

                {ordersStatus === "ready" && orders.length > 0 && (
                  <>
                    <div className="mb-5 flex flex-wrap gap-2">
                      {orderStatuses.map((s) => (
                        <button
                          key={s}
                          onClick={() => setOrderFilter(s)}
                          className={`rounded-full px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                            orderFilter === s
                              ? "bg-maroon text-white"
                              : "border border-ink/10 bg-white text-ink-soft hover:text-ink"
                          }`}
                        >
                          {s}
                          {s !== "all" && (
                            <span className="ml-1.5 opacity-70">{statusCounts[s]}</span>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-4">
                      {visibleOrders.map((order) => (
                        <div
                          key={order.id}
                          className="rounded-xl border border-ink/10 bg-white p-5"
                        >
                          <div className="mb-3 flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm text-ink">
                                #{order.id.slice(0, 8)}
                              </span>
                              <StatusBadge status={order.status} />
                            </div>
                            <span className="font-mono text-sm font-medium text-ink">
                              {money(orderTotal(order))}
                            </span>
                          </div>

                          <ul className="divide-y divide-ink/10">
                            {order.items.map((item) => (
                              <li
                                key={item.id}
                                className="flex items-center justify-between py-2 text-sm"
                              >
                                <span className="text-ink">
                                  {item.product_name} × {item.quantity}
                                </span>

                                <span className="font-mono text-brass">
                                  {item.discounted_unit_price ? (
                                    <>
                                      <span className="mr-2 text-ink-soft line-through">
                                        ${(Number(item.unit_price) * item.quantity).toFixed(2)}
                                      </span>
                                      $
                                      {(
                                        Number(item.discounted_unit_price) * item.quantity
                                      ).toFixed(2)}
                                    </>
                                  ) : (
                                    `$${(Number(item.unit_price) * item.quantity).toFixed(2)}`
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ===================== PROMOTIONS ===================== */}
            {activeView === "promotions" && (
              <>
                <SectionHeader
                  eyebrow="Marketing"
                  title="Promotions"
                  description="Discount codes customers can apply at checkout."
                />

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
                  {/* Existing codes */}
                  <div>
                    {promotionsStatus === "loading" && (
                      <p className="font-mono text-sm text-ink-soft">Loading…</p>
                    )}
                    {promotionsStatus === "error" && (
                      <p className="text-sm text-clay">Couldn't load your promo codes.</p>
                    )}
                    {promotionsStatus === "ready" && promotions.length === 0 && (
                      <EmptyState
                        icon="tag"
                        title="No promo codes yet"
                        hint="Create one on the right to run your first discount."
                      />
                    )}

                    {promotionsStatus === "ready" && promotions.length > 0 && (
                      <div className="space-y-3">
                        {promotions.map((p) => {
                          const pct =
                            p.max_uses != null
                              ? Math.min(100, Math.round((p.times_used / p.max_uses) * 100))
                              : null;
                          return (
                            <div
                              key={p.id}
                              className="rounded-xl border border-ink/10 bg-white p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="rounded-md bg-brass/10 px-2 py-1 font-mono text-sm font-medium tracking-wide text-brass">
                                    {p.code}
                                  </span>
                                  <span className="font-mono text-xs text-ink-soft">
                                    {p.discount_type === "percentage"
                                      ? `${p.discount_value}% off`
                                      : `$${p.discount_value} off`}
                                  </span>
                                </div>
                                <span className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">
                                  {p.product_ids.length} product
                                  {p.product_ids.length === 1 ? "" : "s"}
                                </span>
                              </div>

                              <div className="mt-3 flex items-center gap-3">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                                  <div
                                    className="h-full rounded-full bg-maroon"
                                    style={{ width: `${pct == null ? 100 : pct}%` }}
                                  />
                                </div>
                                <span className="font-mono text-xs text-ink-soft">
                                  {p.times_used} used{p.max_uses ? ` / ${p.max_uses}` : ""}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Create form */}
                  <form
                    onSubmit={handleCreatePromotion}
                    className="h-fit space-y-3 rounded-xl border border-ink/10 bg-white p-5 xl:sticky xl:top-24"
                  >
                    <h2 className="font-display text-lg text-ink">New promo code</h2>

                    <input
                      required
                      placeholder="Code (e.g. SUMMER20)"
                      value={promoForm.code}
                      onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value })}
                      className="w-full rounded border border-ink/25 bg-white/60 px-3 py-2 text-sm uppercase outline-none focus:border-brass"
                    />

                    <div className="flex gap-2">
                      <select
                        value={promoForm.discount_type}
                        onChange={(e) =>
                          setPromoForm({ ...promoForm, discount_type: e.target.value })
                        }
                        className="w-1/2 rounded border border-ink/25 bg-white/60 px-3 py-2 text-sm outline-none focus:border-brass"
                      >
                        <option value="percentage">Percentage off</option>
                        <option value="fixed">Fixed amount off</option>
                      </select>

                      <input
                        required
                        type="number"
                        min="0"
                        step={promoForm.discount_type === "percentage" ? "1" : "0.01"}
                        placeholder={
                          promoForm.discount_type === "percentage" ? "e.g. 20" : "e.g. 500"
                        }
                        value={promoForm.discount_value}
                        onChange={(e) =>
                          setPromoForm({ ...promoForm, discount_value: e.target.value })
                        }
                        className="w-1/2 rounded border border-ink/25 bg-white/60 px-3 py-2 text-sm outline-none focus:border-brass"
                      />
                    </div>

                    <input
                      type="number"
                      min="1"
                      placeholder="Max uses (optional — leave blank for unlimited)"
                      value={promoForm.max_uses}
                      onChange={(e) => setPromoForm({ ...promoForm, max_uses: e.target.value })}
                      className="w-full rounded border border-ink/25 bg-white/60 px-3 py-2 text-sm outline-none focus:border-brass"
                    />

                    <div>
                      <p className="mb-2 font-mono text-xs uppercase tracking-wide text-ink-soft">
                        Applies to
                      </p>

                      <div className="max-h-40 space-y-1.5 overflow-y-auto rounded border border-ink/15 p-3">
                        {products
                          .filter((p) => p.is_active)
                          .map((product) => (
                            <label
                              key={product.id}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                className="accent-maroon"
                                checked={promoForm.product_ids.includes(product.id)}
                                onChange={() => togglePromoProduct(product.id)}
                              />
                              {product.name}
                            </label>
                          ))}

                        {products.filter((p) => p.is_active).length === 0 && (
                          <p className="text-xs text-ink-soft">Add a product first.</p>
                        )}
                      </div>
                    </div>

                    {promoError && <p className="text-xs text-clay">{promoError}</p>}

                    <button
                      type="submit"
                      disabled={promoSubmitting}
                      className="w-full rounded-lg bg-maroon py-2.5 text-sm font-medium text-white transition-colors hover:bg-crimson disabled:opacity-50"
                    >
                      {promoSubmitting ? "Creating…" : "Create promo code"}
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* ===================== ANALYTICS ===================== */}
            {activeView === "analytics" && (
              <>
                <SectionHeader
                  eyebrow="Insights"
                  title="Analytics"
                  description="Trends across your sales and catalog."
                />

                {ordersStatus === "loading" && (
                  <p className="font-mono text-sm text-ink-soft">Loading…</p>
                )}

                {ordersStatus === "ready" && orders.length === 0 ? (
                  <EmptyState
                    icon="chart"
                    title="No data to chart yet"
                    hint="Analytics appear once your shop has its first orders."
                  />
                ) : (
                  ordersStatus === "ready" && (
                    <>
                      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <StatCard icon="coins" tone="maroon" label="Revenue" value={money(revenue)} />
                        <StatCard
                          icon="trend"
                          tone="crimson"
                          label="Avg. order"
                          value={money(avgOrder)}
                        />
                        <StatCard icon="layers" tone="ink" label="Units sold" value={compact(unitsSold)} />
                        <StatCard
                          icon="tag"
                          tone="clay"
                          label="Promo uses"
                          value={compact(promoRedemptions)}
                        />
                      </div>

                      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                        {/* Top products by revenue */}
                        <div className="rounded-xl border border-ink/10 bg-white p-5">
                          <h2 className="mb-4 font-display text-lg text-ink">
                            Top products by revenue
                          </h2>
                          {topProducts.length === 0 ? (
                            <p className="text-sm text-ink-soft">No sales yet.</p>
                          ) : (
                            <div className="space-y-3">
                              {topProducts.map(([name, val], i) => (
                                <div key={name}>
                                  <div className="mb-1 flex items-center justify-between text-sm">
                                    <span className="truncate pr-3 text-ink">{name}</span>
                                    <span className="shrink-0 font-mono text-ink-soft">
                                      {money(val)}
                                    </span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-ink/5">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${(val / topMax) * 100}%`,
                                        background: CHART_COLORS[i % CHART_COLORS.length],
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Order status distribution */}
                        <div className="rounded-xl border border-ink/10 bg-white p-5">
                          <h2 className="mb-4 font-display text-lg text-ink">
                            Orders by status
                          </h2>
                          {statusData.length === 0 ? (
                            <p className="text-sm text-ink-soft">No orders yet.</p>
                          ) : (
                            <Donut data={statusData} />
                          )}
                        </div>
                      </div>
                    </>
                  )
                )}
              </>
            )}

            {/* ===================== REVIEWS ===================== */}
            {activeView === "reviews" && (
              <>
                <SectionHeader
                  eyebrow="Reputation"
                  title="Reviews"
                  description="Customer feedback on your products."
                />
                <EmptyState
                  icon="star"
                  title="No reviews yet"
                  hint="Once customers review your products, their ratings and comments will appear here."
                />
              </>
            )}

            {/* ===================== SETTINGS ===================== */}
            {activeView === "settings" && (
              <>
                <SectionHeader
                  eyebrow="Account"
                  title="Settings"
                  description="Manage your shop details and account."
                />

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="space-y-4 rounded-xl border border-ink/10 bg-white p-6">
                    <h2 className="font-display text-lg text-ink">Shop profile</h2>

                    <div>
                      <label className="mb-1.5 block font-mono text-xs uppercase tracking-wide text-ink-soft">
                        Shop name
                      </label>
                      <input
                        defaultValue={user?.shop_name || ""}
                        className="w-full rounded border border-ink/25 bg-white/60 px-3 py-2 text-sm outline-none focus:border-brass"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block font-mono text-xs uppercase tracking-wide text-ink-soft">
                        Location
                      </label>
                      <input
                        defaultValue={user?.location || ""}
                        className="w-full rounded border border-ink/25 bg-white/60 px-3 py-2 text-sm outline-none focus:border-brass"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block font-mono text-xs uppercase tracking-wide text-ink-soft">
                        Description
                      </label>
                      <textarea
                        rows={3}
                        defaultValue={user?.description || ""}
                        className="w-full rounded border border-ink/25 bg-white/60 px-3 py-2 text-sm outline-none focus:border-brass"
                      />
                    </div>

                    <button
                      disabled
                      title="Profile editing will be enabled here soon"
                      className="w-full cursor-not-allowed rounded-lg bg-maroon py-2.5 text-sm font-medium text-white opacity-50"
                    >
                      Save changes
                    </button>
                    <p className="text-center text-xs text-ink-soft">
                      Editing your public shop profile will be enabled here soon.
                    </p>
                  </div>

                  <div className="space-y-4 rounded-xl border border-ink/10 bg-white p-6">
                    <h2 className="font-display text-lg text-ink">Account</h2>

                    <div className="rounded-lg bg-parchment px-4 py-3">
                      <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">
                        Signed in as
                      </p>
                      <p className="mt-0.5 text-sm text-ink">
                        {user?.email || user?.name || "Artisan account"}
                      </p>
                    </div>

                    <div className="rounded-lg bg-parchment px-4 py-3">
                      <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">
                        Role
                      </p>
                      <p className="mt-0.5 text-sm capitalize text-ink">{user?.role || "artisan"}</p>
                    </div>

                    <button
                      onClick={() => {
                        logout();
                        navigate("/");
                      }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-clay/40 py-2.5 text-sm font-medium text-clay transition-colors hover:bg-clay/5"
                    >
                      <Ico name="logout" className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* ===================== ADD / EDIT PRODUCT MODAL ===================== */}
      {productModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
          onClick={closeProductModal}
        >
          <div
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl text-ink">
                {editingId ? "Edit product" : "Add a product"}
              </h2>
              <button
                onClick={closeProductModal}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <Ico name="x" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block font-mono text-xs uppercase tracking-wide text-ink-soft">
                  Name
                </label>
                <input
                  required
                  autoFocus
                  placeholder="Azure Bloom Vase"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-ink/25 bg-white px-3 py-2.5 text-sm outline-none focus:border-brass"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-xs uppercase tracking-wide text-ink-soft">
                  Description
                </label>
                <textarea
                  placeholder="A few words about this piece"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-ink/25 bg-white px-3 py-2.5 text-sm outline-none focus:border-brass"
                />
              </div>

              <div className="flex gap-3">
                <div className="w-1/2">
                  <label className="mb-1.5 block font-mono text-xs uppercase tracking-wide text-ink-soft">
                    Price ($)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full rounded-lg border border-ink/25 bg-white px-3 py-2.5 text-sm outline-none focus:border-brass"
                  />
                </div>
                <div className="w-1/2">
                  <label className="mb-1.5 block font-mono text-xs uppercase tracking-wide text-ink-soft">
                    Stock
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.stock_quantity}
                    onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                    className="w-full rounded-lg border border-ink/25 bg-white px-3 py-2.5 text-sm outline-none focus:border-brass"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-xs uppercase tracking-wide text-ink-soft">
                  Image URL
                </label>
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-parchment ring-1 ring-ink/10">
                    {form.image_url ? (
                      <img
                        src={form.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = getImageFallbackDataUri();
                        }}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-ink-soft">
                        <Ico name="box" className="h-5 w-5" />
                      </span>
                    )}
                  </div>
                  <input
                    required
                    type="url"
                    placeholder="https://…"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    className="w-full rounded-lg border border-ink/25 bg-white px-3 py-2.5 text-sm outline-none focus:border-brass"
                  />
                </div>
              </div>

              {formError && <p className="text-xs text-clay">{formError}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeProductModal}
                  className="flex-1 rounded-lg border border-ink/20 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-ink/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-maroon py-2.5 text-sm font-medium text-white transition-colors hover:bg-crimson disabled:opacity-50"
                >
                  {submitting
                    ? editingId
                      ? "Saving…"
                      : "Adding…"
                    : editingId
                    ? "Save changes"
                    : "Add product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Small row used in the Dashboard stock snapshot.
function SnapshotRow({ label, value, tone }) {
  const dot = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    ink: "bg-ink/30",
  }[tone];
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-ink">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="font-mono text-sm text-ink">{value}</span>
    </div>
  );
}