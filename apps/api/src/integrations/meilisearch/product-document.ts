/**
 * The document shape indexed into Meilisearch's `products` index — one
 * field per entry in `index-config.ts`'s searchable/filterable/sortable
 * lists. `id` doubles as the primary key (the product's Mongo `_id`
 * string), so upsert/delete are both keyed the same way the rest of the
 * API already identifies a product.
 */
export interface ProductSearchDocument {
  id: string;
  articleCode: string;
  title: string;
  titleAr: string;
  brandId: string;
  brandName: string;
  colorName: string;
  colorFamily: string;
  fabric: string;
  categoryIds: string[];
  categoryPath: string;
  collectionIds: string[];
  stitchingType: string;
  pieceCount: 1 | 2 | 3 | null;
  work: string[];
  occasion: string[];
  season: string;
  size: string[];
  effectivePriceFils: number;
  discountPercent: number;
  onSale: boolean;
  inStock: boolean;
  status: string;
  createdAt: number; // epoch ms — Meilisearch sorts numerically, not by ISO string
  soldCount: number;
}
