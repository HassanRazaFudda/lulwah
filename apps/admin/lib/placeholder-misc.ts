/**
 * Minimal placeholder rows for the screens the task scopes as "structurally
 * real page shells, minimal placeholder content" (Products, Inventory,
 * Discounts, Customers) — depth for this workstream goes into Orders
 * (plan.md §8.7 is the headline feature), not spread evenly across every
 * admin screen.
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

export interface PlaceholderCustomerRow {
  id: string;
  name: string;
  email: string;
  orders: number;
  totalSpentFils: number;
  tags: string[];
}

export const PLACEHOLDER_CUSTOMERS: PlaceholderCustomerRow[] = [
  { id: 'c1', name: 'Ayesha Khan', email: 'ayesha.khan@example.com', orders: 6, totalSpentFils: 184200, tags: ['vip'] },
  { id: 'c2', name: 'Mahnoor Iqbal', email: 'mahnoor.iqbal@example.com', orders: 2, totalSpentFils: 45900, tags: [] },
  {
    id: 'c3',
    name: 'Zara Sheikh',
    email: 'zara.sheikh@example.com',
    orders: 9,
    totalSpentFils: 302100,
    tags: ['wholesale'],
  },
];
