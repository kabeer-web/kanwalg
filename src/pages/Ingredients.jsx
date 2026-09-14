import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Package, AlertTriangle, X, Loader2, Check,
  ArrowDownCircle, ArrowUpCircle, Trash2, Pencil,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const UNITS = ['kg', 'g', 'litre', 'ml', 'pcs', 'dozen', 'unit'];

const emptyForm = {
  name: '', unit: 'kg', current_stock: '', low_stock_threshold: '0',
  cost_per_unit: '0', supplier: '', is_active: true,
};

export default function Ingredients() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [moveOpen, setMoveOpen] = useState(null); // item
  const [moveType, setMoveType] = useState('purchase');
  const [moveQty, setMoveQty] = useState('');
  const [moveNotes, setMoveNotes] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name');
    if (err) setError(err.message);
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q) || (i.supplier || '').toLowerCase().includes(q));
  }, [items, search]);

  const lowCount = items.filter((i) => i.is_active && Number(i.current_stock) <= Number(i.low_stock_threshold)).length;

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setDrawerOpen(true);
  };

  const openEdit = (item) => {
    setForm({
      name: item.name,
      unit: item.unit || 'kg',
      current_stock: String(item.current_stock ?? 0),
      low_stock_threshold: String(item.low_stock_threshold ?? 0),
      cost_per_unit: String(item.cost_per_unit ?? 0),
      supplier: item.supplier || '',
      is_active: item.is_active !== false,
    });
    setEditingId(item.id);
    setDrawerOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setBusy(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      unit: form.unit,
      current_stock: Number(form.current_stock) || 0,
      low_stock_threshold: Number(form.low_stock_threshold) || 0,
      cost_per_unit: Number(form.cost_per_unit) || 0,
      supplier: form.supplier.trim() || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = editingId
      ? await supabase.from('inventory_items').update(payload).eq('id', editingId)
      : await supabase.from('inventory_items').insert([payload]);
    setBusy(false);
    if (err) { setError(err.message); return; }
    setDrawerOpen(false);
    await load();
  };

  const submitMove = async () => {
    if (!moveOpen || !moveQty || Number(moveQty) <= 0) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('adjust_inventory', {
      p_inventory_item_id: moveOpen.id,
      p_movement_type: moveType,
      p_qty: Number(moveQty),
      p_notes: moveNotes || null,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setMoveOpen(null);
    setMoveQty('');
    setMoveNotes('');
    await load();
  };

  return (
    <div className="min-h-full">
      <div className="border-b border-border bg-surface/40">
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-ink tracking-tight">Ingredients</h1>
              <p className="text-sm text-ink-muted mt-1">Raw inventory used in recipes. Customers never see this.</p>
            </div>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-gradient shadow-glow-sm hover:brightness-110 transition-all self-start"
            >
              <Plus size={16} /> Add Ingredient
            </button>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <div className="rounded-xl bg-surface border border-border px-4 py-3 min-w-[120px]">
              <p className="text-[11px] text-ink-faint uppercase tracking-wider">Total</p>
              <p className="text-2xl font-semibold text-ink tabular-nums">{items.length}</p>
            </div>
            <div className="rounded-xl bg-surface border border-border px-4 py-3 min-w-[120px]">
              <p className="text-[11px] text-ink-faint uppercase tracking-wider">Low Stock</p>
              <p className={`text-2xl font-semibold tabular-nums ${lowCount ? 'text-warning' : 'text-ink'}`}>{lowCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        {error && (
          <div className="mb-4 flex items-center gap-2 bg-danger-soft border border-danger/20 text-danger text-sm rounded-xl px-4 py-3">
            <AlertTriangle size={16} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')}><X size={14} /></button>
          </div>
        )}

        <div className="relative mb-5 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ingredients…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-border text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_80px_100px_100px_100px_120px_100px] gap-3 px-5 py-3 border-b border-border bg-surface-raised/50 text-[11px] font-medium text-ink-faint uppercase tracking-wider">
            <span>Name</span>
            <span>Unit</span>
            <span className="text-right">Stock</span>
            <span className="text-right">Min</span>
            <span className="text-right">Cost/Unit</span>
            <span>Supplier</span>
            <span className="text-right">Actions</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-ink-faint text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Package size={28} className="mx-auto text-ink-faint mb-3" />
              <p className="text-sm text-ink">No ingredients yet</p>
              <button onClick={openAdd} className="mt-3 text-sm text-accent font-medium">Add your first ingredient</button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((item) => {
                const low = Number(item.current_stock) <= Number(item.low_stock_threshold);
                return (
                  <div key={item.id} className="px-4 sm:px-5 py-3.5 hover:bg-surface-hover/40 transition-colors">
                    <div className="md:hidden space-y-1">
                      <div className="flex justify-between">
                        <p className="font-medium text-ink text-sm">{item.name}</p>
                        {low && <span className="text-[10px] text-warning bg-warning-soft px-1.5 py-0.5 rounded">Low</span>}
                      </div>
                      <p className="text-xs text-ink-faint">
                        {item.current_stock} {item.unit} · min {item.low_stock_threshold} · Rs.{item.cost_per_unit}/{item.unit}
                      </p>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => { setMoveOpen(item); setMoveType('purchase'); }} className="text-xs text-success font-medium">+ Stock</button>
                        <button onClick={() => { setMoveOpen(item); setMoveType('waste'); }} className="text-xs text-danger font-medium">Waste</button>
                        <button onClick={() => openEdit(item)} className="text-xs text-accent font-medium">Edit</button>
                      </div>
                    </div>
                    <div className="hidden md:grid grid-cols-[1fr_80px_100px_100px_100px_120px_100px] gap-3 items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-ink truncate">{item.name}</span>
                        {low && <AlertTriangle size={14} className="text-warning flex-shrink-0" />}
                        {!item.is_active && <span className="text-[10px] text-ink-faint">Inactive</span>}
                      </div>
                      <span className="text-sm text-ink-muted">{item.unit}</span>
                      <span className={`text-sm font-medium text-right tabular-nums ${low ? 'text-warning' : 'text-ink'}`}>
                        {Number(item.current_stock).toLocaleString()}
                      </span>
                      <span className="text-sm text-ink-muted text-right tabular-nums">{item.low_stock_threshold}</span>
                      <span className="text-sm text-ink-muted text-right tabular-nums">Rs.{Number(item.cost_per_unit).toLocaleString()}</span>
                      <span className="text-sm text-ink-faint truncate">{item.supplier || '—'}</span>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => { setMoveOpen(item); setMoveType('purchase'); }}
                          title="Add stock"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-faint hover:text-success hover:bg-success-soft"
                        >
                          <ArrowDownCircle size={15} />
                        </button>
                        <button
                          onClick={() => { setMoveOpen(item); setMoveType('waste'); }}
                          title="Record waste"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-faint hover:text-danger hover:bg-danger-soft"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-faint hover:text-accent hover:bg-accent-soft"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerOpen(false)} />
            <motion.aside
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-surface border-l border-border flex flex-col"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between px-6 h-16 border-b border-border">
                <h2 className="font-semibold text-ink">{editingId ? 'Edit Ingredient' : 'Add Ingredient'}</h2>
                <button onClick={() => setDrawerOpen(false)} className="text-ink-faint hover:text-ink"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className="text-xs text-ink-muted font-medium">Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl bg-bg border border-border text-sm outline-none focus:border-accent" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-ink-muted font-medium">Unit</label>
                    <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl bg-bg border border-border text-sm outline-none focus:border-accent">
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-ink-muted font-medium">Current Stock</label>
                    <input type="number" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl bg-bg border border-border text-sm outline-none focus:border-accent" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-ink-muted font-medium">Min Stock Level</label>
                    <input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl bg-bg border border-border text-sm outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="text-xs text-ink-muted font-medium">Cost / Unit (Rs.)</label>
                    <input type="number" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl bg-bg border border-border text-sm outline-none focus:border-accent" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-ink-muted font-medium">Supplier</label>
                  <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl bg-bg border border-border text-sm outline-none focus:border-accent" />
                </div>
                <label className="flex items-center gap-2 text-sm text-ink-muted">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  Active
                </label>
              </div>
              <div className="px-6 py-4 border-t border-border flex gap-2">
                <button onClick={() => setDrawerOpen(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-ink-muted">Cancel</button>
                <button onClick={save} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl bg-brand-gradient text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  {editingId ? 'Save' : 'Add'}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Movement modal */}
      <AnimatePresence>
        {moveOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70" onClick={() => setMoveOpen(null)} />
            <motion.div className="relative w-full max-w-sm bg-surface border border-border rounded-2xl p-6"
              initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }}>
              <h3 className="font-semibold text-ink mb-1">{moveType === 'waste' ? 'Record Waste' : 'Add Stock'}</h3>
              <p className="text-sm text-ink-muted mb-4">{moveOpen.name} · current {moveOpen.current_stock} {moveOpen.unit}</p>
              <div className="space-y-3">
                {moveType !== 'waste' && (
                  <div>
                    <label className="text-xs text-ink-muted">Type</label>
                    <select value={moveType} onChange={(e) => setMoveType(e.target.value)}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl bg-bg border border-border text-sm">
                      <option value="purchase">Purchase</option>
                      <option value="return">Return</option>
                      <option value="adjustment">Adjustment (+/-)</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs text-ink-muted">Quantity ({moveOpen.unit})</label>
                  <input type="number" value={moveQty} onChange={(e) => setMoveQty(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl bg-bg border border-border text-sm outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-xs text-ink-muted">Notes</label>
                  <input value={moveNotes} onChange={(e) => setMoveNotes(e.target.value)} placeholder={moveType === 'waste' ? 'e.g. Expired' : ''}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl bg-bg border border-border text-sm outline-none focus:border-accent" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setMoveOpen(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-ink-muted">Cancel</button>
                <button onClick={submitMove} disabled={busy}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 ${moveType === 'waste' ? 'bg-danger' : 'bg-brand-gradient'}`}>
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
