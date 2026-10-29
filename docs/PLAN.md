# Bara 炭焰: build plan

Approved 2026-10-29 (with the additions below) · brief: [`docs/PROMPT.md`](PROMPT.md)

This is the map for the whole build: folder structure, data model, API, permissions, branch scoping, the 13 phases, and risks. Each phase ends with `npm run build`, `npm run lint`, `npm test`, an update to `docs/PROGRESS.md`, and a summary of under 15 lines.

---

## 0. Decisions (approved)

| # | Decision | What we do |
|---|---|---|
| D1 | **How API routes deploy** | Route handlers stay **one file per route**, each exporting `GET/POST/PATCH/DELETE`, under `api/_routes/` (Vercel doesn't turn `_`-prefixed paths into functions). **One** real function, `api/index.ts`, dispatches to them through a `vercel.json` rewrite, and **lazy-loads each route file with a dynamic `import()`** so a cold start only loads the route it serves. Payment and messaging **webhooks go through the same router**. The local Vite plugin uses the same dispatcher. Reason: Vercel Hobby allows a non-framework project only 12 functions per deployment, and this system has about 110 routes. |
| D2 | **Java for the Firebase emulators** | JDK 21 from Homebrew (`openjdk@21`). It's keg-only, so the emulator scripts put `/opt/homebrew/opt/openjdk@21/bin` on `PATH` when `java` isn't found. |
| D3 | **Cron precision** | Cron handlers do "whatever is due now" and are idempotent (a marker per job, branch and business day), so they work on Hobby's daily schedules (which fire somewhere within the hour) and on Pro's exact ones. Takeaway firing never depends on cron: the once-a-minute `tick` from open screens **claims each due order in a transaction** (status `scheduled` → `fired` only if it's still `scheduled`), so two open screens can never fire the same order twice. |
| D4 | **Nightly demo reset** | A **rolling 60 days**: each night, delete what visitors created, add one new day of generated history per branch, drop the oldest day, and restore baseline settings, menus and staff only where they changed. "Today vs same weekday last week" therefore never goes empty. **Budget: under ~5k writes a night**, enforced by a unit test on the generator's per-day document count and a hard cap in the job. The full `npm run seed` (about 90k documents) runs on the emulator and on first deploy only. |
| D5 | **Languages a branch hasn't enabled** (e.g. `/ja/kuala-lumpur/`) | hreflang and the sitemap list **only the branch's enabled languages**. Other language versions still render (site text in that language, menu falling back to English) but are `noindex`, with the canonical pointing to the branch's default language. |
| D6 | **How public pages render** | Prerendered static HTML at build time (STOEDIO's `scripts/prerender.mjs` approach); live prices, sold-out items and open/closed come from the API after hydration. Menu JSON-LD comes from the build-time snapshot. Every menu or branch-info write marks `meta/site.changedAt`; the **nightly cron calls the Vercel Deploy Hook** (`VERCEL_DEPLOY_HOOK_URL`) when anything changed that day, so Google's copy is at most a day old. |
| D7 | **Taiwan providers** | TapPay (payments: cards, LINE Pay, JKOPay, Apple Pay) and ECPay (電子發票), **both behind the `PaymentProvider` / `InvoiceProvider` adapters, with mock as the default**. |

---

## 1. Assumptions (these move into `docs/PROGRESS.md` in Phase 1)

- **Branch IDs** are lowercase codes: `tpe`, `jkt`, `dps`, `kul`, `sin`. The display code is uppercase (`SIN`) and appears in bill numbers. Public URL slugs are `taipei`, `jakarta`, `bali`, `kuala-lumpur`, `singapore`. A second Singapore branch would get its own code, e.g. `orc` (Orchard).
- **Business day**: the cut-off is a per-branch setting, 04:00 by default. A bill's business date is set when the bill closes and is stored on it. Bill numbers use the business date of opening, so a bill that runs past midnight keeps its number.
- **Sales recognition**: a sale counts when the bill is fully paid. Refunds count on the day they are made. Voids reduce sales before payment. Tips are recorded but are not sales.
- **Rates are integers**: tax and service charge are stored in basis points (`500` = 5%). FX rates are fractional by nature, so they're stored as decimal strings ("32.451200") and converted with `BigInt` maths. A JavaScript float never touches money.
- **Ingredient unit cost** is stored in *micro-minor units* (minor unit × 10,000 per g/ml/pc), so S$0.012 per gram stays an exact integer. Costs are rounded to the minor unit only when shown or summed into a dish cost, and that rounding is explicit.
- **Price display follows the branch's currency, not the UI language**: the Bali menu in Japanese still shows `Rp 125.000`. The optional "≈ ¥" hint uses the current month's FX rate and is labelled approximate.
- **Taiwan**: the service charge is inside the tax-inclusive total, so tax = (subtotal + service) × 5 / 105, rounded once at bill level. The 統一編號 checksum accepts the 2023 rule (sum divisible by 5).
- **Malaysia**: cash rounding follows Bank Negara's nearest-5-sen rule. On a mixed tender, it applies to the cash portion only.
- **Rounding mode**: half-up at bill level by default. Line-level rounding and half-even are per-branch settings.
- **Takeaway numbers** (`SIN-T-017`) restart each business day. **Reservation codes** (`BARA-SIN-7KQ2`) are 4 random characters from an unambiguous alphabet, made unique per branch. The manage link uses a separate long random token.
- **In-store wallets** (LINE Pay at the counter, QRIS stand, GoPay, DuitNow, etc.) are *recorded tenders*: the cashier confirms on the wallet's own terminal. The online `PaymentProvider` is used for pay-at-table, takeaway and deposits.
- **Holiday closures** (Lunar New Year, Lebaran, Nyepi, Hari Raya, Deepavali, national days) are seeded for 2026–2027 and marked "verify dates". They're settings, not code.
- **Maps**: Locations uses a custom SVG map of the region with five pins. Branch pages use a click-to-load Google Maps embed, which needs no API key and adds no third-party requests until tapped.
- **Firestore location**: `asia-southeast1` (Singapore). It's central for all four countries. Data residency needs a review before a real client launch (see R12).

---

## 2. Folder structure

```
Bara-BBQ/
├─ api/
│  ├─ index.ts                    # the one deployed function: matches /api/* → _routes (D1)
│  └─ _routes/                    # ONE FILE PER ROUTE, exports GET/POST/PATCH/DELETE
│     ├─ auth/…  public/…  b/[branch]/…  hq/…  customers/…  webhooks/…  cron/…
│     └─ _table.gen.ts            # generated route table (static imports, so Vercel traces them)
├─ lib/                            # server only, never bundled for the browser
│  ├─ http/       context.ts (user + device + branch), route.ts (permission wrapper), validate.ts, respond.ts, errors.ts
│  ├─ auth/       passwords.ts (PBKDF2), session.ts, device.ts, pin.ts, approval.ts, firebase-token.ts, demo.ts
│  ├─ db/         admin.ts, paths.ts (typed refs, branch-scoped), counters.ts, idempotency.ts, audit.ts, rate-limit.ts
│  ├─ domain/     sessions.ts, orders.ts, kds.ts, fire.ts, payments.ts, invoices.ts, refunds.ts, shifts.ts,
│  │              reservations.ts, waitlist.ts, takeaway.ts, stock.ts, purchasing.ts, summaries.ts, reports.ts,
│  │              customers.ts, menu.ts, branches.ts, fx.ts, uploads.ts
│  ├─ providers/
│  │  ├─ payments/   types.ts, mock.ts, midtrans.ts, stripe.ts, tappay.ts, index.ts (pick per branch)
│  │  ├─ invoices/   types.ts, mock.ts, tw-ecpay.ts, my-myinvois.ts, sg.ts, id.ts
│  │  ├─ messaging/  types.ts, mock.ts, line.ts, whatsapp-link.ts, whatsapp-cloud.ts
│  │  ├─ email/      resend.ts, mock.ts, templates/*.ts
│  │  └─ fx/         types.ts, open-er-api.ts, manual.ts
│  ├─ jobs/       daily-branch.ts, group-summary.ts, nightly.ts, demo-reset.ts
│  └─ seed/       brand.ts, branches.ts, floorplans.ts, master-menu.ts (×7 languages), branch-menus.ts,
│                 ingredients.ts, suppliers.ts, staff.ts, history.ts (seeded PRNG), index.ts
├─ shared/                         # pure, isomorphic TS: no Firebase, no DOM, no Node APIs
│  ├─ money.ts  fx.ts  currencies.ts
│  ├─ country-profiles/  index.ts, tw.ts, id.ts, my.ts, sg.ts      # each with lastReviewed
│  ├─ settings.ts                  # effective settings = profile defaults ⊕ branch overrides
│  ├─ charges/  calculate-bill.ts, cash-rounding.ts, split.ts
│  ├─ time/     zoned.ts, business-day.ts, opening-hours.ts
│  ├─ availability/  reservations.ts, takeaway.ts
│  ├─ stock/    deduction.ts, wac.ts, food-cost.ts, variance.ts
│  ├─ tw/       ubn.ts (統一編號), carrier.ts (手機條碼), donation-code.ts, code39.ts, invoice-period.ts
│  ├─ permissions.ts  phone.ts  numbering.ts  menu-rules.ts  localized.ts  csv.ts  ids.ts
│  ├─ schemas/  # zod schemas shared by API validation and staff forms
│  └─ types/    # Branch, Order, Line, Bill, Payment, Invoice, Reservation, …
├─ src/                            # browser only
│  ├─ public/   # entry 1: website + guest flows (QR table, takeaway status, manage booking, feedback)
│  │  ├─ main.tsx  entry-server.tsx  routes.tsx
│  │  ├─ pages/   Home, Story, Locations, Gallery, PrivateDining, Faq, Privacy, NotFound
│  │  │           branch/{BranchHome, Menu, Reserve, Takeaway, PrivateDining}
│  │  │           guest/{TableOrder, TakeawayStatus, ManageBooking, Feedback, Receipt}
│  │  ├─ components/  Header, BranchChooser, LanguagePicker, Image, OpenBadge, MessagingButton,
│  │  │               ReserveBar, Footer, StoedioCredit, DemoRibbon, AllergenIcons, Price
│  │  ├─ motion/  gsap.ts, lenis.ts, reveal.ts, grain.css, embers/ (lazy WebGL, no three.js)
│  │  └─ seo/     head.ts, json-ld.ts, hreflang.ts, sitemap.ts
│  ├─ app/      # entry 2: /login, /device, /staff/*, /hq/*
│  │  ├─ main.tsx  routes.tsx  firebase-client.ts (signInWithCustomToken + onSnapshot only)
│  │  ├─ staff/   floor/ waiter/ host/ pos/ kds/ takeaway/ shift/ menu/ inventory/ reports/
│  │  │           expenses/ settings/ people/ customers/ feedback/ audit/ timeclock/
│  │  ├─ hq/      dashboard/ now/ compare/ pnl/ fx/ menu/ translations/ content/ promotions/
│  │  │           branches/ (new-branch wizard) staff/ customers/ audit/
│  │  └─ ui/      Button, Dialog (native <dialog>), NumPad, PinPad, DataTable, Tabs, Toast,
│  │              Chart/{Bar, Line, Heatmap} (plain SVG), OfflineBanner, BranchSwitcher
│  ├─ i18n/
│  │  ├─ guest/  en.ts (the shape) · zh-TW.ts · zh-CN.ts · id.ts · ms.ts · ja.ts · ko.ts
│  │  ├─ staff/  en.ts (the shape) · zh-TW.ts · zh-CN.ts · id.ts · ms.ts
│  │  └─ index.ts  (types, lazy loader, fallback)
│  ├─ styles/  tokens.css, base.css, fonts/{latin,tc,sc,jp,kr}.css, print-receipt.css,
│  │           print-menu.css (daylight), print-report.css
│  └─ lib/     api.ts (fetch + idempotency keys + offline guard), format.ts, hooks/
├─ scripts/   prerender.mjs, gen-routes.ts, seed.ts, i18n-check.ts, size-check.ts
├─ tests/
│  ├─ unit/         vitest, pure logic (shared/, lib/ helpers)
│  ├─ integration/  vitest + emulator (handlers, transactions, idempotency, scoping)
│  ├─ rules/        vitest + @firebase/rules-unit-testing
│  └─ e2e/          Playwright, the 10 flows in brief §6
├─ docs/     PROMPT.md · PLAN.md · PROGRESS.md · ARCHITECTURE.md · DEMO-SCRIPT.md
├─ index.html (public entry) · app.html (staff/HQ entry)
├─ middleware.ts · vite.config.ts · vite/api-plugin.ts · vercel.json
├─ firebase.json · .firebaserc · firestore.rules · firestore.indexes.json · storage.rules
└─ README.md · CREDITS.md · .env.example
```

**Why two kinds of i18n files**: the brief asks for one file per language in `src/i18n/`. I split them into `guest/` (seven languages) and `staff/` (five), so staff strings stay out of the public bundle and ja/ko don't need staff translations. `lib/` imports the guest files for emails, messages and receipts. They're plain data, so nothing from the browser leaks into the server.

**Why `shared/` exists**: money, the charges engine, availability, permissions and schemas must run in both the API and the browser. `lib/` stays server-only, as the brief requires.

---

## 3. Architecture at a glance

```
                      ┌──────────────────────────── Vercel ─────────────────────────────┐
 Guest phone ────────▶│ dist/  prerendered /{lang}/… pages + public bundle (no Firebase) │
   │   polls /api ───▶│                                                                  │
 Staff tablet ───────▶│ middleware.ts  (/ → /{lang}/ ; /staff, /hq need a session)       │
   │                  │ app.html + app bundle ──── onSnapshot (read-only, custom token) ─┼──▶ Firestore
   └── fetch /api ───▶│ api/index.ts → _routes/<route>.ts → lib/http/context → lib/domain┼──▶ Firestore / Storage
                      │        ▲            Cron (D3) → api/cron/<job>                    │
                      │        └── webhooks/<provider>/<branch> ◀── Midtrans/Stripe/TapPay│
                      └──────────────────────────────────────────────────────────────────┘
                         lib/providers → Resend · LINE · WhatsApp · ECPay · MyInvois · FX API
```

- **Two browser bundles.** `index.html` holds the website and the light guest flows. It never loads Firebase, staff code or other languages' messages. `app.html` holds staff and HQ, and is the only place the Firebase client SDK appears.
- **All writes go through `/api`.** Firestore rules allow no client writes at all.
- **Request flow, e.g. a guest places a QR order:** `POST /api/public/table/:qrToken/orders`. The handler verifies the token's HMAC and version, loads the open table session, applies rate limits, and checks the idempotency key. Then, in one transaction, it re-reads `menuItems` (prices, sold-out, channel, availability time), runs `calculateBill`, appends lines to the order (`pending` if a waiter must confirm, otherwise `fired`), creates one KDS ticket per station, writes stock movements and the audit entry, and stores the idempotent response. The KDS sees the ticket through `onSnapshot`. Guest phones see it on their next 5-second poll.

---

## 4. Branch scoping, end to end

| Layer | How the branch is known | Enforcement |
|---|---|---|
| Public website | URL slug `/{lang}/{slug}/` → branch | Public API returns only public fields |
| Guest QR | Signed token `{branchId, tableId, qrVersion}` (HMAC, rotatable) | Token is verified, its version must match the table's `qrVersion`, and the session must be open to order |
| Guest takeaway / booking / feedback | Slug in the URL, or a long random token | The token decides which document it can see |
| Staff UI | `/staff/:branchId/…` | UI hides what `can()` denies (cosmetic only) |
| Staff API | `/api/b/:branchId/…` | `lib/http/context.ts` resolves `{user, device, branchId}`. **If a device cookie is present, `branchId` must equal the device's branch**, otherwise 403. Each route declares `route({ permission: 'line.void', scope: 'branch' }, handler)`, and the wrapper calls `can(user, permission, branchId)` before the handler runs |
| Data access | `db.branch(branchId)` returns typed refs **only** under `branches/{branchId}`. Handlers never build paths from raw input. Group collections sit behind `db.group`, available only to group permissions | Code review plus integration tests (a cross-branch ID returns 404, never data) |
| Realtime reads | Firebase custom token claims: `{ br: { jkt: 'cashier' }, g: null }`; owner `{ br: {}, g: 'owner' }`; area manager `{ br: { jkt: 'manager', dps: 'manager' }, g: 'area' }` | `firestore.rules` checks `branchRole(b) in [...]` per collection, and denies every write |
| HQ | `/api/hq/…`, `hq.*` permissions | Reads `dailySummaries` with a collection-group query, filtered to the caller's branches (all for owner and finance, assigned ones for area managers) |
| Audit | Cross-branch access: a group-level user opening a branch they're not assigned to as staff | One audit entry per user, branch and day (not per request) |

Tests prove it at every layer: unit tests for `can()` and context resolution, integration tests where a Jakarta cashier calls `/api/b/sin/...` and gets 403, rules tests where a Jakarta cashier cannot read `branches/sin/**`, and the e2e flow where a Jakarta manager cannot open `/hq` or see Singapore.

---

## 5. Roles and permission matrix

There is one file, `shared/permissions.ts`, holding `MATRIX` and `can(user, permission, branchId) → 'allow' | 'approval' | 'deny'`. The API and the UI both import it.

Key: ✓ allowed · **A** allowed with a manager PIN on the spot · R read-only · – no. Area managers have their rights only in their **assigned** branches. The owner has every right in every branch.

| Permission | Owner | Area | HQ Finance | HQ Menu | Manager | Cashier | Waiter | Kitchen | Host |
|---|---|---|---|---|---|---|---|---|---|
| `floor.view` | ✓ | ✓ | – | – | ✓ | ✓ | ✓ | – | ✓ |
| `table.open` (seat, covers, transfer, merge) | ✓ | ✓ | – | – | ✓ | ✓ | ✓ | – | ✓ |
| `order.take` (add, edit unfired, fire, move items) | ✓ | ✓ | – | – | ✓ | ✓ | ✓ | – | – |
| `order.confirmQr` | ✓ | ✓ | – | – | ✓ | ✓ | ✓ | – | – |
| `line.void` (fired item) | ✓ | ✓ | – | – | ✓ | A | A | – | – |
| `item.soldOut` | ✓ | ✓ | – | – | ✓ | ✓ | ✓ | ✓ | – |
| `kds.use` (view, done, bump, recall) | ✓ | ✓ | – | – | ✓ | – | R | ✓ | – |
| `reservation.manage` | ✓ | ✓ | – | – | ✓ | R | R | – | ✓ |
| `waitlist.manage` | ✓ | ✓ | – | – | ✓ | – | R | – | ✓ |
| `takeaway.manage` (ready, picked up) | ✓ | ✓ | – | – | ✓ | ✓ | ✓ | – | – |
| `bill.view` | ✓ | ✓ | R | – | ✓ | ✓ | ✓ | – | – |
| `bill.discount` (≤ branch limit, default 10%) | ✓ | ✓ | – | – | ✓ | ✓ | A | – | – |
| `bill.discountOverLimit` | ✓ | ✓ | – | – | ✓ | A | – | – | – |
| `bill.comp` (complimentary, staff meal) | ✓ | ✓ | – | – | ✓ | A | – | – | – |
| `bill.split` | ✓ | ✓ | – | – | ✓ | ✓ | ✓ | – | – |
| `payment.take` | ✓ | ✓ | – | – | ✓ | ✓ | –¹ | – | – |
| `bill.reopen` | ✓ | ✓ | – | – | ✓ | A | – | – | – |
| `refund.issue` | ✓ | ✓ | – | – | ✓ | A | – | – | – |
| `invoice.issue` | ✓ | ✓ | – | – | ✓ | ✓ | – | – | – |
| `invoice.void` | ✓ | ✓ | – | – | ✓ | A | – | – | – |
| `shift.manage` (open, close, X/Z) | ✓ | ✓ | R | – | ✓ | ✓ | – | – | – |
| `cash.payIn` | ✓ | ✓ | – | – | ✓ | ✓ | – | – | – |
| `cash.payOut` | ✓ | ✓ | – | – | ✓ | A | – | – | – |
| `timeclock.self` | ✓ | ✓ | – | – | ✓ | ✓ | ✓ | ✓ | ✓ |
| `menu.branch.availability` (channels, times) | ✓ | ✓ | – | – | ✓ | – | – | – | – |
| `menu.branch.select` (add master items, local specials) | ✓ | ✓ | – | – | ✓ | – | – | – | – |
| `menu.branch.price` | ✓ | ✓ | – | – | –² | – | – | – | – |
| `menu.master.edit` (incl. translations) | ✓ | – | – | ✓ | – | – | – | – | – |
| `inventory.view` | ✓ | ✓ | R | – | ✓ | – | – | R | – |
| `stock.count` (counts, waste) | ✓ | ✓ | – | – | ✓ | – | – | ✓ | – |
| `stock.adjust` | ✓ | ✓ | – | – | ✓ | – | – | – | – |
| `purchasing.manage` (suppliers, POs) | ✓ | ✓ | – | – | ✓ | – | – | – | – |
| `purchasing.receive` | ✓ | ✓ | – | – | ✓ | – | – | ✓ | – |
| `reports.branch` (sales, tax, P&L, exports) | ✓ | ✓ | R | – | ✓ | – | – | – | – |
| `expenses.create` | ✓ | ✓ | ✓ | – | ✓ | – | – | – | – |
| `settings.branch` (hours, floor, rules, receipts…) | ✓ | ✓ | – | – | ✓ | – | – | – | – |
| `settings.tax` (country overrides, providers) | ✓ | ✓ | – | – | – | – | – | – | – |
| `devices.manage` | ✓ | ✓ | – | – | ✓ | – | – | – | – |
| `staff.branch` (accounts, roles here, PIN reset) | ✓ | ✓ | – | – | ✓ | – | – | – | – |
| `customers.view` | ✓ | ✓ | – | – | ✓ | R | R | – | R |
| `customers.export` / `customers.delete` | ✓ | ✓ | – | – | – | – | – | – | – |
| `feedback.view` | ✓ | ✓ | R | – | ✓ | – | – | – | – |
| `audit.view` | ✓ | ✓ | R | – | ✓ | – | – | – | – |
| `hq.open` | ✓ | ✓ | ✓ | ✓ | – | – | – | – | – |
| `hq.reports` (dashboard, league, compare, consolidated P&L) | ✓ | ✓³ | ✓ | – | – | – | – | – | – |
| `fx.manage` (enter, fetch, lock month) | ✓ | – | ✓ | – | – | – | – | – | – |
| `content.edit` (brand copy, photos, press) | ✓ | – | – | ✓ | – | – | – | – | – |
| `promotions.group` | ✓ | – | – | – | – | – | – | – | – |
| `branch.create` (new-branch wizard) | ✓ | – | – | – | – | – | – | – | – |
| `staff.group` (group roles, any branch) | ✓ | – | – | – | – | – | – | – | – |

¹ A branch setting can let waiters take payment at the table.
² A branch setting (`managersCanChangePrice`) allows it. Even then, a price change asks for a manager PIN and is audited.
³ Area managers see only their assigned branches.

**Who can approve an A**: anyone with ✓ for that permission in that branch. The audit entry records both the actor and the approver.

---

## 6. Firestore data model

### 6.1 Conventions

- Money is `{ amount: number /* safe integer, minor units */, currency: 'TWD'|'IDR'|'MYR'|'SGD' }`. Reporting can also use `USD`. Display-only FX hints add `JPY`, `KRW`, `CNY` and `AUD`.
- `LocalizedText = { en: string } & Partial<Record<Locale, string>>`. English is required, and the other six locales are optional.
- Timestamps are Firestore `Timestamp` (UTC). Every operational document also stores `businessDate: 'YYYY-MM-DD'`, computed when it's written.
- **Snapshots**: order lines copy names (all languages), unit price, modifiers, station, allergens and the recipe used. Bills copy the rates used (`pricing`). Later menu, price or tax edits never change history.

### 6.2 Top-level (group) collections

| Collection | Key fields |
|---|---|
| `brand/main` | name, tagline, story, chef, press[], socials, gallery[], faq (brand-wide answers), heroMedia |
| `branches/{branchId}` | code, slug, country, currency, timeZone, name/address (LocalizedText), geo, phoneE164, messaging `{channel: 'line'\|'whatsapp', id}`, taxIds `{ubn \| npwp \| sstNo \| gstRegNo}`, flags `{halal, alcohol}`, languages `{enabled[], default}`, hours (weekly, overnight-safe), closures[], `overrides` (partial country profile), `settings` (§6.4), providers, deliveryLinks[], media (hero, gallery), status |
| `staff/{staffId}` | username, name, passwordHash, pinHash, language, `branchRoles {branchId: role}`, `groupRole?`, `areaBranches?[]`, `hourlyRate {branchId: Money}`, active, sessionVersion |
| `devices/{deviceId}` | branchId, kind (`pos`\|`kds`\|`host`\|`waiter`), name, station?, language, secretHash, registeredBy, lastSeenAt, revokedAt? |
| `masterCategories/{id}` | name, description, sort |
| `masterItems/{id}` | categoryId, name, description, photo, allergenIds[], dietary `{halalSuitable, vegetarian, vegan, containsAlcohol}`, spice `{adjustable, default}`, modifierGroupIds[], recipe [{ingredientId, qty}], suggestedPrices `{TWD, IDR, MYR, SGD}`, defaultStation, version |
| `modifierGroups/{id}` | name, required, min, max, options [{id, name, priceDelta per currency, recipeDelta?}] |
| `allergens/{id}` | name, description, icon |
| `ingredients/{id}` | name, unit (`g`\|`ml`\|`pcs`), category, allergenIds[] |
| `customers/{id}` | name, phoneE164, email, language, allergies, dietary, notes, tags[], `consent {TW\|ID\|MY\|SG: {marketing, noticeVersion, at, source}}`, stats `{visits {branchId: n}, noShows, spend {currency: amount}, lastVisitAt}`, deletedAt? |
| `customerKeys/{key}` | `phone:+65…` or `email:<sha256>` → customerId (dedupe across the group) |
| `fxRates/{YYYY-MM}` | base `USD`, rates `{TWD: "32.4512", …}` (decimal strings), source, enteredBy, `lockedAt?` |
| `groupPromotions/{id}` | name, rule (percent/fixed/free item, scope, schedule), branchIds[], active |
| `auditLog/{id}` | at, branchId\|null, actor {staffId, name, role}, approver?, action, target {type, id}, before, after, reason, deviceId, ipHash. Append-only |
| `rateLimits/{hash}` · `idempotencyKeys/{hash}` · `jobRuns/{job-branch-date}` | Server housekeeping, with Firestore TTL on `expiresAt` |

### 6.3 Per-branch subcollections (`branches/{branchId}/…`)

| Collection | Key fields |
|---|---|
| `areas` | name, kind (`indoor`\|`terrace`\|`garden`\|`counter`\|`private`), sort |
| `tables` | label, areaId, shape, seats {min, max}, layout {x, y, w, h, rot}, combinableWith[], onlineBookable, qrVersion, live `{status, sessionId, since}` (denormalised for the floor plan) |
| `tableSessions` | tableIds[], covers {adults, children}, seats, openedAt/By, reservationId?, timeLimitMin, endsAt, orderId, status (`open`\|`closed`), `cart` (shared QR cart lines), qrMode, minSpendWarn |
| `calls` | sessionId, tableLabel, kind (`waiter`\|`bill`), at, status (`open`\|`ack`) |
| `menuItems` | masterItemId\|null (null = local special), `content` (denormalised copy of master name, description, allergens, dietary, modifiers, with masterVersion), price: Money, station, channels {dineIn, qr, takeaway}, availability [{days, from, to}], soldOut, badges {chefsPick, onlyHere}, sort, active |
| `recipeOverrides/{masterItemId}` | lines [{ingredientId, qty}], note (e.g. "local snapper instead of barramundi") |
| `stock/{ingredientId}` | onHand (integer base units), par, reorderQty, supplierId, unitCostMicro (weighted average), lowSince? |
| `stockMovements` | ingredientId, delta, reason (`sale`\|`voidReturn`\|`receive`\|`count`\|`waste`\|`adjust`), ref {type, id}, unitCostMicro, at, businessDate, by. Append-only |
| `suppliers` | name, contact, phoneE164, taxId, terms, ingredientIds[] |
| `purchaseOrders` | number, supplierId, lines [{ingredientId, qty, unitCost}], status (`draft`\|`sent`\|`partial`\|`received`), received[], supplierInvoice {no, photo, inputTax: Money} |
| `stockCounts` | lines [{ingredientId, expected, counted}], status, countedBy, at |
| `orders` | see §6.5 |
| `kdsTickets` | orderId, orderNo, station, label (`T12` \| `TAKEAWAY T-017`), pickupAt?, course, items [{lineId, name: LocalizedText, qty, modifiers: LocalizedText[], notes, seat, allergenIds, status}], allergyNote, fireAt, firedAt, status (`scheduled`\|`open`\|`bumped`), bumpedAt |
| `payments` | orderId, checkId, method, amount, tendered?, change?, cashRounding?, tip?, provider, providerRef, status (`pending`\|`succeeded`\|`failed`\|`refunded`), card {brand, approvalCode}?, shiftId, at, businessDate, by, idempotencyKey |
| `invoices` | orderId, checkId, type (`tw-b2c`\|`tw-b2b`\|`id-receipt`\|`my-receipt`\|`my-individual`\|`my-consolidated`\|`sg-receipt`\|`sg-tax-invoice`), number, randomCode?, carrier?/donationCode?/buyer?, amounts (snapshot), period (`2026-09/10`), status (`issued`\|`void`\|`allowance`\|`pending`\|`failed`), provider, providerRef |
| `refunds` | orderId, lines?, amount, reason, paymentIds, invoiceAction (`void`\|`allowance`\|`creditNote`), by, approvedBy, businessDate |
| `shifts` | openedBy/At, float: Money, status, closedAt, counted {denomination: count}, expected, difference |
| `cashMovements` | shiftId, kind (`payIn`\|`payOut`), amount, reason, by, approvedBy? |
| `reservations` | code, tokenHash, customerId, contact snapshot, party {adults, children}, startAt, endAt, businessDate, tableIds[], status (`booked`\|`confirmed`\|`arrived`\|`seated`\|`finished`\|`noShow`\|`cancelled`), source, occasion, notes, dietary[], seating, language, policyAccepted {version, at}, deposit?, notifications {confirmation, reminder}, history[] |
| `waitlist` | name, phoneE164, party, quotedMin, addedAt, status (`waiting`\|`notified`\|`seated`\|`left`), notifiedAt |
| `enquiries` | private dining or large-party leads: contact, date, party, room?, budget, message, status |
| `expenses` | category, amount, date, month, supplier?, receiptPhoto?, note, by |
| `timeEntries` | staffId, in, out, minutes, businessDate, hourlyRate (snapshot), flags[] |
| `feedback` | orderId, rating, comment, language, at, alerted |
| `counters/{series}` | next. Series: `bill-YYYYMMDD`, `takeaway-YYYYMMDD`, `po-YYYY` |
| `dailySummaries/{YYYY-MM-DD}` | branchId, currency, gross, discounts, voids, refunds, net, service, tax, rounding, tips, bills, covers, `byPayment`, `byChannel`, `byCategory`, `byItem {menuItemId: {qty, net, theoreticalCost}}`, `byHour`, `byStaff`, `byLanguage`, labourMinutes, labourCost, cogs, ratingSum/Count, voidCount, finalized, rebuiltAt |

### 6.4 Branch settings (the `settings` map; defaults come from the country profile)

`serviceCharge {bp, channels[]}` · `tax {bp, inclusive, onServiceCharge, label}` · `rounding {level: 'bill'|'line', mode, cashIncrement}` · `businessDayCutoff` · `diningRules {timeLimitMin by daypart, minSpendPerAdult, lateHoldMin}` · `reservations {stepMin: 15, durations by party size & daypart, bufferMin, maxCoversPer15, walkInHoldbackPct, largePartyAt, deposit {mode: 'deposit'|'enquiry', amount}, cancelWindowH}` · `takeaway {enabled, maxPer15, prepMin, payAtPickupMax, packagingFee, byoDiscount, serviceCharge: false}` · `qr {mode: 'staffOpens'|'autoOpen', confirmByWaiter, maxQtyPerItem}` · `discounts {cashierLimitPct}` · `permissions {managersCanChangePrice, waitersTakePayment}` · `kds {amberMin, redMin, sound}` · `stations[]` · `receipts {footer: LocalizedText, feedbackQr}` · `labour {dailyLimitH}` · `notifications {dailyEmail, lowRatingAt}` · `tenders[]` (from the country profile, can be reordered or disabled).

### 6.5 Order document (one per bill)

```ts
interface Order {
  number: string                       // SIN-20261029-0042
  channel: 'dineIn' | 'takeaway' | 'counter'
  source: 'waiter' | 'qr' | 'pos' | 'online'
  status: 'open' | 'closed' | 'void'
  sessionId?: string; tableLabel?: string; covers?: number
  takeaway?: { number: string; pickupAt: Timestamp; asap: boolean; name: string; phoneE164: string;
               statusToken: string; status: 'received' | 'preparing' | 'ready' | 'pickedUp' }
  guestLanguage: Locale; customerId?: string
  lines: Line[]                         // embedded: one read per bill, one transaction per change
  discounts: Discount[]
  pricing: PricingSnapshot              // rates used: service bp, tax bp, inclusive, onService, rounding
  totals: BillTotals                    // last server-computed calculateBill() result
  checks: Check[]                       // splits: {id, mode, lineIds? | share?, totals, status, invoiceId}
  paid: Money; tips: Money; balance: Money
  openedAt; openedBy; closedAt?; businessDate?; openedBusinessDate
  version: number                       // optimistic concurrency for PATCH (409 + refetch on conflict)
}
interface Line {
  id; menuItemId; masterItemId | null; name: LocalizedText; unitPrice: Money; qty: number
  modifiers: { groupId; optionId; name: LocalizedText; priceDelta: Money }[]
  spice?: number; notes?: string; seat?: number; course: number; held: boolean; station: string
  status: 'pending' | 'fired' | 'preparing' | 'done' | 'served' | 'voided'
  allergenIds: string[]; recipe: { ingredientId; qty }[]   // snapshot used for deduction and void return
  addedBy: string /* staffId or 'guest:seat3' */; firedAt?; voided?: { reason; by; approvedBy; returnedStock: boolean }
  comp?: { reason; by }; discountIds: string[]
}
```

### 6.6 Indexes (`firestore.indexes.json`)

| Collection (scope) | Fields |
|---|---|
| `orders` | status ↑ openedAt ↓ · businessDate ↑ closedAt ↑ · channel ↑ status ↑ takeaway.pickupAt ↑ |
| `orders` (group) | customerId ↑ closedAt ↓ (guest profile history) |
| `kdsTickets` | station ↑ status ↑ firedAt ↑ · status ↑ fireAt ↑ |
| `reservations` | businessDate ↑ startAt ↑ · status ↑ startAt ↑ |
| `reservations` (group) | customerId ↑ startAt ↓ |
| `payments` | businessDate ↑ at ↑ · shiftId ↑ at ↑ |
| `invoices` | period ↑ status ↑ · type ↑ issuedAt ↑ |
| `stockMovements` | ingredientId ↑ at ↑ · businessDate ↑ reason ↑ |
| `dailySummaries` (group) | businessDate ↑ · branchId ↑ businessDate ↑ |
| `auditLog` | branchId ↑ at ↓ · action ↑ at ↓ · actor.staffId ↑ at ↓ |
| `timeEntries` | staffId ↑ in ↑ · businessDate ↑ |
| `feedback` | rating ↑ at ↓ |

### 6.7 Security rules (summary)

```
function role(b)  { return request.auth.token.br[b]; }
function owner()  { return request.auth.token.g == 'owner'; }
function can(b, roles) { return request.auth != null && (owner() || role(b) in roles); }

match /branches/{b}/tables/{id}        { allow read: if can(b, ['manager','cashier','waiter','host']); }
match /branches/{b}/tableSessions/{id} { allow read: if can(b, ['manager','cashier','waiter','host']); }
match /branches/{b}/calls/{id}         { allow read: if can(b, ['manager','cashier','waiter']); }
match /branches/{b}/orders/{id}        { allow read: if can(b, ['manager','cashier','waiter']); }
match /branches/{b}/kdsTickets/{id}    { allow read: if can(b, ['manager','waiter','kitchen']); }
match /branches/{b}/reservations/{id}  { allow read: if can(b, ['manager','host','waiter']); }
match /branches/{b}/waitlist/{id}      { allow read: if can(b, ['manager','host']); }
match /branches/{b}/menuItems/{id}     { allow read: if can(b, ['manager','cashier','waiter','kitchen','host']); }
match /{path=**}                       { allow write: if false; }      // no client writes, ever
// everything else (payments, invoices, customers, audit, finance) is API-only: no client reads
```

Area managers get `manager` in `br` for each assigned branch. A KDS screen with nobody logged in gets a device token with `br: {dps: 'kitchen'}`.

---

## 7. Money, tax and the charges engine

### 7.1 `shared/money.ts`

`money(amount, currency)` (asserts a safe integer) · `add` / `subtract` / `sum` (throw on mixed currency) · `multiplyByRatio(m, num, den, rounding)` · `percentOf(m, bp, rounding)` · `allocate(m, weights[])` (largest remainder, never loses a cent, deterministic tie-break) · `roundToIncrement(m, inc, mode)` · `format(m, { display })`.

`format` uses `Intl.NumberFormat` with the **currency's** numbering locale (`id-ID` for IDR → `Rp 125.000`; `en` for `NT$1,280`, `RM 48.50`, `S$32.90`) and our own minor-unit table. TWD and IDR show no decimals in practice, although ISO 4217 lists IDR with 2. FX conversion lives in `shared/fx.ts` (BigInt, rate strings, explicit rounding, and it returns the rate and date used).

### 7.2 `calculateBill(lines, discounts, countryProfile, branchSettings, channel)`: order of operations

1. **Line gross** = (unit + modifier deltas) × qty. Voided lines are excluded. Comps are priced at 0, and their value is kept for reporting.
2. **Item discounts** (percent rounded per line, or fixed capped at the line).
3. **Bill discounts** in their listed order (percent of the current eligible base, then fixed). Each one is **allocated back to its eligible lines** with `allocate()`, so category, seat and split reports stay exact.
4. **Fees**: takeaway packaging fee (taxable), BYO-container discount.
5. **Service charge** = net subtotal × bp, only if `channel ∈ serviceCharge.channels` (dine-in by default).
6. **Tax**
   - *Inclusive* (TW): total = net + service; tax = round((net + service) × bp / (10000 + bp)). It's shown as "includes 5% tax", never added.
   - *Exclusive* (ID / MY / SG): base = net + (onServiceCharge ? service : 0); tax = round(base × bp); total = net + service + tax.
7. **Rounding level**: `bill` (default: service and tax computed once) or `line` (computed per line, rounded, summed).
8. **Cash rounding** happens at tender time, not in the bill: `cashDue(balance, profile)` gives the rounding line for the cash portion only (MY required at 5 sen; ID optional at Rp 100; SG optional at 5¢; TW at NT$1 changes nothing).

**Splits** (`shared/charges/split.ts`): *by seat* and *by item* run `calculateBill` on each sub-bill, and the parent total becomes the sum of the checks, so each invoice is self-consistent. *Even by N* and *custom amounts* compute the whole bill once and then `allocate()` every component (net, service, tax, total) across the checks, so the parts always add up to the whole.

### 7.3 Worked examples (the test table will hold about 40 of these)

| Branch | Lines | Service | Tax | Total | Notes |
|---|---|---|---|---|---|
| SIN dine-in | S$36.00 + 42.00 + 28.00 = **106.00** | 10% = **10.60** | GST 9% × 116.60 = 10.494 → **10.49** | **S$127.09** | Hand-checked example for e2e flow 4 |
| KUL dine-in | RM 25.90 + 38.50 + 22.90 = **87.30** | 10% = **8.73** | SST 6% × 96.03 = 5.7618 → **5.76** | **RM 101.79** | Cash → **RM 101.80** (+0.01 rounding line). Card → 101.79 |
| JKT dine-in | Rp **450.000** | 5% = **22.500** | PBJT 10% × 472.500 = **47.250** | **Rp 519.750** | Optional cash rounding → Rp 519.800 |
| DPS dine-in | Rp **450.000** | 10% = **45.000** | PBJT 10% × 495.000 = **49.500** | **Rp 544.500** | |
| JKT takeaway | Rp **285.000** | none | PBJT 10% = **28.500** | **Rp 313.500** | E2e flow 5 |
| TPE dine-in | NT$**2,560** | 10% = **256** | included: 2,816 × 5/105 = 134.1 → **134** | **NT$2,816** | Split by 2 → 1,408 + 1,408, tax 67 + 67 |
| TPE takeaway | NT$**2,560** | none | included: 121.9 → **122** | **NT$2,560** | |

---

## 8. Time and business days

- `shared/time/zoned.ts`: `zonedParts(instant, tz)` and `fromZoned(date, time, tz)` (wall clock → UTC), built on `Intl.DateTimeFormat`, with no date library. They're tested against a DST zone too, so the code stays correct if a branch opens somewhere with DST.
- `businessDate(instant, tz, cutoff = '04:00')`: 02:30 on Saturday counts as Friday's business day.
- `opening-hours.ts`: weekly hours with overnight intervals (17:30–01:00), special closures and modified hours. Provides `isOpenAt`, `nextOpening` and `openStatus` (used for "Open now / Opens at 17:30").
- Jakarta (WIB, UTC+7) and Bali (WITA, UTC+8) have explicit tests, e.g. the same instant falls on different business days at 04:30 WITA.

---

## 9. Internationalisation

- **Locales**: guests use `zh-TW zh-CN en id ms ja ko`; staff use `zh-TW zh-CN en id ms`. `guest/en.ts` and `staff/en.ts` define the shape (`type GuestMessages = DeepString<typeof en>`). Every other file ends in `satisfies GuestMessages`, so a missing key **and** an extra key are both compile errors.
- **URLs**: `/{lang}/…` everywhere public. `middleware.ts` redirects `/` with a 302 to the remembered cookie, then `Accept-Language`, then `en`. hreflang lists each branch's enabled languages, plus `x-default` pointing to `/`. Once a language is picked from the header, it's remembered (cookie + localStorage).
- **Content**: `pickText(text, locale, branchDefault)` falls back from the locale to `en` to the branch default. `missingLocales(text, required)` drives the "translation missing" flags. `scripts/i18n-check.ts` reports UI keys whose text is identical to English and menu content with missing translations.
- **Kitchen**: ticket lines carry names in every language, and the KDS renders them in the **device's** staff language.
- **Fonts**: Fraunces (display) and Inter (body) are self-hosted variable fonts (`@fontsource-variable`, Latin subsets only), so Latin pages make no third-party request. Noto Serif/Sans TC, SC, JP and KR come from the Google Fonts CSS API, which serves them in about 100 `unicode-range` slices each; the stylesheet link is added only on that locale's pages, with `display=swap`. (Changed from self-hosting the CJK families too: the `@fontsource` CJK packages would put tens of megabytes of slices into every build. Self-hosting can come back later with a download-at-build step if a client needs it.) Only one Latin display weight is preloaded.

---

## 10. Auth, devices, PINs, approvals

- **Passwords**: PBKDF2-SHA256 through Web Crypto, with a per-user salt (no bcrypt dependency).
- **Session cookie** `bara_s`: `v1.<staffId>.<deviceId|->.<expires>.<sessionVersion>.<hmac>`, HttpOnly, SameSite=Lax, Secure in production, 14 days by default (adjustable 12–30). Changing a password or deactivating a user bumps `sessionVersion`, which kills that user's sessions. The pattern comes from STOEDIO's `lib/session.ts`.
- **Login rate limits**: 10 per 15 min per IP and 5 per 15 min per username, with a generic error message.
- **Devices**: a manager signed in on the tablet opens `/device`, names it, and picks a kind and station. The server creates `devices/{id}` and sets the `bara_d` cookie (signed, HttpOnly, 400 days). The device check runs on every API call (cached in-instance for 30 s). Revoking a device takes effect within 30 s.
- **PIN switch**: a device's lock screen lists the branch's active staff. A 4–6 digit PIN (PBKDF2) starts a device-bound session. Five wrong tries locks that staff member on that device for 5 minutes. The app returns to the lock screen after an idle time set per branch (default 15 min).
- **Manager approval**: requests that need **A** carry `approval: { staffId, pin }`. The server checks the PIN and that the approver has ✓ for that permission in that branch, all in the same handler and the same audit entry.
- **Realtime token**: `POST /api/auth/firebase-token` mints a custom token (uid `staffId`, or `dev_<deviceId>` for an unattended KDS) with `br` and `g` claims. The client signs in again on every user switch.
- **`middleware.ts`** (matcher `/`, `/staff/:path*`, `/hq/:path*`): handles the language redirect on `/`. For `/staff` and `/hq` it requires a valid session, redirecting to `/login`, or to the PIN lock screen on a registered device. Branch and role checks happen in the API. The UI hides what `can()` denies.
- **Demo** (`DEMO_MODE=true`): `/login` shows one-tap buttons for every role × branch, plus Group Owner. `POST /api/auth/demo` returns 404 when demo mode is off.

## 11. Idempotency, numbering, audit

- **Idempotency**: the client sends an `Idempotency-Key` (UUID) on create-order, add-items, fire, payment, refund and invoice requests, and keeps it until it gets a definite answer. The server stores `idempotencyKeys/{sha256(branch:route:key)}` with `{requestHash, response}` **in the same transaction** as the business write. A replay returns the stored response. The same key with a different body returns 422. External calls happen in two phases: write a `pending` payment/invoice, call the provider with the same key (Stripe and Midtrans accept one), then finalise.
- **Numbering**: `counters/bill-20261029` is incremented in the transaction that creates the bill, so numbers have no gaps. A voided bill keeps its number. Takeaway works the same way. Reservation codes use random characters; uniqueness is checked with a query on `code` inside the booking transaction (the Admin SDK allows queries in transactions), so no extra index document is written per booking.
- **Audit**: `lib/db/audit.ts` exposes only `append()`. There's no update or delete anywhere, and rules deny client access. Logged actions: void, refund, discount, comp, price change, payment, invoice issue/void/allowance, stock adjust, waste, count finalisation, settings change (with before/after), device register/revoke, staff role change, PIN reset, cross-branch access, customer export/delete, and demo-mode blocks.

## 12. Realtime, polling and scheduled firing

| Screen | Reads | How |
|---|---|---|
| KDS | `kdsTickets` (station, status ≠ bumped) | `onSnapshot` · sound on new ticket · banner on `fromCache` or offline, which recovers by itself |
| Waiter floor | `tables`, `tableSessions`, `calls`, `reservations` (next 2 h) | `onSnapshot` |
| POS | `orders` (status open), `calls` | `onSnapshot` |
| Host | `reservations` (business date), `waitlist`, `tables` | `onSnapshot` |
| Guest QR | session, cart, orders, time left | Polls `GET /api/public/table/:token` every 5 s (every 2 s right after placing an order) |
| Takeaway status | order status | Polls every 10 s |
| Payment pending | payment status | Polls every 2 s, plus the webhook |

**Scheduled takeaway firing doesn't use cron.** Takeaway lines are created as `scheduled`, with `fireAt = pickupAt − prepMin`. Every open POS or KDS device calls `POST /api/b/:branch/tick` once a minute. The tick queries orders that are due, then **claims each one in its own transaction**: it re-reads the order, and only if its lines are still `scheduled` does it flip them to `fired`, create the KDS tickets and deduct stock, all in that same transaction. A second screen ticking at the same moment re-reads `fired` and does nothing, so an order can never fire twice. The nightly cron is only a safety net. If no device is open, nobody is in the kitchen anyway.

**Stock** changes use `FieldValue.increment` plus an appended movement, so a popular ingredient never becomes a transaction hotspot. Stock may go negative, which shows up as a variance. Receiving goods recomputes the weighted average cost inside a transaction.

**`dailySummaries`** are updated incrementally in the payment, void and refund transactions, so "today so far" is live. The nightly job rebuilds the business day that just closed from raw data and marks it `finalized`. HQ never scans orders.

---

## 13. API routes

All routes are under `/api`. **P** = public (rate-limited), **S** = staff session or device, **G** = group roles, **C** = cron secret, **W** = provider signature. ★ = needs an `Idempotency-Key`.

### Auth and devices
| Route | Who | Purpose |
|---|---|---|
| `POST auth/login` · `POST auth/logout` · `GET auth/me` | P/S | Password login, session cookie, current user and branches |
| `POST auth/pin` · `POST auth/lock` | S (device) | Switch user by PIN, lock the screen |
| `POST auth/firebase-token` | S | Custom token for `onSnapshot` |
| `POST auth/demo` | P (demo only) | One-tap role × branch login |
| `POST devices/register` · `GET devices/me` | S manager | Bind this browser to a branch |

### Public: website and guests (`public/…`)
| Route | Purpose |
|---|---|
| `GET geo` | Suggested branch from `x-vercel-ip-country` (and region, so Bali visitors get DPS) |
| `GET branches` · `GET branches/:slug` | Profiles, hours, open status, public settings |
| `GET branches/:slug/menu?channel=` | Live menu (website: `s-maxage=15`; QR/takeaway: `no-store`) |
| `GET fx-hint?branch=` | Indicative rates for the "≈ ¥" hint |
| `GET branches/:slug/availability?date&adults&children` | Reservation slots |
| `POST branches/:slug/reservations` ★ | Book (honeypot, rate limit, deposit or enquiry for large parties) |
| `GET \| PATCH \| DELETE reservations/:token` | Manage link: view, change, cancel |
| `POST branches/:slug/enquiries` | Private dining / events lead |
| `GET branches/:slug/takeaway-slots?date` · `POST branches/:slug/takeaway` ★ | Pickup slots, place a takeaway order |
| `GET takeaway/:token` | Takeaway status |
| `GET table/:qrToken` | Session, menu, shared cart, orders, time left, running total |
| `POST table/:qrToken/cart` | Add, update or remove cart lines (per-token rate limit, max qty) |
| `POST table/:qrToken/orders` ★ | Place the table's cart |
| `POST table/:qrToken/calls` | Call waiter, request bill |
| `POST table/:qrToken/pay` ★ | Pay at table (check or whole bill) with invoice details |
| `GET payments/:id` · `POST payments/:id/simulate` | Payment status poll · mock "simulate paid" |
| `GET receipts/:token` · `POST feedback/:token` · `POST privacy-requests` | E-receipt, rating, PDPA request |

### Branch staff (`b/:branch/…`)
| Area | Routes |
|---|---|
| Floor & sessions | `GET floor` · `POST sessions` ★ · `PATCH sessions/:id` · `POST sessions/:id/transfer` · `POST sessions/:id/merge` · `POST sessions/:id/confirm-qr` · `PATCH calls/:id` |
| Orders | `GET orders` · `POST orders` ★ (counter/takeaway) · `GET orders/:id` · `POST orders/:id/lines` ★ · `PATCH orders/:id/lines/:lineId` · `POST orders/:id/fire` ★ · `POST orders/:id/lines/:lineId/void` (A) · `POST orders/:id/move-lines` · `POST \| DELETE orders/:id/discounts` · `POST \| DELETE orders/:id/split` · `POST orders/:id/reopen` (A) |
| Payments & invoices | `POST orders/:id/payments` ★ · `POST orders/:id/refunds` ★ (A) · `POST orders/:id/invoices` ★ · `POST invoices/:id/void` (A) · `POST invoices/:id/allowance` · `GET orders/:id/receipt` · `POST orders/:id/send-receipt` · `POST invoices/consolidate?month=` (MY) |
| KDS | `PATCH kds/:ticketId` (item done, bump, recall) · `POST tick` |
| Menu | `GET menu` · `POST menu/items` · `PATCH menu/items/:id` (price → `menu.branch.price`) · `POST menu/items/:id/sold-out` |
| Reservations | `GET reservations?date` · `POST reservations` ★ · `PATCH reservations/:id` · `POST reservations/:id/seat` · `GET \| POST waitlist` · `PATCH waitlist/:id` · `GET \| POST \| DELETE closures` · `GET \| PATCH enquiries` |
| Takeaway | `GET takeaway?date` · `PATCH takeaway/:id` |
| Shifts & time | `POST shifts` · `POST shifts/:id/cash` · `POST shifts/:id/close` · `GET shifts/:id/x` · `GET reports/z?date` · `POST timeclock` · `GET timesheets?week` |
| Inventory | `GET stock` · `POST stock/adjust` · `POST waste` · `GET \| POST stock-counts` · `PATCH stock-counts/:id` · `GET \| POST \| PATCH suppliers` · `GET \| POST purchase-orders` · `POST purchase-orders/:id/receive` · `GET \| PUT recipes/:masterItemId` · `GET food-cost` |
| Finance & reports | `GET dashboard` · `GET reports/sales` · `GET reports/tax?period` · `GET reports/pnl?year` · `GET reports/:name.csv` · `GET \| POST \| PATCH expenses` |
| Settings & people | `GET \| PATCH settings` · `GET \| PUT floor-plan` · `POST tables/:id/rotate-qr` · `GET qr-sheet` · `GET \| POST \| PATCH staff` · `POST staff/:id/pin` · `GET \| PATCH \| DELETE devices/:id` · `GET feedback` · `GET audit` · `POST uploads` |

### Customers (group-wide data, scoped by permission)
`GET customers` · `GET customers/:id` · `PATCH customers/:id` · `GET customers/:id/export` · `DELETE customers/:id` · `GET customers.csv`

### Head office (`hq/…`)
`GET dashboard?currency` · `GET now` · `GET league?month` · `GET compare/:report` · `GET pnl?from&to&currency` (+ `.csv`) · `GET \| PUT fx/:month` · `POST fx/:month/fetch` · `POST fx/:month/lock` · `GET \| POST \| PATCH master-items` · `POST master-items/:id/push` · `GET \| POST \| PATCH categories, modifier-groups, allergens, ingredients` · `GET translations/missing` · `GET \| PATCH content` · `GET \| POST \| PATCH promotions` · `POST promotions/:id/push` · `GET \| POST branches` (wizard) · `GET \| POST \| PATCH staff` · `GET audit`

### Cron and webhooks
`GET cron/daily` (C) · `GET cron/group` (C) · `GET cron/nightly` (C) · `POST webhooks/:provider/:branch` (W: Midtrans SHA-512 signature, Stripe `Stripe-Signature` HMAC, TapPay, ECPay CheckMacValue, LINE `X-Line-Signature`)

That's about 110 routes in total, which is why D1 matters.

---

## 14. Provider adapters

```ts
interface PaymentProvider {
  createCharge(i: { branchId; paymentId; amount: Money; method; returnUrl; idempotencyKey; locale }):
    Promise<{ status: 'pending' | 'succeeded'; redirectUrl?: string; qrString?: string; clientSecret?: string; providerRef: string }>
  getStatus(ref): Promise<PaymentStatus>
  handleWebhook(request: Request): Promise<{ paymentId; status; providerRef; raw }>   // verifies signature first
  refund(i: { paymentId; providerRef; amount: Money; reason; idempotencyKey }): Promise<RefundResult>
}
interface InvoiceProvider {
  issue(i: InvoiceInput): Promise<IssuedInvoice>          // number, randomCode, QR payloads, status
  void(inv, reason): Promise<void>
  adjust(inv, allowance: Money, lines): Promise<Adjustment> // TW 折讓 / MY credit note
  getStatus(inv): Promise<InvoiceStatus>
}
interface MessagingProvider { send(to, template, params, locale): Promise<{ sent: boolean; link?: string }> }
interface EmailProvider     { send(to, subject, html, text): Promise<void> }
interface FxSource          { fetch(month, base, quotes[]): Promise<Record<Currency, string>> }
```

- **Choosing a provider**: `branches/{id}.providers` (e.g. `{ payment: 'midtrans', invoice: 'mock', messaging: 'whatsapp-link' }`). Credentials come from per-branch env vars, e.g. `MIDTRANS_SERVER_KEY_JKT`, `STRIPE_SECRET_KEY_SIN`, `TAPPAY_PARTNER_KEY_TPE`, `ECPAY_EINVOICE_HASH_KEY_TPE`, `MYINVOIS_CLIENT_ID_KUL`. `DEMO_MODE=true` forces `mock` everywhere, whatever the settings say.
- **Build order**: mock (all four countries) → Midtrans → Stripe → TapPay. Invoices: mocks → ECPay e-invoice → MyInvois → SG/ID (rendered in-house, no external provider).
- **All of them use `fetch` and Web Crypto**, with no vendor SDKs.
- **The mock payment screen** shows a fake QR, wallet or card form in the branch's currency with a "Simulate paid / failed" button, and drives the same webhook path as the real providers.
- **The Taiwan mock** prints the 58 mm 證明聯 with a Code 39 barcode and QR codes stamped "SAMPLE / 範例". A carrier or donation-code invoice prints only a receipt, which is how real 電子發票 work.
- **The FX source** is `open.er-api.com` (free, no key). The ECB-based APIs such as Frankfurter **don't carry TWD**. HQ Finance can always override, and locking a month freezes its rates.

---

## 15. Public website

| URL | Page |
|---|---|
| `/` | Middleware redirects to `/{lang}/` |
| `/{lang}/` · `story` · `locations` · `gallery` · `private-dining` · `faq` · `privacy` | Brand pages |
| `/{lang}/{branch}/` · `menu/` (+ `?print`) · `reserve/` · `takeaway/` · `private-dining/` | Branch pages |
| `/t/{qrToken}` · `/r/{token}` · `/o/{token}` · `/f/{token}` · `/receipt/{token}` | Guest flows (noindex, light bundle, no motion libraries) |
| `/login` · `/device` · `/staff/*` · `/hq/*` | App entry (noindex) |

- **Rendering**: as in D6. About 160 prerendered HTML files: 7 languages × 7 brand pages, plus 21 enabled branch-language pairs × 5 pages, plus 404s. `trailingSlash: true`.
- **Header**: shows "Bara Singapore ▾" (branch chooser) and the language picker, which are independent. On first visit a suggestion toast appears ("You seem to be in Singapore: view Bara Singapore?"), driven by `GET /api/public/geo`. It never redirects. The choice is remembered in a cookie and localStorage.
- **Motion**: GSAP and ScrollTrigger handle headline character/word rises (split by grapheme for CJK), clip-path image wipes and ScrollTrigger reveals. Lenis handles smooth scroll. There's a CSS film-grain overlay and an ember glow on hover. `prefers-reduced-motion` turns off Lenis, the splits and the embers.
- **Ember hero**: a hand-written WebGL point-sprite shader (a few KB, **no three.js**), loaded after `requestIdleCallback`. It's skipped when `deviceMemory < 4`, `saveData` is on, the connection is slow, or reduced motion is set. Those visitors get a still poster, or a muted loop video if `brand.heroMedia.video` is set (none by default).
- **`<Image>`**: Unsplash URLs with `w`/`q`/`fm=avif` srcset, the `aspect-ratio` attribute, lazy loading except the LCP image, and a blur-up placeholder from a 24 px variant. It swaps to Firebase Storage URLs when real photos arrive. Every photo is credited in `CREDITS.md`.
- **SEO**: per-page, per-language title and description; per-branch Open Graph images; `sitemap.xml`; `robots.txt` (disallowing `/staff`, `/hq`, `/t`, …); Organization JSON-LD; Restaurant + Menu + OpeningHoursSpecification JSON-LD per branch; hreflang.
- **Budgets**, checked by `scripts/size-check.ts` after the build: homepage JS ≤ 200 KB gzip (target ≈ 160), CSS ≤ 30 KB, LCP image ≤ 120 KB, Lighthouse mobile ≥ 90 in en and zh-TW (run with `npx lighthouse`, not installed as a dependency).

## 16. Staff and HQ apps (at a glance)

| Role (device) | Home screen | Main screens |
|---|---|---|
| Waiter (phone/tablet) | Floor | Floor plan by status, table order pad (search, favourites, modifiers, seat, course, hold/fire), QR confirmations, calls |
| Host (tablet) | Host | Timeline per table (drag to assign), list, waitlist, walk-in seat |
| Cashier (10" landscape) | POS | Open bills, bill view, split, tender pad, invoice dialog per country, receipt print, shift, X/Z |
| Kitchen (KDS screen) | KDS | Station or expo, done/bump/recall, sold-out |
| Manager | Dashboard | Everything above, plus menu, inventory, reports, expenses, settings, staff, devices, customers, feedback, audit |
| Owner / Area / Finance / Menu Editor | `/hq` | Group dashboard, now view, league, compare, consolidated P&L, FX, master menu, translations, content, promotions, new-branch wizard |

UI rules: 48 px minimum touch targets, dark and light themes, the branch always in the header with a switcher, offline banner (§4.6 of the brief), common actions in 1–2 taps, keyboard and screen-reader friendly forms.

## 17. Cron (`vercel.json`)

| Job | Hobby schedule (UTC) | What it does |
|---|---|---|
| `cron/daily?tz=+8` | 15:30 (≈ 23:30 TPE/DPS/KUL/SIN) | Each due branch's daily email to its manager (in their language): sales so far, covers, low stock, alerts |
| `cron/daily?tz=+7` | 16:30 (≈ 23:30 JKT) | Same for Jakarta |
| `cron/group` | 00:00 (08:00 Taipei) | Group Owner email: yesterday per branch plus the consolidated total |
| `cron/nightly` | 21:15 (05:15 UTC+8 / 04:15 UTC+7, after every cut-off) | Rebuild and finalise yesterday's `dailySummaries`, clean up TTL leftovers, run the takeaway firing safety net, **demo rolling reset** (D4), and **call the Vercel Deploy Hook** if `meta/site.changedAt` is newer than the last hook call (D6) |

Each job checks `Authorization: Bearer $CRON_SECRET` and writes `jobRuns/{job-branch-date}`, so a retry or a double fire does nothing.

## 18. Demo mode

`DEMO_MODE=true` gives:
- the dismissible ribbon (remembered per device) on public and staff pages;
- one-tap login on `/login` for every role in every branch, plus Group Owner;
- mock payment, invoice, messaging and email providers. Emails and messages appear in a "Demo outbox" panel instead of being sent;
- **blocked destructive settings**: delete branch, deactivate the last manager, change tax or providers, rotate all QR codes, delete customers, lock FX months, change passwords. The API returns 403 with a friendly message, and the block is logged;
- the nightly rolling reset (D4);
- `noindex` on everything except the public site, which stays indexable as a portfolio piece (your call).

With `DEMO_MODE` off, none of this exists: the demo login route returns 404.

---

## 19. Testing

| Suite | Command | Needs | Covers |
|---|---|---|---|
| Unit | `npm test` | Nothing | money, FX, every country profile, `calculateBill` worked examples, splits, cash rounding, business day and zones, opening hours, reservation and takeaway availability (including holidays and WIB/WITA), stock deduction, WAC, food cost, TW validators, phone, permissions, numbering, i18n shape. Target ≥ 95% line coverage on `shared/` |
| Integration | `npm run test:integration` | Emulator (Java) | Handlers end to end: idempotent replays, gap-free numbering under concurrency, branch scoping 403/404s, approval PINs, audit entries, summaries incremented correctly |
| Rules | `npm run test:rules` | Emulator (Java) | A Jakarta cashier can't read `branches/sin/**`; kitchen can't read orders; nobody can write |
| E2E | `npm run test:e2e` | Emulator + Playwright browsers | The 10 flows in brief §6. Each one is written in the phase that completes it (see §21), not saved for the end. "Two phones" means two browser contexts |
| All | `npm run test:all` | Everything | Run at the end of each phase where Java is available |

`npm test` stays emulator-free, so the required per-phase gate (`build`, `lint`, `test`) runs anywhere. The emulator suites also run at each phase end once D2 is done.

---

## 20. Dependencies (one line each)

**Runtime**
| Package | Reason |
|---|---|
| `react`, `react-dom`, `react-router-dom` | Required stack (same versions as the sibling demos) |
| `firebase-admin` | Server access to Firestore, Storage and custom tokens |
| `firebase` | Client SDK for staff realtime `onSnapshot` only. Modular imports, app bundle only |
| `@vercel/functions` | `next()` in `middleware.ts`, as STOEDIO already does |
| `gsap` | Required motion (includes ScrollTrigger) |
| `lenis` | Required smooth scroll |
| `zod` | Strict request validation that rejects unknown fields, with one schema shared by the API and staff forms |
| `uqr` | Tiny zero-dependency QR encoder (SVG) for table QR sheets, receipt feedback QR and the Taiwan e-invoice QR codes |
| `@fontsource-variable/fraunces`, `@fontsource-variable/inter` | Self-hosted Latin display and body fonts (small Latin subsets), so English pages make no third-party font request. CJK fonts come from Google Fonts per locale (§9), with no package |

**Dev**
| Package | Reason |
|---|---|
| `typescript`, `vite`, `@vitejs/plugin-react`, `oxlint`, `@types/*` | Required stack, same as the sibling demos |
| `vitest` | Unit and integration tests |
| `@playwright/test` | The section 6 end-to-end flows |
| `firebase-tools` | Emulators, plus deploying rules and indexes. Pinned per project instead of a global install |
| `@firebase/rules-unit-testing` | Security rules tests against the emulator |
| `tsx` | Runs the TypeScript seed and scripts with the same `.js`-suffixed imports Vercel uses |

**Deliberately not added**: UI kit, headless component library (native `<dialog>` and pointer events are enough), date library (`Intl`), `libphonenumber-js` (own rules for the 4 countries plus an E.164 shape check for everything else), chart library (plain SVG), drag-and-drop library, three.js / R3F (hand-written WebGL embers), payment/email SDKs (`fetch` + Web Crypto), i18n library (typed objects), state library, PDF library (print CSS), map library (SVG map + click-to-load embed).

---

## 21. Phase plan

Sizes are relative: S = small, M = medium, L = large, XL = extra large. Every phase ends with build + lint + test (+ emulator suites when available), `PROGRESS.md`, and a summary of under 15 lines. **Each phase is done when** its listed checks pass.

| # | Phase | Size | Delivers | Done when |
|---|---|---|---|---|
| 1 | **Foundation** | XL | Scaffold (two Vite entries, strict TS, oxlint, vitest); `api/index.ts` dispatcher, route generator and Vite API plugin; `middleware.ts`; tokens.css and fonts; all 7 guest and 5 staff i18n files (initial keys); `shared/` money, FX, currencies, 4 country profiles (with `lastReviewed`), settings merge, `calculateBill` + splits + cash rounding with the worked examples, time and business day, phone, TW validators, permissions; `lib/` context, validation, idempotency, counters, audit, rate limits; auth (passwords, sessions, devices, PINs, approvals, custom tokens), a bare `/login` with demo buttons, `/device`; Firebase emulator config, rules skeleton + first rules test, index file; **seed**: brand, 5 branches, floor plans, settings, master menu (~45 items × 7 languages, 8 categories, modifiers, allergens), branch menus (30–40 + 2–4 specials, local prices), ~35 ingredients, recipes, suppliers, staff for every role and branch plus group users, and the **60-day history generator** (orders priced by `calculateBill`, payments, reservations, shifts, expenses, stock movements, daily summaries; Bali sunset peak, Singapore lunch, KL weekends); demo flag and ribbon; `cron/nightly` with the rolling demo reset (D4) and the deploy-hook check (D6); `ARCHITECTURE.md` draft, README skeleton, `.env.example` | Unit tests are green with the worked examples; `npm run seed` fills the emulator; demo login reaches an empty `/staff/:branch` shell; a Jakarta cashier is refused `sin` (rules + API) |
| 2 | **Public website** | L | All brand and branch pages in 7 languages, header with branch chooser and geo suggestion, language picker, hreflang, live menu in local currency with price-display notes and badges, printable menu, locations SVG map, open/closed badges in each branch's time zone, FAQ per branch, messaging button, sticky Reserve bar, embers hero, motion, `<Image>`, SEO (JSON-LD, sitemap, robots, OG), prerender, STOEDIO credit; Reserve and Takeaway UIs with stubbed submission; `CREDITS.md` | Lighthouse ≥ 90 on mobile in en and zh-TW; JS ≤ 200 KB; 360 px layouts checked; screenshots in ja/ko/zh |
| 3 | **Menus, floor plans, branch settings** | L | HQ master menu editor (7-language fields, "missing" flags, modifiers, allergens, dietary, recipe, photo upload); push to branches with suggested prices; branch menu manager (select, price with permission + approval, station, channels, times, specials, sold-out); alcohol rule in KL (enforced in `shared/menu-rules.ts` + API); floor plan editor (grid drag, shapes, seats, areas, combinable tables); branch settings screens (§6.4) with audit | An alcohol item can't be enabled in KL (unit + API); a price change by a manager is refused by default; the website menu reflects edits |
| 4 | **Reservations** | L | Availability engine (hours, closures/holidays, capacities, combinations, durations, buffer, max covers per 15 min, walk-in holdback, time zones) with tests; guest booking flow (policies, honeypot, deposit or enquiry); confirmation and manage link; email and LINE/WhatsApp notifications (mock first, Resend/LINE/WhatsApp Cloud behind env); host timeline + list + drag to table; status flow; waitlist with "table ready"; seating opens a table session with countdown; group-wide guest profiles | E2E flow 1 (book → host seats → session with countdown, once Phase 5 has the POS view; until then, up to the host seating) |
| 5 | **Dine-in core** | XL | Table sessions (open, covers, transfer, merge, move items), waiter app (live floor coloured by status, order pad, seats, courses, hold/fire, min-spend warning), orders and lines with fire → KDS tickets per station, KDS (station + expo, done/bump/recall, timers, sound, connection banner), sold-out from KDS/POS, POS open bills and bill view with country tax lines, voids with approval, discounts and comps, stock deduction on fire (simple version, finished in Phase 9), offline banner and guard | Flow 1 complete; void-with-PIN half of flow 6 |
| 6 | **QR ordering** | M | Signed table tokens, QR sheet print, guest flow (language, menu, modifiers, allergens, seat pick, shared cart, place order, statuses, time left, running total, call waiter, request bill), waiter confirmation option, abuse limits, token rotation | E2E flow 2 (Bali, ja + ko phones, Indonesian KDS, WITA business day); flow 8's sold-out half |
| 7 | **Payments and invoices** | XL | `PaymentProvider` mock → Midtrans → Stripe → TapPay; webhooks; pay-at-table; tender pad from the country profile (cash with change and denominations, card brand + approval code, wallets, mixed tenders, tips); split by seat, item, even N, custom; `InvoiceProvider` for TW (mock → ECPay), MY (mock → MyInvois, monthly consolidation), SG, ID; 80 mm receipts, 58 mm 證明聯, kitchen chits; send receipt link; refunds (void or allowance / credit note); shifts, pay-in/out, denomination count, X/Z | E2E flows 3, 4 (SG to the cent, KL 5 sen), 6 (refund → allowance, Z shows the void), 7 (shift difference, Z equals payments) |
| 8 | **Takeaway** | M | Online (branch pages) and counter; slots (hours, max per 15 min, prep time); pay online or at pickup (under a limit); packaging fee and BYO discount; no service charge; scheduled firing through `tick`; TAKEAWAY tag and pickup time on KDS; guest status page; mark picked up | E2E flow 5 (Jakarta, mock QRIS, fires at pickup − prep, PBJT, no service charge) |
| 9 | **Inventory** | L | Recipes with branch overrides, deduction on fire with modifier recipe deltas, stock return for voids before cooking, suppliers, POs, receiving with WAC and supplier invoice photo/input tax, counts with variance, waste log, low-stock alerts, food cost per dish and branch (flag > 35%), actual vs theoretical | E2E flow 8 complete (stock drops in that branch only) |
| 10 | **Branch finance and reports** | L | Manager dashboard and alerts; sales reports (all breakdowns, hourly heatmap, guest language); tax report per country; expenses with receipt photos; monthly P&L with prime cost; CSV with BOM; print/PDF for Z and P&L; daily 23:30 email | Report totals match raw data in integration tests; CSV opens correctly in Excel with Chinese text |
| 11 | **Head office** | L | Incremental + nightly-finalised summaries; FX months (fetch, override, lock); group dashboard in TWD/USD/SGD/MYR/IDR with local figures alongside; league table; "now" view; comparisons (same-store growth, per seat, per labour hour, menu engineering, price comparison, heatmaps, language mix); consolidated P&L + CSV; new-branch wizard; group 08:00 email | E2E flow 9 (TWD → USD totals equal the sum of converted branch figures; Jakarta manager blocked) |
| 12 | **Staff, customers, feedback, devices, audit** | M | Staff accounts, roles per branch, PINs, language, deactivate; clock in/out, weekly timesheets with limit flags and labour cost into P&L; device list, rename, revoke; customers (group-wide, tags, consent per country, privacy notice ×7, export/delete, CSV); feedback page with a Google review nudge and low-rating alert; audit log viewer with filters | Unit + integration tests; manual checklist in PROGRESS |
| 13 | **Hardening** | L | All 10 Playwright flows green together (flow 10: demo KL cashier, blocked settings, nightly reset restores); full rules suite; accessibility pass (axe in Playwright, keyboard walk-throughs); Lighthouse pass; translation completeness check; final README (setup, env per provider and branch, Vercel, Firebase, emulators, demo mode, new branch, new country) and ARCHITECTURE; `docs/DEMO-SCRIPT.md` in English, 中文 and Bahasa Indonesia | Everything green; README followed from a clean clone works |

**Seed timing**: the history generator ships in Phase 1, using the final shapes from §6 and pricing every bill with `calculateBill`. Phases that refine a shape update the generator in the same phase, so reports and HQ look alive from day one.

---

## 22. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Size.** This is a real POS, KDS, reservations, inventory, finance and HQ system. Phases 1, 5 and 7 are each large. | Strict phase gates, pure-logic-first, no gold-plating in the staff UI, and e2e written per phase so regressions show early |
| R2 | **Vercel limits**: 12 functions on Hobby, daily-only imprecise crons | D1 dispatcher, D3 "run what's due" crons, device-driven takeaway firing |
| R3 | **Java for the emulator** (resolved) | D2: Homebrew `openjdk@21`; the emulator scripts find it even though it's keg-only |
| R4 | **Real provider adapters can't be fully verified without accounts**: Midtrans sandbox, Stripe test mode, TapPay sandbox, ECPay test merchant (public test keys exist), MyInvois sandbox (needs a TIN and a **digital certificate to sign documents**) | Mocks are the demo path. Real adapters are written to the provider docs, tested against sandboxes where keys exist, and marked "unverified" in PROGRESS otherwise. MyInvois document signing may need extra work before a real Malaysian launch |
| R5 | **Tax and compliance rules change** (MY SST scope, ID regional PBJT, SG GST, TW e-invoice formats, 證明聯 QR encryption with the seller's AES key) | Everything lives in settings and country profiles with a visible `lastReviewed`. The README says to confirm with a local accountant. Real 證明聯 QR content comes from the provider |
| R6 | **Firestore cost and hotspots** (seed volume, nightly reset, hot counters and summary documents) | D4 rolling reset; stock uses `increment`; one summary document per branch per day (well under 1 write/s even at peak); HQ reads summaries only |
| R7 | **Concurrent edits to one bill** (waiter + QR guests + cashier) | Every mutation is a transaction; `version` gives optimistic concurrency on PATCH; the UI refetches on 409 |
| R8 | **CJK fonts and Lighthouse** (zh-TW performance) | `unicode-range` slices, no CJK preload, swap, display serif for headings only, `size-check` after every build, Lighthouse run in zh-TW each phase that touches the public site |
| R9 | **Stale SEO data** (D6) | JSON-LD comes from the build snapshot; an optional deploy hook on menu publish later |
| R10 | **Public demo abuse**: one-tap logins into a live system | Rate limits everywhere, destructive settings blocked, mock outbound only, nightly reset, max quantities |
| R11 | **QR token leakage** (photos of the table QR shared online) | Ordering works only while the session is open; per-token rate limits; one-tap rotation per table or branch |
| R12 | **Personal data law** (TW PDPA, ID PDP Law, MY PDPA, SG PDPA): consent, retention, cross-border transfer | Consent records per country, privacy notice ×7, export/delete tools. A real client launch needs a legal review of hosting region and transfer terms (Indonesia in particular) |
| R13 | **Holiday dates** move each year (Lebaran, Nyepi, Lunar New Year, Hari Raya) | They're data, not code; seeded 2026–27 dates are marked "verify"; managers edit closures |
| R14 | **Time zone bugs** (WIB vs WITA, cut-off at 04:00, bills past midnight) | Pure, heavily tested time module; business date stored on every document at write time |

## 23. Out of scope (future work)

Native apps · delivery platform integrations · full offline sync (only an offline banner and guard now) · direct thermal printer drivers (ESC/POS) · central kitchen and stock transfers between branches · franchise royalty billing · loyalty points · payroll · per-country domains (routing stays ready: `APP_URL` plus branch/language in paths) · Indonesian regional tax monitoring devices.

---

**Next step:** your go-ahead (and any changes to D1–D7). Then I build Phase 1 only and stop.
