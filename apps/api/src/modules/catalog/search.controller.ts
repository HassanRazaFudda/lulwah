import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../shared/response.js';
import * as service from './search.service.js';

const SearchQuery = z.object({
  q: z.string().default(''),
  limit: z.coerce.number().int().positive().max(100).default(24),
});

/** plan.md §9.2 `GET /search` — "Meilisearch, typo-tolerant, article-code
 *  exact boost" with the §7.14 Mongo-regex fallback. Deliberately never
 *  lets a search-backend error surface as an HTTP error: `search.service.ts`
 *  already catches everything and reports which path served the request
 *  via `source`, so this controller has nothing to catch. */
export async function search(req: Request, res: Response): Promise<void> {
  const query = SearchQuery.parse(req.query);
  const result = await service.searchProducts(query.q, query.limit);
  sendSuccess(res, result);
}
