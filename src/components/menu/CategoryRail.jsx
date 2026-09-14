import { useState, useRef, useEffect } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { iconFor, colorFor, AllItemsIcon } from '../../lib/categoryVisual';

export default function CategoryRail({ categories, items, selected, onSelect, onAddCategory, busy }) {
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

  const Row = ({ active, icon: Icon, iconColor, label, count, onClick }) => (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
        active ? 'bg-elevated ring-1 ring-brand-start/50' : 'hover:bg-surface'
      }`}
    >
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-150"
        style={{
          backgroundColor: active ? `${iconColor}26` : 'transparent',
          border: `1px solid ${active ? `${iconColor}55` : 'var(--color-border)'}`,
          color: active ? iconColor : 'var(--color-ink-faint)',
        }}
      >
        <Icon size={15} />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-medium truncate ${active ? 'text-ink' : 'text-ink-muted group-hover:text-ink'}`}>
          {label}
        </span>
      </span>
      <span className={`text-xs font-ticket tabular-nums ${active ? 'text-ink-muted' : 'text-ink-faint'}`}>
        {count}
      </span>
    </button>
  );

  return (
    <aside className="w-full lg:w-60 flex-shrink-0 space-y-4">
      <div>
        <p className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Categories</p>
        <div className="space-y-1">
          <Row active={selected === 'all'} icon={AllItemsIcon} iconColor="#8B5CF6" label="All Items" count={countFor('all')} onClick={() => onSelect('all')} />
          {categories.map((cat) => (
            <Row
              key={cat.id}
              active={selected === cat.id}
              icon={iconFor(cat.name)}
              iconColor={colorFor(cat.name)}
              label={cat.name}
              count={countFor(cat.id)}
              onClick={() => onSelect(cat.id)}
            />
          ))}
        </div>
      </div>

      {adding ? (
        <div className="flex items-center gap-1 bg-elevated ring-1 ring-brand-start/40 rounded-xl pl-3 pr-1.5 py-1.5">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setAdding(false); setName(''); } }}
            placeholder="Category name"
            className="bg-transparent outline-none text-sm text-ink placeholder:text-ink-faint w-full min-w-0"
          />
          <button onClick={submit} disabled={busy} className="w-7 h-7 rounded-lg bg-brand-start/20 text-brand-end flex items-center justify-center hover:brightness-110 transition-colors duration-150 disabled:opacity-50 flex-shrink-0">
            <Check size={14} />
          </button>
          <button onClick={() => { setAdding(false); setName(''); }} className="w-7 h-7 rounded-lg text-ink-faint hover:text-ink flex items-center justify-center transition-colors duration-150 flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border border-dashed border-border text-ink-faint hover:text-ink hover:border-ink-faint/50 transition-colors duration-150"
        >
          <Plus size={14} />
          Add Category
        </button>
      )}
    </aside>
  );
}
