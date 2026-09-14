// Single source of truth for "what does this stock number mean" —
// used by the stats bar, the inventory table, and the view modal so
// they can never disagree with each other.
//
// stock_qty === null means "not tracked" (unlimited) — e.g. a drink
// fountain or a made-to-order item with no finite count.
export const LOW_STOCK_THRESHOLD = 5;

export function getStockStatus(stockQty) {
  if (stockQty === null || stockQty === undefined) return 'unlimited';
  if (stockQty <= 0) return 'out';
  if (stockQty <= LOW_STOCK_THRESHOLD) return 'low';
  return 'in';
}

export const STATUS_META = {
  in:        { label: 'In Stock',    dot: 'bg-success',  text: 'text-success',  bar: 'var(--color-success)' },
  low:       { label: 'Low Stock',   dot: 'bg-warning',  text: 'text-warning',  bar: 'var(--color-warning)' },
  out:       { label: 'Out of Stock',dot: 'bg-danger',   text: 'text-danger',   bar: 'var(--color-danger)' },
  unlimited: { label: 'Unlimited',   dot: 'bg-ink-faint', text: 'text-ink-muted', bar: 'var(--color-ink-faint)' },
};

// Purely visual capacity reference for the stock bar — there's no "max
// stock" field in the schema, so this just gives the bar a sensible
// scale to fill against. Not a stored or computed business metric.
const VISUAL_CAP = 20;
export function getStockFraction(stockQty) {
  if (stockQty === null || stockQty === undefined) return 1;
  return Math.max(0, Math.min(1, stockQty / VISUAL_CAP));
}
