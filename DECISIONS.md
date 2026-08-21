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

---

## Auth Module — Google OAuth

### Identity storage: separate `OAuthAccount` table, not fields on `User`
Rejected alternative: add `oauth_provider` / `oauth_provider_id` columns directly
to `User`. Rejected because `User` should stay focused on identity/role data,
and a column-per-provider approach doesn't scale — adding a second provider
(GitHub, Apple, etc.) later would mean either more nullable columns on `User`
or a schema change. A separate `OAuthAccount` table with `(provider,
provider_user_id)` supports any number of linked identities per user without
touching `User` again. Same reasoning as why `require_approved_artisan` lives
in `artisans/`, not `auth/` — a table should own the data it's actually about.

`OAuthAccount` has a unique constraint on `(provider, provider_user_id)` —
this specific Google account can only ever be linked to one of our users,
preventing an accidental duplicate-account bug where the same Google identity
somehow attaches to two local users.

### `User.password_hash` made nullable
A user who signs up purely through Google never sets a local password.
Two options were considered: (1) make `password_hash` nullable and treat
`NULL` as "no local password — this account can only log in via a linked
OAuthAccount," or (2) generate a random, unusable password hash just to
satisfy a `NOT NULL` constraint. Rejected (2): storing a fake hash for a
password that doesn't exist is a workaround masquerading as data, and creates
risk if a future "reset password" flow ever touched it — a Google-only user
could end up with a real, guessable local password by accident. Chose (1) —
`NULL` honestly represents the actual state of the account. `AuthService.login()`
explicitly checks `password_hash is None` before calling `verify_password()`,
returning the same generic "Invalid credentials" 401 as any other failed
login — this avoids both a `TypeError` from passing `None` into passlib and
avoids leaking "this email is Google-only" as a distinct error message
(same account-enumeration-prevention principle as `forgot_password` always
returning 202).

### Account linking: three-step resolution, checked in order
Implemented in `OAuthService.login_or_register()`:
1. **Known Google identity** — `OAuthAccount` already exists for this
   `(provider, provider_user_id)` → fetch that user, done. Fastest path,
   no email lookup needed.
2. **Existing local account, same email** — no `OAuthAccount` yet, but a
   `User` with this email already exists (they registered the normal way
   first) → link by creating an `OAuthAccount` row pointing at that
   existing `User`, don't create a duplicate. Preserves their order
   history, artisan shop, everything — they now have two ways to log into
   the *same* identity.
3. **Neither exists** — brand new person → create both `User` and
   `OAuthAccount` together.

Each step is only checked if the previous one didn't resolve, because they
answer genuinely different questions (identity vs. email match vs. neither).

### Auto-linking by email is safe here specifically because Google verifies email ownership
Step 2 above trusts an email match enough to attach a new login method to an
existing account with zero extra confirmation step. This is only safe because
Google has already verified the person controls that email address before
issuing any tokens — so "the email matches" is equivalent to "this is
provably the same person." This assumption does NOT automatically transfer
to every OAuth provider — some providers don't verify email ownership before
authenticating a user. If a second provider is ever added, this exact
shortcut needs to be re-justified against that provider's actual guarantees,
not copy-pasted.

### New Google artisan signups: role assigned immediately, profile completed after (superseded — see update below)
~~New Google signups always start as `role = CUSTOMER`. Becoming an artisan
still requires the full `/register` form with a shop name.~~ **Superseded.**
Initial V1 shipped Google auth as customer-only, with artisan-via-Google
logged as a deliberate scope cut. Implemented shortly after: Google's
identity token still only provides email, name, and a stable user ID — it
has no way to supply `shop_name` — so a single-step "Google signup ->
artisan with a complete profile" was never possible. What changed is *when*
`shop_name` gets collected, not whether it's required.

**New flow:** the signup screen's role toggle (customer/artisan) is passed
to `/auth/google/login?intent=...` and round-tripped through the OAuth
session cookie. For a brand-new person choosing "artisan," the `User` row
is created immediately with `role=ARTISAN`, but — critically — with **no**
`Artisan` profile row yet, since `shop_name` isn't known. The backend
redirects to a dedicated `/complete-artisan-profile` step instead of the
normal callback; only after that form submits does the `Artisan` row get
created (`is_approved=False`, same as any new artisan). `POST
/artisans/complete-profile` is idempotent — a double-submit just returns
the existing profile rather than erroring, since a profile-completion form
is exactly the kind of place a duplicate click is likely.

Admin remains fully blocked from Google signup regardless of `intent` —
`OAuthService` only ever assigns `CUSTOMER` or `ARTISAN`, never `ADMIN`,
mirroring `AuthService.register`'s existing rejection of self-registered
admins.

**Existing accounts are still never upgraded by `intent`** — Steps 1 and 2
of `login_or_register` (known Google identity, or email match to an
existing local account) ignore `intent` completely. A customer clicking
an "artisan" Google button on the signup page while already having an
account does NOT get promoted to artisan; they just log into their
existing customer account as normal. This is a deliberate security
boundary: `intent` can only ever apply to accounts that don't exist yet,
never used to escalate one that already does. Becoming an artisan from an
existing account remains a separate, explicit action outside this flow —
not addressed here, and would need its own dedicated feature if wanted
later.

### CSRF protection: Authlib's `state` parameter via session cookie
The OAuth flow requires a `state` value to be generated before redirecting
to Google and verified when Google redirects back — this is what stops a
forged callback request (e.g. an attacker crafting a fake `/auth/google/callback`
link with their own authorization code) from being silently accepted.
Authlib generates and checks this automatically, but needs somewhere to
store the pending `state` between the two requests — Starlette's
`SessionMiddleware` (backed by `itsdangerous` for cookie signing) provides
that. Reuses `jwt_secret` as the session signing key rather than introducing
a second secret to manage, since this cookie only ever holds a short-lived,
low-sensitivity state token — never user data.

### Token handoff to frontend: URL fragment, not query param
After a successful Google login, the backend redirects to
`{FRONTEND_URL}/oauth-callback#access_token=...` — using `#` (URL fragment)
rather than `?` (query param) deliberately. Fragments are never sent to any
server in subsequent requests and never appear in server access logs,
because browsers strip them before sending a request — unlike query params,
which travel with the request and get logged everywhere the request touches
(Render logs, any proxy, etc.). The frontend's `/oauth-callback` page reads
`window.location.hash` client-side only, stores the token exactly like a
normal password-login response, then discards it from the URL via
`navigate(..., { replace: true })`.

### Authorization code exchange stays entirely server-to-server
The `code` Google returns to `/auth/google/callback` is a single-use,
short-lived voucher — not identity data itself. The actual exchange (POSTing
that code + `client_secret` to Google's token endpoint, receiving back a
verified `id_token`) happens inside `oauth.google.authorize_access_token()`
on the backend, never in the browser. This is the core security property of
the "authorization code" grant type: `client_secret` never touches the
browser, unlike the older implicit-grant flow where tokens were issued
directly to client-side JS. `id_token` verification (signature, `sub`,
`email`, `email_verified`) is handled by Authlib against Google's published
JWKS — not re-implemented by hand.

### Development gotcha: local vs. production `DATABASE_URL` (process note)
Mid-implementation, `alembic upgrade head` and manual testing were run
successfully — but a `psql` session opened against the local Docker
container showed the migration hadn't applied and `oauth_accounts` didn't
exist. Root cause: `.env`'s `DATABASE_URL` was still pointed at the Render
production Postgres instance from earlier deployment work, not local Docker
— so every migration and every test login had actually been running against
production the whole time, not localhost. Nothing broke (migrations were
correct), but this could easily have gone the other way. Fixed by switching
`DATABASE_URL` back to the local `postgresql://postgres:postgres@localhost:5432/marketplace`
line for day-to-day development, keeping the Render line commented out
alongside it for when a real deploy is needed. Lesson, consistent with the
CORS gotcha above: always verify which database a command is actually
touching before trusting its output — a successful migration log doesn't
tell you *which* database received it.

---

## Orders Module — Stripe Payment Integration

### Payment moved from mock to real: Stripe Checkout (hosted page)
Replaced the old "always succeeds instantly" mock payment with a real Stripe
Checkout Session. Chose Stripe's hosted checkout page over building a custom
card form (Payment Intents + Elements) — less surface area to secure, no
custom card UI to build/maintain, and it still teaches the real concepts
that matter (webhooks, async state, idempotency) without the extra scope of
handling raw card data ourselves.

### Stock reservation timing: at session creation, not at webhook confirmation
`create_order()` still locks products, validates stock, and decrements
`stock_quantity` in the same step it always did — this now happens BEFORE
the Stripe session is even created, not after payment confirms. Trade-off,
chosen deliberately: this can strand inventory if a customer opens checkout
and never pays (stock stays reserved until the session expires). Rejected
alternative: reserve stock only after `checkout.session.completed` fires —
rejected because that reopens the exact oversell race `SELECT ... FOR UPDATE`
was built to prevent (two customers could both pass a "is there stock"
check while neither has actually paid yet). Preventing oversell was judged
more important than avoiding temporarily stranded inventory.

### Abandoned checkouts: released via `checkout.session.expired` webhook
Stripe sessions are given a 30-minute expiry (`stripe_session_expires_minutes`
in config). If a customer never pays, Stripe fires `checkout.session.expired`,
and `mark_checkout_expired()` restores the reserved stock and marks the
`Order` rows `CANCELLED`. This is what stops the stock-reservation trade-off
above from becoming a real problem — reserved stock isn't stuck forever,
just for a bounded window.

### Payment status vs. fulfillment status — same separation as before, reapplied
`Checkout.payment_status` (`PENDING → PAID` or `PENDING → EXPIRED`) is still
the only source of truth for "did this get paid." `Order.status` still only
tracks fulfillment and is untouched by any of this Stripe work (stays
`PENDING` until an artisan ships it — `CANCELLED` is the one new case, set
only when a checkout expires unpaid). Nothing here changes that boundary,
just gives `payment_status` a third real state (`EXPIRED`) to move into.

### Artisans only see PAID orders — enforced with a JOIN, not app-code filtering
`OrderRepository.list_by_artisan` joins `Order` to `Checkout` and filters on
`Checkout.payment_status == PAID` directly in the query. An artisan's
dashboard will never show an order from a checkout that's still pending or
that expired unpaid — even though the `Order` row exists in the DB the
moment checkout starts (stock is already reserved at that point). This
means "does this order exist" and "can the artisan see it" are genuinely
different questions with different answers for a short window — intentional,
not a bug.

### Postgres enum values cannot be autogenerated OR reversed (new gotcha, related to the orderstatus one)
Adding `EXPIRED` to the existing `PaymentStatus` enum hit a DIFFERENT
Alembic limitation than the `orderstatus` CREATE TYPE issue from Day 4:
`alembic revision --autogenerate` detects new *columns* fine, but does NOT
detect new *values* added to an existing enum type at all — the generated
migration silently omitted the enum change entirely, no error, no warning.
Fix: manually added `op.execute("ALTER TYPE paymentstatus ADD VALUE 'EXPIRED'")`
to `upgrade()`. Worse problem, no fix available: Postgres has no
`ALTER TYPE ... DROP VALUE` — once an enum value exists, it exists forever.
`downgrade()` for this migration cannot actually reverse the enum addition;
it's left as a structural impossibility, not an oversight. Lesson: always
read the generated migration file, every time — this is the second time
autogenerate has silently failed to do the thing it was asked to do.

### Webhook handler: unknown session_id logs a warning, doesn't crash or stay silent
`mark_checkout_paid` / `mark_checkout_expired` both return quietly (no
exception) when a webhook's `stripe_session_id` doesn't match any `Checkout`
row — this has to be true, since a raised exception would make Stripe retry
the same event forever. First version of this code returned SILENTLY, which
is a real bug: if `stripe_session_id` ever failed to save correctly at
checkout time (e.g. a commit failure), a customer could pay for real, Stripe
would confirm it, and the system would just... do nothing, with zero signal
anywhere that a payment got lost. Fixed by adding `logger.warning(...)`
before the early return — still doesn't crash or retry-loop, but now leaves
a trace. Caught this by testing with `stripe trigger`, which fires a
synthetic event with a session_id that deliberately doesn't match anything
in the DB — the exact scenario a "shouldn't happen" comment was protecting
against, made real in five seconds by testing it on purpose.

### Local dev requires THREE processes running at once, not two
`uvicorn` (API) and `npm run dev` (frontend) alone are not enough to test
payment locally — `stripe listen --forward-to localhost:8000/webhooks/stripe`
also has to be running, or webhooks never reach the server and
`payment_status` stays stuck at `PENDING` forever even after a real,
successful payment. This isn't a bug when it happens — it's the correct,
expected result of no webhook ever arriving. Confirmed this directly:
paid successfully with `stripe listen` NOT running, checkout stayed
`PENDING` indefinitely; re-ran the same flow with `stripe listen` running,
it flipped to `PAID` within seconds. In production, this requirement goes
away — Stripe delivers webhooks straight to the deployed Render URL,
configured once in the Stripe Dashboard, no local forwarder needed.

### `payment_reference` reused for the Stripe session ID
The old mock flow set `payment_reference = f"MOCK-{checkout.id}"`. The new
Stripe flow initially left this field unset (`null`) since only
`stripe_session_id` felt like the "real" field to populate. Reversed this —
set `payment_reference = session.id` too, same value as `stripe_session_id`,
kept as a separate column rather than reusing one field for two purposes.
Reasoning: `payment_reference` is the human/support-facing field (shown on
receipts, searchable), while `stripe_session_id` is the field the webhook
handler queries by by. If the payment gateway ever changed in the future,
`stripe_session_id` might get renamed or dropped, but `payment_reference`
as a concept ("some reference to look this payment up by") should survive
that change — so it stays a separate field even though it currently holds
the identical value.

## Promotions Module

### Ownership: per-artisan, globally unique codes
Considered per-artisan-unique codes (`UniqueConstraint(artisan_id, code)`) but rejected —
checkout has a single flat promo-code text field with no "which shop" context, so two
artisans both owning `SUMMER20` would make the code ambiguous to resolve at redemption
time. Global uniqueness means artisans share one namespace and could theoretically
collide on a desired code — accepted as a UI/convention problem (suggest shop-prefixed
codes), not a schema problem, given current marketplace scale.

### Explicit product targeting via `PromotionProduct`, not artisan-wide
A promo applies only to products the artisan explicitly selects, not "everything I sell."
Many-to-many join table (`PromotionProduct`) rather than a denormalized product list,
consistent with how relational associations are modeled everywhere else in this project.
At checkout, a promo's effect is computed as the intersection of `eligible_product_ids`
and the cart's product IDs — a code with zero overlap is a 400, not a silent no-op,
since silently ignoring a code a customer explicitly typed in would look like a bug.

### Reservation ledger (`PromotionRedemption`), not a plain counter — same pattern reused across two domains now
Second time this project has needed "track a limited resource across an async, possibly-
abandoned payment lifecycle" — first was product stock (`stock_quantity`, decremented at
session creation, restored on `checkout.session.expired`). A plain `Promotion.times_used`
counter, incremented at checkout-creation time, would have the identical flaw the original
mock-payment version of stock had: an abandoned Stripe session permanently burns a
redemption slot on a code nobody actually used.

Fix: `PromotionRedemption` mirrors the stock pattern exactly — one row per checkout,
status lifecycle `RESERVED → CONFIRMED` (on `checkout.session.completed`) or
`RESERVED → RELEASED` (on `checkout.session.expired`). Capacity checks
(`count_active_redemptions`) count `RESERVED + CONFIRMED` rows, under a lock on the
`Promotion` row — never read `times_used` for this. `times_used` is demoted to a
display-only cache, updated only on confirm. This is the generalized version of the
stock-reservation principle: **any capped resource touched by an async payment flow
needs a reservation ledger with an explicit release path, not a single mutable counter.**

### FIXED discount: total off eligible subtotal, not per-unit
Initial design applied a FIXED discount independently to every unit of every eligible
product — a "Rs. 500 off" promo on 2 eligible products with 3 units each would have
discounted Rs. 3000, not the Rs. 500 a customer would expect. Caught in architecture
review before implementation, not in testing.

Corrected semantics: `total_discount = min(discount_value, eligible_subtotal)`, then
allocated proportionally across eligible line items by each item's share of the eligible
subtotal. PERCENTAGE has no such problem — it's applied independently per line, no
cross-item allocation needed, which is part of why it's the simpler case.

### Proportional-split rounding: last line absorbs the remainder
Allocating a FIXED discount proportionally and rounding each line's share independently
to the nearest cent can leave the sum off by a cent or two from the true total discount
(the classic "split the bill" rounding problem). Fixed by computing every line's discount
normally except the last eligible line, which instead takes `total_discount - sum_so_far`.
Guarantees the allocated amounts always sum exactly to the intended total — no drift,
no silent under/over-discounting.

### Original price never overwritten; discount is a separate, visible field
`OrderItem.unit_price` always holds the true product price. A new nullable
`OrderItem.discounted_unit_price` holds what was actually charged, only set when a
promotion applied. Same reasoning as why `OrderItem` snapshots `product_name` — a
receipt must show the truth of what happened, not have its base facts silently rewritten
by a downstream calculation. The amount actually sent to Stripe uses the computed
`charged_total` directly (not a re-derived per-unit price), so even a non-evenly-divisible
per-unit discount can't leak money — `discounted_unit_price` is display-only math for the
receipt, never the source of the Stripe charge amount.

### Lock ordering: products, then promotion — always, everywhere
`create_order()` locks every cart product first, then optionally locks the promotion —
fixed order, never reversed, to avoid a classic lock-ordering deadlock between two
concurrent transactions. Audited every other transaction path that touches either table:
`mark_checkout_paid` never touches products; `mark_checkout_expired` touches products but
never locks the `Promotion` row itself (only `PromotionRedemption`, a different table) —
so no cross-path conflict exists beyond `create_order()`'s single, consistent ordering.

While auditing this, found a **pre-existing, promo-unrelated deadlock gap**: products were
locked in whatever order the client's request array happened to list them — two concurrent
checkouts sharing two products, submitted with the array in opposite order, could already
deadlock before promotions ever existed. Fixed opportunistically by sorting `data.items`
by `product_id` before locking, in both `create_order()` and the stock-release loop in
`mark_checkout_expired()` — establishing one canonical lock order system-wide, not just
for the new feature.

### `total_amount` computed in pure Decimal, never round-tripped through Stripe's int cents
Early draft derived `checkout.total_amount` by summing Stripe's integer-cents `unit_amount`
fields and dividing by 100 — `int / 100` in Python 3 is true division, which returns
`float`. That would have written a float into a `Numeric(10,2)` column, the exact class of
bug already forbidden project-wide. Fixed by reverting to the original pattern: compute
`total_amount` directly in Decimal, in the same pass that computes each line's
`charged_total`, and only convert to Stripe's integer-cents format as the very last step,
right before the API call — Decimal money math never touches an int/float boundary until
it has to leave the process.

### Stripe line items: one line per cart item at its full charged total, quantity fixed at 1
Rather than sending Stripe a per-unit `unit_amount` and a `quantity`, each line item sends
`quantity: 1` and the item's full `charged_total` (already correctly discounted and
rounded) as `unit_amount`. Avoids needing a discounted line total to divide evenly back
into a per-unit cents figure — the amount Stripe charges is always exactly the
already-computed, already-correct total, no secondary rounding step introduced at the
Stripe boundary.

### DB↔Stripe transaction boundary: explicit rollback, no outbox/saga needed
Traced both failure modes explicitly rather than assuming safety:
- **Stripe API call fails** → now does an explicit `self.db.rollback()` before raising
  (previously relied on `get_db()`'s implicit rollback-on-close, which worked but wasn't
  visible in the code as an intentional guarantee).
- **Stripe succeeds, then `db.commit()` fails** (rare — DB connection drop, etc.) → the
  request 500s, so the customer never receives `checkout_url` and never reaches Stripe's
  payment page. The orphaned Stripe Session simply self-expires at its configured window;
  when `checkout.session.expired` fires, `mark_checkout_expired` looks up the
  `stripe_session_id`, finds no matching row (since that transaction never committed),
  logs the existing "unknown session_id" warning, and returns cleanly. This already
  degrades gracefully with the code that already existed for a different reason — no
  outbox pattern, no two-phase commit, no additional infrastructure needed at this scale.

### Migration enum values must match Python enum **names**, not `.value`s (real bug, hit and fixed)
SQLAlchemy's `Enum(SomeEnum)` column type sends the Python enum member's **name** to
Postgres by default, not its `.value` — e.g. `DiscountType.PERCENTAGE` sends the string
`"PERCENTAGE"`, not `"percentage"`. The first version of this migration defined the
Postgres enum type using lowercase `.value` strings (`'percentage', 'fixed'`), which
doesn't match what SQLAlchemy actually sends — every insert failed with
`invalid input value for enum discounttype: "PERCENTAGE"`.

This turned out to be a pre-existing project convention I broke, not a new decision: every
other enum in this codebase (`userrole`, `orderstatus`, `paymentstatus`) already stores
member **names** in Postgres (`sa.Enum('CUSTOMER', 'ARTISAN', 'ADMIN', name='userrole')`).
Fixed by matching that existing pattern — migration now defines `discounttype` and
`redemptionstatus` using uppercase names. Lesson: when adding a new enum, check how
existing enums in the same codebase are stored before assuming `.value` is what gets
persisted — SQLAlchemy's default behavior here is easy to get wrong silently until an
actual insert fails.

### Scoped out of this pass (explicit deferrals)
- No "preview discount before checkout" endpoint — would require a new validate-only
  route just to show a number the server recomputes seconds later anyway at real checkout.
  The cart shows the pre-discount total; the true, discounted total appears on
  `OrderConfirmation` once the server has actually applied it.
- No per-customer redemption limit — `PromotionRedemption.customer_id` exists (nullable,
  unenforced) specifically so this is a future WHERE-clause addition, not a migration,
  the same forward-compatible-column pattern already used for `Product.image_url`'s V1→V2
  path.
- No artisan-facing deactivate/delete UI for promo codes yet — create + list only.
- Invalid promo code fails checkout entirely (400, cart preserved) rather than silently
  dropping the code and proceeding at full price — chosen because a silent drop could
  read as "the code should have worked," with no visible explanation to the customer.