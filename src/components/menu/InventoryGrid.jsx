import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, SlidersHorizontal, Check, Plus, PackageSearch } from 'lucide-react';
import ItemCard from './ItemCard';
import { getStockStatus } from '../../lib/stockStatus';

const FILTERS = [
  { key: 'all', label: 'All statuses' },
  { key: 'in', label: 'In Stock' },
  { key: 'low', label: 'Low Stock' },
  { key: 'out', label: 'Out of Stock' },
  { key: 'unlimited', label: 'Unlimited' },
];

export default function InventoryGrid({ items, categories, onOpenItem, onAddNew }) {
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
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items by name…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-elevated border border-border outline-none focus:border-brand-end focus:ring-2 focus:ring-brand-end/15 transition-colors duration-150 text-sm"
          />
        </div>

        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setFilterOpen((o) => !o)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors duration-150 ${
              statusFilter !== 'all' ? 'bg-brand-start/15 border-brand-start/40 text-ink' : 'bg-elevated border-border text-ink-muted hover:text-ink'
            }`}
          >
            <SlidersHorizontal size={14} />
            {FILTERS.find((f) => f.key === statusFilter).label}
          </button>
          {filterOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-elevated border border-border rounded-xl shadow-2xl py-1.5 z-20">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => { setStatusFilter(f.key); setFilterOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-ink-muted hover:text-ink hover:bg-surface transition-colors duration-150"
                >
                  {f.label}
                  {statusFilter === f.key && <Check size={13} className="text-brand-end" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <button
          onClick={onAddNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gradient text-white font-semibold text-sm hover:brightness-110 transition-all duration-150 active:scale-[0.98]"
        >
          <Plus size={15} />
          Add Item
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 border border-dashed border-border rounded-2xl">
          <PackageSearch size={26} className="text-ink-faint mb-3" />
          <p className="text-ink-muted text-sm">
            {items.length === 0 ? 'No menu items yet.' : 'No items match your search/filter.'}
          </p>
          {items.length === 0 && (
            <button onClick={onAddNew} className="mt-3 text-sm text-brand-end font-medium hover:brightness-110 transition-colors duration-150">
              + Add your first item
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} categoryName={catName(item.category_id)} onOpen={onOpenItem} />
          ))}
        </div>
      )}
    </section>
  );
}
