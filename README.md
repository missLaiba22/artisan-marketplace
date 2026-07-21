<div align="center">

# 🏺 Karigar
### A Multi-Vendor Artisan Marketplace

*Handmade goods, direct from the maker — built as a production-grade portfolio system.*

`FastAPI` · `PostgreSQL` · `SQLAlchemy` · `React` · `JWT`

</div>

---

## What This Is

A modular-monolith marketplace backend where independent artisans list products and customers checkout across multiple shops in a single cart — split cleanly into per-artisan orders under one payment event.

Built to demonstrate **engineering judgment**, not just working code: every non-trivial decision is documented in [`DECISIONS.md`](./DECISIONS.md).

## Architecture

```
router → service → repository → database
```

- **Vertical slices** — `auth`, `artisans`, `products`, `orders`, each self-contained
- **Unit of Work** — repositories `flush()`, services own the single `commit()`
- **Role-based access** — JWT identity + fresh-from-DB business-state checks (e.g. artisan approval)
- **Money as `Numeric(10,2)`** — never float, anywhere currency is involved
- **Soft deletes** — products stay queryable for historical order integrity

## Core Modules

| Module | Responsibility |
|---|---|
| `auth` | Registration, login, JWT issuance, role gating |
| `artisans` | Shop profiles, admin approval workflow |
| `products` | Listings, ownership, stock |
| `orders` | Multi-vendor checkout, price snapshotting, locked-inventory concurrency |

## Getting Started
**Deployed link**

**Backend**
```bash
cd backend
docker compose up -d          # Postgres
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```
API docs → `http://localhost:8000/docs`

**Frontend**
```bash
cd frontend
npm install
npm run dev
```
→ `http://localhost:5173`

## Why It's Interesting

- Multi-artisan checkout with `SELECT ... FOR UPDATE` locking to prevent overselling
- Order-time snapshotting (`product_name`, `unit_price`) so receipts never drift from live catalog data
- Clear separation between *authentication* (auth) and *authorization* (artisans, per-module ownership)

Full rationale for every trade-off lives in [`DECISIONS.md`](./DECISIONS.md).

---

<div align="center">

*A portfolio project — built to be read as carefully as it was written.*

</div>
