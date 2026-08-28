/**
 * Minimal placeholder rows for screens still scoped as "structurally real
 * page shells, minimal placeholder content" when this file was written
 * (originally Products, Inventory, Discounts, Customers) — depth for that
 * workstream went into Orders (plan.md §8.7 is the headline feature), not
 * spread evenly across every admin screen. Products, Inventory, and now
 * Customers have since moved to real data (see their own
 * `lib/queries/*.ts`); only Discounts still reads from here.
 */

export interface PlaceholderProductRow {
  id: string;
  title: string;
  brand: string;
  articleCode: string;
  stitchingType: string;
  priceFils: number;
  stock: number;
  status: string;
}

export const PLACEHOLDER_PRODUCTS: PlaceholderProductRow[] = [
  {
    id: 'p1',
    title: 'Embroidered Lawn 3-Piece',
    brand: 'Lulwah Atelier',
    articleCode: 'LF-0001',
    stitchingType: 'unstitched',
    priceFils: 18900,
    stock: 42,
    status: 'active',
  },
  {
    id: 'p2',
    title: 'Custom-Stitched Raw Silk Bridal',
    brand: 'Lulwah Atelier',
    articleCode: 'LF-0002',
    stitchingType: 'custom_stitchable',
    priceFils: 89000,
    stock: 6,
    status: 'active',
  },
  {
    id: 'p3',
    title: 'Karandi Winter Suit',
    brand: 'Lulwah Atelier',
    articleCode: 'LF-0003',
    stitchingType: 'semi_stitched',
    priceFils: 21500,
    stock: 0,
    status: 'draft',
  },
];

export interface PlaceholderInventoryRow {
  sku: string;
  product: string;
  onHand: number;
  reserved: number;
  threshold: number;
}

export const PLACEHOLDER_INVENTORY: PlaceholderInventoryRow[] = [
  { sku: 'LF-0104-S-MAROON', product: 'Zari Formal 3-Piece — S / Maroon', onHand: 1, reserved: 1, threshold: 5 },
  { sku: 'LF-0092-M-BLACK', product: 'Velvet Winter Shawl — M / Black', onHand: 2, reserved: 0, threshold: 5 },
  { sku: 'LF-0071-L-GOLD', product: 'Bridal Silk Dupatta — L / Gold', onHand: 0, reserved: 0, threshold: 3 },
];

export interface PlaceholderDiscountRow {
  code: string;
  type: string;
  status: string;
  used: number;
  limit: number;
}

export const PLACEHOLDER_DISCOUNTS: PlaceholderDiscountRow[] = [
  { code: 'EID2026', type: 'percentage', status: 'active', used: 214, limit: 500 },
  { code: 'FREESHIP', type: 'free_shipping', status: 'active', used: 1032, limit: 0 },
  { code: 'WELCOME10', type: 'fixed_amount', status: 'scheduled', used: 0, limit: 1000 },
];

// Customers previously had a placeholder row shape here
// (`PlaceholderCustomerRow`/`PLACEHOLDER_CUSTOMERS`) — removed now that
// `app/(dashboard)/customers/page.tsx` reads real data from
// `GET /admin/customers` (see `lib/queries/customers.ts`).
