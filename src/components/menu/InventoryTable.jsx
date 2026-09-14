import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, SlidersHorizontal, Eye, Pencil, Trash2, Check } from 'lucide-react';
import { getStockStatus, STATUS_META } from '../../lib/stockStatus';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'in', label: 'In Stock' },
  { key: 'low', label: 'Low Stock' },
  { key: 'out', label: 'Out of Stock' },
  { key: 'unlimited', label: 'Unlimited' },
];

function StatusBadge({ status }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${meta.bg} ${meta.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export default function InventoryTable({ items, categories, onView, onEdit, onDelete }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const catName = (id) => categories.find((c) => c.id === id)?.name || '—';

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (search.trim() && !item.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (statusFilter !== 'all' && getStockStatus(item.stock_qty) !== statusFilter) return false;
      return true;
    });
  }, [items, search, statusFilter]);

  return (
    <section className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items by name…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-raised border border-border outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors duration-150 text-sm"
          />
        </div>

        <div className="relative ml-auto" ref={filterRef}>
          <button
            onClick={() => setFilterOpen((o) => !o)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors duration-150 ${
              statusFilter !== 'all' ? 'bg-accent-soft border-accent/40 text-ink' : 'bg-surface-raised border-border text-ink-muted hover:text-ink'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filter
          </button>
          {filterOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-surface-raised border border-border rounded-xl shadow-2xl py-1.5 z-20">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => { setStatusFilter(f.key); setFilterOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150"
                >
                  {f.label}
                  {statusFilter === f.key && <Check size={13} className="text-accent" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-ink-faint text-xs uppercase tracking-wide">
              <th className="text-left font-medium px-4 py-3">Item</th>
              <th className="text-left font-medium px-4 py-3">Category</th>
              <th className="text-left font-medium px-4 py-3">Price</th>
              <th className="text-left font-medium px-4 py-3">Stock</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-right font-medium px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const status = getStockStatus(item.stock_qty);
              return (
                <tr key={item.id} className="border-t border-border hover:bg-surface-hover transition-colors duration-150">
                  <td className="px-4 py-3">
                    <span className="text-ink font-medium">{item.name}</span>
                    {!item.is_available && <span className="ml-2 text-xs text-ink-faint">(hidden)</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{catName(item.category_id)}</td>
                  <td className="px-4 py-3 text-ink-muted font-ticket">Rs. {item.price}</td>
                  <td className="px-4 py-3 text-ink-muted">{item.stock_qty === null ? 'Unlimited' : item.stock_qty}</td>
                  <td className="px-4 py-3"><StatusBadge status={status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => onView(item)} title="View"
                        className="w-8 h-8 rounded-lg bg-surface-raised border border-border text-ink-muted hover:text-ink hover:border-ink-faint/40 transition-colors duration-150 flex items-center justify-center">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => onEdit(item)} title="Edit"
                        className="w-8 h-8 rounded-lg bg-accent-soft text-accent hover:brightness-110 transition-colors duration-150 flex items-center justify-center">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => onDelete(item)} title="Delete"
                        className="w-8 h-8 rounded-lg bg-danger-soft text-danger hover:brightness-110 transition-colors duration-150 flex items-center justify-center">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p className="text-ink-faint text-sm text-center py-10">
            {items.length === 0 ? 'No menu items yet — add one above.' : 'No items match your search/filter.'}
          </p>
        )}
      </div>
    </section>
  );
}
