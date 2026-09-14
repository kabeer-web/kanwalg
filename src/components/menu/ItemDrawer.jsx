import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Pencil, Trash2, Eye, EyeOff, Loader2, Save, AlertTriangle, Check } from 'lucide-react';
import { iconFor, colorFor } from '../../lib/categoryVisual';
import { getStockStatus, STATUS_META } from '../../lib/stockStatus';

const blank = { name: '', price: '', stock_qty: '', category_id: '' };

// One panel handles all three states instead of three separate
// components: a fresh item opens straight into edit fields (there's
// nothing to "view" yet); an existing item opens read-only with an
// Edit button that swaps the same layout into editable inputs in
// place, so the user never loses their spot in a separate modal.
export default function ItemDrawer({ open, item, categories, onClose, onSave, onDelete, onToggleAvailable, busy }) {
  const isNew = open && !item;
  const [editing, setEditing] = useState(isNew);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setEditing(!item);
    setConfirmingDelete(false);
    setFormError('');
    setForm(item
      ? { name: item.name, price: item.price, stock_qty: item.stock_qty ?? '', category_id: item.category_id || '' }
      : blank);
  }, [open, item]);

  if (!open) return null;

  const categoryName = categories.find((c) => c.id === (item?.category_id))?.name || form.category_id
    ? categories.find((c) => c.id === form.category_id)?.name
    : '—';
  const Icon = iconFor(categoryName || '');
  const color = colorFor(categoryName || '');
  const status = item ? getStockStatus(item.stock_qty) : null;

  const field = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const submit = () => {
    if (!form.name || !form.price || !form.category_id) { setFormError('Name, price and category are required.'); return; }
    onSave(
      { name: form.name, price: Number(form.price), stock_qty: form.stock_qty === '' ? null : Number(form.stock_qty), category_id: form.category_id },
      item?.id
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex justify-end"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />

        <motion.div
          className="relative w-full max-w-md h-full bg-surface border-l border-border flex flex-col"
          initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-5 border-b border-border">
            <span
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${color}1F`, border: `1px solid ${color}40`, color }}
            >
              <Icon size={19} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-display font-semibold text-ink text-base truncate">
                {isNew ? 'New Menu Item' : item.name}
              </p>
              <p className="text-ink-faint text-xs mt-0.5">
                {isNew ? 'Fill in the details below' : (categoryName || '—')}
              </p>
            </div>
            <button onClick={onClose} className="text-ink-faint hover:text-ink transition-colors duration-150 rounded-lg p-1.5 hover:bg-elevated flex-shrink-0">
              <X size={17} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {formError && (
              <div className="flex items-center gap-2 bg-danger-soft border border-danger/30 text-danger text-xs rounded-lg px-3 py-2.5">
                <AlertTriangle size={13} className="flex-shrink-0" />
                {formError}
              </div>
            )}

            {editing ? (
              <>
                <Field label="Item Name">
                  <input value={form.name} onChange={(e) => field('name', e.target.value)} placeholder="e.g. Chicken Karahi" className="input" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Price (PKR)">
                    <input type="number" min="0" value={form.price} onChange={(e) => field('price', e.target.value)} placeholder="0" className="input" />
                  </Field>
                  <Field label="Stock Quantity">
                    <input type="number" min="0" value={form.stock_qty} onChange={(e) => field('stock_qty', e.target.value)} placeholder="Unlimited" className="input" />
                  </Field>
                </div>
                <Field label="Category">
                  <select value={form.category_id} onChange={(e) => field('category_id', e.target.value)} className="input">
                    <option value="">Select…</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              </>
            ) : (
              <>
                <DetailRow label="Price" value={`Rs. ${item.price}`} big />
                <DetailRow label="Stock Quantity" value={item.stock_qty === null ? 'Unlimited' : item.stock_qty} />
                <DetailRow label="Status" value={
                  <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${STATUS_META[status].text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[status].dot}`} />
                    {STATUS_META[status].label}
                  </span>
                } />
                <DetailRow label="Visibility" value={item.is_available ? 'Visible on menu' : 'Hidden from menu'} />
              </>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-5 py-4 border-t border-border">
            {confirmingDelete ? (
              <div className="space-y-2.5">
                <p className="text-sm text-ink-muted">Delete <span className="text-ink font-medium">{item?.name}</span>? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => onDelete(item)} disabled={busy}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-danger text-white font-semibold text-sm hover:brightness-110 transition-colors duration-150 disabled:opacity-50">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Confirm Delete
                  </button>
                  <button onClick={() => setConfirmingDelete(false)}
                    className="px-4 py-2.5 rounded-xl bg-elevated border border-border text-ink-muted font-medium text-sm hover:text-ink transition-colors duration-150">
                    Cancel
                  </button>
                </div>
              </div>
            ) : editing ? (
              <div className="flex gap-2">
                <button onClick={submit} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-gradient text-white font-semibold text-sm disabled:opacity-50 transition-all duration-150 active:scale-[0.98] hover:brightness-110">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {isNew ? 'Add Item' : 'Save Changes'}
                </button>
                <button
                  onClick={() => isNew ? onClose() : setEditing(false)}
                  className="px-4 py-2.5 rounded-xl bg-elevated border border-border text-ink-muted font-medium text-sm hover:text-ink transition-colors duration-150"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-start/15 border border-brand-start/40 text-brand-end font-semibold text-sm hover:brightness-110 transition-colors duration-150">
                  <Pencil size={14} />
                  Edit
                </button>
                <button onClick={() => onToggleAvailable(item)} title={item.is_available ? 'Hide from menu' : 'Show on menu'}
                  className="w-11 h-11 rounded-xl bg-elevated border border-border text-ink-muted hover:text-ink transition-colors duration-150 flex items-center justify-center flex-shrink-0">
                  {item.is_available ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button onClick={() => setConfirmingDelete(true)} title="Delete"
                  className="w-11 h-11 rounded-xl bg-danger-soft text-danger hover:brightness-110 transition-colors duration-150 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-ink-faint mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function DetailRow({ label, value, big }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0">
      <span className="text-ink-faint text-sm">{label}</span>
      <span className={big ? 'text-ink text-lg font-semibold font-ticket' : 'text-ink text-sm font-medium'}>{value}</span>
    </div>
  );
}
