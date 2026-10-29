You are building a complete, production-quality multi-branch restaurant system for a fictional restaurant group called Bara 炭焰, with branches in Taiwan, Indonesia, Malaysia and Singapore. It is the flagship demo of STOEDIO (stoedio.com), a small web studio, so it must be good enough to show to real restaurant owners and to adapt for a real client later. Read this whole brief before writing any code.

0. How to work
Start in plan mode. Before writing code, produce docs/PLAN.md: folder structure, Firestore data model, API route list, role/permission matrix, how branch scoping works end to end, and the phase plan below with any risks you see. Save this brief verbatim as docs/PROMPT.md. Then stop and wait for my go-ahead.
Build one phase at a time. At the end of each phase: run npm run build, npm run lint and npm test, fix everything, update docs/PROGRESS.md (what's done, what's left, known issues, how to test it by hand), then stop and summarise in under 15 lines.
Prefer boring, readable code over clever code. Keep business logic (money, currency, tax, rounding, availability, stock, splitting bills, FX conversion) in pure functions with unit tests. Components stay thin.
Never hard-code a country rule in a component. Everything that differs by country or branch (currency, tax, service charge, rounding, invoicing, payment methods, messaging, languages, phone formats, time zone) comes from the branch's settings and a country profile module.
Don't add dependencies casually. Every new package needs a one-line reason in docs/PLAN.md.
If something in this brief is ambiguous, pick the sensible option, note the assumption in docs/PROGRESS.md, and keep going. Only stop to ask if a choice would be expensive to undo.
1. The restaurant group
Name: Bara 炭焰 ("bara" is Indonesian/Malay for embers; 炭焰 means charcoal flame, same characters in Traditional and Simplified). Tagline idea: "Fire, smoke and the flavours of the archipelago" / 「炭火、煙燻、南洋風味」 / "Api, asap, dan rasa Nusantara".
Story: an Indonesian chef opened the first Bara in Taipei in 2021, then brought it home to Jakarta and Bali and across to Kuala Lumpur and Singapore.
Concept: modern Indonesian and Southeast Asian wood-fire and charcoal grill with a cocktail bar (where allowed). Sate, iga bakar (grilled beef short rib), Jimbaran-style grilled fish, grilled vegetables with sambal matah, smoked rice dishes, house sambals at adjustable heat (always offer a spice level). Pork-free across the brand. Drinks: Indonesian-inspired cocktails and mocktails (palm sugar coffee, jamu spritz), local craft beer, tea.
Tier: upper-middle casual dining in every market.
Dining rules (configurable per branch): dining time limit at peak, minimum spend per adult, how long a late reservation is held.
Kitchen stations (per branch, editable): Grill, Hot kitchen, Cold & pastry, Bar (no Bar station in KL; it becomes "Drinks").
Channels in every branch: dine-in (walk-in, reservation), QR self-ordering at the table, takeaway pickup ordered online or at the counter. Delivery goes through platform links only (no integration).
1.1 Branches
Code    Branch    Address (fictional)    Size    Average spend / guest    Notes
TPE    Taipei, Da'an (flagship)    near a Da'an MRT station    22 tables, ~70 covers, chef's counter, private room    NT$900–1,600    Bar until 00:00 Fri–Sat
JKT    Jakarta, Senopati    Jl. Senopati, Jakarta Selatan    30 tables, ~120 covers, terrace, private room    Rp 300.000–500.000    Licensed bar
DPS    Bali, Seminyak    Jl. Kayu Aya, Seminyak    26 tables, ~90 covers, garden, sunset bar    Rp 350.000–600.000    Many tourists; Japanese, Korean, Chinese and English guests
KUL    Kuala Lumpur, Bangsar    Jalan Telawi, Bangsar    24 tables, ~80 covers, private room    RM 90–160    Halal-certified, no alcohol
SIN    Singapore, Keong Saik    Keong Saik Road shophouse    14 tables, ~50 covers, chef's counter    S$60–110    Small, high turnover, bar
1.2 Country profiles (defaults; every value is a setting the owner can change)
Taiwan    Indonesia    Malaysia    Singapore
Currency (minor units)    TWD (0 decimals)    IDR (0 decimals)    MYR (2 decimals, sen)    SGD (2 decimals, cents)
Display    NT$1,280    Rp 125.000    RM 48.50    S$32.90
Time zone    Asia/Taipei    Asia/Jakarta (JKT), Asia/Makassar (DPS, one hour ahead of Jakarta)    Asia/Kuala_Lumpur    Asia/Singapore
Menu prices    include 5% business tax    exclusive ("++")    exclusive ("++")    exclusive ("++")
Service charge (dine-in only)    10%    5% JKT, 10% DPS    10%    10%
Tax    5% business tax, already inside the price, split out for reports    PBJT/PB1 restaurant tax 10% on (subtotal + service charge)    Service tax 6% on F&B; whether it applies to the service charge is a setting (default yes)    GST 9% on (subtotal + service charge)
Invoice / receipt    電子發票 e-invoice mandatory (section 4.6)    Printed receipt with NPWP; no e-invoice    Receipt with SST number; MyInvois e-invoice: one consolidated monthly e-invoice for B2C sales, an individual e-invoice when the buyer asks (they give their TIN/BRN)    Receipt that shows the GST registration number and GST amount
Cash rounding    NT$1    optional, to Rp 100    to the nearest 5 sen (required)    optional, to 5 cents
In-store payments    cash, card terminal, LINE Pay, JKOPay, EasyCard    cash, card/EDC, QRIS, GoPay, OVO, ShopeePay, bank transfer    cash, card terminal, DuitNow QR, Touch 'n Go eWallet, GrabPay    cash, card terminal, NETS, PayNow, GrabPay
Online payment provider    TapPay or ECPay    Midtrans or Xendit    Stripe (cards, FPX, GrabPay)    Stripe (cards, PayNow, GrabPay, Apple/Google Pay)
Guest messaging    LINE    WhatsApp    WhatsApp    WhatsApp
Delivery links    Uber Eats, foodpanda    GoFood, GrabFood, ShopeeFood    GrabFood, foodpanda, ShopeeFood    GrabFood, foodpanda, Deliveroo
Tax report    bimonthly (401)    monthly PBJT    bimonthly SST-02    quarterly GST F5
Phone format    09xx-xxx-xxx    08xx-xxxx-xxxx    01x-xxx xxxx    8xxx xxxx / 9xxx xxxx
Guest languages (default first)    zh-TW, en, ja, ko, id    JKT: id, en, zh-CN · DPS: en, id, ja, ko, zh-CN    en, ms, zh-CN, id    en, zh-CN, ms, id
Put these in a countryProfiles module (code) with per-branch overrides stored in Firestore. Include a visible "last reviewed" date on each profile and a note in the README that rates must be checked with a local accountant.

1.3 Seed data
A seed script that creates: the brand, the 5 branches with their floor plans and settings; a master menu of ~45 items across 8 categories with names and descriptions in all seven languages, modifiers (spice level, doneness, add-ons, sauce choice), allergens; branch menus that pick 30–40 master items each plus 2–4 local specials, with local prices that make sense for each market; ~35 ingredients with recipes and per-branch suppliers; staff for every role in every branch plus group-level users; and 60 days of plausible history per branch (orders, reservations, expenses, stock movements, shifts) with realistic differences (Bali busier at sunset, Singapore at lunch, KL on weekends) so every report and the HQ dashboard look alive on first run.

2. Tech stack and conventions (match these exactly)
Frontend: React 19 + TypeScript (strict) + Vite, React Router, plain CSS with CSS variables (CSS modules are fine). No UI kit for the public site. For the staff apps you may use a small headless library only if it saves real work.
Motion on the public site: GSAP + ScrollTrigger and Lenis for smooth scroll. Optional: a light Three.js / React Three Fiber ember-particle hero, loaded lazily after idle and skipped on low-memory devices, slow connections, and prefers-reduced-motion.
Backend: Vercel serverless functions in api/ (one file per route, exporting GET/POST/PATCH/DELETE), shared server logic in lib/. Nothing in lib/ runs in the browser.
Database: Firebase Firestore via firebase-admin on the server. Images in Firebase Storage.
Branch scoping: operational data lives under branches/{branchId}/… subcollections (orders, tables, reservations, stock, shifts, …). Group-level data (brand content, master menu, staff, FX rates) lives at the top level. HQ reports use collection-group queries. Every API handler resolves the branch from the URL or the registered device and checks the user may act in it.
All writes go through api/. Server-side validation rejects unknown fields; the server always recomputes prices and totals from the database, never trusts client totals.
Realtime reads for staff screens (KDS, floor plan, POS order list) use the Firestore client SDK onSnapshot, authenticated with a Firebase custom token minted by the API after staff login, with custom claims for role and allowed branch IDs. Firestore security rules: staff can read only their own branches and only what their role needs, no client writes at all. Guests never get Firestore access; guest screens poll the API (e.g. every 5 s for order status).
Auth: staff log in with username + password (signed HttpOnly session cookie, Web Crypto HMAC, 12–30 day expiry, rate-limited login). Devices (POS tablets, KDS screens) are registered to one branch by a manager, so they always know their branch; on a device, staff switch user with a 4–6 digit PIN. Sensitive actions (void, refund, discount above a limit, reopening a closed bill, voiding an invoice, cash drawer payout, price change) require a manager PIN even if a cashier is logged in. Protect /staff/* and /hq/* in middleware.ts.
Money:
Every amount is an integer in the currency's minor unit together with its currency code: { amount: 4850, currency: 'MYR' } is RM 48.50; { amount: 125000, currency: 'IDR' } is Rp 125.000. No floats anywhere.
One money.ts module: create, add (same currency only, throws otherwise), multiply by a rate with explicit rounding, allocate (split a total into N parts without losing a cent), format with Intl.NumberFormat in the right locale.
Amounts in different currencies are never added together except in HQ reports, through an explicit FX conversion (section 4.11).
Time: store UTC timestamps; display and compute business days in the branch's own time zone. A business day ends at 04:00 local time, not midnight, so late bar bills land on the right day. Remember Jakarta and Bali are in different time zones.
Phone numbers: validate per the branch's country, accept international numbers, store in E.164.
Languages (i18n):
Supported: zh-TW 繁體中文, zh-CN 简体中文, en English, id Bahasa Indonesia, ms Bahasa Melayu, ja 日本語, ko 한국어. Each branch enables a subset with a default (table 1.2).
Guest-facing (website, QR ordering, takeaway, booking, receipts, emails/messages) uses all enabled languages. Staff apps support zh-TW, zh-CN, en, id, ms as a per-user setting.
One file per language in src/i18n/ with the same shape; TypeScript must error if a key is missing. A language picker in the header, remembered per device, auto-picked from the browser on first visit, and in the URL for SEO, with hreflang tags.
Menu items, categories, modifiers and allergens store a name and description per language. Missing translations fall back to English, then the branch default, and the menu manager flags untranslated items. A guest who orders in Japanese in Bali still produces kitchen tickets in the cook's language.
Real CJK typography: Noto Serif/Sans TC for zh-TW, SC for zh-CN, JP and KR on those locales only, loaded with unicode-range subsets so Latin pages stay light.
Idempotency: every create-order, add-items, payment and invoice request carries a client-generated idempotency key, so a double tap or a retry on bad wifi never charges twice, fires a dish twice or issues two invoices.
Numbering (per branch): gap-free via Firestore transactions on a per-branch counters document: bills SIN-20261029-0042, takeaway SIN-T-017, reservations BARA-SIN-7KQ2.
Audit log: every void, refund, discount, price change, payment, invoice issue/void, stock adjustment, settings change and cross-branch access is written to an append-only audit log with who, branch, when, what, before/after.
Testing: Vitest for pure logic (thorough coverage of money, every country's tax and rounding rules, splitting, availability, stock, FX). Playwright for the critical flows in section 6.
Quality bars: Lighthouse ≥ 90 on mobile for the public homepage (performance, accessibility, SEO, best practices) in at least en and zh-TW; homepage JS under ~200 KB gzipped before the lazy 3D hero; every staff screen usable on a 10" tablet in landscape and the guest QR flow usable on a 360 px wide phone. Keyboard and screen-reader accessible forms.
Local dev: npm run dev must run the api/ functions locally too (a small Vite plugin mapping /api/<route> to api/<route>.ts, like Vercel), and support the Firebase emulators so the whole thing runs with no cloud account. npm run seed fills the emulator.
Domain and demo mode (STOEDIO showcase):
Deployed on Vercel at a STOEDIO subdomain, e.g. bara.stoedio.com (base URL in one env var, APP_URL, used for canonical URLs, QR codes and emails). Per-country domains are out of scope, but keep routing ready for them.
Footer credit on every public page: "Website & system by STOEDIO" linking to https://stoedio.com, translated in every language.
DEMO_MODE=true shows a slim dismissible ribbon "This is a STOEDIO demo restaurant · stoedio.com", a login page with one-tap buttons to enter as any role in any branch (and as Group Owner), mock providers only (no real emails, messages, payments or invoices), blocks destructive settings, and re-seeds the data nightly via Vercel Cron. With DEMO_MODE off it behaves as a real restaurant group's system.
Docs: README.md (setup, env vars per provider and branch, deploy to Vercel, Firebase setup, emulator use, demo mode, how to add a new branch or country) and docs/ARCHITECTURE.md (diagram, request flow, branch scoping, data model, where to change common things).
3. The public website (this is the one that must feel premium)
Goal: someone opening it on their phone in any of the four countries should feel the heat of the grill, find their nearest Bara in one tap, and book. Think editorial food magazine meets a dark, warm, cinematic restaurant site, and it must look just as good in Chinese, Japanese and Korean as in English.

Look and feel

Palette (as CSS variables): charcoal #141110 background, soot #1E1A18 surfaces, ember orange #E8642C as the single accent, brass #C8A46A for fine lines and small caps, bone #EFE7DA text, smoke grey for secondary text. Provide a light "daylight" variant only for the menu print styles.
Type: a high-contrast display serif for Latin headlines (e.g. Fraunces or Cormorant Garamond) paired with Noto Serif TC/SC for Chinese; a clean sans for body (e.g. Inter + Noto Sans). font-display: swap.
Motion: slow, confident. Headline words or characters rise in on load, images reveal with a clip-path wipe, a subtle film grain overlay, the ember accent glows on hover, smooth scroll with Lenis. Everything respects prefers-reduced-motion.
Imagery: high-quality placeholder photography (Unsplash URLs with credit in CREDITS.md) behind an <Image> component that handles srcset, lazy loading, aspect ratio and blur-up, so real photos can be dropped in later. Each branch has its own hero and gallery images.
Structure and URLs

Brand pages: /{lang}/ and /{lang}/story, /{lang}/locations, /{lang}/gallery, /{lang}/private-dining, /{lang}/faq.
Branch pages: /{lang}/{branch}/ (e.g. /en/singapore/, /zh-TW/taipei/, /ja/bali/) with menu, reserve, takeaway, private-dining under it.
Branch chooser: the header always shows the current branch ("Bara Singapore ▾"). On first visit, suggest the nearest branch using Vercel's x-vercel-ip-country header (suggest, never force) and remember the choice. Language and branch are independent: a Japanese visitor can view the Bali menu in Japanese with prices in rupiah, with an optional "≈ ¥" hint for tourists.
Pages / sections

Brand home: full-height hero (headline, short line, CTAs "Reserve a table" and "Find a Bara"), the ember particle effect or a looping muted video fallback; the story; a horizontally scrolling signature dishes strip; a locations strip (five branch cards with photo, city, local time and "Open now / Opens at 17:30"); press/review strip; gallery; footer with all branches, socials and the STOEDIO credit.
Locations: a map with all five branches, list with address, hours, phone, messaging button (LINE for Taipei, WhatsApp elsewhere), halal and alcohol badges.
Branch home: the branch's own hero, hours with live open/closed badge in the branch's time zone, address, map and transport tip (MRT, MRT Jakarta, LRT, etc.), signature dishes available there, local specials, chef's counter or garden highlights, delivery platform links for that country, reserve and takeaway CTAs.
Branch menu: reads live from the database (same source as the POS) in the branch's currency and price display ("prices include tax" in Taipei, "++ prices subject to 10% service charge and 9% GST" in Singapore, etc.), sticky category tabs, allergen icons, spice level, halal badge in KL, "chef's pick" and "only at Bara Bali" badges, sold-out items greyed. Printable version.
Reserve (section 4.2) and Takeaway (section 4.4) per branch, embedded beautifully.
Private dining & events: per-branch rooms and set menus, enquiry form that creates a lead for that branch.
Story / Chef, Gallery, FAQ (per-branch answers where they differ: service charge, tax, halal status, alcohol, dining time limit, minimum spend, children, corkage, parking, e-invoice in Taiwan), 404.
SEO: per-page, per-language titles and descriptions, Open Graph images per branch, sitemap.xml with every language × branch URL, robots.txt, Organization JSON-LD for the brand and Restaurant + Menu + OpeningHoursSpecification JSON-LD per branch, hreflang.
A floating messaging button for the current branch (LINE or WhatsApp) and a sticky mobile "Reserve" bar.
4. The operations system (functional first, clean and calm UI)
Staff apps live under /staff (always inside one branch) and the head-office app under /hq. Plain, high-contrast, big touch targets, dark and light themes, works on tablet and desktop. Speed matters more than decoration: common actions in 1–2 taps. The current branch is always visible in the header; users with several branches get a branch switcher.

4.1 Roles and permissions
Group level: Group Owner (everything, all branches, HQ settings, master menu, FX), Area Manager (assigned branches: everything a branch manager can do, plus comparison reports for those branches), HQ Finance (read-only finance and reports for all branches, expenses entry), HQ Menu Editor (master menu and translations, no finance).
Branch level: Branch Manager, Cashier, Waiter, Kitchen, Host.
A staff member can belong to several branches with a role in each. Put the permission matrix in one config file used by both the API and the UI, e.g. can(user, 'bill.void', branchId).
4.2 Reservations (per branch)
Guest booking: pick party size (adults and children separately), date, then available time slots (15-minute steps) in the branch's local time, labelled with the time zone if the visitor's own differs. Slots come from an availability engine (pure function) that considers opening hours, closed days and special closures (Lunar New Year, Lebaran, Nyepi in Bali, Hari Raya, national holidays, typhoon days), table capacities and combinable tables, dining duration (configurable by party size and time of day), a buffer between turns, a max covers per 15-minute slot to protect the kitchen, and a share of tables held back for walk-ins.
Guest enters name, mobile number, email, occasion, allergies/notes, dietary needs (halal, vegetarian), seating preference, preferred language. The form shows that branch's dining time limit, minimum spend, hold policy and charges, and the guest accepts them. Rate-limited, honeypot-protected.
Large parties and private rooms: request a deposit (via the branch's payment provider) or turn into an enquiry, configurable per branch.
Confirmation page with a short code and a manage link (token) to view, change or cancel within the cancellation window. Confirmation and same-day reminder by email (Resend) and by the branch's messaging channel: LINE in Taiwan (Messaging API, if the guest linked the restaurant's LINE account), WhatsApp elsewhere (click-to-chat links by default; optional WhatsApp Business Cloud API adapter). All in the guest's language.
Host view: timeline per table for the day and a list view; drag a reservation onto a table; statuses Booked → Confirmed → Arrived → Seated → Finished, or No-show / Cancelled. Waitlist for walk-ins with quoted wait time and a "your table is ready" message. Seating a reservation opens a table session in the POS and starts the dining-time countdown.
Guest profiles are shared across the group (one guest who visits Taipei and Singapore is one person), with visits, no-shows, allergies, notes, spend per currency, language.
4.3 Dine-in orders and QR ordering at the table
Each table has a printable QR code (generated in branch settings, printable sheet with table number, branch name and a short line in the branch's languages). The QR contains a signed token for that branch and table, not a guessable ID. Seat numbers are supported: guests can pick their seat after scanning, and waiters can tag items by seat, so bills can be split by seat later.
Table session: a table is "open" from seating until the bill is paid. Setting: QR ordering either auto-opens a session on first scan, or requires staff to open the table first (default). Scanning a table with no open session shows the menu read-only with a "call staff" button.
Guest QR flow (mobile web, no app, no login): choose a language, browse the branch menu, choose modifiers, add notes, see allergens, add to a cart that is shared by everyone at the table, place the order. Option to require a waiter to confirm QR orders before they reach the kitchen. Guests see order status (received, preparing, served), the time left in their dining slot, a running total with that country's charges, can call the waiter, request the bill, and optionally pay at the table with that country's methods (LINE Pay in Taipei, QRIS in Indonesia, DuitNow in KL, PayNow in Singapore, cards everywhere), entering invoice details where the country needs them.
Abuse protection: rate limits per table token, max quantity per item per order, session expires when the bill closes, tokens can be rotated.
Waiter app (tablet/phone): live floor plan coloured by status (free, reserved soon, seated, ordered, food out, bill requested, needs attention, near time limit), with time since seated. Open a table, set covers, take orders fast (search, favourites, modifiers, seat number, course with "hold" and "fire course"), send to kitchen, see QR orders and waiter calls as alerts, transfer or merge tables, move items between tables. Warn when a table is below the minimum spend.
4.4 Takeaway (per branch)
Online on the branch's website pages and at the POS counter. Guests pick items, choose ASAP or a pickup time (within opening hours, respecting a max takeaway orders per 15 minutes and prep time), enter name and mobile number, pay online via the branch provider or choose "pay at pickup" (configurable, limited to orders under an amount).
No service charge on takeaway (configurable). Optional packaging fee and a "bring your own container" discount. Takeaway orders go to the KDS with a TAKEAWAY tag and pickup time, and fire automatically at pickup time minus prep time.
Status page for the guest (received, preparing, ready for pickup) in their language; staff mark it Picked up.
4.5 Kitchen display (KDS)
One screen per station or an "all" expo screen, per branch. Each menu item is routed to a station in that branch. Ticket text in the screen's chosen staff language, whatever language the guest ordered in.
Tickets show table/takeaway number, seat, course, items, modifiers highlighted, allergies in red, and a timer that turns amber then red at configurable thresholds.
Tap an item to mark it done, bump the ticket when all are done, recall the last bumped tickets. The expo screen shows when every station has finished a ticket.
Realtime via Firestore onSnapshot, a sound on new ticket, and a visible "connection lost" banner that auto-recovers.
Mark an item sold out from the KDS or POS: it disappears from that branch's QR ordering and takeaway immediately.
4.6 POS / cashier (per branch)
Open bills list (dine-in tables, takeaway, counter orders), plus quick counter sale.
Bill view: items, modifiers, seat, discounts, service charge, tax lines as that country shows them, rounding line, total. Removing fired items is a void with a reason and permission.
Discounts: percentage or fixed, per item or per bill, named promos (e.g. "Happy hour 20% off drinks 17:30–19:00" per branch, group-wide birthday dessert), staff meal, complimentary items, all with permission rules and audit.
Charges engine: one pure, heavily tested function calculateBill(lines, discounts, countryProfile, branchSettings, channel) that handles every rule in table 1.2: tax-inclusive (Taiwan: tax split out as total × 5 / 105, never added) vs tax-exclusive (Indonesia, Malaysia, Singapore: tax added, on subtotal + service charge where the setting says so), service charge by channel, order of discounts, line-level vs bill-level rounding, and cash rounding (5 sen in Malaysia, shown as a rounding line, applied only to cash payments). Add a table of worked examples per country to the tests.
Split bill: by seat, by item (drag items to sub-bills), evenly by N people (one tap), or by custom amounts, using allocate() so no cent is lost. Each split is paid separately and gets its own invoice where needed.
Payments: the tender buttons come from the country profile (table 1.2): cash with change calculation and quick-amount buttons in local denominations, card via an external terminal (record brand and approval code), QR wallets, bank transfer, and mixed tenders on one bill. Tips recorded separately.
Invoices and receipts per country: build an InvoiceProvider interface (issue, void, adjust, getStatus) with one implementation per country and a mock for each:
Taiwan, 電子發票 (mandatory): at payment choose a mobile barcode carrier (手機條碼, / + 7 characters, validated), a company tax ID (統一編號, 8 digits with the official checksum) for a B2B invoice, a donation code (愛心碼), or a printed invoice (default). Provider behind env vars (e.g. ECPay or ezPay). Store invoice number and random code; refunds void the invoice or issue an allowance (折讓). Print the 58 mm 電子發票證明聯 layout with barcode and QR codes; mock mode prints "SAMPLE / 範例".
Malaysia, MyInvois: normal receipts for walk-in guests, collected into one consolidated e-invoice per month submitted after month end; an individual e-invoice when a buyer asks (capture name, TIN, BRN/ID, address, email). Provider adapter for the LHDN MyInvois API behind env vars; mock by default. Receipts show the SST registration number.
Singapore: receipt shows "GST Reg No." and the GST amount; full tax invoice on request with the buyer's company name.
Indonesia: receipt shows NPWP and the PBJT line. No e-invoice.
Receipts: an 80 mm thermal layout via a print stylesheet (window.print()), with branch header and tax IDs, bill number, items, charges, tax, rounding, payment, change, a "thank you" line in the guest's language, and a QR to a feedback page. Option to send the receipt as a LINE/WhatsApp link or email. Kitchen chits print the same way.
Refunds after payment: manager only, full or per item, reason required, linked to the invoice void/adjustment, reflected in reports.
Shifts and cash drawer: open a shift with a starting float, pay-ins/pay-outs with reasons, close by counting cash by local denomination (e.g. S$100 notes down to 5¢ coins); the system shows expected vs counted and the difference. X report (mid-shift) and Z report (end of day) printable.
Offline behaviour: show a clear offline banner. Allow building orders offline in local state, but block sending to the kitchen, taking payments and issuing invoices until reconnected. (No full offline sync; note it as future work.)
4.7 Menu (master + branch) and inventory
Master menu (HQ): items with names and descriptions in all seven languages and a "translation missing" indicator, photos, allergens, spice level, dietary tags (halal-suitable, vegetarian, vegan, contains alcohol), recipe, modifier groups (required/optional, min/max choices). The HQ Menu Editor maintains it.
Branch menu: each branch picks master items, sets local price in local currency, station, available channels (dine-in / QR / takeaway), availability times (e.g. lunch-only), and adds local specials. Rules enforced: items tagged "contains alcohol" can't be enabled in a branch with alcohol disabled (KL); branch managers can change availability and sold-out status, but price changes need Group Owner or Area Manager by default. HQ can push a new item to several branches at once with suggested prices per currency. Changes show on the website, QR menu and POS at once.
Ingredients and recipes: master recipes with per-branch substitutions (e.g. local fish), ingredients with unit (g, ml, pcs), cost per unit in local currency, par level, supplier, per branch. Stock is deducted automatically when items are fired, and returned for voids made before cooking.
Purchasing (per branch): suppliers, purchase orders, receiving goods (updates stock and weighted average cost), supplier invoice photo and number (for input tax where it applies).
Stock counts with variance, waste log with reason, low-stock alerts on the dashboard and in the daily email.
Food cost: theoretical cost per dish from the recipe, food cost % per dish and branch (flag above 35%), actual vs theoretical usage between counts.
4.8 Branch finance and reports
Branch dashboard (manager): today's sales so far vs same weekday last week, covers, average spend, open tables, upcoming reservations, low stock, top items, alerts (unclosed shift, large cash difference, many voids, failed invoice submissions).
Sales reports by date range, in local currency: gross sales, discounts, voids, refunds, net sales, service charge, tax, rounding, tips, by payment method, by channel, by category and item, by hour of day (heatmap), by staff member, by guest language (tourist share), covers and average spend.
Tax report per country: Taiwan bimonthly (sales, output tax, e-invoices issued/voided/allowances, input tax), Indonesia monthly PBJT, Malaysia bimonthly SST with the consolidated e-invoice status, Singapore quarterly GST (output tax, input tax). Laid out to make the accountant's filing easy.
Expenses: operating costs by category (rent, payroll and statutory contributions, utilities, gas/charcoal, marketing, maintenance, royalties to HQ, other) with receipt photo. Purchases from 4.7 count as COGS.
P&L by month: net sales (ex tax) − COGS = gross profit; − expenses = operating profit; 12-month charts; prime cost (COGS + labour) as a % of sales.
Exports: every report to CSV (UTF-8 with BOM so Excel opens Chinese correctly); Z reports and monthly P&L printable / save as PDF.
A daily summary email to each branch manager at 23:30 branch time (Vercel Cron, Resend, optional), in their language.
4.9 Payments adapter
A PaymentProvider interface (createCharge, getStatus, handleWebhook, refund), chosen per branch. Ship a mock provider that works with no account (fake QR/wallet/card screen with a "simulate paid" button, in the branch's currency), then real implementations behind per-branch env vars in this order: Midtrans (Indonesia: QRIS, GoPay, ShopeePay, cards, VA), Stripe (Singapore and Malaysia: cards, PayNow, FPX, GrabPay, Apple/Google Pay), TapPay or ECPay (Taiwan: cards, LINE Pay, JKOPay, Apple Pay). Webhook signature verification, idempotent state changes, everything recorded in the branch's payments and linked to the invoice.

4.10 Staff and branch settings
Staff: create accounts, assign roles per branch, set/reset PINs, staff app language, deactivate. Clock in / clock out on the POS with a weekly timesheet per branch (flags shifts over the local legal daily limit, configurable) that feeds labour cost into the P&L via an hourly rate in local currency.
Branch settings: profile (names in local languages, address, tax IDs such as 統一編號 / NPWP / SST no. / GST reg. no., logo, socials, LINE or WhatsApp number), country profile overrides (service charge, tax, rounding, price display), enabled languages and default, opening hours and special closures, floor plan editor (drag tables on a grid, shape, seats, area, combinable tables), QR code sheet, dining time limit and minimum spend, alcohol on/off, halal flag, reservation rules, takeaway rules, payment and invoice providers, receipt text per language, KDS timer thresholds, notifications.
Devices: register POS/KDS devices to a branch, name them, revoke them.
Customers: group-wide guest list from reservations and takeaway orders: contact, language, visits per branch, spend, allergies, notes, tags (VIP, regular, tourist), marketing consent recorded per country. Follow each country's personal data law (Taiwan PDPA, Indonesia PDP Law, Malaysia PDPA, Singapore PDPA): a privacy notice in every language, consent records, export or delete a guest's data. Export CSV.
Feedback: the receipt QR leads to a 1–5 rating with a comment in the guest's language, a nudge to leave a Google review for that branch after a 5, and an alert to the branch manager on low ratings.
4.11 Head office (/hq)
Group dashboard: today and month-to-date across all branches in one reporting currency (default TWD, switchable to USD, SGD, MYR or IDR), with each branch's local figure next to it; branch league table (net sales, covers, average spend, food cost %, labour %, prime cost %, voids %, average rating); alerts from every branch; a "now" view of open tables and covers per branch with each branch's local time.
FX rates: a monthly rate table per currency pair, entered by HQ Finance or fetched from a free rates API through an adapter with manual override. Every consolidated figure records the rate and date used; past months stay locked to their rates.
Comparison reports: same-store growth, sales per seat and per labour hour, menu engineering per item across branches (popularity × margin), price comparison of the same dish across branches, hourly heatmaps side by side, guest language mix per branch.
Consolidated P&L by month and branch in the reporting currency, with CSV export.
Master menu, translations, brand content (website copy, photos, press) and group promotions pushed to selected branches.
Opening a new branch: a guided form (country, currency, time zone, languages, tax profile, providers, hours, floor plan, menu selection with suggested prices), so adding e.g. a second Singapore branch takes minutes. Document it in the README.
A group summary email to the Group Owner every morning at 08:00 Taipei time with yesterday's numbers per branch and the consolidated total.
5. Data model (starting point, refine in PLAN.md)
Top level: brand (settings, content), branches (profile, settings, country code, currency, time zone), staff (with branch roles), devices, masterItems, masterCategories, modifierGroups, ingredients (master list), customers, fxRates, groupPromotions, auditLog, rateLimits, idempotencyKeys.
Per branch (branches/{branchId}/…): areas, tables, tableSessions, menuItems (branch selection with local price and overrides), recipeOverrides, stock, stockMovements (append-only), suppliers, purchaseOrders, stockCounts, orders (one per bill, with channel and guest language), order items with status (pending, fired, preparing, done, served, voided), kdsTickets, payments, invoices, refunds, shifts, cashMovements, reservations, waitlist, expenses, timeEntries, feedback, counters, dailySummaries (pre-aggregated per business day, used by HQ so it never scans raw orders).
Snapshot item names (all languages), price, currency, and the tax/service settings used onto each order line and bill, so later menu, price or tax changes never alter historical bills. Add the Firestore composite and collection-group indexes you need in firestore.indexes.json, and the security rules in firestore.rules, with emulator tests proving a Jakarta cashier cannot read Singapore data.

6. Critical flows to cover with Playwright
A visitor from Singapore lands on the brand home, is offered Bara Singapore, books a table for 4 in English; the Singapore host sees it, seats it; the table opens in the POS with the time limit countdown.
A guest scans a table QR in Bali, two phones (one in Japanese, one in Korean) add to the same cart, the order reaches the right KDS stations in Indonesian, the kitchen bumps it, the guests see "served". Business day and times use Bali time (WITA), not Jakarta time.
In Taipei the waiter adds a second round by seat; the cashier splits the bill evenly by 2: one half pays cash with a printed invoice, the other pays mock LINE Pay with a mobile barcode carrier; two mock e-invoices are issued; the 5% tax is split out, not added.
In Singapore a bill shows 10% service charge and 9% GST on top, matching a hand-calculated example to the cent. In KL a cash payment is rounded to the nearest 5 sen and a card payment is not; an alcohol item cannot be added to the KL menu.
A takeaway order in Jakarta with a pickup time is paid with mock QRIS, fires to the kitchen at the right time, and is marked picked up, with PBJT and no service charge.
A cashier tries to void a fired item and is asked for a manager PIN; the void appears in the audit log and the Z report. A refund in Taipei issues a mock e-invoice allowance.
A shift is opened and closed with a cash difference, and the Z report totals match the sum of the day's payments.
Selling a dish reduces the right ingredient stock in that branch only; marking an item sold out removes it from that branch's QR menu but not other branches'.
The Group Owner opens HQ, sees all five branches in TWD with the stored FX rates, switches to USD, and the totals match the sum of converted branch figures. A Jakarta branch manager cannot open HQ or see Singapore.
In demo mode, a visitor enters as Cashier in KL with one tap, cannot change destructive settings, and the nightly re-seed restores the data.
7. Build phases
Foundation: repo setup, design tokens, i18n for all seven languages with CJK fonts, money and currency module, country profiles, charges engine with worked examples for every country, time zone and business-day utilities, auth (sessions, roles per branch, devices, PINs), middleware, demo mode flag, emulator setup, seed script for all branches, docs/ARCHITECTURE.md draft.
Public website: brand and branch pages, locations, branch chooser with geo suggestion, live branch menus in local currency, polished motion and performance, STOEDIO credit. (Reserve and takeaway pages can show the UI with stubbed submission for now.)
Master menu, branch menus, floor plans, branch settings.
Reservations: availability engine with tests (including holidays and time zones), guest flow, manage link, host timeline, waitlist, email/LINE/WhatsApp notifications (mock first).
Dine-in core: table sessions, waiter app, POS bills, KDS with realtime, sold-out items.
QR ordering: QR codes, guest flow, shared cart, waiter calls, bill requests.
Payments and invoices: payment adapter (mock, then Midtrans, Stripe, TapPay/ECPay), invoice providers for all four countries (mock first, then Taiwan e-invoice and MyInvois), split bills, receipts and invoice prints, refunds, shifts, X/Z reports.
Takeaway: online and counter, scheduled firing, pickup status.
Inventory: recipes with branch overrides, auto-deduction, purchasing, counts, waste, food cost.
Branch finance & reports: dashboard, reports, per-country tax reports, expenses, P&L, exports, daily email.
Head office: daily summaries, FX rates, group dashboard, comparisons, consolidated P&L, new-branch wizard, group email.
Staff, customers, feedback, devices, audit log viewer.
Hardening: Playwright flows from section 6, security rules tests, accessibility pass, Lighthouse pass, translation completeness check, README and ARCHITECTURE final, a short docs/DEMO-SCRIPT.md (English, 中文 and Bahasa Indonesia) for presenting the system to a restaurant owner in 10 minutes.
8. Out of scope (note as future work, don't build)
Native apps, delivery platform integrations, full offline sync, direct thermal printer drivers (ESC/POS), central kitchen and stock transfers between branches, franchise royalty billing, loyalty points, payroll, per-country domains, Indonesian regional tax monitoring devices.

Start now with step 0: write docs/PROMPT.md and docs/PLAN.md, then stop and wait for my approval.
