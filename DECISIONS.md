# Architecture Decisions — Multi-Vendor Artisan Marketplace

Living document. Append to this every time a real design decision gets made —
don't wait until end of session. Format: decision → why → what it prevents/enables.
This doubles as interview prep material: it's the "why," not just the "what."

---

## Cross-Cutting Patterns (apply to every module)

### Repository = data access only, never authorization
Repositories only know how to read/write rows. They never check "is this
allowed" — that's the job of dependencies (route-level) and services
(business-rule level). Reason: if authorization logic existed in two places
(dependency AND repository), a future disagreement between them is a bug
with no clear owner. One layer decides; the rest execute.

### Client-submitted IDs are never trusted for identity/ownership
Any field that determines "who is this action performed as" (e.g. `artisan_id`
on a create request) must come from the authenticated session (JWT → dependency
→ `current_user.id` / `artisan.id`), never from the request body. If a client
could type in someone else's ID, they could impersonate/spoof actions as
another user. This is the same category of principle as never trusting user
input for anything that determines authorization or access scope.

### 403 vs 404: only hide existence when existence itself is sensitive
Default to 403 ("exists, but not yours") for ownership failures. Only use 404
to hide a resource's existence when that existence is itself sensitive
(private data, another user's private account). Products/artisans are public
by design — nothing is protected by pretending they don't exist, so 403 is
strictly more honest with zero downside.

### Partial updates require `exclude_unset=True`
Any PATCH schema with all-optional fields needs `data.model_dump(exclude_unset=True)`
before applying updates. Without it, fields the client didn't send get
silently overwritten with `None`. Classic PATCH bug — easy to miss, easy to
ship.

### Module boundary ownership
A dependency/check lives in the module that OWNS the data it inspects, not
the module that happens to consume it. E.g. `require_approved_artisan` lives
in `artisans/dependencies.py`, not `auth/dependencies.py`, because `auth`
should only ever know about identity/roles — the moment it needs to know
`is_approved` exists, that's a boundary violation.

### Transaction ownership: repositories flush, services commit
Repositories call `.flush()` only (sends SQL, keeps transaction open).
Services own the single `.commit()` per unit of work. This is what makes
cross-module atomic operations (e.g. user + artisan profile created together)
actually atomic — one failure rolls back both.

---

## Auth Module

### JWT payload scoping: role in JWT, approval status NOT in JWT
Role is stable identity data — safe to bake into a signed token. Approval
status is mutable business state that can change at any time (admin action).
If it were in the JWT, a revoked/pending artisan could keep acting as
approved until their token expired. So approval is always queried fresh
from the DB on every request via `require_approved_artisan`.

### Money fields: Numeric, never float (applies project-wide, first enforced here conceptually)
Float uses IEEE 754 binary floating point — cannot represent most decimal
fractions exactly. For currency this isn't a style choice, it's a
correctness bug waiting to surface in checkout math. `Numeric(10,2)` is
non-negotiable for any price/money field.

---

## Artisans Module

### `require_approved_artisan` composes `require_role`, doesn't duplicate it
Chains three independently-owned checks: authentication (JWT valid?) →
role authorization (`require_role(ARTISAN)`) → business-state authorization
(is_approved?). Each layer fails fast before the next runs. Returns the
`Artisan` object (not `User`) so consumers get `artisan.id` for free without
a second query.

### Route ordering: static paths before dynamic paths
`/pending` and `/me` must be declared before `/{artisan_id}/approve` in the
router. FastAPI matches top-to-bottom; if the dynamic route came first, a
request to `/artisans/pending` would try to parse `"pending"` as a UUID and
fail with 422 instead of reaching the intended handler.

---

## Products Module

### Price: `Numeric(10,2)`, not float
Same reasoning as above — prevents rounding errors from corrupting order
totals once orders reference product prices.

### Ownership FK: `Product.artisan_id → artisans.id`, not `users.id`
Artisan (not User) is the business identity that owns approval state and
shop context. `require_approved_artisan` already returns the `Artisan`
object with `.id` available — using this FK avoids a redundant join on the
most common path (create/list products by shop).

### Delete strategy: soft delete via `is_active` boolean
Hard delete would orphan/break order history once the orders module
references products by FK. Soft delete keeps the row alive forever;
listings just filter it out. Cost: every "list" query must remember the
`is_active` filter — but that's a much smaller risk than broken referential
integrity in order history.

### `list_products` filters `is_active=true`; `get_by_id` does NOT filter
Two different audiences for the same underlying data:
- Public browsing → should never show removed listings → filtered.
- A direct/historical link (e.g. a customer's old order confirmation
  pointing at `/products/{id}`) → should still resolve, even for a product
  the artisan later deleted → unfiltered.
Conflating these into one rule would break one of the two use cases.

### Ownership-check failure returns 403, not 404
Products are already public (`GET /products/{id}` works for anyone).
Nothing is protected by pretending a product doesn't exist when an artisan
tries to edit someone else's listing — 403 tells the truth for free.

### Ownership check implementation: fetch-then-compare, not filtered query
```python
product = repo.get_by_id(product_id)
if product.artisan_id != current_artisan.id:
    raise HTTPException(403)
```
Chosen over a single filtered query (`get_by_id_and_artisan`) because the
filtered-query approach collapses "doesn't exist" and "exists but isn't
yours" into the same `None` result — losing the 403-vs-404 distinction
without a second query anyway. Fetch-then-compare costs one extra indexed
PK lookup, which is irrelevant at this scale.

### `image_url` required at creation, not optional
For a marketplace built around visual craftsmanship, a listing with no
photo is close to unsellable — different from `description` being optional,
which is a minor UX gap rather than a core value-prop gap. Required at
creation forces good data into the system from day one rather than
patching "no image" edge cases into every frontend view later.

### Image storage: URL field now (V1), real upload deferred (V2)
`image_url: str` stores a link; backend never touches image bytes.
V1: artisan pastes a URL (external host / stock photo for demo purposes).
V2 (deferred): client uploads bytes → API → object storage (S3/R2) → API
stores the resulting URL in the exact same column. The schema doesn't
change between V1 and V2 — only how the URL gets populated — so this
isn't throwaway work, it's forward-compatible with the real version.
`HttpUrl` (Pydantic) used on input schemas for cheap format validation;
does not verify the URL is a real image or that it resolves.

### Empty migration gotcha (process note, not architecture)
`alembic revision --autogenerate` diffs the model file **as saved on disk**,
not "as discussed." An empty upgrade/downgrade (`pass`/`pass`) means the
model change wasn't actually saved before running the command. Always
regenerate after confirming the file is saved, and always read the
generated migration before running `upgrade head` — especially checking
whether new `NOT NULL` columns need a default (they'll fail against any
existing rows if not).

---

## Orders Module

### Data shape: Checkout (1) → Order (N, per artisan) → OrderItem (N, per product line)
A customer's cart can span multiple artisans, but each artisan must only
see and manage their own slice. One `Checkout` row represents the whole
purchase event; one `Order` row is created per distinct `artisan_id` in
the cart; `OrderItem` rows hold individual product lines under each Order.
Rejected alternative: single `Order` row with a JSON blob of all items
across artisans — breaks the moment two artisans need to update their own
fulfillment status independently without touching each other's data, and
loses relational query power (no clean "list all my orders" per artisan).

### Grouping mechanism: `Order.checkout_id` FK, not a loose repeated UUID
Originally considered a plain `checkout_reference` UUID column repeated
across sibling `Order` rows with no parent table. Reversed this once
payment entered scope — payment happens once per checkout (one gateway
charge), not once per artisan sub-order, so there had to be a real row to
hold `payment_status`/`payment_reference`. A repeated loose UUID can't
hold data of its own; a real FK to a real `Checkout` row can. Rule that
generalizes: if you can derive every fact from the child rows, you don't
need a parent table (see products' `checkout`-less original reasoning);
the moment a fact exists that ONLY makes sense at the parent level
(payment), the parent table becomes necessary.

### Payment status lives on Checkout; fulfillment status lives on Order
Two different kinds of "status" that must never be merged into one field.
`Checkout.payment_status` (pending/paid/failed) reflects the single money
movement for the whole cart. `Order.status` (pending/shipped/delivered/
cancelled) reflects one artisan's independent fulfillment progress.
Conflating them would mean one artisan's shipping update could accidentally
read as/affect payment state, or vice versa — they change for entirely
different reasons and on different timelines.

### Snapshotting: `OrderItem` copies `product_name` + `unit_price`, not just price
Price alone isn't sufficient — if a product's `name` changes later (or the
product is soft-deleted) and OrderItem only stored a live `product_id`
reference, a historical order display could show a materially different
or missing product description than what was actually purchased. Anything
the customer needs to see accurately on a historical receipt, that could
plausibly drift on the live product, must be copied at purchase time.
`product_id` itself stays a live FK (not snapshotted as a duplicate) since
it's an identity link for "view this product" / reorder flows, not display
data — same distinction as why `description`/`image_url` aren't snapshotted.

### Atomicity: one service method, one `db.commit()`, no manual rollback
Checkout is actually ~9 steps (lock products, validate stock, compute
total, create Checkout, group by artisan, create Orders + OrderItems,
decrement stock, mark paid). All of it lives inside `OrderService.
create_order()`, all repos only `.flush()`, and a single `db.commit()`
sits at the very end. If any step raises before that line, nothing
persists — this is the existing "repos flush, services commit" rule
doing real work under a genuinely multi-step operation for the first
time, not new code.

### Concurrency: `SELECT ... FOR UPDATE`, and lock BEFORE validating stock
Two customers checking out the last unit of the same product
simultaneously can both read `stock_quantity=1`, both pass validation,
both decrement — a classic TOCTOU (time-of-check-to-time-of-use) race
that oversells inventory. Atomicity (single commit) does NOT prevent
this, because the problem is between two separate transactions, not
within one. Fix: `ProductRepository.get_by_id_for_update()` issues a
locking read (`.with_for_update()`); `create_order()` locks every cart
product in one pass BEFORE reading/trusting any `stock_quantity` value.
Validating first and locking after would reopen the identical race in
the gap between those two steps — lock-then-validate is the only order
that actually closes it. This locking method is deliberately separate
from the normal `get_by_id()` — casual product-browsing reads must stay
non-blocking; only the checkout path needs to serialize against other
checkouts.

### Total amount computed server-side, never trusted from client
`CheckoutRequest` only accepts `product_id` + `quantity` pairs — never a
client-submitted total. `total_amount` is computed inside the service
from the (locked, fresh) product prices. Same "never trust the client for
anything that determines a financial/authorization outcome" principle
already applied to `artisan_id` on product creation — here it's price
integrity instead of identity.

### Payment: mock, always succeeds (deliberate V1 scope cut)
`checkout.payment_status` is unconditionally set to `PAID` with a fake
`payment_reference` string, inside the same transaction as everything
else — no real gateway call. This is a conscious simplification, not an
oversight: a real integration (Stripe test mode, webhooks, decline
handling) is materially more scope (async status updates, idempotency)
than a one-day module allows, and would not teach additional data-
modeling lessons beyond what's already built. The mock slots into the
exact same step (step 8 of 9) a real gateway call would occupy, without
touching stock-locking or snapshotting logic — so this isn't throwaway
work either.

### Postgres enum + `ALTER TABLE ADD COLUMN` migration gotcha (process note)
Alembic autogenerate emits `CREATE TYPE` automatically when an enum column
is part of a brand-new `CREATE TABLE` — but NOT reliably when adding an
enum column to an EXISTING table via `ALTER TABLE ADD COLUMN`. Hit this
directly: `orders.status` (added to a pre-existing `orders` table) failed
with `UndefinedObject: type "orderstatus" does not exist` because the
type was never created before the column tried to use it. Fix: explicitly
call `postgresql.ENUM(...).create(op.get_bind(), checkfirst=True)` before
the `add_column` call in the migration, and mirror it with `.drop(...)`
in `downgrade()` so re-running upgrade later doesn't hit "type already
exists" instead. Because Alembic runs migrations transactionally, the
failed attempt rolled back cleanly with no partial/broken schema left
behind — worth knowing that safety net exists, but the fix still has to
be made explicitly; autogenerate isn't fully reliable here.

### Scoped out of Day 4 (explicit deferrals, not oversights)
- Customer order-history endpoint (`GET` orders by customer) — requires
  joining through `Checkout.customer_id` since `Order` only tracks
  `artisan_id`, not the purchasing customer directly. Straightforward
  addition later; cut for time.
- `GET /orders/{order_id}` single-order detail endpoint — artisan list
  view already returns nested items, so lower priority than checkout
  creation itself.
- Real payment gateway integration (see above).

---

## Next Up — Frontend (React)

Backend V1 scope is complete as of this entry: auth, artisans, products,
orders all implemented and manually verified end-to-end, including the
multi-artisan checkout/locking/snapshotting flow. Frontend work begins
next: React + minimal Tailwind, deferred appropriately until backend
proved out.

Deployment: CORS misconfiguration debugging (process note)
A CORS_ORIGINS env var that looked correct in the dashboard still failed silently because the deployed code hadn't actually redeployed — git push succeeded, but Render's auto-deploy either lagged or wasn't triggering as expected, and the browser/curl symptoms (400 Bad Request, missing Access-Control-Allow-Origin) looked identical to an actual origin mismatch. Diagnosed by adding a temporary /debug/cors endpoint that echoed repr(settings.cors_origins) straight from the running process — the only way to get ground truth without shell access on Render's free tier. Lesson: when a config value "looks right," verify what the running process actually has loaded, not what's saved in a dashboard or committed in git — those are three different things that can silently diverge.
