import { Infinity as InfinityIcon } from 'lucide-react';
import { iconFor, colorFor } from '../../lib/categoryVisual';
import { getStockStatus, getStockFraction, STATUS_META } from '../../lib/stockStatus';

export default function ItemCard({ item, categoryName, onOpen }) {
  const Icon = iconFor(categoryName);
  const color = colorFor(categoryName);
  const status = getStockStatus(item.stock_qty);
  const meta = STATUS_META[status];
  const fraction = getStockFraction(item.stock_qty);

  return (
    <button
      onClick={() => onOpen(item)}
      className="group relative text-left bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3 transition-all duration-150 hover:border-ink-faint/40 hover:bg-elevated"
    >
      {!item.is_available && (
        <span className="absolute top-3 right-3 text-[10px] font-medium text-ink-faint bg-bg border border-border px-1.5 py-0.5 rounded-md">
          Hidden
        </span>
      )}

      <div className="flex items-start gap-3">
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}1F`, border: `1px solid ${color}40`, color }}
        >
          <Icon size={17} />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-ink font-medium text-sm truncate">{item.name}</p>
          <p className="text-ink-faint text-xs mt-0.5 truncate">{categoryName}</p>
        </div>
      </div>

      <p className="text-ink text-lg font-semibold font-ticket">Rs. {item.price}</p>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs font-medium ${meta.text}`}>{meta.label}</span>
          <span className="text-xs text-ink-faint font-ticket">
            {status === 'unlimited' ? <InfinityIcon size={12} /> : item.stock_qty}
          </span>
        </div>
        <div className="h-1 rounded-full bg-elevated overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${fraction * 100}%`, backgroundColor: meta.bar }}
          />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-9 rounded-b-2xl bg-gradient-to-t from-elevated/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none" />
    </button>
  );
}
