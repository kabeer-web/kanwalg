import { useState, useRef, useEffect } from 'react';
import { Coffee, Cookie, Soup, IceCream, Tag, LayoutGrid, Plus, Check, X } from 'lucide-react';

// Purely presentational — matches a category name to an icon so the row
// doesn't look like a flat list of pills. No DB field for this, so it's
// a best-effort guess with a sensible fallback; renaming a category to
// something unrecognized just falls back to the generic tag icon.
function iconFor(name) {
  const n = name.toLowerCase();
  if (n.includes('beverage') || n.includes('drink')) return Coffee;
  if (n.includes('snack')) return Cookie;
  if (n.includes('meal') || n.includes('karahi') || n.includes('bbq') || n.includes('rice')) return Soup;
  if (n.includes('dessert') || n.includes('sweet')) return IceCream;
  return Tag;
}

export default function CategoryTabs({ categories, items, selected, onSelect, onAddCategory, busy }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const countFor = (catId) =>
    catId === 'all' ? items.length : items.filter((i) => i.category_id === catId).length;

  const submit = () => {
    if (name.trim()) onAddCategory(name.trim());
    setName('');
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => onSelect('all')}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors duration-150 ${
          selected === 'all'
            ? 'bg-accent-soft border-accent/40 text-ink'
            : 'bg-surface border-border text-ink-muted hover:text-ink hover:border-ink-faint/40'
        }`}
      >
        <LayoutGrid size={14} />
        All Items
        <span className="text-xs text-ink-faint">{countFor('all')}</span>
      </button>

      {categories.map((cat) => {
        const Icon = iconFor(cat.name);
        const active = selected === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors duration-150 ${
              active
                ? 'bg-accent-soft border-accent/40 text-ink'
                : 'bg-surface border-border text-ink-muted hover:text-ink hover:border-ink-faint/40'
            }`}
          >
            <Icon size={14} />
            {cat.name}
            <span className="text-xs text-ink-faint">{countFor(cat.id)}</span>
          </button>
        );
      })}

      {adding ? (
        <div className="flex items-center gap-1 bg-surface-raised border border-accent/50 rounded-xl pl-3 pr-1.5 py-1.5">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setAdding(false); setName(''); } }}
            placeholder="Category name"
            className="bg-transparent outline-none text-sm text-ink placeholder:text-ink-faint w-32"
          />
          <button onClick={submit} disabled={busy} className="w-7 h-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center hover:brightness-110 transition-colors duration-150 disabled:opacity-50">
            <Check size={14} />
          </button>
          <button onClick={() => { setAdding(false); setName(''); }} className="w-7 h-7 rounded-lg text-ink-faint hover:text-ink flex items-center justify-center transition-colors duration-150">
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border border-dashed border-border text-ink-faint hover:text-ink hover:border-ink-faint/50 transition-colors duration-150"
        >
          <Plus size={14} />
          Add Category
        </button>
      )}
    </div>
  );
}
