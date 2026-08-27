import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * Mongoose schema for `search_queries` — NOT in plan.md §7 (no collection
 * for this existed before this pass). Added specifically so the Reports
 * screen's Search category (plan.md §11.1: "top queries, zero-result
 * queries — this is a merchandising goldmine") can report on real data
 * instead of being skipped outright: `search.service.ts#searchProducts`
 * was the only real entry point for `GET /search`, and it logged nothing
 * before this. See that file's doc comment for the logging call site.
 *
 * Deliberately minimal — no `userId`/session/IP (this is a merchandising
 * signal, not an analytics or security log; storing less here is simply
 * less to justify keeping). `normalizedQuery` (trimmed, lowercased) is
 * what every report groups by, so "Lawn" and "lawn " roll up together;
 * `query` keeps one raw original for display.
 */
export interface SearchQueryLogDoc {
  _id: Types.ObjectId;
  query: string;
  normalizedQuery: string;
  resultCount: number;
  source: 'meilisearch' | 'mongo_fallback';
  createdAt: Date;
}

const searchQueryLogSchema = new Schema<SearchQueryLogDoc>(
  {
    query: { type: String, required: true },
    normalizedQuery: { type: String, required: true },
    resultCount: { type: Number, required: true, min: 0 },
    source: { type: String, enum: ['meilisearch', 'mongo_fallback'], required: true },
  },
  // Append-only log — no `updatedAt`, same convention as `stock_movements`.
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'search_queries' },
);

searchQueryLogSchema.index({ normalizedQuery: 1, createdAt: -1 });
searchQueryLogSchema.index({ createdAt: -1 });

export type SearchQueryLogHydratedDoc = HydratedDocument<SearchQueryLogDoc>;
export const SearchQueryLogModel = model<SearchQueryLogDoc>('SearchQueryLog', searchQueryLogSchema);
