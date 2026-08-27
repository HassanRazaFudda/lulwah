import type { QueryFilter } from 'mongoose';
import { SearchQueryLogModel } from './search-query.model.js';
import type { SearchQueryLogDoc } from './search-query.model.js';

/** The ONLY file allowed to touch `SearchQueryLogModel` (plan.md §5.4). */

export interface LogSearchQueryInput {
  query: string;
  resultCount: number;
  source: SearchQueryLogDoc['source'];
}

export async function logSearchQuery(input: LogSearchQueryInput): Promise<void> {
  await SearchQueryLogModel.create({ query: input.query, normalizedQuery: input.query.trim().toLowerCase(), resultCount: input.resultCount, source: input.source });
}

export interface SearchQueryAggregateRow {
  normalizedQuery: string;
  sampleQuery: string;
  searchCount: number;
  avgResultCount: number;
  lastSearchedAt: Date;
}

function dateMatch(dateFrom?: Date, dateTo?: Date): QueryFilter<SearchQueryLogDoc> {
  const match: QueryFilter<SearchQueryLogDoc> = {};
  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom) match.createdAt.$gte = dateFrom;
    if (dateTo) match.createdAt.$lte = dateTo;
  }
  return match;
}

/** Most-searched normalized query text in the window, most first. */
export async function aggregateTopQueries(dateFrom: Date | undefined, dateTo: Date | undefined, limit: number): Promise<SearchQueryAggregateRow[]> {
  return SearchQueryLogModel.aggregate<SearchQueryAggregateRow>([
    { $match: dateMatch(dateFrom, dateTo) },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$normalizedQuery',
        sampleQuery: { $first: '$query' },
        searchCount: { $sum: 1 },
        avgResultCount: { $avg: '$resultCount' },
        lastSearchedAt: { $max: '$createdAt' },
      },
    },
    { $sort: { searchCount: -1 } },
    { $limit: limit },
    { $project: { _id: 0, normalizedQuery: '$_id', sampleQuery: 1, searchCount: 1, avgResultCount: 1, lastSearchedAt: 1 } },
  ]).exec();
}

/** Same shape, but only counting the occasions a query returned literally
 *  zero results — plan.md §11.1's own words, "a merchandising goldmine":
 *  these are searches real customers ran that the catalog had nothing to
 *  answer with. A query that's zero-result some of the time and not
 *  others is counted only for its zero-result occurrences here, not
 *  lumped in with the times it worked. */
export async function aggregateZeroResultQueries(dateFrom: Date | undefined, dateTo: Date | undefined, limit: number): Promise<SearchQueryAggregateRow[]> {
  return SearchQueryLogModel.aggregate<SearchQueryAggregateRow>([
    { $match: { ...dateMatch(dateFrom, dateTo), resultCount: 0 } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$normalizedQuery',
        sampleQuery: { $first: '$query' },
        searchCount: { $sum: 1 },
        avgResultCount: { $avg: '$resultCount' },
        lastSearchedAt: { $max: '$createdAt' },
      },
    },
    { $sort: { searchCount: -1 } },
    { $limit: limit },
    { $project: { _id: 0, normalizedQuery: '$_id', sampleQuery: 1, searchCount: 1, avgResultCount: 1, lastSearchedAt: 1 } },
  ]).exec();
}
