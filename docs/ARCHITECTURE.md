# Digital Menu — Architecture

## 1. The two modes

The admin flips a single global switch. It changes what the customer app does.

| | `DISPLAY` mode | `ORDERING` mode |
|---|---|---|
| Customer sees | Menu, favorites, personal history | Same + cart + "Place order" |
| Ordering | Customer tells the waitress verbally | Customer submits from their phone |
| Staff screen | Idle / not used | Live order queue, polled every 3s |
| Order records | Optional: waitress can log them | Created by the customer |
| Popularity stats | From logged orders | From real orders |

The mode lives in a single-row `settings` table, exposed at `GET /api/settings`
and cached in the client. A customer whose device is offline keeps the last
known mode until they reconnect.

## 2. Roles

- **customer** — no account. Anonymous `deviceId` (UUID v4 in localStorage).
  Optionally claims an account later; the claim merges device rows into user rows.
- **waiter** — Better Auth account, role `waiter`. Access to `/staff` only.
- **admin** — Better Auth account, role `admin`. Access to `/admin` + `/staff`.

Better Auth `admin` plugin provides the role field. Middleware guards both routes.

## 3. Data model

```
settings            one row. mode, restaurantName, currency, taxRate, serviceCharge
categories          id, name, slug, sortOrder, isActive
menu_items          id, categoryId, name, description, longDescription,
                    price, imageUrl, tags[], isAvailable, isFeatured,
                    sortOrder, prepMinutes, spiceLevel, calories, updatedAt
menu_item_options   id, itemId, groupName, label, priceDelta, isDefault
                    (e.g. "Size": Small +0, Large +40)

orders              id, publicCode, tableId, deviceId, userId?, status,
                    subtotal, tax, serviceCharge, total, note,
                    placedAt, acceptedAt, readyAt, servedAt, source
order_items         id, orderId, itemId, nameSnapshot, priceSnapshot,
                    qty, selectedOptions jsonb, lineTotal
                    (snapshots so history survives menu edits)

tables              id, label, qrSlug, isActive

favorites           deviceId | userId, itemId, createdAt   (composite PK)
item_stats          itemId, orderCount, lastOrderedAt      (denormalized)
device_links        deviceId -> userId, linkedAt           (account claim)
```

Every FK is indexed. `orders(status, placedAt)` is indexed for the live queue.
`order_items(orderId)` and `order_items(itemId)` for history and stats.

### Why price/name snapshots
A customer's history must still read "Doro Wat — 320 ETB" a year later even if
the item was renamed, repriced, or deleted. Stats use `itemId`; display uses the
snapshot.

## 4. Offline strategy

The requirement: works after one online visit; syncs when data returns.

**Three layers:**

1. **App shell** — a service worker precaches the HTML/JS/CSS. The app opens
   with no network at all.

2. **Menu data** — IndexedDB holds the full menu plus a `menuVersion` integer.
   - Online: `GET /api/menu?since=<version>` → either `{ unchanged: true }`
     (cheap) or the full new menu + new version.
   - Offline: read straight from IndexedDB, show an "Offline — menu may be out
     of date" banner with the last-synced time.
   - `menuVersion` bumps on any admin write, via a DB trigger-free approach:
     the admin mutation increments `settings.menuVersion` in the same transaction.

3. **Actions taken offline** — favorites toggles and placed orders go into an
   IndexedDB `outbox` with a client-generated UUID. A sync routine drains the
   outbox on reconnect (`online` event + a poll). The server upserts by that
   UUID, so a replayed request is a no-op — **idempotent by client UUID**, which
   is what makes retry safe.

Orders placed offline are held and marked "will send when you're back online" —
the customer is told plainly rather than being led to believe the kitchen got it.

## 5. Order lifecycle

```
PLACED ──accept──▶ PREPARING ──ready──▶ READY ──serve──▶ SERVED
   │                                                       
   └──────────────────── cancel ──────────────────▶ CANCELLED
```

`item_stats.orderCount` increments when an order reaches SERVED (not PLACED),
so cancelled orders don't inflate popularity.

## 6. Routes

```
/                      customer menu (mode-aware)
/item/[id]             item detail + options
/favorites             saved items
/history               past orders + "you ordered this 7 times"
/cart                  ORDERING mode only
/t/[qrSlug]            table QR entry — binds tableId to the session

/staff                 live order queue (waiter + admin)
/admin                 dashboard: today's orders, top items
/admin/menu            CRUD items, categories, options, availability
/admin/tables          tables + QR codes
/admin/analytics       order frequency per item, over a date range
/admin/settings        mode switch, restaurant info, tax
/admin/staff           manage waiter accounts (admin only)

/api/menu              GET (versioned)
/api/settings          GET
/api/orders            POST (idempotent), GET (staff, polled)
/api/orders/[id]       PATCH status
/api/favorites         GET/POST/DELETE by deviceId
/api/history           GET by deviceId (+ userId if linked)
/api/sync              POST outbox drain
/api/admin/*           guarded mutations
```

## 7. Design language

Fast and calm. Dark-first, warm accent, big photography, thumb-reachable.

- Type: one display face for dish names, system stack for body.
- Motion: 150–200ms, ease-out. Nothing bounces. Respects
  `prefers-reduced-motion`.
- Layout: single column on phones; category rail sticks under the header;
  the cart bar docks above the safe-area inset.
- Touch targets ≥ 44px. Contrast ≥ 4.5:1.
- Skeletons, not spinners, so the page never jumps.

## 8. Stack

Next.js 15 App Router · TypeScript · Tailwind v4 · Drizzle + Neon Postgres ·
Better Auth · Zod · idb-keyval (IndexedDB) · Serwist (service worker).

Server Components read data directly; mutations are Server Actions or route
handlers. The customer shell is a Client Component because it must work from
IndexedDB with no server.
