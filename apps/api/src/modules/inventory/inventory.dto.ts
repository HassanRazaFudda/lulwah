import { z } from 'zod';
import { AdjustStockInput, InventoryItem, StockMovement } from '@lulwah/contracts';

export { AdjustStockInput };

const booleanParam = () =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true'));

export const AdminListInventoryQuery = z.object({
  lowStock: booleanParam(),
  outOfStock: booleanParam(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type AdminListInventoryQuery = z.infer<typeof AdminListInventoryQuery>;

export const AdminInventoryListResponse = z.object({ items: z.array(InventoryItem) });
export type AdminInventoryListResponse = z.infer<typeof AdminInventoryListResponse>;

export const AdjustStockResponse = z.object({ item: InventoryItem, movement: StockMovement });
export type AdjustStockResponse = z.infer<typeof AdjustStockResponse>;

export const ListMovementsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type ListMovementsQuery = z.infer<typeof ListMovementsQuery>;

export const ListMovementsResponse = z.object({ movements: z.array(StockMovement) });
export type ListMovementsResponse = z.infer<typeof ListMovementsResponse>;
