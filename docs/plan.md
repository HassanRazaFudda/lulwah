# LULWAH FASHION — Master Build Plan

**Pakistani designer fashion, retailed in the UAE.**
Custom e‑commerce platform: storefront (Next.js) + REST API (Node.js/Express/MongoDB) + Admin console.

---

## Contents

- [0. Document control](#0-document-control)
- [1. Business brief (locked)](#1-business-brief-locked)
- [2. Domain model of Pakistani fashion (the part generic e-commerce gets wrong)](#2-domain-model-of-pakistani-fashion-the-part-generic-e-commerce-gets-wrong)
- [3. Scope](#3-scope)
- [4. Technology decisions (locked)](#4-technology-decisions-locked)
- [5. System architecture](#5-system-architecture)
- [6. Repository structure](#6-repository-structure)
- [7. Data model](#7-data-model)
- [8. Core business logic (specified, not left to the developer)](#8-core-business-logic-specified-not-left-to-the-developer)
- [9. API specification](#9-api-specification)
- [10. Authentication, authorization, roles](#10-authentication-authorization-roles)
- [11. Admin console specification](#11-admin-console-specification)
- [12. Storefront architecture](#12-storefront-architecture)
- [13. Design system — visual direction](#13-design-system-visual-direction)
- [14. Motion specification](#14-motion-specification)
- [15. Page-by-page specification](#15-page-by-page-specification)
- [16. Localization & RTL](#16-localization-rtl)
- [17. SEO](#17-seo)
- [18. Performance budgets (enforced in CI)](#18-performance-budgets-enforced-in-ci)
- [19. Security](#19-security)
- [20. Payments (UAE specifics)](#20-payments-uae-specifics)
- [21. Shipping & fulfilment](#21-shipping-fulfilment)
- [22. Notifications](#22-notifications)
- [23. Analytics](#23-analytics)
- [24. Testing strategy](#24-testing-strategy)
- [25. Environments, CI/CD, configuration](#25-environments-cicd-configuration)
- [26. Observability & operations](#26-observability-operations)
- [27. Engineering standards](#27-engineering-standards)
- [28. Delivery plan](#28-delivery-plan)
- [29. Risks](#29-risks)
- [30. Cost estimate (monthly, USD, at launch scale)](#30-cost-estimate-monthly-usd-at-launch-scale)
- [31. Open questions (each has a default — none blocks development)](#31-open-questions-each-has-a-default-none-blocks-development)
- [32. Appendix A — Enum reference](#32-appendix-a-enum-reference)
- [33. Appendix B — Error codes](#33-appendix-b-error-codes)
- [34. Appendix C — Launch checklist](#34-appendix-c-launch-checklist)
- [35. What "done" means for this project](#35-what-done-means-for-this-project)
- [36. Appendix D — Contabo VPS deployment runbook](#36-appendix-d-contabo-vps-deployment-runbook)

---

## 0. Document control

| Field | Value |
|---|---|
| Document | `plan.md` — single source of truth for scope, architecture and decisions |
| Version | 1.2 |
| Status | **Decisions locked.** Anything not locked is listed in §31 "Open questions" with a default already chosen. |
| Changelog | **1.2** (2026-08-12) — dependency versions refreshed to what is actually current/LTS at build start, since 1.1 had drifted behind real releases. Node 22→**24 LTS**, Next.js 15→**16.3+**, React 19→**19.2+**, MongoDB 7→**8.3+**, Mongoose 8→**9.9+**, Redis 7→**8.10+**, Meilisearch 1.11→**1.48+**, Tailwind v4→**4.3+**. TypeScript pinned at **6.0** rather than the newly-released 7.0 — see the note in §4.1, revisit once 7.x has a stable programmatic API. Affects §4.1, §4.2, §4.3, §36.5. **1.1** — infrastructure moved from managed cloud (Vercel/Atlas/Upstash/Cloudinary) to **self-hosted Docker on one Contabo VPS**. Affects §4.3, §5.1, §5.6, §7.14 (Atlas Search → Meilisearch), §18, §25, §26, §29, §30, and adds §36. |
| Audience | Engineering, design, client stakeholders |
| Language | English (so any developer can pick it up). Client-facing summaries can be Urdu. |

### 0.1 How to read this document

- **Locked** = build it exactly like this. Do not re-litigate in standup.
- Every section that could otherwise cause a "what should we do here?" moment has a **Decision** line with a rationale.
- §31 lists the handful of items that genuinely need client input, each with a **default** we will ship if no answer arrives by the stated deadline. No item blocks development.

### 0.2 Interpretation note on the brief

The brief mentioned "web3". Two readings were possible:

- **WebGL / Three.js / 3D on the web** — 3D and shader-driven visuals.
- **Blockchain / crypto / wallets.**

**Decision:** We interpret it as **WebGL / Three.js**, and it is in scope (§14). Blockchain, crypto payments, NFTs and wallet login are **out of scope** — they add regulatory exposure under UAE VARA rules, they do not serve a fashion buyer, and they would slow the site down. If the client actually meant crypto, see §31‑Q10.

---

## 1. Business brief (locked)

### 1.1 What the business is

Lulwah Fashion is a **UAE-registered multi-brand retailer of Pakistani designer women's wear**. It curates and sells collections from Pakistani fashion houses — Khaadi, Asim Jofa, Sana Safinaz and similar — to customers in the UAE and the wider GCC.

### 1.2 What it is NOT

> **This is the single most important merchandising constraint in the document.**

- ❌ Not Western wear. No dresses, jeans, blazers, skirts, tops, swimwear, knitwear.
- ❌ Not Khaleeji/Emirati wear. No abayas, jalabiyas, kaftans, shailas as core catalogue.
- ✅ **Pakistani silhouettes only**: shalwar kameez, 3-piece suits, lawn, pret, luxury pret, festive, formal/wedding, kurtis, shararas, ghararas, angrakhas, saris where the designer offers them.

Every taxonomy, filter, size chart, photograph, and line of copy in this build follows from that. Any template, theme or component that assumes "Dresses / Tops / Bottoms / Shoes" is wrong for this store and must be rebuilt (see §2 taxonomy).

### 1.3 Customer

| Segment | Share (assumed) | Notes |
|---|---|---|
| Pakistani & South Asian diaspora women in UAE, 22–45 | ~70% | Knows the brands, knows their size in Khaadi vs Asim Jofa, shops seasonally (lawn, Eid, wedding season). Price-aware, compares against Pakistan retail price. |
| Other South Asian (Indian, Bangladeshi) | ~15% | Buys festive/formal. |
| Arab & expat customers discovering Pakistani craft | ~15% | Needs education: what is *lawn*, what is *unstitched*, what is a *dupatta*. Arabic-language journey matters here. |

Primary device: **mobile, ~78% of sessions.** Design mobile-first, always.
Peak seasons: **Ramadan/Eid al-Fitr, Eid al-Adha, Aug–Sep (winter collection drops), Nov–Feb (wedding season)**. Traffic can spike 8–12× on a collection drop. The architecture in §5 is sized for that.

### 1.4 Commercial parameters (locked defaults)

| Parameter | Decision |
|---|---|
| Presentment currency | **AED** (primary). PKR, SAR, USD as display-only conversions in Phase 2. |
| Countries served | Phase 1: **UAE** only. Phase 2: KSA, Qatar, Kuwait, Oman, Bahrain. |
| VAT | **5% UAE VAT**, prices displayed **VAT-inclusive** (UAE consumer law requirement), VAT broken out on the invoice. |
| Free shipping threshold | **AED 300** (configurable in Admin → Settings, not hardcoded). |
| Standard shipping | AED 20 flat, UAE-wide. |
| COD | Supported, **AED 10 COD handling fee**, capped at AED 2,000 order value. |
| Returns window | **14 days** from delivery. Unstitched fabric returnable only if seals intact; custom-stitched items non-returnable (stated at PDP and checkout). |
| Trade licence / legal entity | Client-provided; required for payment gateway onboarding (§20). |

---

## 2. Domain model of Pakistani fashion (the part generic e-commerce gets wrong)

Read this before writing a single schema. These distinctions drive the product model, filters, size logic and pricing.

### 2.1 Stitching state — the primary axis

| State | Meaning | Sizing | Inventory unit |
|---|---|---|---|
| **Unstitched** | Fabric suit sold as pieces. Customer takes it to a tailor. | No size. Sold by **piece count** and **fabric metres**. | 1 suit = 1 SKU |
| **Pret / Ready to wear** | Factory-stitched, standard sizes. | XS–XXL (brand-specific charts) | Size = variant |
| **Semi-stitched** | Shirt partly stitched, customer finishes. | Free size / one size | 1 SKU |
| **Custom stitched** | We take the unstitched suit and stitch it to the customer's measurements. | Customer measurement profile | Base SKU + service |

**Decision:** All four are supported. `stitchingType` is a **required, indexed field** on every product and is a **top-level filter** on every listing page. This single field is the biggest UX differentiator over a generic Shopify theme.

### 2.2 Piece count

Unstitched suits are sold as 1-piece, 2-piece or 3-piece. This is a **hard purchase-decision attribute**, displayed on the product card, not buried in a spec table.

- **1 piece** — shirt fabric only
- **2 piece** — shirt + trouser, OR shirt + dupatta
- **3 piece** — shirt + trouser + dupatta

Field: `pieceCount: 1 | 2 | 3`, plus `pieces[]` describing each piece (`type`, `fabric`, `lengthMeters`, `work`).

### 2.3 Fabric vocabulary (controlled list, not free text)

`lawn`, `cambric`, `cotton`, `cotton-net`, `khaddar`, `linen`, `chiffon`, `organza`, `silk`, `raw-silk`, `jacquard`, `velvet`, `karandi`, `viscose`, `net`, `masuri`, `grip`, `tissue`, `banarsi`, `jamawar`, `crinkle-chiffon`, `slub`

Seasonality is derived from fabric, not entered manually:
`lawn | cambric | cotton | linen(summer)` → **Summer**; `khaddar | karandi | velvet | jacquard` → **Winter**; `chiffon | organza | net | silk | banarsi | jamawar` → **All-season / Festive**.

### 2.4 Work / embellishment (controlled list)

`digital-print`, `screen-print`, `block-print`, `machine-embroidery`, `hand-embroidery`, `zari`, `resham`, `tilla`, `mukaish`, `gota`, `sequins`, `dabka`, `naqshi`, `applique`, `mirror-work`, `plain`

### 2.5 Occasion (controlled list)

`everyday`, `casual`, `workwear`, `eid`, `festive`, `mehndi`, `mayoun`, `barat`, `walima`, `nikkah`, `party`, `bridal`

### 2.6 Collection concept

Pakistani houses release **named seasonal collections** (e.g. "Lawn '26 Vol‑1", "Eid Edit", "Wedding Festive '25"). These are **first-class merchandising objects**, not tags. Each has a hero video/image, a description, a launch date/time, and can be **scheduled to go live at an exact timestamp** (drops matter — customers queue).

### 2.7 Article code

Pakistani brands identify items by an article/design code (e.g. `KHAS-24-107`, `AJ-LAWN-3B`). Customers search by it and send it over WhatsApp. **Article code is a searchable, indexed, displayed field.** Search must match it exactly and fuzzily.

### 2.8 Colour naming

Use the **brand's own colour name** (e.g. "Ferozi", "Mehndi Green", "Off White", "Powder Pink") plus a normalised `colorFamily` for filtering (`white/off-white`, `black`, `red/maroon`, `pink`, `blue/ferozi`, `green`, `yellow/mustard`, `purple`, `brown/beige`, `grey/silver`, `gold`, `multi`). Show the brand name to the customer, filter on the family.

### 2.9 Dupatta type

`printed`, `embroidered`, `chiffon`, `organza`, `net`, `silk`, `none`. Displayed on PDP; it is a real buying factor.

### 2.10 Glossary for the Arabic/English copywriter

| Term | Plain-English gloss used on the site |
|---|---|
| Lawn | Fine, lightweight cotton — the Pakistani summer fabric |
| Unstitched | Fabric pieces you have tailored to your own fit |
| 3-piece | Shirt fabric + trouser fabric + dupatta |
| Dupatta | Long scarf worn with the outfit |
| Shalwar / trouser | The bottom piece |
| Kameez / shirt | The long top |
| Pret | Ready to wear, stitched in standard sizes |
| Sharara / Gharara | Wide flared trousers worn for weddings |
| Karhai | Embroidery |

---

## 3. Scope

### 3.1 Release plan

| Release | Name | Duration | Goal |
|---|---|---|---|
| **R1** | Commerce Core | Weeks 1–10 | A customer in Dubai can find, buy and track a Pakistani suit. Admin can run the shop end to end. |
| **R2** | Experience & Growth | Weeks 11–16 | The site becomes distinctive: WebGL/GSAP layer, Arabic/RTL, custom stitching, reviews, marketing tooling. |
| **R3** | Scale | Post-launch | GCC expansion, multi-currency, loyalty, app-grade PWA, warehouse tooling. |

### 3.2 Feature matrix

Legend: ✅ in release · ⏳ later · ❌ never

| # | Feature | R1 | R2 | R3 |
|---|---|:--:|:--:|:--:|
| **Catalogue** |
| 1 | Products with variants (size / colour / piece count) | ✅ | | |
| 2 | Stitching-type model (unstitched/semi/pret/custom) | ✅ | | |
| 3 | Brand pages (Khaadi, Asim Jofa, Sana Safinaz…) | ✅ | | |
| 4 | Named collections with scheduled drops | ✅ | | |
| 5 | Faceted filtering + sorting | ✅ | | |
| 6 | Full-text + article-code search with typo tolerance | ✅ | | |
| 7 | Search autocomplete with product previews | ⏳ | ✅ | |
| 8 | Related / "Complete the look" recommendations | ⏳ | ✅ | |
| 9 | Recently viewed | ⏳ | ✅ | |
| 10 | Lookbook / editorial pages | ⏳ | ✅ | |
| 11 | Shop-the-video / shoppable reels | | | ⏳ |
| **Product page** |
| 12 | Gallery, zoom, video, 360° | ✅ (360 ⏳) | ✅ | |
| 13 | Size chart per brand, size recommender | ✅ | | |
| 14 | Fabric/care/piece breakdown | ✅ | | |
| 15 | Stock urgency ("2 left") | ✅ | | |
| 16 | Back-in-stock notify me | ⏳ | ✅ | |
| 17 | Reviews with photo upload, verified badge | ⏳ | ✅ | |
| 18 | Q&A on product | | | ⏳ |
| **Cart & checkout** |
| 19 | Persistent cart (guest + logged-in, merged on login) | ✅ | | |
| 20 | Mini-cart drawer | ✅ | | |
| 21 | Guest checkout | ✅ | | |
| 22 | Multi-step checkout with address book | ✅ | | |
| 23 | Card payment (3DS) | ✅ | | |
| 24 | Apple Pay / Google Pay | ✅ | | |
| 25 | Cash on delivery with OTP verification | ✅ | | |
| 26 | Tabby / Tamara BNPL | ⏳ | ✅ | |
| 27 | Coupon codes | ✅ | | |
| 28 | Automatic promotions & bundles | ✅ | | |
| 29 | Gift wrap + gift message | ⏳ | ✅ | |
| 30 | Gift cards / store credit | | | ⏳ |
| 31 | Abandoned-cart recovery | ⏳ | ✅ | |
| **Orders & fulfilment** |
| 32 | Order status flag pipeline, admin-updated | ✅ | | |
| 33 | Customer order tracking page (no login needed) | ✅ | | |
| 34 | Email + SMS/WhatsApp status notifications | ✅ | | |
| 35 | Partial fulfilment / split shipments | ⏳ | ✅ | |
| 36 | Courier API integration (AWB, live tracking) | ⏳ | ✅ | |
| 37 | Returns & exchange portal | ⏳ | ✅ | |
| 38 | Refunds (gateway + manual) | ✅ | | |
| **Custom stitching** |
| 39 | Measurement profiles per customer | ⏳ | ✅ | |
| 40 | Stitching add-on at PDP/cart with price | ⏳ | ✅ | |
| 41 | Stitching workflow states in admin | ⏳ | ✅ | |
| **Accounts** |
| 42 | Email/password + OTP (phone) login | ✅ | | |
| 43 | Google sign-in | ✅ | | |
| 44 | Address book, order history, invoices | ✅ | | |
| 45 | Wishlist (guest + synced) | ✅ | | |
| 46 | Loyalty points / tiers | | | ⏳ |
| **Admin** |
| 47 | RBAC with 8 roles | ✅ | | |
| 48 | Product & variant CRUD, bulk CSV import/export | ✅ | | |
| 49 | Media manager | ✅ | | |
| 50 | Inventory & stock movements | ✅ | | |
| 51 | Order console + status flags + bulk actions | ✅ | | |
| 52 | Discount & coupon builder | ✅ | | |
| 53 | Customer console | ✅ | | |
| 54 | CMS: homepage sections, banners, pages, menus | ✅ | | |
| 55 | Dashboard & reports | ✅ | | |
| 56 | Audit log | ✅ | | |
| 57 | Purchase orders / supplier management | | | ⏳ |
| **Platform** |
| 58 | English storefront | ✅ | | |
| 59 | Arabic + full RTL | ⏳ | ✅ | |
| 60 | SEO, structured data, sitemaps | ✅ | | |
| 61 | GSAP motion system | ✅ (core) | ✅ (full) | |
| 62 | WebGL signature moments | ⏳ | ✅ | |
| 63 | Analytics + server-side tracking | ✅ | | |
| 64 | PWA / installable | | | ⏳ |
| 65 | Multi-currency & GCC shipping | | | ⏳ |
| 66 | Crypto / blockchain | ❌ | ❌ | ❌ |
| 67 | Marketplace / third-party sellers | ❌ | ❌ | ❌ |
| 68 | Men's and kids' wear | ❌ | ❌ | ⏳ |

### 3.3 Definition of done (applies to every ticket)

A ticket is done when **all** of the following are true:

1. TypeScript compiles with zero errors; no `any` outside `*.d.ts`.
2. Zod schema validates every external input (body, query, params, webhook).
3. Unit tests for business logic; integration test for the endpoint; Playwright test if it touches a critical user path.
4. Works at 375 px, 768 px, 1280 px, 1920 px.
5. Keyboard reachable, visible focus ring, correct ARIA, contrast ≥ 4.5:1.
6. `prefers-reduced-motion` honoured.
7. Arabic string keys added (even if translation lands later) — no hardcoded UI copy.
8. No layout shift (CLS contribution ≈ 0); images have explicit dimensions.
9. Error and empty states designed and implemented, not just the happy path.
10. Reviewed by one other engineer; PR references the plan section it implements.

---

## 4. Technology decisions (locked)

Every choice below is final for R1–R2. Version numbers are the floor; patch upgrades are fine, majors need an ADR (§27.7).

### 4.1 Frontend

| Concern | Choice | Why this and not the alternative |
|---|---|---|
| Framework | **Next.js 16.3+, App Router, React 19.2+, TypeScript 6.0 strict** | SSR/ISR for SEO on ~5,000 product pages; Server Components cut client JS; brief specifies Next. TypeScript held at 6.0 (not the newly-shipped 7.0/native-Go compiler) until the ecosystem — Next.js, ESLint/typescript-eslint, Vitest — ships stable support for it; 7.0 itself notes it has no stable programmatic API yet. |
| Rendering | Per-route strategy, see §12.2 | Home/collections ISR, PDP ISR+on-demand revalidate, cart/checkout/account CSR-with-auth. |
| Styling | **Tailwind CSS 4.3+** + a hand-written design-token layer (§13) | Utility speed, but tokens are ours — no default Tailwind palette, no default radii. This is what stops it looking templated. |
| Component primitives | **Radix UI primitives**, styled entirely by us | **Deliberately NOT shadcn/ui defaults.** shadcn's default skin is the single most recognisable "AI-generated site" signature. We take Radix's accessibility, throw away the skin. |
| Icons | **Lucide**, but only for UI chrome. Brand/nav icons are custom SVG drawn from the logo's filigree | Generic icon sets are a tell. |
| Animation (DOM) | **GSAP 3 + ScrollTrigger + Flip + SplitText** (Business licence via client) | Timeline control and scroll choreography that Framer Motion can't match. |
| Animation (component) | **Motion (`motion/react`)** for enter/exit, layout, drawers | Ergonomic for React state transitions; used alongside GSAP, not instead of. |
| Smooth scroll | **Lenis** | Required for credible scroll choreography; disabled under reduced-motion and on low-end devices. |
| 3D / WebGL | **Three.js + React Three Fiber + Drei**, lazy-loaded, R2 only | Signature moments only (§14.5). Hard budget: ≤ 220 KB gz, never blocks LCP. |
| State (server data) | **TanStack Query v5** | Cache, retry, optimistic updates for cart. |
| State (client) | **Zustand** (cart UI, drawers, filters, locale) | Small, no boilerplate. Redux is overkill here. |
| Forms | **React Hook Form + Zod resolver** | Same Zod schemas shared with the API via `packages/contracts`. |
| Images | **next/image** with a custom **imgproxy** loader | Self-hosted transforms, AVIF/WebP, responsive srcset, blur placeholder from dominant colour. Derivatives cached at Cloudflare forever. |
| i18n | **next-intl** | App Router native, RSC-compatible, handles pluralisation and RTL routing. |
| Fonts | Self-hosted via `next/font/local`, WOFF2, subset | No render-blocking Google Fonts request; no CLS. |
| Testing | Vitest + Testing Library + Playwright | |
| Analytics | GTM (server-side container) → GA4, Meta CAPI, TikTok, Snap | |

### 4.2 Backend

| Concern | Choice | Why |
|---|---|---|
| Runtime | **Node.js 24 LTS**, TypeScript 6.0 strict, ESM | Brief specifies Node. Node 24 is Active LTS (22 is Maintenance LTS as of 2026-08). |
| Framework | **Express 5.2+** + `express-async-errors` | Brief-implied, universally understood, easiest to hire for. Fastify is faster but Express is not the bottleneck — Mongo and payments are. |
| Database | **MongoDB 8.3+ (Atlas)** + **Mongoose 9.9+** | Brief specifies Mongo. Mongoose for schema enforcement, middleware, populate. |
| Search | **Meilisearch 1.48+** (self-hosted container) | Atlas Search does not exist on a self-hosted MongoDB. Meilisearch gives typo tolerance, facets, synonyms, Arabic support and sub-20 ms queries in ~400 MB RAM — correctly sized for one box. Synced by a BullMQ job on `product.updated`. |
| Cache / sessions / locks | **Redis 8.10+** (self-hosted container, AOF on) | Cart TTL, rate limits, hot product cache, idempotency keys, distributed stock locks, and the shared Next.js ISR cache. |
| Background jobs | **BullMQ** on Redis | Emails, webhooks, image processing, exports, abandoned-cart, scheduled drops. |
| Validation | **Zod** at every boundary | One schema shared front↔back. |
| Auth | **JWT access (15 min) + rotating refresh (30 d) in httpOnly cookies** | See §10. |
| File storage | **Contabo Object Storage** (S3-compatible) + **imgproxy** | Originals live off the VM disk so they survive a rebuild; imgproxy does transforms on the fly; Cloudflare caches the result. Falls back to a local Docker volume if object storage is not purchased. |
| Email | **Resend** (transactional) + **Klaviyo** (marketing, R2) | |
| SMS / WhatsApp | **Unifonic** (UAE-local, good deliverability) with Twilio fallback | UAE SMS needs a registered sender ID; Unifonic handles TDRA registration. |
| Payments | **Stripe** primary (card, Apple Pay, Google Pay, 3DS2) · **Tabby + Tamara** (R2 BNPL) · **COD** in-house | See §20 and §31‑Q3. |
| Logging | **Pino** → structured JSON → Better Stack | |
| Errors | **Sentry** (both apps) | |
| API docs | **OpenAPI 3.1 generated from Zod** (`zod-to-openapi`) + Scalar UI | Docs can never drift from code. |

### 4.3 Infrastructure — self-hosted on one Contabo VPS

**Decision: the entire stack runs in Docker on a single Contabo Cloud VPS (8 GB RAM), fronted by Cloudflare.** Full runbook in §36.

| Concern | Choice | Notes |
|---|---|---|
| Host | **Contabo Cloud VPS 10** — 8 GB RAM, NVMe, Ubuntu 24.04 LTS | Production *and* staging on the same box (§36.4). Upgrade path in §36.11. |
| Region | **Mumbai (India)** recommended | Contabo has no Middle East location. Mumbai ≈ 40 ms to Dubai; EU ≈ 120 ms. See §36.2. |
| Orchestration | **Docker Compose** (not Kubernetes, not Swarm) | One box, one file, readable by anyone. K8s on a single node is pure overhead. |
| Reverse proxy / TLS | **Caddy 2** | Automatic Let's Encrypt, HTTP/3, health-checked upstreams, 20-line config. |
| Edge / CDN / WAF | **Cloudflare (free plan)** | This is not optional — it is what makes a Mumbai origin feel fast in Dubai, hides the origin IP, and absorbs drop-day traffic. |
| Database | **MongoDB 8.3+ in Docker, single-node replica set** | The replica set is **mandatory**, not optional — multi-document transactions (order placement) do not work on a standalone mongod. See §36.6. |
| Cache / queues | **Redis 8.10+** in Docker, AOF persistence | |
| Search | **Meilisearch** in Docker | |
| Media | **Contabo Object Storage** (S3) + **imgproxy** | |
| Images/CI | Images built in **GitHub Actions**, pushed to **GHCR**, pulled by the VPS | **Never build on the server** — a Next.js build alone wants 2–4 GB and would OOM production. |
| Backups | **restic → Contabo Object Storage / Backblaze B2**, nightly + weekly | Plus Contabo's paid VM snapshot add-on. §36.8. |
| Secrets | A root-owned `.env` at `/srv/lulwah/.env`, mode `600`, injected by Compose | No Doppler needed at this scale; the file is backed up encrypted, never in git. |
| Email | **Resend** (external) | Do **not** run an SMTP server on the VPS — the IP has no reputation and your order confirmations will land in spam. |
| Monitoring | **Uptime Kuma** (self-hosted) + **Better Stack free** (external) + Sentry | An internal monitor cannot tell you the box is down. You need one watcher outside it. |

**What self-hosting costs you** (be clear-eyed about this — §36.13):
no auto-scaling, no managed failover, **one machine is a single point of failure**, backups and patching are your job, and there are no per-PR preview deploys. What you get is ~$12/month instead of ~$450/month, and complete control.
### 4.4 Explicitly rejected

| Rejected | Reason |
|---|---|
| Shopify / WooCommerce / Medusa / Saleor | Brief asks for a custom Node + Mongo build; also none of them model unstitched/3-piece/stitching-service natively without heavy hacking. |
| GraphQL | REST + typed contracts is simpler to cache, debug and hire for. No client-shaped-query problem here. |
| Microservices at launch | Premature. We build a **modular monolith** with hard module boundaries so it can be split later without a rewrite (§5.3). |
| shadcn/ui default theme | Visual tell of AI-generated sites. Radix primitives only. |
| Framer Motion as the only animation lib | Cannot orchestrate scroll timelines at the level this brief demands. |
| Blockchain / crypto payments | §0.2. |
| Server-side sessions in Mongo | Redis is the right tool; Mongo writes for sessions are wasteful. |

---

## 5. System architecture

### 5.1 High level — everything on one box

```
                        Customers (UAE, mobile-first)
                                   │
                    ┌──────────────▼───────────────┐
                    │  CLOUDFLARE  (free plan)     │
                    │  DNS · TLS · WAF · DDoS      │
                    │  Edge cache: HTML, images,   │  ← Dubai PoP serves most
                    │  static, /_next/*            │    requests without ever
                    └──────────────┬───────────────┘    touching the origin
                                   │  only cache MISSes + all POSTs
             ══════════════════════▼══════════════════════
             ║   CONTABO VPS  ·  8 GB  ·  Ubuntu 24.04    ║
             ║   ufw: 22/80/443 only · fail2ban · swap 4G ║
             ╠════════════════════════════════════════════╣
             ║  ┌──────────────────────────────────────┐  ║
             ║  │ caddy  :80 :443  auto-TLS, HTTP/3    │  ║
             ║  └───┬──────────┬──────────┬─────────┬──┘  ║
             ║      │          │          │         │     ║
             ║  ┌───▼────┐ ┌───▼────┐ ┌───▼───┐ ┌───▼───┐ ║
             ║  │ web    │ │ admin  │ │  api  │ │imgproxy│║
             ║  │Next 16 │ │Next 16 │ │ ×2    │ │        │║
             ║  │standalone│ CSR   │ │Express│ │        │ ║
             ║  └───┬────┘ └───┬────┘ └──┬────┘ └───┬───┘ ║
             ║      └──────────┴─────┬───┘          │     ║
             ║                       │              │     ║
             ║  ┌────────┐ ┌─────────▼──┐ ┌───────┐ │     ║
             ║  │ worker │ │  mongodb   │ │ redis │ │     ║
             ║  │ BullMQ │ │  rs0 (1nd) │ │ AOF   │ │     ║
             ║  └────────┘ └────────────┘ └───────┘ │     ║
             ║  ┌────────────┐  ┌──────────────┐    │     ║
             ║  │meilisearch │  │ uptime-kuma  │    │     ║
             ║  └────────────┘  └──────────────┘    │     ║
             ║  ── staging stack (same box, own DB names) ║
             ║     web-stg · admin-stg · api-stg          ║
             ╚═══════════════════════╤════════════════════╝
                                     │
        ┌────────────────┬───────────┼───────────┬──────────────┐
        ▼                ▼           ▼           ▼              ▼
  Contabo Object    Stripe      Resend      Unifonic      restic backups
  Storage (S3)      Tabby       (email)     (SMS/WA)      → B2 / Object St.
  originals+media                                          nightly, off-box
```

**The single most important line in this diagram is the Cloudflare box.** With the origin ~4,000 km from Dubai, a cache hit is ~30 ms and a cache miss is ~400–700 ms. Since almost every storefront page is ISR-static, the answer is to make Cloudflare serve them and let the origin handle only cart, checkout, account and API writes. Cache strategy is specified in §36.3.
### 5.2 Why a BFF layer in Next.js

The storefront never calls the API directly from the browser for authenticated work. It calls **Next.js Route Handlers** (`/api/bff/*`) which:

1. Hold the httpOnly refresh cookie (XSS-safe — no token in JS).
2. Attach the access token server-side.
3. Hide the API origin from the public.
4. Collapse multi-call pages into one round trip (e.g. PDP = product + related + reviews).

Public read endpoints (product, collection, search) are called directly from RSC on the server, cached by ISR.

### 5.3 Modular monolith — module boundaries

`apps/api/src/modules/*`. **Rule: a module may only touch another module through its exported service interface or a published domain event. No cross-module Mongoose imports. Enforced by ESLint `import/no-restricted-paths`.**

| Module | Owns | Publishes events |
|---|---|---|
| `identity` | User, Session, RefreshToken, OTP, RBAC | `user.registered`, `user.verified` |
| `catalog` | Product, Variant, Category, Brand, Collection, Attribute, SizeChart | `product.published`, `product.updated`, `collection.launched` |
| `inventory` | InventoryItem, StockMovement, Reservation | `stock.low`, `stock.out`, `stock.restocked` |
| `pricing` | Price, PriceRule, Discount, Coupon, promotion engine | `discount.applied` |
| `cart` | Cart, CartItem, cart pricing pipeline | `cart.updated`, `cart.abandoned` |
| `checkout` | Checkout session, address validation, shipping quotes, tax | `checkout.started`, `checkout.completed` |
| `order` | Order, OrderItem, StatusHistory, Fulfilment, Invoice | `order.placed`, `order.status_changed`, `order.delivered`, `order.cancelled` |
| `payment` | PaymentIntent, Transaction, Refund, gateway adapters, webhooks | `payment.authorized`, `payment.captured`, `payment.failed`, `payment.refunded` |
| `shipping` | ShippingZone, Rate, Shipment, carrier adapters, tracking | `shipment.created`, `shipment.in_transit`, `shipment.delivered` |
| `stitching` | MeasurementProfile, StitchingOrder, tailor workflow | `stitching.started`, `stitching.completed` |
| `content` | Page, Banner, HomeSection, Menu, Media, Lookbook, FAQ | `content.published` |
| `engagement` | Review, Wishlist, Newsletter, NotifyMe, Notification templates | `review.submitted` |
| `analytics` | Reporting aggregates, dashboard queries, audit log | — |

### 5.4 Layering inside a module

```
modules/order/
├── order.routes.ts        HTTP only: path, middleware, handler binding
├── order.controller.ts    parse+validate (Zod) → call service → shape response. No logic.
├── order.service.ts       ALL business rules. Framework-free. Unit-testable.
├── order.repository.ts    ONLY place Mongoose models are touched.
├── order.model.ts         Mongoose schema + indexes
├── order.events.ts        event publishing/subscribing
├── order.dto.ts           Zod schemas (request/response) — re-exported to packages/contracts
├── order.policy.ts        state machine + permission rules
├── order.mapper.ts        entity ↔ DTO
└── __tests__/
```

**Rule:** controllers never import repositories; services never import `express`; repositories never contain business rules.

### 5.5 Domain events

In-process EventEmitter for R1, published to a **BullMQ `domain-events` queue** for anything with side effects (email, webhook, analytics, cache invalidation). This means:

- Placing an order does **not** wait on an email send.
- Adding a new reaction to `order.status_changed` (e.g. WhatsApp) requires zero changes to the order service.
- The same event stream becomes the Kafka/SQS boundary if we ever split services.

### 5.6 Scaling posture

| Load | Response |
|---|---|
| Baseline | 2 API instances + 1 worker |
| Collection drop | Cloudflare cache on public GETs; API autoscale 2→10; Redis-backed stock reservation prevents oversell; waiting-room rule on Cloudflare if RPS > threshold |
| Catalogue growth | Meilisearch handles 100k+ SKUs comfortably; compound indexes in §7.14 |
| Read scaling | Atlas read replicas for reporting queries (`readPreference=secondaryPreferred` on analytics only) |
| Media | Entirely off the API — object storage behind Cloudflare |

**Stateless API** — no in-memory session, no local file writes, no sticky sessions. Any instance can serve any request.

---

## 6. Repository structure

**Decision: pnpm workspaces + Turborepo monorepo.** One PR can change a contract and both consumers; types are shared, never duplicated.

```
lulwah/
├── apps/
│   ├── web/                     Storefront — Next.js 16
│   │   ├── app/
│   │   │   ├── [locale]/
│   │   │   │   ├── (shop)/      home, collections, product, search, brand
│   │   │   │   ├── (checkout)/  cart, checkout, confirmation   ← no header/footer chrome
│   │   │   │   ├── (account)/   orders, addresses, wishlist, measurements
│   │   │   │   ├── (content)/   about, policies, faq, journal, size-guide
│   │   │   │   └── layout.tsx
│   │   │   ├── api/bff/         BFF route handlers
│   │   │   ├── sitemap.ts  robots.ts  opengraph-image.tsx
│   │   ├── components/
│   │   │   ├── primitives/      Button, Input, Select, Dialog… (Radix, our skin)
│   │   │   ├── commerce/        ProductCard, PriceBlock, VariantPicker, AddToCart…
│   │   │   ├── sections/        Hero, CollectionRail, EditorialSplit, BrandStrip…
│   │   │   ├── motion/          GSAP hooks, ScrollReveal, PageTransition, Lenis
│   │   │   └── webgl/           lazy R3F scenes
│   │   ├── lib/                 api client, formatters, seo, analytics
│   │   ├── hooks/  stores/  styles/  messages/{en.json,ar.json}
│   ├── admin/                   Admin console — Next.js 16, CSR, no SEO
│   │   ├── app/(dashboard)/     orders, products, inventory, discounts,
│   │   │                        customers, content, reports, settings, users
│   │   └── components/          DataTable, Filters, BulkBar, StatusFlagControl…
│   └── api/                     Node.js API
│       ├── src/
│       │   ├── modules/         (§5.3)
│       │   ├── shared/          middleware, errors, logger, redis, mongo, events, utils
│       │   ├── jobs/            BullMQ queues, workers, schedulers
│       │   ├── integrations/    stripe/ tabby/ cloudinary/ resend/ unifonic/ aramex/
│       │   ├── config/          env (Zod-validated), constants, feature flags
│       │   └── server.ts  app.ts  worker.ts
│       └── scripts/             seed, migrate, backfill, reindex
├── packages/
│   ├── contracts/               Zod schemas + inferred TS types — the shared truth
│   ├── ui/                      cross-app primitives (used by web + admin)
│   ├── tokens/                  design tokens → CSS vars + TS objects (§13)
│   ├── config/                  eslint, tsconfig, tailwind, prettier presets
│   └── utils/                   money, dates, slug, phone (UAE), sizes
├── docs/
│   ├── plan.md                  ← this document
│   ├── adr/                     architecture decision records
│   ├── api/                     generated OpenAPI
│   └── runbooks/                incidents, deploys, on-call
├── .github/workflows/
├── docker-compose.yml           local mongo + redis
├── turbo.json  pnpm-workspace.yaml
```

### 6.1 The `contracts` package (important)

Zod schemas live once, in `packages/contracts`. The API validates with them. The web app infers types from them and validates forms with them. The admin app does the same.

```ts
// packages/contracts/src/order.ts
export const OrderStatus = z.enum([
  'pending_payment','confirmed','processing','stitching',
  'ready_to_ship','shipped','out_for_delivery','delivered',
  'cancelled','returned','refunded','failed',
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const UpdateOrderStatusInput = z.object({
  status: OrderStatus,
  note: z.string().max(500).optional(),
  notifyCustomer: z.boolean().default(true),
  trackingNumber: z.string().optional(),
  carrier: z.enum(['aramex','emirates_post','careem','fetchr','own_fleet']).optional(),
});
```

**Consequence:** a status can never be added on the backend and forgotten in the admin dropdown. The compiler stops it.

---

## 7. Data model

Conventions for every collection:
`_id: ObjectId` · `createdAt`, `updatedAt` (timestamps) · `deletedAt: Date|null` (soft delete, all queries filter it) · money stored as **integer fils** (1 AED = 100 fils) — **never floats** · `slug` unique + indexed where public.

### 7.1 `users`

```ts
{
  _id, email: string(lowercase, unique, sparse), emailVerifiedAt: Date|null,
  phone: { countryCode: '+971', number: string }, phoneVerifiedAt: Date|null,
  passwordHash: string|null,                       // null for OTP/social-only users
  provider: 'local'|'google'|'otp',
  googleId: string|null,
  firstName, lastName,
  role: 'customer'|'support'|'catalog'|'order_ops'|'warehouse'|'content'|'finance'|'manager'|'super_admin',
  permissions: string[],                            // extra grants beyond role
  status: 'active'|'suspended'|'deleted',
  locale: 'en'|'ar', currency: 'AED',
  defaultAddressId: ObjectId|null,
  marketing: { email: bool, sms: bool, whatsapp: bool, consentAt: Date|null, consentIp: string },
  stats: { orderCount: int, totalSpentFils: int, avgOrderValueFils: int, lastOrderAt: Date },
  tags: string[],                                   // 'vip','wholesale','risky_cod'
  notesInternal: string,                            // staff-only
  lastLoginAt, lastLoginIp, failedLoginCount, lockedUntil
}
```
Indexes: `{email:1}` unique sparse · `{'phone.number':1}` unique sparse · `{role:1,status:1}` · `{createdAt:-1}`

### 7.2 `addresses`

```ts
{
  userId, label: 'home'|'work'|'other',
  firstName, lastName, phone: {countryCode, number},
  emirate: 'dubai'|'abu_dhabi'|'sharjah'|'ajman'|'ras_al_khaimah'|'fujairah'|'umm_al_quwain',
  city, area: string,                    // e.g. 'Al Barsha', 'JLT' — REQUIRED in UAE
  buildingName, apartment, street,
  landmark: string,                      // UAE addressing needs this
  makani: string|null,                   // Dubai Makani number — optional but gold for couriers
  poBox: string|null,
  country: 'AE',
  isDefaultShipping: bool, isDefaultBilling: bool,
  geo: { lat: number, lng: number }|null
}
```
> **UAE addressing note:** there are no postcodes and street numbers are unreliable. The address form is **area + building + landmark**, not "Address line 1 / ZIP". Getting this wrong causes failed deliveries. `area` is an autocomplete against a seeded list of ~400 UAE areas.

### 7.3 `brands`

```ts
{
  name: 'Khaadi', slug: 'khaadi',
  nameAr, descriptionEn, descriptionAr,
  logo: MediaRef, coverImage: MediaRef, coverVideo: MediaRef|null,
  countryOfOrigin: 'PK',
  sizeChartId: ObjectId|null,            // brands size differently — this matters
  sortOrder: int, isFeatured: bool, isActive: bool,
  seo: SeoBlock
}
```

### 7.4 `categories` (tree)

```ts
{
  name, nameAr, slug, parentId: ObjectId|null, path: 'unstitched/lawn/3-piece',
  level: int, image: MediaRef|null, icon: string|null,
  sortOrder, isActive, showInMenu: bool, menuColumn: int|null,
  seo: SeoBlock, productCount: int   // denormalised, recomputed by job
}
```

**Seeded taxonomy (locked — this replaces the generic Dresses/Tops/Bottoms tree):**

```
Unstitched
├── Lawn · Cambric · Cotton · Khaddar · Karandi · Linen
├── Chiffon · Organza · Silk · Jacquard · Velvet
└── By pieces: 1 Piece · 2 Piece · 3 Piece
Pret (Ready to Wear)
├── Kurtis · 2 Piece Sets · 3 Piece Sets · Co-ords · Kaftans (Pakistani cut)
Luxury Pret
Festive & Eid
Formal & Wedding
├── Mehndi · Barat · Walima · Nikkah · Guest Wear
├── Shararas · Ghararas · Lehengas · Angrakhas · Maxis
Bottoms & Separates
├── Trousers · Shalwar · Culottes · Slips
Dupattas & Shawls
Accessories (curated only)
├── Clutches · Jhumkas & Jewellery · Khussa (footwear)
Sale
New In
```

### 7.5 `products`

```ts
{
  title, titleAr, slug(unique), articleCode(indexed, uppercase),
  brandId, categoryIds: ObjectId[], primaryCategoryId,
  collectionIds: ObjectId[],

  // Pakistani-fashion core
  stitchingType: 'unstitched'|'semi_stitched'|'pret'|'custom_stitchable',
  pieceCount: 1|2|3|null,
  pieces: [{ type:'shirt'|'trouser'|'dupatta'|'slip'|'shawl', fabric, lengthMeters:number|null, work:string[], descriptionEn, descriptionAr }],
  fabric: FabricEnum, secondaryFabrics: FabricEnum[],
  work: WorkEnum[],
  dupattaType: DupattaEnum|null,
  occasion: OccasionEnum[],
  season: 'summer'|'winter'|'all_season'|'festive',
  colorName: string,                    // brand's name: 'Ferozi'
  colorFamily: ColorFamilyEnum,
  colorHex: string,                     // for the swatch dot
  neckline, sleeveLength, shirtLength, fit: string|null,   // pret only
  careInstructions: { en, ar },
  countryOfManufacture: 'PK',

  // Commerce
  hasVariants: bool,
  variantAxes: ('size'|'color'|'piece_count')[],
  basePriceFils: int,                   // fallback if no variants
  compareAtPriceFils: int|null,         // the "cut price" strike-through
  costPriceFils: int|null,              // admin-only, margin reports
  taxClass: 'standard_5'|'zero',
  isCustomStitchAvailable: bool, stitchingPriceFils: int|null, stitchingLeadDays: int|null,

  // Media
  media: [{ id, type:'image'|'video', publicId, url, alt, altAr, width, height, dominantColor, sortOrder, isPrimary, variantId?: ObjectId }],
  video: MediaRef|null, model360: MediaRef|null,

  // Merchandising
  status: 'draft'|'scheduled'|'active'|'archived',
  publishAt: Date|null,                 // scheduled drops
  isFeatured: bool, isNewIn: bool, isExclusive: bool,
  badges: ('new'|'bestseller'|'limited'|'last_pieces'|'pre_order'|'back_in_stock')[],
  sortWeight: int,

  // Denormalised for listing performance (recomputed on write)
  priceRange: { minFils, maxFils },
  effectivePriceFils: int,              // after active automatic discounts
  discountPercent: int,
  inStock: bool, totalStock: int,
  ratingAvg: number, ratingCount: int,
  soldCount: int, viewCount: int,

  seo: { titleEn, titleAr, descEn, descAr, canonical, noindex },
  relatedProductIds: ObjectId[], completeTheLookIds: ObjectId[],
  publishedAt, archivedAt
}
```

### 7.6 `variants`

```ts
{
  productId, sku(unique), barcode|null,
  options: { size?: 'XS'|'S'|'M'|'L'|'XL'|'XXL'|'free', color?: string, pieceCount?: 1|2|3 },
  priceFils, compareAtPriceFils|null, costPriceFils|null,
  weightGrams: int,                     // needed for courier rates
  mediaIds: string[],                   // subset of product media for this variant
  isActive, sortOrder,
  // stock lives in `inventory`, never here — single source of truth
}
```
Index: `{productId:1, 'options.size':1}` · `{sku:1}` unique

### 7.7 `inventory`

```ts
{
  variantId(unique), productId, sku,
  onHand: int,                 // physically in warehouse
  reserved: int,               // held by in-flight carts/orders
  available: int,              // onHand - reserved  (computed, stored, indexed)
  incoming: int, incomingEta: Date|null,
  lowStockThreshold: int (default 3),
  allowBackorder: bool (default false),
  warehouseId, binLocation: string|null,
  lastCountedAt: Date
}
```

### 7.8 `stock_movements` (append-only audit trail)

```ts
{
  variantId, type: 'purchase'|'sale'|'return'|'adjustment'|'reservation'|'release'|'damage'|'transfer',
  quantity: int,               // signed
  before: int, after: int,
  referenceType: 'order'|'manual'|'import'|'return', referenceId,
  reason: string, performedBy: userId, createdAt
}
```
> Stock is **never** set by a bare `$set`. Every change writes a movement. This is how we answer "where did 4 pieces go?" six months later.

### 7.9 `collections`

```ts
{
  name:'Lawn Vol-1 2026', nameAr, slug, subtitle,
  descriptionEn, descriptionAr,
  brandId|null,                          // brand collection vs house edit
  type: 'seasonal'|'brand'|'editorial'|'sale'|'automated',
  rules: [{ field, operator:'eq'|'in'|'gte'|'lte'|'contains', value }]|null,  // automated collections
  productIds: ObjectId[],                // manual collections, ordered
  heroImage, heroImageMobile, heroVideo, lookbookMedia: MediaRef[],
  launchAt: Date|null, endAt: Date|null,
  isTeaserVisible: bool,                 // show a countdown before launch
  status:'draft'|'scheduled'|'active'|'ended',
  layout: 'grid'|'editorial'|'lookbook'|'split',   // drives the page template
  sortOrder, isFeatured, seo
}
```

### 7.10 `carts`

```ts
{
  cartId(uuid, cookie), userId|null, sessionId,
  items: [{
    _id, productId, variantId, quantity,
    unitPriceFils, compareAtPriceFils,     // snapshot at add time
    stitching: { enabled: bool, measurementProfileId|null, priceFils, leadDays }|null,
    giftWrap: bool,
    addedAt, priceLockedUntil: Date
  }],
  appliedCoupons: [{ code, discountId, amountFils }],
  automaticDiscounts: [{ discountId, name, amountFils }],
  totals: { subtotalFils, discountFils, shippingFils, codFeeFils, taxFils, grandTotalFils },
  shippingAddressId|null, shippingMethodId|null,
  currency:'AED', locale,
  status:'active'|'converted'|'abandoned'|'merged',
  abandonedEmailsSent: int, lastActivityAt,
  expiresAt: Date            // TTL index, 30 days
}
```
Redis mirror of the active cart for sub-10 ms reads; Mongo is the durable record.

### 7.11 `orders`

```ts
{
  orderNumber: 'LF-260812-0001',          // human-readable, see §8.6
  userId|null, guestEmail|null, guestPhone|null,

  items: [{
    productId, variantId, sku, titleSnapshot, brandSnapshot, imageSnapshot,
    optionsSnapshot: {size,color,pieceCount},
    stitchingTypeSnapshot, articleCodeSnapshot,
    quantity, unitPriceFils, lineDiscountFils, lineTaxFils, lineTotalFils,
    stitching: { enabled, measurementSnapshot: {...}, priceFils, status } | null,
    fulfilmentStatus: 'pending'|'processing'|'stitching'|'packed'|'shipped'|'delivered'|'cancelled'|'returned',
    returnedQty: int, refundedFils: int
  }],

  // Money — every field stored, nothing recomputed at read time
  currency:'AED',
  subtotalFils, discountTotalFils, shippingFils, codFeeFils,
  taxFils, taxRate: 0.05, taxInclusive: true,
  grandTotalFils, paidFils, refundedFils, balanceDueFils,

  discounts: [{ discountId, code|null, type, amountFils, appliedTo:'order'|'shipping'|'item', itemId? }],

  // THE STATUS FLAG (§8.7)
  status: OrderStatus,
  statusHistory: [{ from, to, at, byUserId|'system', note, notifiedCustomer: bool }],
  paymentStatus: 'unpaid'|'authorized'|'paid'|'partially_refunded'|'refunded'|'failed',
  fulfilmentStatus: 'unfulfilled'|'partially_fulfilled'|'fulfilled'|'returned',

  shippingAddress: AddressSnapshot,       // embedded snapshot, NOT a ref
  billingAddress: AddressSnapshot,
  shippingMethod: { id, name, carrier, etaMinDays, etaMaxDays, priceFils },
  shipments: [{ id, carrier, trackingNumber, trackingUrl, awb, items:[{itemId,qty}], shippedAt, deliveredAt, events:[{code,description,at,location}] }],

  payment: { method:'card'|'apple_pay'|'google_pay'|'cod'|'tabby'|'tamara'|'bank_transfer',
             gateway, intentId, transactionIds:[], last4, brand, threeDSResult, codVerifiedAt },

  customerNote: string, internalNotes: [{ text, byUserId, at }],
  tags: string[],
  riskScore: int, riskFlags: string[],     // COD fraud screening
  invoiceNumber, invoiceUrl,
  source: 'web'|'mobile_web'|'admin'|'whatsapp',
  utm: { source, medium, campaign, term, content },
  ip, userAgent,
  placedAt, confirmedAt, shippedAt, deliveredAt, cancelledAt, cancelReason
}
```
Indexes: `{orderNumber:1}` unique · `{userId:1, placedAt:-1}` · `{status:1, placedAt:-1}` · `{'payment.intentId':1}` · `{guestEmail:1}` · `{placedAt:-1}`

> **Snapshot rule:** an order embeds copies of title, price, image, address and measurements. If a product is renamed or repriced in 2027, the 2026 invoice must still be correct. Never `populate()` a product into an order for display.

### 7.12 `discounts`

```ts
{
  name, internalDescription,
  mode: 'automatic'|'code',
  code: string|null (uppercase, unique sparse),
  type: 'percentage'|'fixed_amount'|'free_shipping'|'buy_x_get_y'|'tiered'|'bundle',
  value: number,                          // 20 = 20% | fils for fixed
  tiers: [{ minSubtotalFils, value }]|null,
  buyXGetY: { buyQty, getQty, appliesToCollectionId, discountPercent }|null,

  appliesTo: 'all'|'products'|'collections'|'categories'|'brands',
  targetIds: ObjectId[],
  excludeIds: ObjectId[],                 // e.g. exclude bridal from a sitewide sale

  conditions: {
    minSubtotalFils|null, minQuantity|null,
    firstOrderOnly: bool,
    customerTags: string[]|null,
    emirates: string[]|null,
    paymentMethods: string[]|null,        // e.g. 5% off on prepaid only
    startsAt, endsAt
  },

  usage: { limitTotal|null, limitPerCustomer|null, usedCount: int },
  stackable: bool, priority: int,          // lower runs first
  status: 'draft'|'active'|'scheduled'|'expired'|'disabled',
  showOnProductCard: bool,                 // render the "-30%" badge
  bannerTextEn, bannerTextAr
}
```

### 7.13 Other collections (fields abbreviated)

| Collection | Purpose | Key fields |
|---|---|---|
| `measurement_profiles` | Custom stitching | `userId, label('Mine','Ammi'), shirtLength, shoulder, bust, waist, hip, sleeveLength, armhole, neckDepthFront/Back, trouserLength, bottomWidth, unit:'inches', notes, isDefault` |
| `stitching_orders` | Tailor workflow | `orderId, itemId, profileSnapshot, tailorId, status:'queued'\|'cutting'\|'stitching'\|'finishing'\|'qc'\|'done', dueAt, photos[]` |
| `reviews` | Product reviews | `productId, orderId, userId, rating 1-5, title, body, media[], fitFeedback:'small'\|'true'\|'large', isVerifiedPurchase, status:'pending'\|'approved'\|'rejected', adminReply, helpfulCount` |
| `wishlists` | Saved items | `userId\|guestId, items:[{productId,variantId,addedAt,priceAtAdd}]` — price-drop email hook |
| `returns` | RMA | `orderId, items[], reason enum, condition, status:'requested'\|'approved'\|'picked_up'\|'received'\|'inspected'\|'refunded'\|'rejected', pickupAddress, refundMethod, refundFils, photos[]` |
| `shipping_zones` | Rates | `name, emirates[], methods:[{name, priceFils, freeAboveFils, etaMinDays, etaMaxDays, carrier, isCodAllowed}]` |
| `notify_requests` | Back in stock | `variantId, email\|phone, locale, notifiedAt` |
| `pages` | CMS pages | `slug, titleEn/Ar, bodyEn/Ar(rich), status, seo` |
| `home_sections` | Homepage builder | `type:'hero'\|'collection_rail'\|'editorial_split'\|'brand_strip'\|'category_grid'\|'video_banner'\|'usp_bar'\|'journal_teaser', payload(JSON), sortOrder, isActive, startsAt, endsAt, locale` |
| `banners` | Promo bars/tiles | `placement:'announcement'\|'homepage_top'\|'plp_top'\|'cart', mediaDesktop, mediaMobile, link, textEn/Ar, startsAt, endsAt` |
| `menus` | Navigation | `location:'header'\|'footer'\|'mobile', items:[{label, labelAr, href, children[], featuredMedia, badge}]` |
| `media` | Asset library | `publicId, url, type, width, height, bytes, alt, altAr, folder, tags[], dominantColor, uploadedBy` |
| `settings` | Singleton config | `store{name,email,phone,whatsapp,address,trn}, shipping{freeThreshold,flatRate,codFee,codMax}, tax{rate,inclusive}, features{}, social{}, maintenance{}` |
| `audit_logs` | Compliance | `actorId, actorEmail, action, entityType, entityId, before, after(diff), ip, userAgent, at` |
| `sessions` | Refresh tokens | `userId, refreshTokenHash, family, device, ip, expiresAt, revokedAt` |
| `otps` | Phone/email OTP | `identifier, codeHash, purpose, attempts, expiresAt(TTL 10m)` |
| `newsletter_subscribers` | Marketing | `email, locale, source, consentAt, consentIp, status, unsubscribedAt` |
| `search_queries` | Merchandising insight | `query, resultCount, clickedProductId, userId, at` — powers "no results" fixes and synonym tuning |

### 7.14 Indexes (create in migration, not by accident)

```js
products: { slug:1 } unique
          { status:1, publishedAt:-1 }
          { brandId:1, status:1 }
          { categoryIds:1, status:1, sortWeight:-1 }
          { collectionIds:1, status:1 }
          { stitchingType:1, fabric:1, occasion:1, status:1 }   // main facet path
          { effectivePriceFils:1, status:1 }
          { articleCode:1 }
          { inStock:1, status:1, createdAt:-1 }
variants:  { productId:1, isActive:1 } , { sku:1 } unique
inventory: { variantId:1 } unique , { available:1 } , { available:1, lowStockThreshold:1 }
orders:    { orderNumber:1 } unique , { userId:1, placedAt:-1 } , { status:1, placedAt:-1 }
           { 'payment.intentId':1 } , { 'shipments.trackingNumber':1 }
carts:     { cartId:1 } unique , { userId:1 } , { expiresAt:1 } TTL
           { status:1, lastActivityAt:1 }   // abandoned-cart job
discounts: { code:1 } unique sparse , { mode:1, status:1, 'conditions.startsAt':1 }
reviews:   { productId:1, status:1, createdAt:-1 }
audit_logs:{ entityType:1, entityId:1, at:-1 } , { actorId:1, at:-1 }
```

**Meilisearch index** `products` — synced by a BullMQ job on `product.published` / `product.updated`, full rebuild via `pnpm reindex`:

```jsonc
searchableAttributes: ["articleCode","title","titleAr","brandName","colorName","fabric","categoryPath","occasion"]
filterableAttributes: ["brandId","categoryIds","collectionIds","stitchingType","pieceCount","fabric","work",
                       "occasion","season","colorFamily","size","effectivePriceFils","inStock","onSale","status"]
sortableAttributes:   ["effectivePriceFils","createdAt","soldCount","discountPercent"]
rankingRules:         ["words","typo","proximity","attribute","sort","exactness","soldCount:desc"]
synonyms:             { "3 piece": ["three piece","3pc","3-piece"],
                        "unstitched": ["un-stitched","unstiched"],
                        "lawn": ["lawn suit"],
                        "dupatta": ["dupata","chunri"] }
```

Article code is the first searchable attribute, so `KHAS-24-107` always outranks a fuzzy title match. Only `status: active` products are indexed. If Meilisearch is unreachable the API falls back to a Mongo regex query on `title` + `articleCode` — degraded, but search never returns a 500.

---

## 8. Core business logic (specified, not left to the developer)

### 8.1 Money

- Stored and computed as **integer fils**. `AED 249.50` → `24950`.
- Rounding **only** at final display, `Math.round`, half-up.
- One formatter: `formatMoney(fils, locale)` → `AED 249.50` / `‏د.إ ٢٤٩٫٥٠`.
- Never `parseFloat` a price from the client. Prices always come from the database.

### 8.2 Price resolution order

For any variant, the price shown is resolved in this exact order:

1. `variant.priceFils` if set, else `product.basePriceFils`.
2. Apply **automatic discounts** matching the product (highest-priority rule wins unless `stackable`).
3. `compareAtPrice` = `variant.compareAtPriceFils` if set, else the pre-discount price → this is the struck-through number.
4. `discountPercent = round((compareAt - final) / compareAt * 100)`.

**Price-cut display rule (the client's "price cut discount options"):**

```
┌───────────────────────────────┐
│  AED 249.00   ~~AED 349.00~~  │   -29%
└───────────────────────────────┘
```
- Final price in ink, large, `Archivo` 600 weight, tabular numerals.
- Compare-at struck through, in Mukaish grey, one step smaller.
- Percentage badge in **Garnet** `#8C2F39`, uppercase, tracked. Rendered **only if** `discountPercent ≥ 5` and `discount.showOnProductCard`.
- **Never** show a fake compare-at. UAE consumer protection: a strike-through price must have been the actual selling price for the preceding 30 days. Admin shows a warning when a compare-at is set above a price that was never live. `priceHistory[]` on the product records this.

### 8.3 Discount engine

A single pure function — the only place discount maths exists:

```ts
applyDiscounts(cart: CartSnapshot, discounts: Discount[], ctx: { user, isFirstOrder, paymentMethod, emirate })
  → { lineDiscounts: Map<itemId, fils>, orderDiscount: fils, shippingDiscount: fils, applied: AppliedDiscount[], rejected: {code, reason}[] }
```

Algorithm, in order:

1. Load all `active` discounts within their date window. Add any coupon codes on the cart.
2. **Eligibility filter** per discount: target match (product/collection/brand/category minus excludes), `minSubtotal`, `minQuantity`, `firstOrderOnly`, `customerTags`, `emirates`, `paymentMethods`, usage limits (total + per customer, checked in Redis then Mongo).
3. Sort by `priority` ascending, then by discount value descending.
4. Apply sequentially. If a discount is `stackable: false`, it terminates further order-level discounts. Free-shipping discounts are evaluated in a separate lane and always stack.
5. **Line allocation:** an order-level discount is distributed across eligible lines *pro rata by line total*, with the rounding remainder given to the largest line, so `Σ lineDiscounts === orderDiscount` exactly. This is required for correct partial refunds and VAT.
6. Cap: total discount can never exceed subtotal. Grand total can never be < 0.
7. Return rejected codes with a **specific human reason** ("This code applies to Lawn '26 only", not "Invalid code").

**Locked business rules:**
- Only **one coupon code** per order (a second code replaces the first, with a clear message). Automatic discounts stack with a code only if the code is `stackable`.
- Discounts never apply to shipping fee, COD fee or gift wrap unless `type === 'free_shipping'`.
- Bridal/Formal category can be globally excluded from sitewide sales with one toggle.
- Discount recalculation happens **server-side on every cart mutation and again at order creation.** The client's numbers are never trusted.

### 8.4 Inventory & the oversell problem

Availability shown = `inventory.available` = `onHand − reserved`.

**Reservation flow (Redis-locked):**

```
addToCart / checkout-start
  → acquire Redis lock `lock:variant:{id}` (redlock, 3s TTL)
  → re-read available
  → if available >= qty:
        inventory.reserved += qty
        stock_movement(type='reservation')
        set Redis key `resv:{cartId}:{variantId}` TTL 20 min
    else: return OUT_OF_STOCK with the max available qty
  → release lock
```

- Reservation TTL: **20 minutes** in cart, extended to **45 minutes** once checkout starts.
- Expiry is handled by a BullMQ repeatable job every 60 s that releases stale reservations and writes a `release` movement.
- On `order.placed`: reservation → `sale` movement, `onHand -= qty`, `reserved -= qty`.
- On `order.cancelled` / return received: `onHand += qty` with a `return` movement.
- `allowBackorder` per variant permits selling into negative; the PDP then shows "Pre-order — ships in X days".
- Low stock (`available ≤ lowStockThreshold`) → badge "Only N left" on PDP + daily low-stock digest email to the manager.

### 8.5 Cart rules

| Rule | Value |
|---|---|
| Max quantity per line | 10 (configurable) |
| Max distinct lines | 50 |
| Guest cart lifetime | 30 days (cookie `lulwah_cart`, `SameSite=Lax`, `Secure`) |
| Cart merge on login | Union of items; same variant → **max(qty)**, not sum. Prices re-resolved to current. |
| Price change while in cart | On every cart read, compare snapshot vs current. If changed, update silently and surface a non-blocking notice: "Price updated for 1 item." |
| Item goes out of stock | Move to a `Saved for later` section in the drawer; never silently delete. |
| Cart totals | Always recalculated server-side. The client renders what the server returns. |

### 8.6 Order number format

`LF-YYMMDD-NNNN` → `LF-260812-0043` (43rd order on 12 Aug 2026).
Generated by an atomic `findOneAndUpdate` on a `counters` document keyed by date. Human-readable, sortable, tells support the date instantly, leaks a rough daily volume only.

### 8.7 Order status — the delivery-tracking state machine ⭐

This is the feature the brief calls out explicitly ("delivery tracking by status flag, update by admin/manager"). Specified in full.

#### 8.7.1 States

| # | `status` | Customer-facing EN | Customer-facing AR | Meaning |
|---|---|---|---|---|
| 1 | `pending_payment` | Awaiting payment | بانتظار الدفع | Order created, payment not captured. Auto-cancels after 60 min (card) / immediately confirmed (COD). |
| 2 | `confirmed` | Order confirmed | تم تأكيد الطلب | Paid, or COD verified by OTP. Stock committed. |
| 3 | `processing` | Preparing your order | قيد التجهيز | Picked from shelf, being checked/packed. |
| 4 | `stitching` | With our tailor | لدى الخياط | Only for items with custom stitching. Shows expected days. |
| 5 | `ready_to_ship` | Ready to ship | جاهز للشحن | Packed, awaiting courier pickup. |
| 6 | `shipped` | Shipped | تم الشحن | Handed to courier. Tracking number attached (required to enter this state). |
| 7 | `out_for_delivery` | Out for delivery | خارج للتوصيل | Last mile. |
| 8 | `delivered` | Delivered | تم التوصيل | Terminal (happy). Starts the 14-day return clock. |
| 9 | `cancelled` | Cancelled | ملغى | Terminal. Requires a reason. Releases stock. |
| 10 | `returned` | Returned | مُرجَع | Terminal. Post-delivery. |
| 11 | `refunded` | Refunded | تم استرداد المبلغ | Terminal. Full or partial. |
| 12 | `failed` | Payment failed | فشل الدفع | Terminal. Recoverable via a retry link. |

#### 8.7.2 Allowed transitions (enforced in `order.policy.ts`)

```
pending_payment → confirmed | failed | cancelled
confirmed       → processing | cancelled
processing      → stitching | ready_to_ship | cancelled
stitching       → ready_to_ship | cancelled
ready_to_ship   → shipped | cancelled
shipped         → out_for_delivery | delivered | returned
out_for_delivery→ delivered | shipped (failed attempt, back a step) | returned
delivered       → returned
returned        → refunded
cancelled       → refunded          (if it was paid)
failed          → pending_payment   (customer retries)
```

Any other transition returns `409 INVALID_STATUS_TRANSITION`. **`super_admin` may force any transition**, and it is written to `audit_logs` with a mandatory reason.

#### 8.7.3 Side effects per transition (automatic, via domain events)

| Transition | Effects |
|---|---|
| → `confirmed` | Reservation→sale, decrement `onHand`, generate invoice PDF, email + SMS, increment `discount.usedCount`, increment `product.soldCount`, fire `Purchase` to GA4/Meta CAPI |
| → `stitching` | Create `stitching_order` records, notify tailor queue, email customer with ETA |
| → `shipped` | Require `trackingNumber` + `carrier`; email + SMS/WhatsApp with tracking link; start courier polling job |
| → `out_for_delivery` | SMS/WhatsApp only ("arriving today") |
| → `delivered` | Set `deliveredAt`, start return window timer, schedule review-request email at +5 days, mark COD as collected |
| → `cancelled` | Release/return stock, decrement discount usage, trigger refund if paid, email with reason |
| → `returned` | Await inspection, then restock or write off |
| → `refunded` | Gateway refund or manual record, credit note PDF, email |

#### 8.7.4 Admin controls

- A **single status control** in the order detail header: current flag as a pill, a dropdown showing **only legally valid next states** (invalid ones are not rendered at all — impossible to make a mistake).
- Optional **internal note** and a **"Notify customer"** toggle (default on) on every change.
- Entering `shipped` opens a required mini-form: carrier, tracking number, optional AWB.
- **Bulk status update** from the order list: select rows → change status → confirmation dialog listing exactly what will happen and how many emails will send.
- Every change appends to `statusHistory` with actor, timestamp, note, and whether the customer was notified. This history is immutable.

#### 8.7.5 Customer-facing tracking

- `/track` — enter order number + email/phone, **no login required**. Rate-limited to 5 attempts / 10 min / IP.
- `/account/orders/{orderNumber}` for logged-in users.
- A **vertical timeline** of the states, with completed steps in Zamurrad green with a filled pearl marker, current step animated (a slow gold shimmer along the connector line, `prefers-reduced-motion` → static), future steps in Mukaish grey.
- Shows: ETA range, courier name, tracking number with copy button, deep link to the courier's site, and the per-item fulfilment status when a shipment is split.
- Live courier events (R2) merge into the same timeline beneath the internal flags.

### 8.8 Returns & refunds

- Customer opens a return from the order page within 14 days of `delivered`.
- Reasons: `size_issue`, `not_as_described`, `damaged`, `wrong_item`, `changed_mind`, `quality`. Photos required for `damaged` / `wrong_item`.
- **Non-returnable:** custom-stitched items, opened/cut unstitched fabric, sale items marked final, jewellery. Stated on the PDP and re-stated at checkout with a checkbox for final-sale items.
- Flow: `requested → approved → picked_up → received → inspected → refunded | rejected`.
- Refund method: original payment method; COD orders refund to bank transfer (IBAN collected in the return form) or store credit (R3).
- Refund maths: refund the **line total actually paid**, i.e. `unitPrice × qty − allocated line discount`, plus the proportional VAT. Shipping refunded only if the whole order is returned or the fault is ours.

### 8.9 Custom stitching (R2)

1. PDP for `custom_stitchable` products shows a "Stitch it for me — +AED 120, ready in 7 days" option.
2. Customer picks a saved measurement profile or creates one (guided form with a diagram illustrating each measurement; inches; validation ranges per field to catch typos like a 60" shoulder).
3. Cart line carries `stitching{}`; order item snapshots the measurements (profiles can be edited later — the order must not change).
4. Order enters `stitching`; admin sees a **Stitching board** (kanban: queued → cutting → stitching → finishing → QC → done) with due dates and the tailor assigned.
5. Order can only progress to `ready_to_ship` when every stitching item is `done`.
6. Custom-stitched items are non-returnable — enforced in the returns eligibility check, not just in copy.

---

## 9. API specification

Base: `https://api.lulwah.ae/api/v1` · JSON only · UTC ISO-8601 dates · fils integers for money.

### 9.1 Response envelope (every endpoint, no exceptions)

```jsonc
// success
{ "success": true, "data": { }, "meta": { "page":1, "limit":24, "total":312, "hasMore":true } }

// error
{ "success": false, "error": {
    "code": "OUT_OF_STOCK",
    "message": "Only 2 pieces of this size are left.",
    "messageAr": "تبقى قطعتان فقط من هذا المقاس.",
    "field": "items[0].quantity",
    "details": { "available": 2 }
  },
  "requestId": "req_01J..." }
```

Error codes are a **closed enum** in `packages/contracts`. The UI maps code → localized message; it never displays a raw backend string.

### 9.2 Public endpoints

```
GET  /health                                  liveness + version
GET  /products                                ?category&brand&collection&stitchingType&fabric&work&occasion&
                                              colorFamily&size&minPrice&maxPrice&inStock&onSale&
                                              sort=newest|price_asc|price_desc|bestselling|discount&page&limit
GET  /products/:slug                          full PDP payload (variants, inventory, sizeChart, media, breadcrumbs)
GET  /products/:slug/related
GET  /products/:id/reviews                    ?page&sort=recent|helpful|rating
POST /products/:id/notify-me                  back-in-stock
GET  /search                                  ?q (Meilisearch, typo-tolerant, article-code exact boost)
GET  /search/suggest                          ?q  → products, collections, brands, queries
GET  /collections  /collections/:slug
GET  /brands       /brands/:slug
GET  /categories   /categories/tree
GET  /content/home                            ordered home_sections payload
GET  /content/menus/:location
GET  /content/pages/:slug
GET  /content/banners?placement=
GET  /settings/public                         thresholds, currency, contact, feature flags
GET  /shipping/rates?emirate=&subtotal=
POST /newsletter/subscribe
POST /contact
GET  /orders/track                            ?orderNumber&emailOrPhone   (rate-limited)
```

### 9.3 Auth endpoints

```
POST /auth/register                {email,password,firstName,lastName,phone}
POST /auth/login                   {email,password}
POST /auth/otp/request             {phone|email, purpose}
POST /auth/otp/verify              {identifier, code}
POST /auth/google                  {idToken}
POST /auth/refresh                 (rotating refresh cookie)
POST /auth/logout   POST /auth/logout-all
POST /auth/forgot-password   POST /auth/reset-password
POST /auth/verify-email
GET  /auth/me
```

### 9.4 Customer endpoints (auth required)

```
GET|PATCH /me                        profile, locale, marketing consent
GET|POST  /me/addresses     PATCH|DELETE /me/addresses/:id     POST /me/addresses/:id/default
GET       /me/orders        GET /me/orders/:orderNumber        GET /me/orders/:n/invoice.pdf
POST      /me/orders/:n/cancel        (only while confirmed|processing)
POST      /me/orders/:n/reorder
GET|POST  /me/wishlist      DELETE /me/wishlist/:productId
GET|POST  /me/measurements  PATCH|DELETE /me/measurements/:id
GET|POST  /me/returns       GET /me/returns/:id
POST      /me/reviews
```

### 9.5 Cart & checkout

```
POST   /cart                          create/get by cookie
GET    /cart/:cartId
POST   /cart/:cartId/items            {variantId, quantity, stitching?}
PATCH  /cart/:cartId/items/:itemId    {quantity}
DELETE /cart/:cartId/items/:itemId
POST   /cart/:cartId/coupon           {code}
DELETE /cart/:cartId/coupon
POST   /cart/:cartId/merge            after login

POST   /checkout/session              validate stock, lock prices, extend reservations
POST   /checkout/session/:id/address
POST   /checkout/session/:id/shipping
POST   /checkout/session/:id/payment-intent   → Stripe client secret | Tabby session | COD
POST   /checkout/session/:id/place            Idempotency-Key header REQUIRED
POST   /checkout/cod/verify-otp
```

### 9.6 Webhooks (public, signature-verified, idempotent)

```
POST /webhooks/stripe        signature: stripe-signature
POST /webhooks/tabby         hmac
POST /webhooks/tamara        hmac
POST /webhooks/aramex        shared secret + IP allowlist
```
Every webhook: verify signature → check `webhook_events` for `eventId` → if seen, `200` immediately → else persist, enqueue processing, `200` within 5 s. **Never** do the work inline.

### 9.7 Admin endpoints (`/admin/*`, RBAC-guarded)

```
Products    GET|POST /admin/products · GET|PATCH|DELETE /admin/products/:id
            POST /admin/products/:id/duplicate · POST /admin/products/bulk
            POST /admin/products/import (CSV) · GET /admin/products/export
            POST|PATCH|DELETE /admin/products/:id/variants[/:vid]
            POST /admin/products/:id/media · PATCH reorder · DELETE
Inventory   GET /admin/inventory ?lowStock&search · POST /admin/inventory/:variantId/adjust
            GET /admin/inventory/movements · POST /admin/inventory/bulk-adjust
Orders      GET /admin/orders ?status&payment&dateFrom&dateTo&emirate&q&sort
            GET /admin/orders/:id
            PATCH /admin/orders/:id/status      ⭐ the status flag endpoint
            POST /admin/orders/bulk-status
            POST /admin/orders/:id/shipments · PATCH /admin/orders/:id/shipments/:sid
            POST /admin/orders/:id/refund · POST /admin/orders/:id/notes
            POST /admin/orders/:id/resend-notification
            GET  /admin/orders/export · GET /admin/orders/:id/packing-slip.pdf
Discounts   full CRUD + POST /admin/discounts/:id/toggle + GET /admin/discounts/:id/usage
Customers   GET /admin/customers · GET /admin/customers/:id (orders, cart, LTV)
            PATCH tags/notes/status · POST /admin/customers/:id/impersonate (super_admin, audited)
Content     CRUD for home-sections, banners, pages, menus, collections, lookbooks, media
Reports     /admin/reports/{sales,products,customers,discounts,inventory,traffic}
Settings    GET|PATCH /admin/settings · GET|POST /admin/users · GET /admin/audit-logs
```

### 9.8 Cross-cutting API rules

| Rule | Detail |
|---|---|
| Pagination | Cursor-based on hot lists (products, orders); offset allowed in admin tables. `limit` max 100. |
| Rate limits | Public read 120/min/IP · auth 10/min/IP · OTP 3/5min/identifier · checkout place 5/min/user · admin 300/min/user. Redis sliding window. |
| Idempotency | `Idempotency-Key` header required on order placement and refunds; stored 24 h in Redis. |
| Caching | Public GETs get `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` + ETag. Cloudflare caches; purged by tag on `product.updated`. |
| Compression | gzip/brotli on responses > 1 KB. |
| Payload size | 1 MB body limit (10 MB on media upload routes). |
| Versioning | Path-versioned `/v1`. Breaking changes ship as `/v2`; `/v1` supported 6 months. |
| Request ID | `x-request-id` in, echoed out, on every log line and Sentry event. |

---

## 10. Authentication, authorization, roles

### 10.1 Token strategy

| Token | Lifetime | Storage | Notes |
|---|---|---|---|
| Access JWT | 15 min | Memory (web) / `Authorization` header | Claims: `sub, role, permissions[], sessionId, iat, exp` |
| Refresh token | 30 days | **httpOnly, Secure, SameSite=Lax** cookie | Opaque, hashed in `sessions`, **rotated on every use** |

**Reuse detection:** refresh tokens carry a `family` id. If an already-rotated token is presented, the entire family is revoked and the user is forced to re-authenticate — this defeats stolen-token replay.

- Passwords: **argon2id** (m=19456, t=2, p=1). Minimum 8 chars, checked against a common-password list. No forced complexity theatre.
- OTP: 6 digits, hashed, 10-min TTL, 3 attempts, 60-second resend cooldown, per-phone daily cap.
- Admin accounts: **mandatory TOTP 2FA**, 8-hour session, separate cookie domain (`admin.lulwah.ae`), IP-change re-auth.
- Account lockout: 5 failed logins → 15-minute lock, exponential thereafter.

### 10.2 RBAC matrix

| Permission → / Role ↓ | Products | Inventory | Orders view | Order status | Refunds | Discounts | Customers | Content | Reports | Settings | Users |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `super_admin` | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ |
| `manager` | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | 👁 | 👁 |
| `catalog` | ✏️ | ✏️ | — | — | — | 👁 | — | ✏️ | 👁 | — | — |
| `order_ops` | 👁 | 👁 | ✏️ | ✏️ | — | 👁 | 👁 | — | 👁 | — | — |
| `warehouse` | 👁 | ✏️ | 👁 | ✏️* | — | — | — | — | — | — | — |
| `support` | 👁 | 👁 | ✏️ | ✏️* | — | 👁 | ✏️ | — | — | — | — |
| `content` | 👁 | — | — | — | — | — | — | ✏️ | 👁 | — | — |
| `finance` | 👁 | 👁 | 👁 | — | ✏️ | 👁 | 👁 | — | ✏️ | — | — |
| `customer` | storefront only |

✏️ write · 👁 read · `✏️*` = restricted subset: `warehouse` may only set `processing → ready_to_ship → shipped`; `support` may only set `cancelled` and re-send notifications.

Permissions are strings (`orders.status.update`, `discounts.create`, `settings.write`). Roles are bundles. A user can hold extra individual permissions. Enforced by `requirePermission('orders.status.update')` middleware **and** re-checked in the service layer — never in the UI alone.

---

## 11. Admin console specification

`admin.lulwah.ae` — separate Next.js app, client-rendered, `noindex`, its own auth cookie. Dense, fast, keyboard-driven. Visually it is a **tool**: neutral greys, one accent, high information density. It deliberately does not use the storefront's editorial styling.

### 11.1 Screens

| Screen | Contents |
|---|---|
| **Dashboard** | Today/7d/30d/custom: revenue, orders, AOV, conversion rate, units. Sparkline trends vs previous period. Orders needing action (unfulfilled, pending payment, stitching overdue, return requests). Low-stock list. Top products, top collections, top discount codes. Live "last 10 orders" feed. |
| **Orders** | Table: order #, date, customer, emirate, items, total, payment method, payment status, **status flag pill**, tags. Saved filters ("COD unverified", "Shipped >5 days, not delivered", "Stitching overdue"). Bulk: status change, print packing slips, export CSV, tag. Row click → drawer with quick actions; full page for detail. |
| **Order detail** | Header: number, date, status pill + status dropdown, payment status, total. Panels: items with per-item fulfilment, money breakdown (subtotal, discounts itemised, shipping, COD fee, VAT, total, paid, balance), customer card (LTV, order count, past orders), shipping address with copy + Google Maps link, shipments with tracking, **status timeline**, internal notes, activity/audit feed. Actions: update status, add shipment, refund, resend email/SMS, edit address, cancel, print packing slip/invoice. |
| **Products** | Table with image thumb, title, brand, article code, stitching type, price, compare-at, stock, status. Inline quick-edit of price and stock. Filters mirroring storefront facets. Bulk: publish, archive, add to collection, price change (% or fixed), tag. CSV import with a dry-run preview showing exactly which rows will create vs update vs error. |
| **Product editor** | Tabs: **Basics** (title EN/AR, slug, article code, brand, categories, collections, description rich text) · **Pakistani attributes** (stitching type, piece count + per-piece builder, fabric, work, dupatta, occasion, season, colour name/family/hex) · **Media** (drag-drop, reorder, alt text EN/AR, assign to variant, video, mark primary) · **Variants** (matrix generator from size×colour, per-variant price/SKU/weight/stock) · **Pricing** (base, compare-at, cost, margin % shown live, tax class, stitching add-on price) · **Inventory** (per-variant on-hand, threshold, backorder) · **SEO** (title/desc EN/AR with SERP preview, canonical, noindex) · **Publishing** (status, publish-at scheduler, featured, badges). Autosave draft every 20 s; unsaved-changes guard. |
| **Inventory** | Variant-level grid, filter by low/out of stock, inline adjust with mandatory reason, movement history per variant, bulk CSV stock update, printable stock-count sheet. |
| **Discounts** | List with status, usage vs limit, revenue attributed. Builder: mode (automatic/code), type, value, targets with a product/collection picker, conditions, schedule, limits, stacking, priority, badge text EN/AR. **Live preview**: "on a sample cart of X, this discount gives AED Y off." Bulk generate unique codes (e.g. 500 codes for an influencer campaign) with CSV export. |
| **Customers** | List with orders, spend, last order, tags, marketing consent. Detail: profile, addresses, order history, current cart contents, wishlist, reviews, measurement profiles, internal notes, tag editor, COD risk flags. |
| **Content** | **Homepage builder** — drag-and-drop the ordered `home_sections`, each with a typed settings form and a live preview iframe. **Banners** with desktop/mobile assets and scheduling. **Menus** — nested drag-and-drop with featured imagery per column. **Pages** — rich text EN/AR. **Collections** — manual ordering by drag, or rule builder for automated collections, hero media, layout template, launch scheduler with countdown toggle. **Media library** with folders, search, alt-text bulk edit. |
| **Reports** | Sales (by day/brand/category/collection/emirate/payment method), Products (best/worst sellers, sell-through rate, never-sold), Customers (new vs returning, cohort retention, LTV), Discounts (usage, revenue, margin impact), Inventory (stock value, ageing, low stock), Search (top queries, **zero-result queries** — this is a merchandising goldmine), Traffic (from GA4 API). All exportable to CSV/XLSX. |
| **Settings** | Store details + TRN, shipping zones & rates & free-shipping threshold, COD fee/cap, tax rate, email/SMS templates with variable preview and test-send, payment gateway keys (masked), feature flags, maintenance mode, legal pages. |
| **Users & roles** | Invite staff, assign role, extra permissions, force 2FA reset, deactivate, session list with revoke. |
| **Audit log** | Every mutating admin action, filterable by actor/entity/date, with a before→after diff viewer. |

### 11.2 Admin UX rules

1. **Never a full-page spinner.** Skeletons matching the final layout.
2. Optimistic updates on toggles and inline edits, with rollback + toast on failure.
3. Every destructive action needs typed confirmation for irreversible ones (delete product, refund).
4. Every table: sticky header, column visibility control, saved views, keyboard row navigation, `Cmd/Ctrl+K` command palette for global search and navigation.
5. Bulk actions always state the exact consequence, including how many customer notifications will be sent.
6. All money inputs are in AED with two decimals in the UI, converted to fils at the boundary.
7. Mobile: order list, order detail and status update **must** work on a phone — the manager will update flags from a phone. Everything else may be desktop-only.

---

## 12. Storefront architecture

### 12.1 Route map

```
/[locale]                                 Home
/[locale]/new-in
/[locale]/collections                     All collections index
/[locale]/collections/[slug]              Collection (layout driven by collection.layout)
/[locale]/shop/[...category]              Category PLP, nested (shop/unstitched/lawn)
/[locale]/brands  /brands/[slug]          Brand index + brand house page
/[locale]/product/[slug]                  PDP
/[locale]/search                          Search results
/[locale]/lookbook  /lookbook/[slug]      Editorial (R2)
/[locale]/journal  /journal/[slug]        Blog (R2)
/[locale]/cart
/[locale]/checkout                        Multi-step, minimal chrome
/[locale]/checkout/confirmation/[order]
/[locale]/track                           Guest order tracking
/[locale]/account/*                       orders, orders/[n], addresses, wishlist,
                                          measurements, returns, profile
/[locale]/stitching                       Custom stitching service page (R2)
/[locale]/size-guide  /fabric-guide       Education pages — high SEO value
/[locale]/about  /contact  /faq  /stores
/[locale]/policies/[slug]                 shipping, returns, privacy, terms, cookies
/[locale]/sale
```

### 12.2 Rendering strategy per route (locked)

| Route | Strategy | Revalidate |
|---|---|---|
| Home | ISR | 300 s + on-demand on content publish |
| PLP / Collection | ISR for page 1 & the top 20 facet combinations; client fetch for deeper filtering | 300 s |
| PDP | ISR, `generateStaticParams` for the top 500 products, rest on-demand | 600 s + on-demand on `product.updated` |
| Search | SSR (`dynamic`) | no cache |
| Cart / Checkout / Account | Client, auth-guarded, `no-store` | — |
| Track | SSR | no cache |
| Content pages | SSG + on-demand revalidate | — |

Stock and price on ISR pages are **hydrated client-side** on mount from `/products/:slug/availability` so a cached page never shows a stale "in stock".

### 12.3 Data & state

- Server Components fetch on the server for anything SEO-relevant. `'use client'` only where interaction demands it.
- TanStack Query for cart, wishlist, account, filters. Cart mutations are optimistic with rollback.
- Zustand slices: `cartUI` (drawer open, last added item), `filters`, `search`, `locale`, `motionPrefs`.
- URL is the source of truth for filters, sort and pagination (`nuqs`) — filtered pages are shareable and back/forward works.

### 12.4 Component contract

Every component: typed props, no `any`, no data fetching inside presentational components, `Skeleton` and `Empty` variants co-located, Storybook story (R2), and a named export.

---

## 13. Design system — visual direction

> The brief says twice: **the UI must not look AI-generated.** This section is how we guarantee that. It is a design brief, not decoration; deviations need design sign-off.

### 13.1 Positioning

Lulwah means **pearl**. The logo is a high-contrast serif monogram with a pearl set into the flourish of the L. So the store is not a marketplace — it is a **jewellery vitrine for cloth**. Every screen should feel like a piece has been placed under glass and lit.

The reference site (Ipekyol) is competent Shopify: full-bleed banners, tidy grid. We take its **clarity and merchandising rhythm** and reject its **genericness**. Our differentiator is that the layout behaves like a Pakistani couture lookbook — asymmetric, generous, fabric-led — not a catalogue page.

### 13.2 What "AI-generated" looks like — banned list

Do not ship any of these. This is a hard checklist reviewed at design QA.

| ❌ Banned | ✅ Instead |
|---|---|
| Purple/blue/indigo gradients anywhere | Gold used only as a hairline, rule, or 1px border. Never a large gradient fill. |
| Glassmorphism, frosted blur cards | Solid surfaces, real edges, one hairline rule |
| `rounded-2xl` + `shadow-lg` on every card | **Radius 0 on product media and panels**, 2px on buttons/inputs only. Shadows almost never; separation comes from spacing and rules. |
| Centred hero: headline + subhead + two pill buttons | Full-bleed campaign image/video with the type set **off-axis**, one text link, no button pair |
| Emoji as icons; three-icon "features" row | Custom line icons drawn from the logo's filigree; the USP bar is text-only, uppercase, tracked |
| Default Tailwind palette (`gray-500`, `blue-600`) | Only tokens from §13.3. `gray-*` etc. are removed from the Tailwind config so they cannot be typed. |
| shadcn default skin | Radix primitives, our styling |
| Stock-photo "diverse team smiling" imagery | Only real product/campaign photography; if unavailable at launch, use fabric macro shots and typographic panels |
| Uniform 4-up grid everywhere | Editorial rhythm: 2-up hero row → 3-up → full-bleed break → 3-up |
| Copy like "Discover our amazing collection" / "Elevate your style" | Specific copy: "Lawn '26, Vol 1 — 42 designs, in stock in Dubai" |
| Section headings that are all the same size | A real type scale used at full range: 96px display next to 11px tracked labels |
| Everything animating on scroll | One orchestrated moment per page; the rest is still |

### 13.3 Colour tokens (locked)

```css
--ink:            #131311;   /* primary type, near-black, warm */
--ink-70:         #131311b3;
--paper:          #FFFFFF;   /* default page surface — products are shot on white */
--pearl:          #EDEDEA;   /* alternating section surface, low chroma neutral */
--nacre:          #F7F7F5;   /* input fills, hover surfaces */
--zamurrad:       #0E3B30;   /* deep emerald — structural colour, footer, primary button */
--zamurrad-deep:  #08221C;   /* overlays, immersive sections */
--gold-dark:      #B8862B;   /* gold family — matches the logo gradient */
--gold:           #D9AE4A;
--gold-light:     #F2E0A8;
--garnet:         #8A2B36;   /* sale / price-cut only */
--mukaish:        #8E9086;   /* muted meta text, disabled, dividers */
--line:           #131311 14%;/* hairline rules */
--success:        #1F6B4A;
--warning:        #A9761A;
--danger:         #A32A2A;
```

**Usage law:**
- Gold is **metal, not paint**: hairlines, the monogram, the price-cut badge border, focus rings, the scroll bead. Never a background fill larger than 48 px.
- Emerald is the only large colour block: footer, the "Formal & Wedding" world, the primary button, immersive sections.
- Garnet appears **only** on sale/discount markers, nowhere else — so a red mark always means "price cut".
- Everything else is paper, pearl and ink. The clothes bring the colour.

*Rationale for the choice:* emerald + gold is the colour pair of Pakistani bridal *zari* work and of Gulf luxury retail simultaneously — it is native to both ends of this business. It is also deliberately far from the warm-cream/terracotta and black/acid-green palettes that current AI-generated sites default to.

### 13.4 Typography (locked)

| Role | Face | Notes |
|---|---|---|
| Display | **Bodoni Moda** (variable, self-hosted, `opsz` axis) | Didone, extreme thick/thin contrast — mirrors the logo's serif. Used **only** ≥ 32 px, tight tracking (−0.02em), and never for UI. |
| Body / UI | **Archivo** (variable, `wdth` + `wght` axes) | Grotesque with a width axis; a real personality, not Inter/Geist default. |
| Labels / eyebrows / nav | Archivo, `wdth 92`, uppercase, 11–12 px, tracking **+0.16em** | The tracked micro-label is a signature of the system. |
| Numerals (price, sizes, tracking) | Archivo, `font-variant-numeric: tabular-nums` | Prices must never jitter in a grid. |
| Arabic display | **Aref Ruqaa** | Calligraphic, matches the logo's ornamental register. |
| Arabic body/UI | **IBM Plex Sans Arabic** | Excellent legibility, wide weight range, pairs with Archivo. |

Scale (mobile → desktop, `clamp`):

```
display-1  44 → 96 / 0.94   Bodoni Moda 400
display-2  32 → 64 / 1.0    Bodoni Moda 400
heading-1  24 → 36 / 1.15   Bodoni Moda 500
heading-2  19 → 24 / 1.25   Archivo 600
body-lg    16 → 18 / 1.6    Archivo 400
body       15 → 16 / 1.65   Archivo 400
body-sm    13 → 14 / 1.55   Archivo 400
label      11 → 12 / 1.2    Archivo 600, +0.16em, uppercase
price      16 → 20 / 1.1    Archivo 600, tabular
```

Rule: on any given screen, use **at most three** steps from this scale. The contrast between 96 px display and 11 px label is the drama — mid-sized type in between kills it.

### 13.5 Layout & grid

- Page margin: `24px` mobile → `clamp(24px, 5vw, 88px)` desktop. Generous — the vitrine needs air.
- 12-column grid, 24 px gutter, plus an **editorial 5-column** variant for storytelling rows (asymmetric splits like 3/2 and 2/3).
- Product grid: **2-up mobile, 3-up desktop** (not 4-up). Larger images, fewer per row, lookbook feel. A "compact 4-up" toggle exists for shoppers who want density — remembered in localStorage.
- Product media aspect ratio: **3:4** everywhere, enforced. No mixed ratios in a grid, ever.
- Vertical rhythm: sections separated by `clamp(64px, 9vw, 160px)`. Two adjacent sections never share a background — paper alternates with pearl.
- Spacing scale: `4 8 12 16 24 32 48 64 96 128 160` px only.

### 13.6 Components — the specific look

**Product card**
```
┌──────────────────┐
│                  │   3:4 image, radius 0, no shadow, no border
│   [ product ]    │   hover: fabric-lift wipe to image 2 (§14.4)
│                  │   top-left: −30% garnet label (only if discounted)
│                  │   top-right: wishlist — a hairline pearl outline, fills gold on save
├──────────────────┤   size chips fade up over the image bottom on hover (desktop)
 KHAADI                brand — label style, mukaish, +0.16em
 Ferozi 3 Piece Lawn   title — Archivo 500, 15px, one line + ellipsis
 AED 249  ~~349~~      price block — tabular, garnet strike
 ● ● ●                 colour dots, max 4 + "+2"
```
No card border, no background, no rounded corners, no drop shadow. The image is the card.

**Buttons**
- Primary: solid `--zamurrad`, paper text, 2 px radius, 52 px tall, label style (uppercase, tracked). Hover: fills to `--zamurrad-deep` from the bottom in 240 ms.
- Secondary: transparent, 1 px `--ink` border. Hover: ink fill, paper text.
- Tertiary: text with a 1 px underline offset 4 px; hover draws the underline left→right.
- No gradients, no pill radius, no icon+text unless the icon adds meaning.

**Inputs**: `--nacre` fill, no border, 1 px `--ink 20%` bottom rule that animates to full-width `--zamurrad` on focus. Floating label in label style. Error in `--danger` with an icon and a specific message.

**The gold hairline** is the system's connective tissue: 1 px, `--gold-dark` at 45% opacity, used to separate the header, underline the active nav item, and frame the price-cut badge. Nowhere else.

### 13.7 Signature element

**"The Dupatta"** — the one thing this site is remembered for.

On the homepage hero, a single length of cloth (WebGL, vertex-shader wave, gold-to-emerald sheen sampled from the campaign image) hangs from the top edge and drifts with cursor and scroll velocity, as if in a slow breeze. As the user scrolls past the hero, it **unfurls and dissolves** into the first product row, its threads becoming the grid's hairlines.

- ≤ 220 KB gzipped, lazy-loaded after LCP, `IntersectionObserver`-gated.
- Falls back to a static campaign image + subtle CSS parallax on low-end devices, low `deviceMemory`, save-data, or `prefers-reduced-motion`.
- It appears on **one page only**. That restraint is what makes it read as intentional rather than as effects for their own sake.

**Micro-signature:** a small pearl travels down a gold hairline at the right edge as a scroll-progress indicator, and the same pearl is the loading indicator across the site. It ties every page back to the logo.

---

## 14. Motion specification

### 14.1 Principles

1. **Motion explains, it doesn't perform.** Every animation answers "where did this come from / where did it go".
2. One orchestrated moment per page. Everything else is quiet.
3. Nothing important waits on an animation. Content is readable before motion finishes.
4. `prefers-reduced-motion: reduce` → all transforms become instant opacity changes ≤ 120 ms; Lenis off; WebGL off. Tested, not assumed.

### 14.2 Easing & duration (tokens — no ad-hoc values)

```js
ease.out   = cubic-bezier(0.22, 1, 0.36, 1)     // default for entrances
ease.inOut = cubic-bezier(0.65, 0, 0.35, 1)     // for moves
ease.cloth = cubic-bezier(0.16, 1, 0.30, 1)     // signature: slow settle, fabric-like
dur.fast = 160ms · dur.base = 280ms · dur.slow = 480ms · dur.cloth = 900ms
stagger = 45ms (max 8 items, then batch)
```
No bounce, no elastic, no spring overshoot. Couture doesn't bounce.

### 14.3 Page-level choreography

- **Page transition:** the outgoing page's content fades out and shifts up 12 px (200 ms); a hairline sweeps across the viewport; the new page's first block fades up. Uses the View Transitions API where supported, GSAP fallback elsewhere. Total ≤ 420 ms.
- **PLP → PDP:** GSAP **Flip** morphs the clicked product image into the PDP gallery position. This is the single most premium-feeling interaction on the site and it is cheap.
- **First load:** the logo monogram draws its strokes (SVG `stroke-dashoffset`, 700 ms), the pearl settles into the flourish, then the hero reveals. Shown **once per session** (sessionStorage), never blocking — max 900 ms then hard cut.

### 14.4 Interaction inventory

| Element | Motion |
|---|---|
| Product card hover | Second image revealed by a **diagonal clip-path wipe** (like a dupatta being lifted), 420 ms `ease.cloth`. Image scales 1.0→1.03 only; the card frame never moves. |
| Size chips | Fade up from the image bottom, 45 ms stagger |
| Wishlist toggle | Pearl outline fills gold; a single ring pulses out once, 380 ms |
| Add to cart | Button label crossfades to a tick; a ghost of the product image flies to the cart icon (GSAP Flip, 520 ms); cart count rolls up like an odometer |
| Mini-cart drawer | Slides from the inline-end edge, 320 ms `ease.out`; a scrim fades to `--ink 40%`; content staggers in |
| Mega menu | Panel height auto-animates 260 ms; column contents stagger 40 ms; the featured image crossfades on category hover |
| Section reveal | ScrollTrigger: content fades up 20 px, once, `once: true`. Never re-animates on scroll back — that is the hallmark of an over-animated template. |
| Editorial rows | Image and text move at slightly different scroll speeds (max 8% offset). Subtle. |
| Collection hero | Video scrubs to scroll for the first 60 vh, then releases (desktop only, ≤ 4 MB, poster frame always present) |
| Marquee brand strip | Continuous horizontal loop, pauses on hover, 60 s per cycle |
| Filter apply | Grid re-lays out with GSAP Flip, 400 ms, so items visibly move rather than snapping |
| Price change in cart | Old number wipes up, new wipes in, 220 ms tabular |
| Order timeline | Active step's connector carries a slow gold shimmer, 2 s loop |
| Form submit | Button label → pearl spinner → tick → the following step reveals |
| Image load | Dominant-colour block → blur-up → sharp, 300 ms. Never a grey skeleton flash on product media. |

### 14.5 WebGL inventory (R2, strictly bounded)

| Scene | Where | Budget |
|---|---|---|
| The Dupatta | Home hero | 220 KB gz, 60 fps desktop / 30 fps mobile, off below 400 px wide |
| Fabric macro shader | Fabric guide page | 90 KB, plane + normal map, drag to inspect the weave |
| 360° product spin | PDP, select products | Image-sequence based (36 frames), **not** WebGL — cheaper and sharper |

**Kill switches:** `navigator.deviceMemory < 4`, `hardwareConcurrency < 4`, `connection.saveData`, `prefers-reduced-motion`, battery saver, or a feature flag in Admin → Settings. Any one of these serves the static fallback. The site must be fully shoppable with WebGL disabled — it is decoration, never function.

### 14.6 Performance guardrails on motion

- Only `transform` and `opacity` are animated. Never `width`, `height`, `top`, `left`, `box-shadow`.
- `will-change` applied on interaction start, removed on completion.
- All ScrollTriggers are killed on route change (`gsap.context()` scoped to the component, reverted on unmount) — the #1 source of memory leaks in GSAP+React apps.
- GSAP plugins are dynamically imported per route; ScrollTrigger is not in the homepage's initial bundle if the homepage doesn't need it above the fold.
- A Lighthouse CI budget fails the build if the motion layer pushes total JS past the §18 budget.

---

## 15. Page-by-page specification

### 15.1 Global chrome

**Announcement bar** — rotating messages (free shipping over AED 300 · delivery in 2–4 days across UAE · COD available), 5 s each, pausable, dismissible for the session. Emerald background, paper text, label type.

**Header** — transparent over the hero on the homepage, solid paper elsewhere; becomes solid on scroll past 80 px with a gold hairline underneath. Layout: mega-menu trigger + primary nav (left), **wordmark centred**, search / account / wishlist / cart (right). On mobile: hamburger, centred wordmark, cart. Hides on scroll down, reappears on scroll up.

**Mega menu** — full-width panel. Four columns of links + a fifth **featured tile** (campaign image + collection name) that crossfades as you hover a category. Brands get their own column with wordmarks. Sale link in garnet.

**Footer** — full-bleed emerald. Four columns (Shop / Help / About / Contact), newsletter with an explicit consent checkbox (PDPL), payment method marks, social, TRN and legal line, language switcher, the filigree ornament from the logo as a single centred rule. WhatsApp float button on mobile (UAE shoppers expect it) — one tap to the store's business number with the current product pre-filled.

### 15.2 Home

Sections are CMS-driven (`home_sections`), but the **launch composition is fixed**:

1. **Hero** — full-viewport campaign video or image, the Dupatta WebGL layer, collection name in `display-1` off-axis (lower-left, inset from the margin), one text link "See the collection". No button pair. Scroll cue: the pearl.
2. **New arrivals rail** — horizontal scroll, 3.4 cards visible on desktop, drag/swipe, hairline progress bar.
3. **Shop by stitching** — three full-height panels: *Unstitched* · *Ready to Wear* · *Formal & Wedding*. Hover reveals the fabric macro behind the label. **This is the store's core navigation idea and it sits above the fold on mobile.**
4. **Editorial split** — 3/2 asymmetric: campaign image + a short paragraph about the collection, real copy, no marketing filler.
5. **Brand strip** — Khaadi, Asim Jofa, Sana Safinaz and others as a slow marquee of wordmarks; each links to a brand house page.
6. **Best sellers** — 3-up grid, 6 items, "View all" as a tertiary link.
7. **Full-bleed break** — a single fabric macro image, no text, pure rhythm.
8. **Shop by occasion** — Everyday / Eid / Mehndi / Barat / Walima, five tiles in the 5-column editorial grid.
9. **The Lulwah promise** — text-only USP bar: authentic designer pieces · 2–4 day UAE delivery · 14-day returns · cash on delivery. Label type, hairline separators, no icons.
10. **Journal teaser** (R2) — two posts.
11. **Newsletter** — emerald panel, one field, consent checkbox.

### 15.3 Product listing (PLP / collection / category / search)

- Header: collection hero (image/video, name, description, product count) for collections; a plain typographic header for categories.
- **Filter rail** — desktop: sticky left column, always visible, no accordion-hell. Mobile: bottom sheet with a live "Show 42 results" button.
  Facets in this order: **Stitching type** · Piece count · Brand · Fabric · Occasion · Work · Colour · Size · Price (histogram slider) · Availability · On sale.
  Every facet shows counts. Selected filters appear as removable chips above the grid. "Clear all" always present.
- Sort: Newest · Price low→high · Price high→low · Best selling · Biggest discount.
- Grid: 2-up mobile / 3-up desktop, with a **full-bleed editorial tile injected after row 3 and row 8** (campaign image or a brand story) so the grid never feels like a spreadsheet.
- Pagination: "Load more" button (not infinite scroll — it breaks the footer and hurts SEO), with real `?page=` URLs and `rel=next/prev` for crawlers.
- Zero results: show the query, suggest spelling corrections, offer the three nearest collections, and log to `search_queries`.

### 15.4 Product detail (PDP)

Two columns on desktop (media 58% / info 42%, info sticky), stacked on mobile.

**Media**: vertical thumbnail strip on desktop; swipeable gallery with dot indicators on mobile. Click → full-screen lightbox with pinch/scroll zoom. Video and 360° inline in the same strip.

**Info column, in this order:**
1. Brand (label type, links to brand page) · article code (small, mukaish, copyable)
2. Title — `heading-1`, Bodoni Moda
3. Price block — final, compare-at struck, `-30%` garnet badge, "VAT included" microcopy
4. **Stitching type pill** — the first thing a Pakistani-fashion buyer looks for. `Unstitched · 3 Piece` in a bordered pill.
5. Colour swatches (brand colour name shown on hover/tap)
6. Size selector (pret only) + "Size guide" opening a drawer with the **brand-specific** chart + a "find my size" helper from a previous purchase
7. Stock line: "In stock" / "Only 2 left" (garnet) / "Sold out — notify me"
8. **Custom stitching option** (R2): checkbox with price and lead time, opens the measurement picker
9. Quantity + **Add to bag** (full-width primary) + wishlist icon
10. Delivery estimator: "Order in 3 h 20 m for delivery on Fri, 14 Aug to Dubai" — computed from the cutoff time and the emirate
11. Accordions: **What's included** (per-piece breakdown with fabric and metres) · Fabric & care · Delivery & returns · About the brand
12. Trust row: authentic pieces, COD available, 14-day returns
13. Reviews (R2) with rating distribution and fit feedback ("Runs true to size — 82%")
14. **Complete the look** (dupatta, khussa, clutch) then **You may also like**

**Sticky mobile bar** appears after the primary CTA scrolls out: thumbnail, price, size chip, Add to bag.

### 15.5 Cart

Drawer for quick review; a full page for editing. Line items with image, brand, title, options, stitching flag, quantity stepper, remove, save-for-later. Order summary: subtotal, discount rows (each named), shipping (or "Free — you saved AED 20"), VAT line, total. **Free-shipping progress bar**: "AED 51 away from free delivery." Coupon field with specific error messages. Recommendations under the summary. Empty state links to New In and the three stitching worlds.

### 15.6 Checkout

Single page, three collapsible steps, no chrome except the wordmark and a security line. Guest by default with an inline "create an account" checkbox at the end.

1. **Contact** — email + UAE phone (with a `+971` mask and validation)
2. **Delivery** — saved addresses or a new one. Fields in UAE order: full name, phone, **emirate (select)**, **area (autocomplete)**, building/villa, apartment/floor, street, landmark, Makani (optional). Shipping method with price and ETA.
3. **Payment** — Card (Stripe Elements, 3DS2) · Apple Pay / Google Pay (shown only when available, at the top) · Tabby / Tamara (R2, with the instalment amount shown) · **Cash on delivery** (fee and cap stated; triggers an OTP to the phone before the order is placed).

Right column: sticky order summary with editable quantities, coupon field, and the full money breakdown.
Rules: no forced account creation · autofill and `autocomplete` attributes correct on every field · inline validation on blur, never on keystroke · the "Place order" button is disabled while submitting and the request carries an idempotency key · any error keeps every entered value.

**Confirmation page**: order number (copyable), status timeline at step 1, ETA, items, total, "Track your order" link, "What happens next" in three plain sentences, WhatsApp support link. Fires `Purchase` to analytics exactly once (guarded by the order id in sessionStorage).

### 15.7 Account

Orders (status pill, reorder, invoice PDF, track, request return) · Order detail with the timeline · Addresses · Wishlist (with price-drop markers) · Measurements (R2) · Returns · Profile & password · Notification preferences.

### 15.8 Track (guest)

Order number + email/phone → the same timeline component, the shipment details, and a contact link. No other order data exposed. Rate-limited.

### 15.9 Content pages

**Size guide** — brand-by-brand tables, how to measure with diagrams, unstitched fabric lengths. High-intent SEO page.
**Fabric guide** — what lawn/khaddar/organza actually are, with macro photography and the WebGL weave inspector. This educates the non-Pakistani customer and earns organic traffic no competitor has.
**Stitching service** (R2) · **About** · **Contact** (form + WhatsApp + hours) · **FAQ** (accordion, searchable, schema.org FAQPage) · **Policies**.

---

## 16. Localization & RTL

| Decision | Value |
|---|---|
| Locales | `en` (default), `ar` |
| Routing | `/en/...` and `/ar/...`; `/` redirects on `Accept-Language`, choice persisted in a cookie |
| Library | `next-intl` |
| Direction | `dir="rtl"` on `<html>` for `ar`; layout uses **logical properties everywhere** (`margin-inline-start`, `padding-inline`, `inset-inline-end`) — never `left`/`right` |
| Content | Every content model has `*En` / `*Ar` fields; admin edits both in a tabbed editor. Untranslated Arabic falls back to English, never to an empty string. |
| Numbers | Arabic-Indic numerals in `ar` for prices and dates via `Intl.NumberFormat('ar-AE')`; Latin numerals in `en` |
| Currency | `AED 249.00` / `‏د.إ ٢٤٩٫٠٠` |
| Dates | `Intl.DateTimeFormat`, Gregorian; Hijri shown alongside during Ramadan campaigns |
| Icons/arrows | Directional icons mirror in RTL; logos, brand marks and product images never mirror |
| Motion | X-axis animations flip sign in RTL. GSAP `x` values read from a `dir` helper, not hardcoded. |
| QA | Every PR touching UI is screenshotted in both directions. A Playwright suite runs the critical path in `ar`. |

---

## 17. SEO

| Item | Implementation |
|---|---|
| Rendering | ISR/SSG on every indexable route; full HTML in the first response |
| Titles | `{Product} — {Brand} | Lulwah Fashion` · PLP: `{Category} in UAE | Lulwah Fashion` |
| Meta descriptions | Generated from real attributes (fabric, pieces, brand, price), editable per entity |
| Canonicals | Self-referencing; filtered PLPs canonicalise to the unfiltered category; `?page=2+` are indexable with their own canonical |
| Structured data | `Product` (with `offers`, `AggregateRating`, `Brand`, `sku`, `gtin` if available), `BreadcrumbList`, `Organization`, `WebSite`+`SearchAction`, `FAQPage`, `Article` on journal |
| hreflang | `en-AE`, `ar-AE`, `x-default` on every page |
| Sitemaps | Index + child sitemaps: products, collections, categories, brands, pages, journal. Regenerated nightly and on publish. |
| Robots | Allow all except `/checkout`, `/account`, `/api`, `/admin`, and any URL with more than two filter params |
| Images | Descriptive alt in both languages, `next/image`, AVIF, lazy below the fold, `fetchpriority=high` on the LCP image |
| Internal linking | Breadcrumbs everywhere; related products; brand↔collection cross-links; fabric-guide links from PDP |
| Content moat | Fabric guide, size guide, "how to style a 3-piece lawn suit", brand explainers — queries no UAE competitor targets |
| Speed | Core Web Vitals are a ranking factor; see §18 |
| Redirects | Slug changes write a 301 automatically and permanently |

---

## 18. Performance budgets (enforced in CI)

| Metric | Budget | Enforcement |
|---|---|---|
| LCP (mobile, 4G) | **≤ 2.0 s** | Lighthouse CI, fails the PR |
| INP | ≤ 200 ms | Lighthouse CI + RUM |
| CLS | ≤ 0.05 | Lighthouse CI |
| TTFB (edge hit) | ≤ 250 ms | RUM + Cloudflare analytics |
| TTFB (origin miss) | ≤ 700 ms | RUM — origin distance, see §36.2 |
| First-load JS (home) | **≤ 180 KB gz** | `@next/bundle-analyzer` + `size-limit` gate |
| First-load JS (PDP) | ≤ 200 KB gz | same |
| WebGL chunk | ≤ 220 KB gz, lazy | same |
| Total image weight above the fold | ≤ 350 KB | manual + CI check |
| Lighthouse Performance (mobile) | ≥ 90 | CI |
| Accessibility | ≥ 95 | CI (axe) |

**Tactics, in priority order**

1. Server Components by default; `'use client'` only where truly interactive. This is the largest single lever.
2. Route-level code splitting; GSAP plugins, Three.js, the lightbox, the review widget and Stripe Elements are all dynamically imported.
3. Fonts: self-hosted WOFF2, subset (Latin + Arabic), `font-display: swap`, preload only the two faces used above the fold, `size-adjust` to prevent CLS.
4. Images: imgproxy AVIF with WebP fallback, responsive `sizes`, dominant-colour placeholder, explicit width/height, `priority` on exactly one image per page. Each derivative is generated once and then served from the Cloudflare edge — the VPS never re-encodes the same image twice.
5. Cache: Cloudflare on public GETs, ISR on pages, Redis on hot product/collection reads, TanStack Query on the client.
6. Mongo: lean queries, projections (never `SELECT *`), the compound indexes in §7.14, denormalised counters instead of `$lookup` in list views.
7. Third-party scripts: **all** via GTM, loaded `afterInteractive`; the chat widget only on interaction; no script blocks the main thread before LCP.
8. Preconnect to the media origin and the API origin; DNS-prefetch to Stripe.
9. Prefetch the PDP route on product-card hover/viewport entry.
10. `content-visibility: auto` on below-the-fold sections.

---

## 19. Security

| Area | Control |
|---|---|
| Transport | HTTPS only, HSTS `max-age=31536000; includeSubDomains; preload` |
| Headers | CSP (nonce-based, no `unsafe-inline` in production), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` locking camera/mic/geo |
| Auth | §10 — argon2id, rotating refresh with reuse detection, admin TOTP 2FA |
| Input | Zod on every body/query/param; `mongo-sanitize` against operator injection; HTML sanitised with `isomorphic-dompurify` on any rich-text field |
| Output | React escapes by default; `dangerouslySetInnerHTML` only on sanitised CMS content, and it is lint-flagged |
| CSRF | SameSite=Lax cookies + a double-submit token on state-changing BFF routes |
| Rate limiting | Redis sliding window (§9.8) + Cloudflare rules on `/auth/*` and `/checkout/*` |
| Secrets | Root-owned `/srv/lulwah/.env` (mode `600`), injected by Compose, never in git; a leaked key rotates within 1 hour per runbook (§36.4) |
| PII | Passwords hashed, OTPs hashed, card data **never touches our servers** (Stripe Elements tokenises in the browser); PII redacted from logs by a Pino serializer allowlist |
| Payments | PCI-DSS SAQ-A scope only. Webhook signatures verified. Amounts re-verified server-side against the order before capture. |
| Uploads | Presigned S3 uploads to object storage, MIME + magic-byte check, 10 MB cap, re-encoded with Sharp to strip EXIF/payloads. imgproxy runs with a signed-URL key so it cannot be abused as an open image proxy. |
| Admin | Separate subdomain, 2FA, IP-change re-auth, 8-hour sessions, every mutation audited |
| Dependencies | Dependabot + `pnpm audit` in CI; a critical CVE blocks the merge |
| Data protection | UAE PDPL: explicit marketing consent with timestamp+IP, a data-export and delete endpoint, a documented retention policy (orders 5 years for tax, carts 30 days, logs 90 days) |
| Fraud (COD) | Risk score from order value, address completeness, phone verification, prior COD refusals. High risk → manual review queue; blocked numbers list. |
| Backups | Atlas continuous backup, PITR 7 days, daily snapshot retained 30 days, **restore drill every quarter** |

---

## 20. Payments (UAE specifics)

| Method | Provider | Notes |
|---|---|---|
| Card (Visa/Mastercard/Amex) | **Stripe** | 3DS2 mandatory in UAE; Payment Intents; AED settlement |
| Apple Pay / Google Pay | Stripe Payment Request Button | Very high mobile conversion in UAE — placed **above** the card form |
| **Cash on delivery** | In-house | ~35–50% of UAE fashion orders. AED 10 fee, AED 2,000 cap, phone OTP verification before placing, risk screening, cash reconciliation report in admin |
| Tabby (pay in 4) | Tabby (R2) | Dominant BNPL in UAE; shows "4 × AED 62.25" on PDP and cart — measurably lifts AOV |
| Tamara | Tamara (R2) | Second BNPL, mainly KSA-facing but used in UAE |
| Bank transfer | Manual (R2) | For high-value bridal orders; admin marks paid |

**Alternate gateway:** if Stripe onboarding is blocked by the trade licence, use **Telr** or **Checkout.com** — the `PaymentGateway` interface (`createIntent`, `capture`, `refund`, `verifyWebhook`) is provider-agnostic, so switching is one adapter, not a rewrite.

**VAT:** 5%, prices displayed inclusive. Invoice shows net, VAT and gross, the store TRN and a sequential tax-invoice number — a legal requirement in the UAE.

---

## 21. Shipping & fulfilment

| Item | Decision |
|---|---|
| Zones | R1: seven emirates, single zone. R2: GCC zones. |
| Rates | Standard AED 20, free above AED 300 · Express (next-day, Dubai/Sharjah/Ajman) AED 35 · configurable in admin |
| Cutoff | Orders before 14:00 GST ship the same day (drives the PDP delivery estimate) |
| ETA | Dubai/Sharjah/Ajman 1–2 days · Abu Dhabi 2–3 · RAK/Fujairah/UAQ 2–4 · +7 days if custom stitching |
| Carriers | R1: manual — admin enters carrier + tracking number. R2: **Aramex** API for AWB generation and webhook tracking; Emirates Post as fallback; own driver for Dubai same-day. |
| Packing slip | A4 PDF, order number, barcode, items with article codes, gift message |
| Split shipments | R2 — an order can carry multiple shipments; per-item fulfilment status already exists in the schema (§7.11) |
| Address quality | Emirate + area are required and validated against a seeded list; a missing landmark triggers a soft warning at checkout |

---

## 22. Notifications

Channels: **email** (Resend), **SMS** (Unifonic), **WhatsApp** (Unifonic Business API, R2). All templates bilingual, sent in the customer's `locale`, all rendered from React Email components so they are code-reviewed like everything else.

| Trigger | Email | SMS | WhatsApp |
|---|:--:|:--:|:--:|
| Welcome / verify email | ✅ | — | — |
| OTP (login, COD) | — | ✅ | — |
| Order placed | ✅ | ✅ | R2 |
| Payment failed (with retry link) | ✅ | ✅ | — |
| Status → processing | ✅ | — | — |
| Status → stitching | ✅ | — | R2 |
| Status → shipped (+ tracking) | ✅ | ✅ | R2 |
| Status → out for delivery | — | ✅ | R2 |
| Status → delivered | ✅ | — | R2 |
| Cancelled / refunded | ✅ | ✅ | — |
| Return: received / approved / refunded | ✅ | — | — |
| Review request (+5 days) | ✅ (R2) | — | — |
| Abandoned cart (1 h, 24 h, 72 h) | ✅ (R2) | — | R2 |
| Back in stock | ✅ (R2) | ✅ (R2) | — |
| Price drop on a wishlisted item | ✅ (R2) | — | — |
| Low stock digest (staff) | ✅ | — | — |
| New order alert (staff) | ✅ | ✅ | — |

Rules: transactional messages ignore marketing consent; marketing messages require it. Every marketing email has a working one-click unsubscribe. All sends are queued and retried 3× with backoff; failures alert on the third.

---

## 23. Analytics

**Stack:** GTM server-side container → GA4 + Meta Conversions API + TikTok Events API + Snap. Server-side because iOS ITP destroys client-side attribution, and CAPI recovers 20–30% of tracked conversions.

**Event taxonomy (locked names — GA4 ecommerce standard, so reports work out of the box):**

```
view_item_list · select_item · view_item · add_to_wishlist ·
add_to_cart · remove_from_cart · view_cart · begin_checkout ·
add_shipping_info · add_payment_info · purchase · refund ·
search · view_promotion · select_promotion · sign_up · login ·
generate_lead (newsletter) · view_size_guide · notify_me_click ·
filter_apply · stitching_option_selected · track_order_view
```

Every commerce event carries `item_id, item_name, item_brand, item_category (path), item_variant, price, quantity, currency: 'AED'` plus custom dimensions `stitching_type`, `fabric`, `occasion`, `piece_count` — so the merchandiser can ask "does unstitched lawn convert better than pret?" and get an answer.

**Also tracked:** Core Web Vitals RUM → GA4 · zero-result searches · filter combinations that return nothing · cart abandonment step · COD vs prepaid split by emirate.

**Consent:** a cookie banner (Cookiebot or a self-built manager) with granular categories; GTM Consent Mode v2; analytics fires in a limited mode until consent, marketing tags not at all.

---

## 24. Testing strategy

| Layer | Tool | Coverage target | What is tested |
|---|---|---|---|
| Unit | Vitest | **90% on `*.service.ts`**, 70% overall | Discount engine, price resolution, stock reservation, status transitions, tax, refund maths, money utils |
| Integration | Vitest + `mongodb-memory-server` + Supertest | Every endpoint | Auth flows, cart lifecycle, order placement, webhook idempotency, RBAC denials |
| Contract | Zod schema tests | All DTOs | Request/response shapes match `packages/contracts` |
| Component | Testing Library | Critical components | ProductCard, VariantPicker, PriceBlock, filters, address form |
| E2E | Playwright (Chromium, WebKit, mobile viewport) | 12 critical journeys | See below |
| Visual regression | Playwright screenshots | Key pages, LTR + RTL | Catches layout breaks in Arabic |
| a11y | axe-core in Playwright | Every page | Zero critical violations |
| Performance | Lighthouse CI | Home, PLP, PDP, cart | Budgets in §18 |
| Load | k6 | Pre-launch + before every drop | 1,000 concurrent on PLP/PDP, 100 checkouts/min |
| Synthetic monitoring | Checkly | Production, every 15 min | Add-to-cart → checkout reachability |

**The 12 Playwright journeys (must be green to deploy):**
1. Browse home → category → filter by unstitched + lawn → open PDP
2. Guest: add to cart → checkout → card payment (Stripe test) → confirmation
3. Guest: COD with OTP verification
4. Register → login → add address → order → view in account
5. Apply a valid coupon; apply an invalid one and see the specific reason
6. Out-of-stock variant cannot be added; notify-me works
7. Search by article code returns the exact product
8. Cart persists across a reload and merges correctly on login
9. Admin: log in with 2FA → change an order status → the customer sees the new timeline step
10. Admin: create a product with variants → it appears on the storefront
11. Guest order tracking by order number + phone
12. Full Arabic RTL run of journeys 1 and 2

**Test data:** a seed script creates 3 brands, 8 categories, 60 products (mixed stitching types), 4 collections, 5 discounts, 10 customers, 25 orders across every status. `pnpm seed` gives any developer a realistic shop in 30 seconds.

---

## 25. Environments, CI/CD, configuration

### 25.1 Environments

Everything runs on the one VPS. Production and staging are two Docker Compose **profiles** sharing the same MongoDB, Redis and Meilisearch daemons but with **separate database names, Redis DB indexes and Meili index prefixes** — this saves ~3 GB of RAM versus running duplicate data services, which an 8 GB box cannot afford.

| Env | URLs | Data | Notes |
|---|---|---|---|
| Local | `localhost:3000` / `:3001` / `:4000` | `docker compose -f docker-compose.dev.yml` | Mongo + Redis + Meili in containers, apps run with `pnpm dev` on the host |
| Staging | `staging.lulwah.ae`, `admin-staging.`, `api-staging.` | db `lulwah_staging`, redis db `1`, meili prefix `stg_` | Test payment keys. Basic-auth protected at Caddy. `noindex` header forced. **Stopped by default** — `./scripts/staging.sh up` before UAT, `down` after, to free ~1 GB. |
| Production | `lulwah.ae`, `admin.lulwah.ae`, `api.lulwah.ae` | db `lulwah`, redis db `0`, meili prefix `prod_` | Live keys |

There are **no per-PR preview deploys** — that is the real cost of leaving Vercel. Compensation: a strong local dev setup, staging on demand, and Playwright running against a throwaway stack inside the GitHub Actions runner (not on the VPS).

### 25.2 Pipeline

```
PR opened
 └─ GitHub Actions runner (NOT the VPS):
    ├─ install (pnpm, cached)
    ├─ lint · typecheck · format check
    ├─ unit + integration tests (mongodb-memory-server)
    ├─ build all apps
    ├─ bundle-size gate (size-limit)
    ├─ spin up mongo+redis+meili as GH services → Playwright E2E
    ├─ Lighthouse CI against the built app
    └─ axe a11y scan
 ✔ green → review → squash-merge to develop

merge to develop
 └─ build Docker images (web, admin, api) with buildx cache
 └─ push to ghcr.io/<org>/lulwah-{web,admin,api}:sha
 └─ SSH to VPS → ./scripts/deploy.sh staging <sha>
 └─ smoke test staging

merge develop → main  (manual, after UAT sign-off)
 └─ retag images :prod-<sha> and :latest
 └─ SSH to VPS → ./scripts/deploy.sh production <sha>
    ├─ docker compose pull
    ├─ rolling restart: api replica 1, wait healthy, replica 2, then web, then admin
    ├─ post-deploy smoke (curl /health, /, /product/<known-slug>)
    └─ on failure → ./scripts/rollback.sh <previous-sha>   (images are kept, 5 deep)
 └─ Cloudflare cache purge (tagged) + Sentry release + source maps
```

**Images are built in CI and only pulled on the server.** Building on an 8 GB production box would OOM-kill MongoDB mid-checkout. This rule is non-negotiable.

Branches: `main` (production) ← `develop` ← `feat/*`, `fix/*`, `chore/*`. Conventional Commits. Squash merge. No direct pushes to `main`. Deploys are GitHub Actions → SSH with a deploy key that can only run `/srv/lulwah/scripts/deploy.sh` (forced command in `authorized_keys`).

### 25.3 Environment variables (complete list)

One root-owned file, `/srv/lulwah/.env` (mode `600`), plus `/srv/lulwah/.env.staging`. Both are backed up **encrypted** by restic and are never in git. A copy of the current values lives in the client's password manager.

**Shared / infrastructure**
```
NODE_ENV  TZ=UTC
DOMAIN=lulwah.ae  ACME_EMAIL=
MONGODB_URI=mongodb://mongo:27017/lulwah?replicaSet=rs0&directConnection=true
MONGO_ROOT_USER  MONGO_ROOT_PASSWORD
REDIS_URL=redis://:PASS@redis:6379/0     REDIS_PASSWORD
MEILI_HOST=http://meilisearch:7700  MEILI_MASTER_KEY  MEILI_INDEX_PREFIX=prod_
S3_ENDPOINT  S3_REGION  S3_BUCKET  S3_ACCESS_KEY  S3_SECRET_KEY  S3_PUBLIC_BASE_URL
IMGPROXY_KEY  IMGPROXY_SALT  IMGPROXY_BASE_URL
GHCR_TOKEN                                # pull-only PAT
RESTIC_REPOSITORY  RESTIC_PASSWORD  B2_ACCOUNT_ID  B2_ACCOUNT_KEY
CLOUDFLARE_ZONE_ID  CLOUDFLARE_API_TOKEN   # cache purge only, scoped
```

**apps/api**
```
PORT=4000  API_URL  WEB_URL  ADMIN_URL
JWT_ACCESS_SECRET  JWT_REFRESH_SECRET  JWT_ACCESS_TTL=15m  JWT_REFRESH_TTL=30d
COOKIE_DOMAIN=.lulwah.ae  COOKIE_SECURE=true
ARGON2_MEMORY=19456  ARGON2_TIME=2
STRIPE_SECRET_KEY  STRIPE_WEBHOOK_SECRET  STRIPE_PUBLISHABLE_KEY
TABBY_SECRET_KEY  TABBY_PUBLIC_KEY  TABBY_WEBHOOK_SECRET
TAMARA_API_TOKEN  TAMARA_NOTIFICATION_TOKEN
RESEND_API_KEY  EMAIL_FROM  EMAIL_REPLY_TO
UNIFONIC_APP_SID  UNIFONIC_SENDER_ID  WHATSAPP_PHONE_ID  WHATSAPP_TOKEN
GOOGLE_CLIENT_ID  GOOGLE_CLIENT_SECRET
ARAMEX_USERNAME  ARAMEX_PASSWORD  ARAMEX_ACCOUNT_NUMBER  ARAMEX_ACCOUNT_PIN  ARAMEX_ENTITY
SENTRY_DSN  LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS  RATE_LIMIT_MAX
VAT_RATE=0.05  FREE_SHIPPING_THRESHOLD_FILS=30000
COD_FEE_FILS=1000  COD_MAX_ORDER_FILS=200000
STORE_TRN  STORE_NAME  STORE_EMAIL  STORE_PHONE  STORE_WHATSAPP
WORKER=false                                # the worker container sets true
```

**apps/web**
```
NEXT_PUBLIC_API_URL  NEXT_PUBLIC_SITE_URL
API_INTERNAL_URL=http://api:4000            # server-side calls skip the proxy entirely
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  NEXT_PUBLIC_TABBY_PUBLIC_KEY
NEXT_PUBLIC_IMGPROXY_BASE_URL
NEXT_PUBLIC_GTM_ID  NEXT_PUBLIC_GA4_ID  NEXT_PUBLIC_META_PIXEL_ID  NEXT_PUBLIC_TIKTOK_PIXEL_ID
NEXT_PUBLIC_SENTRY_DSN  SENTRY_AUTH_TOKEN
NEXT_PUBLIC_GOOGLE_CLIENT_ID  NEXT_PUBLIC_WHATSAPP_NUMBER
NEXT_PUBLIC_ENABLE_WEBGL=true  NEXT_PUBLIC_ENABLE_AR_LOCALE=false
REVALIDATE_SECRET  INTERNAL_API_KEY
CACHE_HANDLER_REDIS_URL                     # shared ISR cache across replicas — see §36.7
```

**apps/admin**
```
NEXT_PUBLIC_API_URL  NEXT_PUBLIC_IMGPROXY_BASE_URL  NEXT_PUBLIC_SENTRY_DSN
```

Every variable is parsed through a Zod schema at boot (`config/env.ts`). **A missing or malformed variable crashes the container at startup, not at 2 a.m. during a sale** — and because the container fails its health check, the rolling deploy stops and the old one keeps serving.

---
## 26. Observability & operations

On one box, monitoring has one rule: **the thing that watches the server cannot live on the server.**

| Concern | Tool | Where it runs | Alert threshold |
|---|---|---|---|
| Errors | Sentry (web, api, admin), release-tagged, source maps uploaded | SaaS (free tier) | Any new production issue; error rate > 1% |
| Logs | Pino JSON → Docker `json-file` (rotated) → **Dozzle** for live tailing | On box | — |
| Log search | `grep`/`jq` over rotated files, 14-day retention | On box | Better Stack free tier if volume grows |
| Uptime (internal) | **Uptime Kuma** — checks each container's `/health` | On box | Container unhealthy |
| Uptime (external) | **Better Stack / UptimeRobot free**, 60 s on `https://lulwah.ae` and `/api/v1/health` | Off box ⭐ | 2 consecutive failures → SMS to the lead |
| Host metrics | **netdata** (or `node_exporter` + a lightweight dashboard) | On box | CPU > 85% for 5 min · **RAM > 85%** · **disk > 80%** · swap in use > 1 GB |
| Synthetic checkout | A cron script in GitHub Actions that adds to cart and reaches the payment step | Off box ⭐ | Any failure |
| APM | Pino request timings + MongoDB slow-query log (`slowms: 100`) | On box | p95 API latency > 800 ms; any query > 200 ms |
| Queues | Bull Board at `admin.lulwah.ae/queues`, admin-auth protected | On box | Depth > 1,000; any job at max retries |
| Business alerts | Cron → Slack webhook | On box | Zero orders in 3 h during business hours; payment failure rate > 10%; stock-out on a top-20 product |
| Backup verification | restic `check` + a monthly scripted restore into the staging DB | On box + GH Actions | Any backup older than 26 h |

**Disk is the silent killer on a small VPS.** Docker `json-file` logs, Mongo journal and Meili dumps will fill 75 GB if unattended. Log rotation is configured in `/etc/docker/daemon.json` (§36.5) and a nightly cron prunes dangling images. The disk alert fires at 80%, not 95% — you need room to take a backup before you can fix anything.

**Runbooks in `docs/runbooks/`:** VPS unreachable · out of memory / OOM-killer · disk full · MongoDB won't start after reboot · restore from restic · rolling back a bad deploy · payment gateway down · stuck queue · leaked-secret rotation · drop-day checklist · Cloudflare "Under Attack" mode.

**SLO:** 99.5% availability (honest for one box, not 99.9%). P1 (checkout down) acknowledged in 15 minutes during business hours. **RTO 2 hours, RPO 24 hours** — meaning a total server loss costs at most one day of data and two hours of downtime, provided the rebuild script and backups are tested. Both are tested quarterly.

---
## 27. Engineering standards

### 27.1 TypeScript

`strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. `any` is banned (ESLint error); use `unknown` + a narrowing guard. Types are **inferred from Zod**, not hand-written twice. No enums — `as const` objects plus union types.

### 27.2 Naming

| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case | `order-status.service.ts` |
| React components | PascalCase, one per file | `ProductCard.tsx` |
| Hooks | `use` prefix | `useCart.ts` |
| Mongo collections | plural snake_case | `stock_movements` |
| Model fields | camelCase | `compareAtPriceFils` |
| Money fields | **always suffixed `Fils`** | `grandTotalFils` |
| Booleans | `is`/`has`/`can`/`should` | `isCustomStitchAvailable` |
| API routes | plural kebab-case | `/api/v1/stock-movements` |
| Env vars | SCREAMING_SNAKE | `FREE_SHIPPING_THRESHOLD_FILS` |
| Events | `noun.past_tense` | `order.status_changed` |
| CSS custom props | `--kebab-case` | `--zamurrad-deep` |

### 27.3 Function and file limits

Functions ≤ 40 lines. Files ≤ 300 lines (models and route files exempt). Nesting ≤ 3 levels — use early returns. A React component with more than 3 `useEffect`s or more than ~150 lines gets split.

### 27.4 Errors

One `AppError` class (`code`, `httpStatus`, `messageEn`, `messageAr`, `details`). Services throw domain errors; a single Express error middleware maps them to the §9.1 envelope. **Never** `catch (e) { console.log(e) }`. Never leak a stack trace to a client. Every caught error is logged with its `requestId`.

### 27.5 Comments

Code says *what*. Comments say *why*. Every non-obvious business rule cites this document:

```ts
// Order-level discount is allocated pro rata across lines so partial
// refunds and VAT stay correct. See plan.md §8.3 step 5.
```

### 27.6 Git

Conventional Commits (`feat(cart): merge guest cart on login`). PRs are small (< 400 lines changed where possible), reference the plan section, include screenshots for UI work, and cannot merge with a failing check.

### 27.7 ADRs

Any decision that contradicts this plan requires an ADR in `docs/adr/NNNN-title.md` (context, options, decision, consequences), and this document is updated in the same PR. **The plan never goes stale.**

---

## 28. Delivery plan

Assumed team: **1 tech lead / full-stack · 1 frontend · 1 backend · 1 designer (weeks 1–8) · 1 QA (from week 8) · client-side content/photography**.

| Phase | Weeks | Deliverables | Exit criteria |
|---|---|---|---|
| **P0 — Foundation** | 1 | Monorepo, CI, envs, Docker, design tokens, primitives, API skeleton, auth module, seed script | A developer clones and runs the whole stack in one command; a PR deploys a preview |
| **P1 — Catalogue** | 2–4 | Catalog + inventory modules, admin product editor, media, taxonomy seed, PLP + facets + search, PDP, header/footer/mega menu | 60 real products live on staging, browsable and filterable |
| **P2 — Commerce** | 5–7 | Cart, discount engine, checkout, Stripe, COD + OTP, order module, order confirmation, emails/SMS | A real AED 1 order completes end to end on staging with both card and COD |
| **P3 — Operations** | 8–10 | Full admin: order console, **status flags + timeline**, shipments, refunds, discounts builder, customers, CMS/homepage builder, reports, RBAC, audit log | The client's manager runs a full day of simulated operations unaided |
| **🚀 R1 LAUNCH** | **10–11** | Content load, SEO, analytics, load test, security review, UAT, soft launch | The 12 Playwright journeys green; Lighthouse ≥ 90; backup restore drill passed |
| **P4 — Experience** | 12–14 | GSAP system in full, the Dupatta WebGL, page transitions, Flip PLP→PDP, lookbook, journal, reviews, wishlist sync, recommendations | Design QA signs off against the §13.2 banned list |
| **P5 — Depth** | 15–16 | Arabic + RTL, custom stitching end to end, returns portal, Tabby/Tamara, Aramex integration, abandoned cart, back-in-stock | Arabic journey passes E2E; a return completes end to end |
| **P6 — Hardening** | 17 | Bug bash, perf tuning, accessibility pass, documentation, handover training, runbook walkthrough | Client team trained; on-call rota agreed |
| **R3** | Post-launch | GCC expansion, multi-currency, loyalty, PWA, warehouse tooling | — |

**Critical path:** taxonomy sign-off (week 1) → product data from the client (week 3) → payment gateway credentials (week 5) → product photography (week 8) → content load (week 10). Each has an owner and a date; a slip on any of them slips launch, and this is stated to the client at kickoff.

**Parallelisable:** design runs one phase ahead of build; content and photography run throughout; Arabic translation starts at week 12.

---

## 29. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Payment gateway onboarding delayed by trade-licence paperwork | High | Blocks launch | Start Stripe/Telr application in **week 1**. Ship COD-only if needed; the gateway is one adapter. |
| 2 | Product photography late or inconsistent | High | The whole design depends on imagery | Lock a shooting spec in week 2 (3:4, white seamless, 4 angles + 1 fabric macro + 1 on-model). Provide a fallback typographic card design. |
| 3 | Client supplies product data as photos on WhatsApp | High | Catalogue chaos | Ship the CSV importer in P1 with a dry-run preview and a filled template; train the client's data entry person in week 4. |
| 4 | Oversell during a drop | Medium | Angry customers, refunds | Redis reservation with locks (§8.4); load-tested before every drop. |
| 5 | Motion layer hurts Core Web Vitals | Medium | SEO + conversion | CI performance budgets fail the build; WebGL lazy and kill-switched. |
| 6 | COD fraud / refused deliveries | Medium | Direct cash loss | OTP verification, risk scoring, blocklist, COD cap. |
| 7 | Scope creep from "one more small feature" | High | Timeline | This document is the contract; anything outside it is a change request with cost and date impact. |
| 8 | Arabic content not ready | Medium | Delays R2 | Locale is behind a feature flag; English launches independently. |
| 9 | Traffic spike on a drop takes the API down | Medium | Lost revenue at peak | Cloudflare cache + autoscale + a waiting room; a drop-day runbook. |
| 10 | Brand-supply relationships change (a brand goes exclusive elsewhere) | Low | Catalogue gap | Brand is a data record, not code — adding or removing one is a content task. |
| 11 | Key-person dependency | Medium | Bus factor | Everything documented here; ADRs; no undocumented tribal knowledge; pair on the discount engine and checkout. |
| 12 | **Single VPS fails** (hardware, Contabo outage, bad `apt upgrade`) | Medium | Shop offline | Nightly off-box restic backups + Contabo snapshots + a tested rebuild script (§36.8). RTO 2 h. Accept it, or budget a second VPS as warm standby from month 4. |
| 13 | **Out of memory on 8 GB** during a drop or a stray build | Medium-High | OOM-killer kills MongoDB mid-order | Never build on the server; WiredTiger capped; 4 GB swap; per-container memory limits; RAM alert at 85% (§36.5, §36.10). |
| 14 | **Disk fills** with Docker logs / Mongo journal / images | High if unattended | Everything stops writing | Log rotation, nightly image prune, disk alert at 80%, media stored in object storage not on disk. |
| 15 | **Origin latency** — no Contabo datacenter in the Middle East | Certain | Slower TTFB on cache misses | Cloudflare edge caching does the heavy lifting (§36.3); choose Mumbai (~40 ms) over EU (~120 ms); keep checkout API calls to a minimum. |
| 16 | Nobody on the team is comfortable administering Linux | Medium | Small problems become outages | The runbooks in §36 are written to be followed by someone who is not a sysadmin. If that is still a stretch, the honest answer is to pay for managed hosting instead. |

---

## 30. Cost estimate (monthly, USD, at launch scale)

### 30.1 Self-hosted on Contabo (the chosen setup)

| Item | Plan | Cost |
|---|---|---|
| Contabo Cloud VPS 10 (8 GB, NVMe) | 12-month term | ~$5 |
| Location surcharge (non-Germany region) | Mumbai/Singapore | ~$2 |
| Contabo auto-backup add-on | daily VM snapshots, 10 versions | ~$2 |
| Contabo Object Storage (media + backups) | 250 GB | ~$3 |
| Cloudflare | **Free plan** | $0 |
| Sentry | Developer/free tier | $0 |
| Better Stack / UptimeRobot | Free tier | $0 |
| GitHub Actions | Free tier (public/small private) | $0 |
| Resend | 3,000 emails/mo free, then $20 | $0–20 |
| Unifonic SMS | ~3,000 SMS | $60–90 |
| Domain + Cloudflare DNS | — | ~$2 |
| GSAP Business licence (annual, amortised) | — | ~$12 |
| **Infrastructure total** | | **≈ $86–138 / month** |

Plus transaction fees: Stripe ~2.9% + AED 1 · Tabby/Tamara 4–7% of order value.

**SMS is now the largest line item, not servers.** Worth revisiting: send order updates over WhatsApp (much cheaper per message in the UAE) and reserve SMS for OTP only. That single change can cut the bill by half.

### 30.2 What this saves versus the managed stack

| | Managed (Vercel + Atlas + Cloudinary…) | Self-hosted (Contabo) |
|---|---|---|
| Infrastructure | ~$420–500/mo | ~$86–138/mo |
| Auto-scaling | Yes | No — vertical only |
| Managed failover / PITR | Yes | No — RPO 24 h |
| Per-PR preview deploys | Yes | No |
| Ops time | ~1 h/month | **~4–6 h/month** (patching, backups, disk, restore drills) |
| Single point of failure | No | **Yes** |

The saving is real (~$350/month, ~$4,200/year). The cost is engineering time and risk, and both are budgeted explicitly: §36.13 lists what breaks and §29 rows 12–15 track the risks.

---
## 31. Open questions (each has a default — none blocks development)

| # | Question | Default if unanswered by | Owner |
|---|---|---|---|
| Q1 | Confirm the exact brand list at launch and whether Lulwah is an authorised reseller (affects brand pages and legal copy) | Build with 3 brands seeded, structure supports N | Client · week 2 |
| Q2 | Is inventory owned (stocked in UAE) or dropshipped from Pakistan? | **Owned stock in UAE**, 2–4 day delivery | Client · week 2 |
| Q3 | Which payment gateway does the trade licence support — Stripe, Telr, Checkout.com? | Build against Stripe; the adapter interface makes a switch a 2-day job | Client · week 4 |
| Q4 | Is custom stitching actually offered, and by whom (in-house tailor / partner)? | Built in R2, feature-flagged **off** until confirmed | Client · week 10 |
| Q5 | Free-shipping threshold and COD fee — AED 300 / AED 10? | As stated, editable in Admin → Settings | Client · week 5 |
| Q6 | Arabic at launch or R2? | **R2**, feature-flagged | Client · week 8 |
| Q7 | Courier account — Aramex, Emirates Post, or own drivers? | R1 manual tracking entry; Aramex API in R2 | Client · week 9 |
| Q8 | Photography: who shoots, and can we enforce the 3:4 white-seamless spec? | Spec issued in week 2; brand-supplied imagery used as fallback | Client · week 2 |
| Q9 | GSAP Business licence — client purchases (required for SplitText/commercial use) | Client purchases in week 4; we build without SplitText until then | Client · week 4 |
| Q10 | "web3" — confirm this meant WebGL/3D, not blockchain | **WebGL/3D** (§0.2). Crypto is out of scope. | Client · week 1 |
| Q11 | Are men's/kids' lines planned within 12 months? | Schema supports it (`gender` field reserved); no UI built | Client · week 6 |
| Q12 | Physical store(s) in UAE — do we need a store locator and click-and-collect? | No store locator in R1 | Client · week 6 |
| Q13 | **VPS region** — Mumbai, Singapore or EU? Mumbai is ~3× faster to Dubai; EU is the neutral/GDPR-familiar choice. Also worth confirming the client is comfortable with UAE customer data residing in India (permitted under UAE PDPL with safeguards, but a business call). | **Mumbai**, with Cloudflare in front | Client · week 1 |
| Q14 | Is a second VPS acceptable later for warm standby / HA (~$7/mo)? | Single box at launch; revisit at month 4 or 300 orders/month | Client · week 12 |
| Q15 | §20 names Stripe as the primary card gateway, but **Ziina** (UAE-native payment app/wallet) has significant adoption with UAE SMBs and may be worth adding alongside or instead of Stripe. Flagged during build, not yet evaluated against §20's `PaymentGateway` interface (`createIntent`/`capture`/`refund`/`verifyWebhook`) or UAE trade-licence/settlement requirements. | **Defer** — R1 ships against Stripe as planned; evaluate Ziina in the P4/P5 phase alongside the Tabby/Tamara BNPL integrations (§20, §28), not before | Client · pre-P4 |

---

## 32. Appendix A — Enum reference

```ts
StitchingType   = unstitched | semi_stitched | pret | custom_stitchable
PieceCount      = 1 | 2 | 3
Fabric          = lawn | cambric | cotton | cotton_net | khaddar | linen | karandi |
                  chiffon | organza | silk | raw_silk | jacquard | velvet | viscose |
                  net | masuri | grip | tissue | banarsi | jamawar | crinkle_chiffon | slub
Work            = digital_print | screen_print | block_print | machine_embroidery |
                  hand_embroidery | zari | resham | tilla | mukaish | gota | sequins |
                  dabka | naqshi | applique | mirror_work | plain
Occasion        = everyday | casual | workwear | eid | festive | mehndi | mayoun |
                  barat | walima | nikkah | party | bridal
Season          = summer | winter | all_season | festive
DupattaType     = printed | embroidered | chiffon | organza | net | silk | none
ColorFamily     = white_offwhite | black | red_maroon | pink | blue_ferozi | green |
                  yellow_mustard | purple | brown_beige | grey_silver | gold | multi
Size            = XS | S | M | L | XL | XXL | free
Emirate         = dubai | abu_dhabi | sharjah | ajman | ras_al_khaimah | fujairah | umm_al_quwain
OrderStatus     = pending_payment | confirmed | processing | stitching | ready_to_ship |
                  shipped | out_for_delivery | delivered | cancelled | returned | refunded | failed
PaymentStatus   = unpaid | authorized | paid | partially_refunded | refunded | failed
PaymentMethod   = card | apple_pay | google_pay | cod | tabby | tamara | bank_transfer
ReturnStatus    = requested | approved | picked_up | received | inspected | refunded | rejected
DiscountType    = percentage | fixed_amount | free_shipping | buy_x_get_y | tiered | bundle
UserRole        = customer | support | catalog | order_ops | warehouse | content |
                  finance | manager | super_admin
```

## 33. Appendix B — Error codes

```
AUTH_INVALID_CREDENTIALS   AUTH_ACCOUNT_LOCKED        AUTH_TOKEN_EXPIRED
AUTH_TOKEN_REUSED          AUTH_EMAIL_EXISTS          AUTH_OTP_INVALID
AUTH_OTP_EXPIRED           AUTH_2FA_REQUIRED          AUTH_FORBIDDEN
VALIDATION_FAILED          NOT_FOUND                  CONFLICT
CART_NOT_FOUND             CART_ITEM_LIMIT            CART_QTY_LIMIT
OUT_OF_STOCK               INSUFFICIENT_STOCK         VARIANT_INACTIVE
COUPON_INVALID             COUPON_EXPIRED             COUPON_USAGE_LIMIT
COUPON_NOT_ELIGIBLE        COUPON_MIN_SUBTOTAL        COUPON_ALREADY_APPLIED
CHECKOUT_SESSION_EXPIRED   CHECKOUT_PRICE_CHANGED     CHECKOUT_ADDRESS_INVALID
PAYMENT_FAILED             PAYMENT_DECLINED           PAYMENT_3DS_FAILED
COD_NOT_ALLOWED            COD_LIMIT_EXCEEDED         COD_OTP_REQUIRED
ORDER_NOT_FOUND            INVALID_STATUS_TRANSITION  ORDER_NOT_CANCELLABLE
RETURN_WINDOW_CLOSED       ITEM_NOT_RETURNABLE
SHIPPING_UNAVAILABLE       RATE_LIMITED               IDEMPOTENCY_CONFLICT
INTERNAL_ERROR             SERVICE_UNAVAILABLE
```

## 34. Appendix C — Launch checklist

**Technical**
- [ ] All 12 Playwright journeys green on production
- [ ] Lighthouse mobile ≥ 90 on home, PLP, PDP, cart
- [ ] Real payment tested with a live card (AED 1, then refunded)
- [ ] COD order placed and OTP received on a real UAE number
- [ ] Order status change → email + SMS received
- [ ] Backup restore drill completed and timed
- [ ] Load test passed: 1,000 concurrent, 100 checkouts/min
- [ ] Sentry, uptime, synthetic checkout and business alerts all firing to Slack
- [ ] Security headers scored A on securityheaders.com; SSL Labs A+
- [ ] Rate limits verified on auth, OTP and checkout

**Commerce**
- [ ] Minimum 60 products live with complete attributes and imagery
- [ ] Every product has correct stitching type, piece count, fabric and article code
- [ ] Shipping rates, free threshold, COD fee and VAT verified against a manual calculation
- [ ] Return, shipping, privacy, terms and cookie policies published and legally reviewed
- [ ] TRN on invoices; a sample invoice checked by the client's accountant

**Marketing**
- [ ] GA4, GTM server container, Meta CAPI, TikTok all verified with test events
- [ ] Search Console + Bing verified; sitemap submitted
- [ ] Structured data passes the Rich Results test on PDP and FAQ
- [ ] OG images render correctly on WhatsApp, Instagram and Facebook shares
- [ ] Cookie consent banner live and honouring rejection

**Operational**
- [ ] Client staff trained on the admin console; recording saved
- [ ] Runbooks reviewed with the client
- [ ] Support inbox, WhatsApp business number and hours live
- [ ] Rollback procedure tested once on staging

---

## 35. What "done" means for this project

The build is complete when a woman in Sharjah can, on her phone, on a mid-range Android over a 4G connection:

1. Land on the homepage in under two seconds and immediately understand this is Pakistani designer wear,
2. Filter to unstitched lawn 3-piece under AED 300 in three taps,
3. See exactly what she is buying — fabric, metres, dupatta type, article code,
4. Pay cash on delivery with a verified phone number,
5. Watch her order move through the status flags with a message at each step,
6. Receive it in two days,

…and the client's manager can run every part of that day from an admin console she was trained on in an afternoon — without ever calling a developer.

---

## 36. Appendix D — Contabo VPS deployment runbook

Everything needed to take a bare Ubuntu box to a running shop, and to keep it running. Written to be followed by someone who is competent but not a career sysadmin.

### 36.1 Server sizing and the memory budget

**Chosen: Cloud VPS 10 — 8 GB RAM, NVMe, Ubuntu 24.04 LTS.** This is workable for launch but has no spare room, so memory is budgeted explicitly rather than hoped for. Every container gets a hard `mem_limit`.

| Container | Limit | Typical | Note |
|---|---:|---:|---|
| caddy | 128 MB | 50 MB | |
| web (Next.js standalone) | 640 MB | 380 MB | 1 replica at launch |
| admin (Next.js) | 384 MB | 200 MB | Low traffic |
| api ×2 | 320 MB each | 230 MB each | 2 replicas for zero-downtime deploys |
| worker (BullMQ) | 384 MB | 240 MB | |
| mongodb | 2,048 MB | 1.8 GB | **WiredTiger cache capped at 1 GB** — see §36.6 |
| redis | 512 MB | 380 MB | `maxmemory 384mb`, `allkeys-lru` |
| meilisearch | 640 MB | 400 MB | |
| imgproxy | 384 MB | 200 MB | Spikes while encoding; Cloudflare means it runs rarely |
| uptime-kuma + dozzle | 256 MB | 150 MB | |
| **Production subtotal** | **~5.9 GB** | **~4.3 GB** | |
| Staging (web+admin+api+worker, shared data services) | ~1.2 GB | ~900 MB | **Stopped by default** |
| OS + Docker daemon + sshd | — | ~700 MB | |
| **Peak with staging up** | | **~5.9 GB / 8 GB** | ~2 GB headroom |

**Three rules follow from this table and none of them are optional:**

1. **Never run a build on this server.** `next build` alone wants 2–4 GB and the OOM-killer picks the largest process, which is MongoDB — losing writes mid-order. Build in GitHub Actions, pull the image.
2. **4 GB swap is mandatory** (Contabo VPS images ship without swap). Swap does not make the box fast; it makes a memory spike a slowdown instead of a crash.
3. **Staging stays down unless someone is using it.** `./scripts/staging.sh up` / `down`.

Upgrade trigger: sustained RAM > 80% or Mongo working set > 1 GB → move to Cloud VPS 20 (12 GB). It is a resize + reboot, not a migration.

### 36.2 Region choice

Contabo has no Middle East datacenter. Approximate round-trip from Dubai:

| Region | RTT to Dubai | Effect on an origin-miss TTFB | Verdict |
|---|---|---|---|
| **Mumbai (India)** | **~35–45 ms** | ~250–400 ms | ✅ **Recommended.** Direct submarine routes Dubai↔Mumbai. Also good for future Pakistan/GCC traffic. |
| Singapore | ~95–115 ms | ~450–700 ms | Acceptable, not ideal |
| EU Hub (Lauterbourg) | ~105–125 ms | ~500–800 ms | Only if there is a data-residency or business reason |
| US East | ~180–220 ms | ~900 ms+ | ❌ No |

Two things to confirm with the client before ordering (§31‑Q13): (a) UAE PDPL permits cross-border transfer of customer data with appropriate safeguards, so India is legally fine, but it should be a conscious decision and disclosed in the privacy policy; (b) some clients have their own preference about jurisdiction — ask rather than assume.

**Whichever region is chosen, Cloudflare in front is what actually determines perceived speed.** A cached page is served from Cloudflare's Dubai PoP in ~30 ms regardless of where the origin sits.

### 36.3 Cloudflare configuration (the performance strategy)

Free plan is sufficient. Configure exactly this:

| Setting | Value | Why |
|---|---|---|
| DNS | `A` records **proxied** (orange cloud) for `@`, `www`, `admin`, `api`, `img`, `staging` | Hides the origin IP; without this, DDoS hits the VPS directly |
| SSL/TLS mode | **Full (strict)** | Caddy holds a real Let's Encrypt cert; anything less allows a MITM between edge and origin |
| Always Use HTTPS | On | |
| Brotli, HTTP/3, 0-RTT | On | |
| Cache Rule 1 | `/_next/static/*`, `/fonts/*`, `/img/*` → **Cache Everything**, Edge TTL **1 year**, immutable | Hashed filenames; safe forever |
| Cache Rule 2 | Storefront HTML (`lulwah.ae/*` excluding the paths below) → **Cache Everything**, Edge TTL **1 hour**, Browser TTL 0, **respect origin `Cache-Tag`** | This is the whole trick: ISR pages served from Dubai |
| Cache Rule 3 (bypass) | `/cart*`, `/checkout*`, `/account*`, `/track*`, `/api/*`, `admin.lulwah.ae/*`, `api.lulwah.ae/*` | Never cache personalised or write paths |
| Cache key | Include the `NEXT_LOCALE` cookie and the `lulwah_currency` cookie; **ignore all other cookies and UTM params** | Otherwise the cache hit rate collapses to near zero |
| Purge | On publish, the API calls the Cloudflare API to purge by `Cache-Tag` (`product-<id>`, `collection-<id>`, `home`) | Content updates are live in seconds without dropping the whole cache |
| WAF | Managed ruleset on; rate-limit rule: 20 req/min on `/api/v1/auth/*` and `/api/v1/checkout/*` per IP | Second layer behind the app's own limits |
| Bot Fight Mode | On | |
| Under Attack mode | Documented in the drop-day runbook, off normally | |
| Origin firewall | `ufw` allows 80/443 **only from Cloudflare IP ranges** (script refreshes the list weekly) | Makes bypassing the edge impossible |

Target: **> 90% cache hit ratio on storefront HTML.** Check it weekly in the Cloudflare dashboard — a sudden drop usually means a cookie leaked into the cache key.

### 36.4 First-time server setup (in order)

```bash
# 1 — as root, immediately after provisioning
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
# harden sshd: PermitRootLogin no, PasswordAuthentication no, Port 22 (or moved)
systemctl restart ssh

# 2 — base packages + swap
apt update && apt upgrade -y
apt install -y ufw fail2ban unattended-upgrades curl git jq restic
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10 && echo 'vm.swappiness=10' >> /etc/sysctl.conf
timedatectl set-timezone UTC

# 3 — firewall  (do this BEFORE docker; see the gotcha in §36.10)
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

# 4 — docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

`/etc/docker/daemon.json` — **log rotation, without this the disk fills:**
```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true
}
```

```bash
# 5 — layout
mkdir -p /srv/lulwah/{scripts,caddy,backups,data}
chown -R deploy:deploy /srv/lulwah
# 6 — unattended security upgrades (kernel updates still need a reboot window)
dpkg-reconfigure --priority=low unattended-upgrades
# 7 — nightly cron
crontab -e
#   0 2 * * *  /srv/lulwah/scripts/backup.sh
#   0 4 * * 0  docker image prune -af --filter "until=168h"
#   */5 * * * * /srv/lulwah/scripts/disk-check.sh
```

### 36.5 `docker-compose.yml` (production)

```yaml
name: lulwah

x-logging: &logging
  driver: json-file
  options: { max-size: "10m", max-file: "3" }

services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443", "443:443/udp"]
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    mem_limit: 128m
    logging: *logging
    depends_on: [web, admin, api]

  web:
    image: ghcr.io/ORG/lulwah-web:${TAG}
    restart: unless-stopped
    env_file: [.env]
    environment:
      HOSTNAME: "0.0.0.0"
      PORT: "3000"
    mem_limit: 640m
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 20s
      timeout: 5s
      retries: 3
      start_period: 30s
    logging: *logging
    depends_on: { api: { condition: service_healthy } }

  admin:
    image: ghcr.io/ORG/lulwah-admin:${TAG}
    restart: unless-stopped
    env_file: [.env]
    environment: { PORT: "3001" }
    mem_limit: 384m
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    logging: *logging

  api:
    image: ghcr.io/ORG/lulwah-api:${TAG}
    restart: unless-stopped
    env_file: [.env]
    environment: { WORKER: "false" }
    deploy: { replicas: 2 }
    mem_limit: 320m
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4000/api/v1/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 20s
    logging: *logging
    depends_on:
      mongo: { condition: service_healthy }
      redis: { condition: service_started }

  worker:
    image: ghcr.io/ORG/lulwah-api:${TAG}
    restart: unless-stopped
    command: ["node", "dist/worker.js"]
    env_file: [.env]
    environment: { WORKER: "true" }
    mem_limit: 384m
    logging: *logging
    depends_on:
      mongo: { condition: service_healthy }
      redis: { condition: service_started }

  mongo:
    image: mongo:8
    restart: unless-stopped
    command: >
      mongod --replSet rs0 --bind_ip_all
             --wiredTigerCacheSizeGB 1
             --slowms 100
    volumes:
      - mongo_data:/data/db
      - ./scripts/mongo-init.js:/docker-entrypoint-initdb.d/init.js:ro
    mem_limit: 2048m
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s
    logging: *logging
    # NOT published to the host — reachable only on the compose network

  redis:
    image: redis:8-alpine
    restart: unless-stopped
    command: >
      redis-server --requirepass ${REDIS_PASSWORD}
                   --maxmemory 384mb --maxmemory-policy allkeys-lru
                   --appendonly yes --appendfsync everysec
    volumes: [redis_data:/data]
    mem_limit: 512m
    logging: *logging

  meilisearch:
    image: getmeili/meilisearch:v1.48
    restart: unless-stopped
    environment:
      MEILI_MASTER_KEY: ${MEILI_MASTER_KEY}
      MEILI_ENV: production
      MEILI_NO_ANALYTICS: "true"
    volumes: [meili_data:/meili_data]
    mem_limit: 640m
    logging: *logging

  imgproxy:
    image: darthsim/imgproxy:latest
    restart: unless-stopped
    environment:
      IMGPROXY_KEY: ${IMGPROXY_KEY}
      IMGPROXY_SALT: ${IMGPROXY_SALT}
      IMGPROXY_USE_S3: "true"
      IMGPROXY_S3_ENDPOINT: ${S3_ENDPOINT}
      AWS_ACCESS_KEY_ID: ${S3_ACCESS_KEY}
      AWS_SECRET_ACCESS_KEY: ${S3_SECRET_KEY}
      IMGPROXY_ENABLE_WEBP_DETECTION: "true"
      IMGPROXY_ENABLE_AVIF_DETECTION: "true"
      IMGPROXY_MAX_SRC_RESOLUTION: "50"
      IMGPROXY_TTL: "31536000"
      IMGPROXY_WORKERS: "2"
    mem_limit: 384m
    logging: *logging

  uptime-kuma:
    image: louislam/uptime-kuma:1
    restart: unless-stopped
    volumes: [kuma_data:/app/data]
    mem_limit: 256m
    logging: *logging

volumes:
  caddy_data: {}
  caddy_config: {}
  mongo_data: {}
  redis_data: {}
  meili_data: {}
  kuma_data: {}
```

**Note what is *not* here:** no published ports except Caddy's. Mongo, Redis and Meilisearch are reachable only inside the Docker network — never `127.0.0.1:27017`, never `0.0.0.0`.

**`caddy/Caddyfile`:**
```caddyfile
{
    email {$ACME_EMAIL}
    servers { protocols h1 h2 h3 }
}

(secure_headers) {
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
}

lulwah.ae, www.lulwah.ae {
    import secure_headers
    encode zstd gzip
    reverse_proxy web:3000 {
        health_uri /api/health
        health_interval 10s
        lb_policy least_conn
    }
}

admin.lulwah.ae {
    import secure_headers
    header X-Robots-Tag "noindex, nofollow"
    reverse_proxy admin:3001
}

api.lulwah.ae {
    import secure_headers
    reverse_proxy api:4000 {
        health_uri /api/v1/health
        health_interval 10s
        lb_policy round_robin
    }
}

img.lulwah.ae {
    import secure_headers
    header Cache-Control "public, max-age=31536000, immutable"
    reverse_proxy imgproxy:8080
}

staging.lulwah.ae, admin-staging.lulwah.ae, api-staging.lulwah.ae {
    header X-Robots-Tag "noindex, nofollow"
    basic_auth { lulwah {$STAGING_BCRYPT_HASH} }
    reverse_proxy web-stg:3000
}
```

### 36.6 MongoDB — the replica-set requirement

**This is the single most common way this stack breaks in production.** A standalone `mongod` cannot run multi-document transactions, and order placement uses one (create order → decrement stock → increment discount usage, all or nothing). Without the replica set, checkout throws `Transaction numbers are only allowed on a replica set member or mongos` — and it will pass in local dev if the dev box was set up correctly and fail on the server if it wasn't.

Initialise once, after the first `docker compose up`:

```bash
docker compose exec mongo mongosh --eval '
  rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] })
'
docker compose exec mongo mongosh --eval 'rs.status().ok'   # must print 1
```

Then create the application user, enable auth, and restart with `--auth --keyFile`. Connection string:
`mongodb://user:pass@mongo:27017/lulwah?replicaSet=rs0&directConnection=true`

Other locked settings:
- `--wiredTigerCacheSizeGB 1` — **required.** The default is `(RAM/2) − 1 GB` = 3 GB on this box, which starves Node and triggers the OOM-killer.
- `--slowms 100` so slow queries are visible in the log.
- Indexes are created by a migration script at deploy time (`pnpm migrate`), never by `autoIndex` in production — `autoIndex: false` in the Mongoose connection.
- One-node replica sets have no redundancy. They are for transaction support, not high availability. Backups are the safety net, not the replica set.

### 36.7 Next.js on a VPS — the three adjustments

1. **`output: 'standalone'`** in `next.config.js`, and the Dockerfile copies `.next/standalone`, `.next/static` and `public`. This drops the runtime image from ~1.2 GB to ~180 MB — meaningful when pulling images over a slow link.
2. **Shared ISR cache.** With more than one `web` replica (and across deploys), each container has its own `.next/cache`, so users see pages regenerate repeatedly and revalidation is inconsistent. Fix: a Redis cache handler (`cacheHandler` in `next.config.js` pointing at `@neshca/cache-handler` or equivalent) using `CACHE_HANDLER_REDIS_URL`. Set this up in P0 — retrofitting it after launch means debugging phantom stale pages.
3. **Server-side fetches bypass the proxy.** Inside RSC, call `http://api:4000` on the Docker network, not `https://api.lulwah.ae` — otherwise every server render leaves the box, goes to Cloudflare, and comes back, adding 200–400 ms for nothing.

Media: the `next/image` loader points at `img.lulwah.ae` (imgproxy). Next's own image optimizer is **disabled** (`images.unoptimized` is false but a custom `loader` is set) so the Node process never spends CPU on Sharp.

### 36.8 Backups — the part that actually matters

Three layers, because one is not a backup:

| Layer | What | Frequency | Retention | Where |
|---|---|---|---|---|
| 1 | `mongodump` (logical) + Meili dump + `.env` files, encrypted by **restic** | Nightly 02:00 UTC | 7 daily, 4 weekly, 6 monthly | **Off-box** — Contabo Object Storage or Backblaze B2 |
| 2 | Contabo VM snapshot (whole machine) | Daily (paid add-on) | 10 versions | Contabo |
| 3 | Media originals | Already in object storage, versioning on | continuous | Object storage |

`scripts/backup.sh` (simplified):
```bash
set -euo pipefail
STAMP=$(date +%F-%H%M)
docker compose exec -T mongo mongodump --archive --gzip --db=lulwah > /tmp/mongo-$STAMP.gz
curl -s -H "Authorization: Bearer $MEILI_MASTER_KEY" -X POST http://localhost:7700/dumps || true
restic backup /tmp/mongo-$STAMP.gz /srv/lulwah/.env /srv/lulwah/.env.staging /srv/lulwah/caddy
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
rm -f /tmp/mongo-$STAMP.gz
curl -fsS "$HEALTHCHECK_PING_URL"     # dead-man's switch: silence = alert
```

The `HEALTHCHECK_PING_URL` (healthchecks.io free) is the important line — **a backup job that fails silently is worse than no backup**, because you believe you are covered.

**Restore drill — run quarterly, and once before launch, and time it:**
```bash
restic snapshots
restic restore latest --target /tmp/restore
docker compose exec -T mongo mongorestore --archive --gzip --drop --nsFrom='lulwah.*' \
        --nsTo='lulwah_restoretest.*' < /tmp/restore/tmp/mongo-*.gz
# verify counts, then point staging at lulwah_restoretest and click around
```
Target: full rebuild from a blank VPS to a serving shop in **under 2 hours**. If a drill takes longer, fix the script, not the target.

### 36.9 Deploy and rollback

`scripts/deploy.sh <env> <tag>`:
```bash
set -euo pipefail
cd /srv/lulwah
echo "TAG=$2" > .tag
docker compose --env-file .env --env-file .tag pull
docker compose --env-file .env --env-file .tag run --rm api node dist/scripts/migrate.js
# rolling: one api replica at a time, wait for healthy before touching the next
docker compose up -d --no-deps --scale api=2 --wait api
docker compose up -d --no-deps --wait web admin worker
./scripts/smoke.sh || { ./scripts/rollback.sh; exit 1; }
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/purge_cache" \
     -H "Authorization: Bearer $CF_TOKEN" -H 'Content-Type: application/json' \
     --data '{"purge_everything":false,"tags":["home","nav"]}'
```

`scripts/smoke.sh` checks, with a non-zero exit on any failure: `/api/v1/health` returns 200 · the homepage returns 200 and contains the wordmark · a known product page returns 200 · `/api/v1/products?limit=1` returns a product · admin login page returns 200.

`scripts/rollback.sh` re-pins `.tag` to the previous SHA and repeats the rolling restart. The last **5** image tags are kept on the box, so a rollback needs no network. Migrations must therefore be **backwards-compatible for one release** — add columns/fields, never rename or drop in the same deploy as the code that stops using them.

### 36.10 Gotchas that will bite (each has cost someone a weekend)

1. **Docker punches through UFW.** `ports: "27017:27017"` is reachable from the internet even with `ufw deny`, because Docker writes its own iptables rules. Never publish a data-service port; if you must, bind it as `127.0.0.1:27017:27017`.
2. **Standalone mongod ⇒ checkout is broken.** §36.6. Initialise the replica set.
3. **WiredTiger eats the box.** Cap it. Default behaviour on 8 GB is to take 3 GB.
4. **No swap ⇒ the OOM-killer picks MongoDB.** Create 4 GB before anything else.
5. **Docker json-file logs fill the disk** in weeks. Rotate in `daemon.json`, and remember containers must be recreated for it to take effect.
6. **Do not run `next build` on the server.** It will OOM production.
7. **Never self-host SMTP.** Contabo IP ranges have poor reputation and port 25 is often blocked. Order confirmations must arrive; use Resend.
8. **Cloudflare "Full" instead of "Full (strict)"** silently allows an untrusted origin cert. Use strict.
9. **Cookies in the Cloudflare cache key** destroy the hit rate. Explicitly allowlist the two cookies that matter.
10. **`docker compose down` deletes nothing by default, but `down -v` deletes your database.** Never type `-v` on the production box. Consider aliasing `docker compose down` to refuse in `/srv/lulwah`.
11. **Automatic kernel updates need a reboot** to take effect; schedule it in a low-traffic window (03:00 GST Tuesday) and confirm `restart: unless-stopped` brings everything back — test this once, deliberately, before launch.
12. **Contabo has no hourly billing and no instant resize back down.** Size up deliberately.
13. **Object storage keys in `imgproxy` env** are readable by anyone who can exec into the container — keep the S3 credentials scoped to read-only on the media bucket.
14. **Meilisearch has no auth by default** in some setups; `MEILI_MASTER_KEY` must be set and `MEILI_ENV=production`, or the search index is world-writable to anything that reaches the port.
15. **Timezone.** Keep the server in UTC and format in the app. A server in local time plus a `TZ`-unaware cron will run the nightly backup at the wrong hour after a DST change somewhere.

### 36.11 Scale-up path

| Signal | Action |
|---|---|
| RAM sustained > 80%, or Mongo working set > 1 GB | Resize to Cloud VPS 20 (12 GB) — reboot, no migration |
| CPU sustained > 70% during peaks | Resize, or move imgproxy to a Cloudflare Worker / Images |
| Cache hit ratio < 80% | Fix the cache key before buying hardware |
| > 300 orders/month, or downtime becomes expensive | **Split the database onto its own VPS** (private network), keep apps on the first box |
| Real HA required | Second VPS + Mongo 3-node replica set + a load balancer, or move the DB to Atlas and keep the apps self-hosted — a good middle path |
| Drop-day traffic | Cloudflare cache + "Under Attack" mode; pre-warm the cache by crawling the sitemap 30 min before the drop |

Nothing in the application code changes at any of these steps — the app is stateless and configured by environment variables. That is the point of the architecture in §5.

### 36.12 Pre-launch infrastructure checklist

- [ ] Swap active (`free -h` shows 4 GB) and `vm.swappiness=10`
- [ ] `ufw status` shows only 22/80/443; 80/443 restricted to Cloudflare ranges
- [ ] `fail2ban` active on sshd; root login and password auth disabled
- [ ] Docker log rotation confirmed (`docker inspect` a container shows `max-size`)
- [ ] `rs.status().ok === 1`; MongoDB auth enabled; app user is not root
- [ ] A transaction actually commits — place a real test order on staging
- [ ] Redis `requirepass` set; AOF on; no port published
- [ ] `MEILI_MASTER_KEY` set; `MEILI_ENV=production`
- [ ] imgproxy signed URLs enforced (an unsigned URL returns 403)
- [ ] Cloudflare: Full (strict), proxied records, cache rules live, hit ratio > 90% on a crawl
- [ ] TLS: SSL Labs A+, HSTS present, HTTP/3 responding
- [ ] Backup ran, restic snapshot exists off-box, **restore drill completed and timed**
- [ ] Dead-man's-switch ping configured; deliberately fail the backup once and confirm the alert fires
- [ ] External uptime monitor alerting to a phone, verified by stopping Caddy for 60 s
- [ ] Disk, RAM and CPU alerts firing to Slack, thresholds 80/85/85
- [ ] Reboot test: `reboot`, and everything comes back healthy unattended
- [ ] Rollback test: deploy a deliberately broken tag, confirm smoke fails and rollback restores service
- [ ] `.env` files backed up encrypted and a copy is in the client's password manager

### 36.13 What you are giving up, stated plainly

Self-hosting on one VPS is a legitimate choice for a store at this stage, and the ~$350/month saving is real. These are the trade-offs, so nobody is surprised later:

- **One machine is one point of failure.** A hardware fault or a bad upgrade takes the shop offline until someone restores it. RTO 2 hours *if* the drill has been done; considerably longer if it hasn't.
- **RPO is 24 hours.** A catastrophic loss at 23:00 loses a day of orders. Reduce it to 6 hours by running the backup four times daily — cheap, and worth doing once order volume is real.
- **No autoscaling.** A viral Eid drop is absorbed by the Cloudflare cache or not at all. Pre-warm the cache and watch the dashboard on drop days.
- **Ops is now a line item**, roughly 4–6 hours a month: patching, disk, backups, restore drills, certificate and dependency updates. Someone must own it by name.
- **No preview deploys**, so review happens locally or on staging.

If, three months in, the client's tolerance for downtime turns out to be lower than this setup provides, the cleanest upgrade is not "move everything back to managed" — it is **move MongoDB to Atlas and keep everything else on the VPS**. That removes the highest-consequence failure mode for roughly $60/month and requires only a connection-string change.

---

*End of plan. Version 1.0 — changes require an ADR and an update to this document in the same pull request.*
