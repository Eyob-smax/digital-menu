# Digital Menu

A mobile-first restaurant menu with two modes, an admin back office, a live
staff order screen, and offline support for customers.

---

## Getting it running

You need a Neon Postgres project. If one is already linked (a `.neon` file
and a `.env.local` are present), it is just:

```bash
npm install
npm run dev
```

Otherwise follow "Setting it up from scratch" below first.

Open http://localhost:3000 for the menu, and http://localhost:3000/admin to
sign in.

**Seeded admin:** `admin@restaurant.local` / `changeme123` —
change this before anyone else can reach the app.

### Setting it up from scratch

```bash
npm i -g neon@latest && neon login
neon skills -y
neon mcp -y --oauth
neon link --project-id <your-project-id> --branch production -y   # writes .env.local + .neon
neon config init
neon deploy

npm run db:migrate   # create the 14 tables
npm run db:seed      # first admin + sample menu + 6 tables
```

`neon link` pulls `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `NEON_BRANCH`
into `.env.local` and leaves your other variables alone. You still need to set
`BETTER_AUTH_SECRET` yourself (`openssl rand -base64 32`).

### If the database is unreachable on your network

Neon's pooled hostname (`...-pooler...`) resolves to **IPv6-only** addresses in
some regions. On a network without IPv6 routing, every query fails with an
opaque `fetch failed` while the Neon console works fine.

This project handles that: set `DATABASE_URL_UNPOOLED_ONLY=1` in `.env.local`
and it uses the direct endpoint instead. It is set on this machine for exactly
that reason. Remove it when deploying to a dual-stack host so you get
connection pooling.

---

## The two modes

The admin flips one switch on `/admin`, and it changes what customers can do.

**Display only** — customers browse, save favourites, and see their own order
history. They tell a server what they'd like. Nothing is ordered from the app.

**Ordering** — everything above, plus a cart. Customers order from their phone
and the order appears on `/staff` with the table number, where staff move it
through New → Cooking → Ready → Served.

There is also a *pause* switch inside Ordering mode, for when the kitchen needs
to catch up without taking the menu down.

---

## Offline behaviour

The requirement was that the app keeps working after one online visit. It does,
in three layers:

1. **The app shell** is precached by a service worker (`public/sw.js`), so the
   page opens with no network at all.
2. **The menu** lives in IndexedDB. The app renders from that cache first and
   treats the network as an upgrade. Each menu change bumps a version number,
   so a returning phone asks "anything new?" and usually gets a tiny "no"
   instead of the whole menu again.
3. **Actions taken offline** — favouriting a dish, or placing an order — go
   into an outbox and are sent when the connection returns. Every queued write
   carries a client-generated UUID, and the server ignores a repeat of one it
   has already seen, so a retry can never double-send an order.

An order placed offline says so plainly — *"Saved — not sent yet"* — rather
than implying the kitchen has it. A customer who thinks food is coming when it
isn't will sit there hungry.

---

## Layout

```
app/
  page.tsx              menu (mode-aware)
  cart/ favorites/ history/
  t/[slug]/             QR entry — binds a table to the device
  staff/                live order queue
  admin/                dashboard, menu, analytics, tables, settings
  api/                  menu, settings, orders, favorites, history, auth
components/
  customer/ staff/ admin/     screens
  menu-provider.tsx           cache-first client state
  ui.tsx                      shared primitives
lib/
  money.ts              integer-cent arithmetic (never floats)
  offline-store.ts      IndexedDB: menu, favourites, cart, outbox
  sync.ts               pull menu/favourites/history, drain the outbox
  orders.ts             order placement + status transitions
  queries.ts            server-side reads
  auth.ts / guard.ts    Better Auth + role checks
db/schema/              Drizzle tables
proxy.ts                route guard (Next 16 renamed middleware → proxy)
docs/ARCHITECTURE.md    why things are built the way they are
```

---

## Decisions worth knowing

**Prices are never trusted from the client.** An order arrives as item ids and
quantities; the server re-reads every price from the database. A stale offline
cart cannot charge last week's price, and a tampered payload cannot charge
zero.

**Money is integer cents, never floats.** `0.1 + 0.2` is not `0.3`, and a menu
that loses a cent per line is a bug you only find when the till is short.

**Removing an item archives it.** Past orders, customer history and popularity
stats keep working. Nothing about last month's receipts changes because a dish
was taken off today.

**Order names and prices are snapshotted.** A customer's history still reads
"Doro Wat — 320.00 ETB" a year later, even if the dish was renamed or repriced.

**Popularity counts on *served*, not *placed*.** A cancelled order doesn't
inflate the "most ordered" list.

**The staff screen polls every 3 seconds** rather than holding a socket open.
A three-second delay is invisible in a restaurant, and polling survives flaky
wifi, sleeping tablets and serverless hosting without extra infrastructure.

**`proxy.ts` is an optimistic filter, not the security boundary.** It checks
for a session cookie to keep signed-out users off staff screens. Every
protected page, route handler and Server Action re-verifies the real session
and role on the server, because a cookie can be forged and a verified session
cannot.

---

## Scripts

```bash
npm run dev          # development server
npm run build        # production build
npm run db:generate  # generate a migration after changing db/schema
npm run db:migrate   # apply migrations
npm run db:studio    # browse the database
npm run db:seed      # sample data + first admin
```

---

## Notes and caveats

- **Table QR codes** are rendered by `api.qrserver.com`, which means each table's
  URL is sent to that third party when the admin views the Tables page. The URLs
  aren't secret, but if you'd rather not, swap in a local QR library — the
  change is confined to `components/admin/tables-manager.tsx`.
- **Item images** are URLs you paste in; there is no upload/storage pipeline.
- **The app icons** in `public/` are generated placeholders. Replace them with
  real branding before launch.
- `npm audit` reports a moderate advisory in `drizzle-kit`'s bundled esbuild.
  It affects the local dev server only, never production, and the suggested
  "fix" downgrades drizzle-kit to a 2023 release incompatible with this schema.
- **Customer accounts** are anonymous device ids. The schema has a
  `device_links` table so a device can later be claimed by a real account and
  carry its history across phones; the claim UI itself isn't built yet.
