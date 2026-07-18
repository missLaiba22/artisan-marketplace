# Kiln & Thread — Frontend

React + Vite + Tailwind v4 frontend for the Artisan Marketplace API.

## Setup

```bash
npm install
```

`.env` already points to `VITE_API_URL=http://localhost:8000` — change it if your
FastAPI backend runs elsewhere.

## Run

```bash
npm run dev
```

Make sure your FastAPI backend (`uvicorn app.main:app --reload`) and Postgres
are running first — the app calls it directly, there's no mock data.

## What's built (Day 1 slice)

- **Auth**: register (role toggle, conditional shop_name), login, JWT in
  localStorage, `/auth/me` hydration on load, auto-logout on 401
- **Products**: public browse grid (`/`), product detail + add-to-cart
- **Cart**: client-side cart (localStorage), checkout → hits `/orders/checkout`
- **Order confirmation**: renders the checkout split into per-artisan orders —
  this is the screen that proves the backend's multi-vendor order-splitting
  logic actually works end-to-end
- **Artisan dashboard**: list own products (incl. inactive), create product
  form, soft-delete ("Remove"); shows a pending-approval message if the
  artisan's shop isn't approved yet (backend 403)

## Deliberately cut for now (fast follow)

- Product edit UI (backend `PATCH /products/{id}` exists, no form for it yet)
- Admin approval panel (`GET /artisans/pending`, `PATCH /artisans/{id}/approve`)
- Order history for customers
- Any polish beyond the base design pass

## Structure

```
src/
  api/         # axios calls, one file per backend module
  context/     # AuthContext (user + token), CartContext (cart state)
  routes/      # ProtectedRoute (auth + role gate)
  components/  # Navbar, ProductCard
  pages/       # one file per route
```

## Notes on decisions

- **JWT in localStorage**, not in-memory: chosen deliberately over
  session-only auth since there's no refresh-token flow yet — trades some
  XSS surface for not logging out on every page refresh. Revisit when
  refresh tokens land (V2).
- **Cart is entirely client-side** (localStorage), never trusted for price —
  the backend re-locks and re-validates stock/price at checkout time
  (`get_by_id_for_update`), so a stale cart just surfaces as a checkout error,
  not a security issue.
