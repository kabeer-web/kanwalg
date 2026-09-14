import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, X, Loader2, AlertCircle,
  Search, Package, AlertTriangle, Ban, Infinity, Filter,
  Coffee, Utensils, Cookie, IceCream, LayoutGrid, ChevronRight, Check,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProductConfigure from '../components/menu/ProductConfigure';

const emptyForm = { name: '', price: '', stock_qty: '', category_id: '' };

const CATEGORY_ICONS = {
  default: LayoutGrid,
  beverage: Coffee,
  drink: Coffee,
  beer: Coffee,
  meal: Utensils,
  food: Utensils,
  main: Utensils,
  snack: Cookie,
  side: Cookie,
  dessert: IceCream,
  sweet: IceCream,
};

function getCategoryIcon(name = '') {
  const lower = name.toLowerCase();
  for (const [key, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (key !== 'default' && lower.includes(key)) return Icon;
  }
  return CATEGORY_ICONS.default;
}

function getStockStatus(item) {
  if (item.stock_qty === null || item.stock_qty === undefined) {
    return { key: 'unlimited', label: 'Unlimited', color: 'text-ink-muted', bg: 'bg-surface-hover', dot: 'bg-ink-faint' };
  }
  const qty = Number(item.stock_qty);
  if (qty <= 0) {
    return { key: 'out', label: 'Out of Stock', color: 'text-danger', bg: 'bg-danger-soft', dot: 'bg-danger' };
  }
  if (qty <= 5) {
    return { key: 'low', label: 'Low Stock', color: 'text-warning', bg: 'bg-warning-soft', dot: 'bg-warning' };
  }
  return { key: 'in', label: 'In Stock', color: 'text-success', bg: 'bg-success-soft', dot: 'bg-success' };
}

function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel, busy }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
          <motion.div
            className="relative w-full max-w-sm bg-surface border border-border rounded-2xl shadow-elevated overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="p-6">
              <div className="w-11 h-11 rounded-xl bg-danger-soft flex items-center justify-center mb-4">
                <Trash2 size={20} className="text-danger" />
              </div>
              <h3 className="text-base font-semibold text-ink mb-1.5">{title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{message}</p>
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={onCancel}
                disabled={busy}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-ink-muted bg-surface-raised border border-border hover:bg-surface-hover hover:text-ink transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={busy}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-danger hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ItemDrawer({ open, onClose, form, setForm, categories, onSave, busy, isEdit }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-surface border-l border-border shadow-elevated flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between px-6 h-16 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-ink">{isEdit ? 'Edit Item' : 'Add Menu Item'}</h2>
                <p className="text-xs text-ink-faint mt-0.5">
                  {isEdit ? 'Update details and stock levels' : 'Create a new item for your menu'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-faint hover:text-ink hover:bg-surface-hover transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Item Name</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Chicken Biryani"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-border text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all placeholder:text-ink-faint"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">Price (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-border text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all placeholder:text-ink-faint"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    Stock Qty
                    <span className="text-ink-faint font-normal ml-1">(blank = ∞)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.stock_qty}
                    onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-border text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all placeholder:text-ink-faint"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Category</label>
                <div className="relative">
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-bg border border-border text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
                  >
                    <option value="">Select category…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-ink-faint pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 flex-shrink-0">
              <button
                onClick={onClose}
                disabled={busy}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-ink-muted bg-surface-raised border border-border hover:bg-surface-hover hover:text-ink transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={busy}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-gradient hover:brightness-110 shadow-glow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {isEdit ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function ViewItemPanel({ open, item, categories, onClose, onEdit, onToggle, onDelete }) {
  if (!item) return null;
  const status = getStockStatus(item);
  const catName = categories.find((c) => c.id === item.category_id)?.name || 'Uncategorized';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-surface border-l border-border shadow-elevated flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between px-6 h-16 border-b border-border">
              <h2 className="text-base font-semibold text-ink">Item Details</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-faint hover:text-ink hover:bg-surface-hover transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-surface-raised border border-border flex items-center justify-center flex-shrink-0">
                  <Package size={24} className="text-ink-muted" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-ink leading-tight">{item.name}</h3>
                  <p className="text-sm text-ink-muted mt-1">{catName}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-sm text-ink-muted">Price</span>
                  <span className="text-sm font-semibold text-ink font-ticket">Rs. {Number(item.price).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-sm text-ink-muted">Stock</span>
                  <span className={`text-sm font-medium ${status.color}`}>
                    {item.stock_qty === null ? 'Unlimited' : item.stock_qty}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-sm text-ink-muted">Status</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${status.bg} ${status.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-sm text-ink-muted">Visibility</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                    item.is_available ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
                  }`}>
                    {item.is_available ? <Eye size={12} /> : <EyeOff size={12} />}
                    {item.is_available ? 'Visible on menu' : 'Hidden'}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2">
              <button
                onClick={() => onToggle(item)}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-muted bg-surface-raised border border-border hover:bg-surface-hover hover:text-ink transition-colors flex items-center justify-center gap-1.5"
              >
                {item.is_available ? <EyeOff size={14} /> : <Eye size={14} />}
                {item.is_available ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={() => onEdit(item)}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium text-accent bg-accent-soft hover:brightness-110 transition-all flex items-center justify-center gap-1.5"
              >
                <Pencil size={14} />
                Edit
              </button>
              <button
                onClick={() => onDelete(item)}
                className="px-3 py-2.5 rounded-xl text-sm font-medium text-danger bg-danger-soft hover:brightness-110 transition-all flex items-center justify-center"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default function MenuManagement() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [newCat, setNewCat] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [configureItem, setConfigureItem] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [showAddCat, setShowAddCat] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: cats, error: catErr }, { data: menuItems, error: itemErr }] = await Promise.all([
      supabase.from('menu_categories').select('*').order('sort_order'),
      supabase.from('menu_items').select('*').order('name'),
    ]);
    if (catErr) setError(catErr.message);
    else if (itemErr) setError(itemErr.message);
    setCategories(cats || []);
    setItems(menuItems || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const run = async (fn) => {
    setError('');
    setBusy(true);
    const { error: opError } = await fn();
    setBusy(false);
    if (opError) { setError(opError.message); return false; }
    await load();
    return true;
  };

  const addCategory = () => {
    if (!newCat.trim()) return;
    run(() => supabase.from('menu_categories').insert([{ name: newCat.trim(), sort_order: categories.length }]))
      .then((ok) => { if (ok) { setNewCat(''); setShowAddCat(false); } });
  };

  const saveItem = () => {
    if (!form.name || !form.price || !form.category_id) {
      setError('Name, price and category are required.');
      return;
    }
    const payload = {
      name: form.name,
      price: Number(form.price),
      stock_qty: form.stock_qty === '' ? null : Number(form.stock_qty),
      category_id: form.category_id,
    };
    run(() =>
      editingId
        ? supabase.from('menu_items').update(payload).eq('id', editingId)
        : supabase.from('menu_items').insert([payload])
    ).then((ok) => {
      if (ok) {
        setForm(emptyForm);
        setEditingId(null);
        setDrawerOpen(false);
      }
    });
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setDrawerOpen(true);
  };

  const openEdit = (item) => {
    setForm({
      name: item.name,
      price: item.price,
      stock_qty: item.stock_qty ?? '',
      category_id: item.category_id || '',
    });
    setEditingId(item.id);
    setError('');
    setViewItem(null);
    setDrawerOpen(true);
  };

  const confirmDelete = (item) => {
    setDeleteTarget(item);
    setViewItem(null);
  };

  const doDelete = () => {
    if (!deleteTarget) return;
    run(() => supabase.from('menu_items').delete().eq('id', deleteTarget.id))
      .then((ok) => { if (ok) setDeleteTarget(null); });
  };

  const toggleAvailable = (item) => {
    run(() => supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id))
      .then(() => {
        if (viewItem?.id === item.id) {
          setViewItem((prev) => prev ? { ...prev, is_available: !prev.is_available } : null);
        }
      });
  };

  const stats = useMemo(() => {
    const total = items.length;
    let low = 0, out = 0, unlimited = 0;
    items.forEach((i) => {
      if (i.stock_qty === null || i.stock_qty === undefined) unlimited += 1;
      else if (Number(i.stock_qty) <= 0) out += 1;
      else if (Number(i.stock_qty) <= 5) low += 1;
    });
    return { total, low, out, unlimited };
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (activeCategory !== 'all') {
      list = list.filter((i) => i.category_id === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (stockFilter !== 'all') {
      list = list.filter((i) => getStockStatus(i).key === stockFilter);
    }
    return list;
  }, [items, activeCategory, search, stockFilter]);

  const categoryCounts = useMemo(() => {
    const map = {};
    items.forEach((i) => {
      const key = i.category_id || 'none';
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [items]);

  return (
    <div className="min-h-full">
      <div className="border-b border-border bg-surface/40">
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-ink tracking-tight">Menu & Stock</h1>
              <p className="text-sm text-ink-muted mt-1 max-w-lg">
                Manage your menu items, categories, pricing and real-time inventory levels.
              </p>
            </div>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-gradient shadow-glow-sm hover:brightness-110 transition-all active:scale-[0.98] self-start sm:self-auto"
            >
              <Plus size={16} strokeWidth={2.5} />
              Add Item
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Items', value: stats.total, icon: Package, accent: 'text-ink' },
              { label: 'Low Stock', value: stats.low, icon: AlertTriangle, accent: 'text-warning' },
              { label: 'Out of Stock', value: stats.out, icon: Ban, accent: 'text-danger' },
              { label: 'Unlimited', value: stats.unlimited, icon: Infinity, accent: 'text-ink-muted' },
            ].map(({ label, value, icon: Icon, accent }) => (
              <div
                key={label}
                className="relative overflow-hidden rounded-xl bg-surface border border-border px-4 py-3.5 group hover:border-border-strong transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-ink-faint uppercase tracking-wider">{label}</p>
                    <p className={`text-2xl font-semibold mt-0.5 tabular-nums ${accent}`}>{value}</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-surface-raised border border-border flex items-center justify-center">
                    <Icon size={16} className={accent} strokeWidth={1.75} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-start gap-2.5 bg-danger-soft border border-danger/20 text-danger text-sm rounded-xl px-4 py-3"
          >
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="text-danger/60 hover:text-danger">
              <X size={14} />
            </button>
          </motion.div>
        )}

        <div className="mb-5">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all border ${
                activeCategory === 'all'
                  ? 'bg-accent/10 border-accent/30 text-ink'
                  : 'bg-surface border-border text-ink-muted hover:text-ink hover:border-border-strong'
              }`}
            >
              <LayoutGrid size={15} className={activeCategory === 'all' ? 'text-accent' : 'text-ink-faint'} />
              All Items
              <span className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded-md ${
                activeCategory === 'all' ? 'bg-accent/20 text-accent' : 'bg-surface-hover text-ink-faint'
              }`}>
                {items.length}
              </span>
            </button>

            {categories.map((cat) => {
              const Icon = getCategoryIcon(cat.name);
              const count = categoryCounts[cat.id] || 0;
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all border ${
                    active
                      ? 'bg-accent/10 border-accent/30 text-ink'
                      : 'bg-surface border-border text-ink-muted hover:text-ink hover:border-border-strong'
                  }`}
                >
                  <Icon size={15} className={active ? 'text-accent' : 'text-ink-faint'} />
                  {cat.name}
                  <span className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded-md ${
                    active ? 'bg-accent/20 text-accent' : 'bg-surface-hover text-ink-faint'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}

            <AnimatePresence mode="wait">
              {showAddCat ? (
                <motion.div
                  key="input"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex-shrink-0 flex items-center gap-1.5"
                >
                  <input
                    autoFocus
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addCategory();
                      if (e.key === 'Escape') { setShowAddCat(false); setNewCat(''); }
                    }}
                    placeholder="Category name"
                    className="w-36 px-3 py-2 rounded-xl bg-bg border border-border text-[13px] text-ink outline-none focus:border-accent transition-colors"
                  />
                  <button
                    onClick={addCategory}
                    disabled={busy || !newCat.trim()}
                    className="w-8 h-8 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 flex items-center justify-center transition-colors disabled:opacity-40"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onClick={() => { setShowAddCat(false); setNewCat(''); }}
                    className="w-8 h-8 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-hover flex items-center justify-center transition-colors"
                  >
                    <X size={15} />
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setShowAddCat(true)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium text-ink-faint border border-dashed border-border hover:border-accent/40 hover:text-accent transition-all"
                >
                  <Plus size={14} />
                  Add Category
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items by name…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all placeholder:text-ink-faint"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                stockFilter !== 'all'
                  ? 'bg-accent/10 border-accent/30 text-ink'
                  : 'bg-surface border-border text-ink-muted hover:text-ink hover:border-border-strong'
              }`}
            >
              <Filter size={15} className={stockFilter !== 'all' ? 'text-accent' : 'text-ink-faint'} />
              {stockFilter === 'all' ? 'Stock Status' : (
                stockFilter === 'unlimited' ? 'Unlimited' :
                stockFilter === 'out' ? 'Out of Stock' :
                stockFilter === 'low' ? 'Low Stock' : 'In Stock'
              )}
              {stockFilter !== 'all' && (
                <span
                  onClick={(e) => { e.stopPropagation(); setStockFilter('all'); }}
                  className="ml-0.5 w-4 h-4 rounded-full bg-accent/20 text-accent flex items-center justify-center"
                >
                  <X size={10} />
                </span>
              )}
            </button>

            <AnimatePresence>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setFilterOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1.5 z-40 w-48 bg-surface border border-border rounded-xl shadow-elevated overflow-hidden py-1"
                  >
                    {[
                      { key: 'all', label: 'All Statuses' },
                      { key: 'in', label: 'In Stock' },
                      { key: 'low', label: 'Low Stock' },
                      { key: 'out', label: 'Out of Stock' },
                      { key: 'unlimited', label: 'Unlimited' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => { setStockFilter(key); setFilterOpen(false); }}
                        className={`w-full text-left px-3.5 py-2 text-[13px] transition-colors flex items-center justify-between ${
                          stockFilter === key
                            ? 'bg-accent/10 text-ink font-medium'
                            : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
                        }`}
                      >
                        {label}
                        {stockFilter === key && <Check size={14} className="text-accent" />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_120px_100px_120px_100px_110px] gap-4 px-5 py-3 border-b border-border bg-surface-raised/50 text-[11px] font-medium text-ink-faint uppercase tracking-wider">
            <span>Item</span>
            <span>Category</span>
            <span className="text-right">Price</span>
            <span className="text-right">Stock</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-surface-raised animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-40 bg-surface-raised rounded animate-pulse" />
                    <div className="h-3 w-24 bg-surface-raised rounded animate-pulse" />
                  </div>
                  <div className="h-3.5 w-16 bg-surface-raised rounded animate-pulse hidden md:block" />
                  <div className="h-3.5 w-12 bg-surface-raised rounded animate-pulse hidden md:block" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface-raised border border-border flex items-center justify-center mx-auto mb-4">
                <Package size={24} className="text-ink-faint" />
              </div>
              <p className="text-sm font-medium text-ink mb-1">
                {search || stockFilter !== 'all' || activeCategory !== 'all'
                  ? 'No matching items'
                  : 'No menu items yet'}
              </p>
              <p className="text-xs text-ink-faint mb-5">
                {search || stockFilter !== 'all' || activeCategory !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Add your first item to get started'}
              </p>
              {!search && stockFilter === 'all' && activeCategory === 'all' && (
                <button
                  onClick={openAdd}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-accent bg-accent-soft hover:brightness-110 transition-all"
                >
                  <Plus size={14} />
                  Add Item
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              <div className="divide-y divide-border">
                {filtered.map((item) => {
                  const status = getStockStatus(item);
                  const catName = categories.find((c) => c.id === item.category_id)?.name || '—';
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="group px-4 sm:px-5 py-3.5 hover:bg-surface-hover/40 transition-colors cursor-pointer"
                      onClick={() => setViewItem(item)}
                    >
                      <div className="md:hidden flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border flex items-center justify-center flex-shrink-0">
                          <Package size={16} className="text-ink-muted" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-ink truncate">{item.name}</p>
                            {!item.is_available && (
                              <span className="text-[10px] font-medium text-danger bg-danger-soft px-1.5 py-0.5 rounded">Hidden</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-faint">
                            <span>{catName}</span>
                            <span>·</span>
                            <span className="font-ticket">Rs. {Number(item.price).toLocaleString()}</span>
                            <span>·</span>
                            <span className={status.color}>{status.label}</span>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-ink-faint flex-shrink-0" />
                      </div>

                      <div className="hidden md:grid grid-cols-[1fr_120px_100px_120px_100px_110px] gap-4 items-center">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-surface-raised border border-border flex items-center justify-center flex-shrink-0">
                            <Package size={15} className="text-ink-muted" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink truncate">
                              {item.name}
                              {!item.is_available && (
                                <span className="ml-2 text-[10px] font-medium text-danger bg-danger-soft px-1.5 py-0.5 rounded align-middle">Hidden</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm text-ink-muted truncate">{catName}</span>
                        <span className="text-sm font-medium text-ink font-ticket text-right">
                          Rs. {Number(item.price).toLocaleString()}
                        </span>
                        <span className={`text-sm font-medium text-right tabular-nums ${status.color}`}>
                          {item.stock_qty === null ? '∞' : item.stock_qty}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium w-fit ${status.bg} ${status.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleAvailable(item)}
                            title={item.is_available ? 'Hide from menu' : 'Show on menu'}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-faint hover:text-ink hover:bg-surface-raised transition-colors"
                          >
                            {item.is_available ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button
                            onClick={() => setConfigureItem(item)}
                            title="Variants & Recipe"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-faint hover:text-accent hover:bg-accent-soft transition-colors text-[10px] font-bold"
                          >
                            BOM
                          </button>
                          <button
                            onClick={() => openEdit(item)}
                            title="Edit"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-faint hover:text-accent hover:bg-accent-soft transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => confirmDelete(item)}
                            title="Delete"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-faint hover:text-danger hover:bg-danger-soft transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <p className="mt-3 text-xs text-ink-faint text-center">
            Showing {filtered.length} of {items.length} items
          </p>
        )}
      </div>

      <ItemDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingId(null); setForm(emptyForm); }}
        form={form}
        setForm={setForm}
        categories={categories}
        onSave={saveItem}
        busy={busy}
        isEdit={!!editingId}
      />

      <ViewItemPanel
        open={!!viewItem}
        item={viewItem}
        categories={categories}
        onClose={() => setViewItem(null)}
        onEdit={openEdit}
        onToggle={toggleAvailable}
        onDelete={confirmDelete}
      />

      <ProductConfigure
        open={!!configureItem}
        item={configureItem}
        onClose={() => setConfigureItem(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete item?"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" will be permanently removed from your menu. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Item"
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
}
