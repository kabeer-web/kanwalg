import { Package } from 'lucide-react';

// A single composed panel instead of three equal cards: the total is the
// hero number (what a restaurant owner actually cares about first), and
// in-stock/low/out are a proportional segmented bar underneath — so the
// *shape* of the inventory health is visible at a glance, not just three
// disconnected counts.
export default function OverviewStrip({ counts }) {
  const { total, in: inStock, low, out } = counts;
  const segs = [
    { key: 'in', value: inStock, color: 'var(--color-success)' },
    { key: 'low', value: low, color: 'var(--color-warning)' },
    { key: 'out', value: out, color: 'var(--color-danger)' },
  ];

  return (
    <div className="bg-surface border border-border rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-5">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-11 h-11 rounded-xl bg-brand-start/15 border border-brand-start/30 text-brand-end flex items-center justify-center">
          <Package size={18} />
        </div>
        <div>
          <p className="text-2xl font-semibold text-ink leading-none font-ticket">{total}</p>
          <p className="text-ink-faint text-xs mt-1">menu items total</p>
        </div>
      </div>

      <div className="hidden sm:block w-px self-stretch bg-border" />

      <div className="flex-1 min-w-[180px]">
        <div className="flex h-1.5 rounded-full overflow-hidden bg-elevated">
          {segs.map((s) => (
            <div
              key={s.key}
              style={{ width: total ? `${(s.value / total) * 100}%` : 0, backgroundColor: s.color }}
              className="transition-all duration-300"
            />
          ))}
        </div>
        <div className="flex items-center gap-4 mt-2.5 flex-wrap">
          <Legend color="var(--color-success)" label="In Stock" value={inStock} />
          <Legend color="var(--color-warning)" label="Low Stock" value={low} />
          <Legend color="var(--color-danger)" label="Out of Stock" value={out} />
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label, value }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-muted">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {label} <span className="text-ink font-medium font-ticket">{value}</span>
    </span>
  );
}
