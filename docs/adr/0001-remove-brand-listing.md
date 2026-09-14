# 0001 — Remove the "Brands We Carry" storefront listing

## Status

Accepted, 2026-09-14.

## Context

`plan.md` was written around a multi-brand retail model: the storefront
carries named third-party fashion houses (Khaadi, Asim Jofa, Sana
Safinaz, Maria B, Gul Ahmed, Elan), and several sections explicitly
market that assortment — a "Brand strip" home section (§15.2 item 5, "a
slow marquee of wordmarks"), a `/brands` + `/brands/[slug]` directory,
a "Brands" entry in the primary nav and footer, a mega-menu column
reserved for brand wordmarks (§15.1), and a site-wide meta description
naming specific houses.

The client corrected this: Lulwah Fashion sells its own product. It is
not a multi-brand retailer, so a section inviting a shopper to browse
"the brands we carry" no longer describes anything real, and continuing
to display one would be actively misleading.

## Options considered

1. **Leave the marketing listing in place**, seeded with placeholder
   brand names, on the assumption a real multi-brand catalog might
   still happen later. Rejected — showing a customer a shelf of brands
   that aren't actually stocked is worse than showing nothing.
2. **Remove the marketing listing, and also collapse the underlying
   `Brand` catalog data model** (the `brandId` product attribution,
   `/admin/brands`, the PDP's own "Khaadi" byline) down to a single
   implicit house brand. Rejected for *this* change — it's a much
   larger, separate decision (product data model, seed data, every
   PLP/PDP/admin screen that reads a product's brand) that the client
   explicitly deferred ("we'll handle the rest of the website
   improvements separately"). Bundling it in here would have missed
   that scope boundary.
3. **Remove only the customer-facing marketing surface, leave the data
   model untouched.** Chosen.

## Decision

Removed, storefront-side only:
- `BrandStrip` (the home-section marquee component) and the
  `brand_strip` `HomeSectionType`'s actual rendering — the type itself
  stays valid in the schema (see below), it just never renders and can
  no longer be created.
- `/brands` and `/brands/[slug]` (deleted entirely; both now 404).
- The "Brands" link in the primary nav (`Header.tsx`), the footer, and
  the sitemap.
- The site's meta description's brand-name-dropping ("Khaadi, Asim
  Jofa, Sana Safinaz and more").
- `apps/admin`'s ability to create a new `brand_strip` home section
  (`HomeSectionsPanel.tsx`'s type picker) and that section type's
  settings sub-form (`HomeSectionSettingsForm.tsx`) — both fall
  through to the same graceful no-op every other unrecognised section
  type already has, rather than being deleted from the schema.

Deliberately **kept**, as genuinely out of scope for this change:
- The `Brand` catalog entity itself (`packages/contracts/src/brand.ts`,
  `apps/api/src/modules/catalog/brand.*`) — product attribution
  (a PDP/PLP's own brand byline, brand-based filtering) still depends
  on it.
- `brand_strip` as a `HomeSectionType` enum member — removing it is a
  real schema/migration question (Mongoose enum, any existing stored
  document of that type), not something this change needed to answer.
- Everything about whether the catalog itself should eventually become
  genuinely single-brand (re-seeding all products under one house
  label, retiring `brandId` entirely) — a separate, larger decision.

## Consequences

- The storefront no longer implies Lulwah carries third-party houses
  it doesn't. `plan.md` §15.1's mega-menu spec and §15.2 item 5 are now
  stale on this one point — corrected in the same change this ADR
  documents, per §27.7's own rule ("this document is updated in the
  same PR").
- A product's own brand name (e.g. "Gul Ahmed" under a product title)
  still appears throughout the site — this is product attribution, not
  the removed marketing listing, and is unaffected.
- If the catalog itself later becomes genuinely single-brand, that is
  a new, separate decision (and likely its own ADR) — this one only
  answers "should the site market a multi-brand assortment," not
  "should the catalog model be multi-brand."
