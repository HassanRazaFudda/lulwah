/** Moves the item at `from` to `to`, returning a new array — the one bit of
 *  logic every drag-reorder list in the Content screen needs (home
 *  sections, a manually-curated collection's `productIds`, menu items at
 *  one nesting level). Out-of-range indices are a no-op (returns the
 *  original array reference) rather than throwing, since a drag handler
 *  can legitimately fire with a stale index during a fast drag. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}
