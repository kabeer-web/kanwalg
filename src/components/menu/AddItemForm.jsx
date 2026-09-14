import { Loader2, Plus, Save } from 'lucide-react';

export default function AddItemForm({ categories, form, setForm, editingId, onSave, onCancel, busy }) {
  const field = (key, patch) => setForm({ ...form, [key]: patch });

  return (
    <section className="bg-surface border border-border rounded-2xl p-5">
      <h2 className="font-display font-semibold text-ink text-[15px] mb-4">
        {editingId ? 'Edit Item' : 'Add Menu Item'}
      </h2>

      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-ink-faint mb-1.5 block">Item Name</label>
          <input
            value={form.name}
            onChange={(e) => field('name', e.target.value)}
            placeholder="e.g. Chicken Karahi"
            className="w-full p-2.5 rounded-lg bg-surface-raised border border-border outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors duration-150 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-ink-faint mb-1.5 block">Price (PKR)</label>
          <input
            type="number" min="0"
            value={form.price}
            onChange={(e) => field('price', e.target.value)}
            placeholder="0"
            className="w-full p-2.5 rounded-lg bg-surface-raised border border-border outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors duration-150 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-ink-faint mb-1.5 block">Stock Quantity</label>
          <input
            type="number" min="0"
            value={form.stock_qty}
            onChange={(e) => field('stock_qty', e.target.value)}
            placeholder="Blank = unlimited"
            className="w-full p-2.5 rounded-lg bg-surface-raised border border-border outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors duration-150 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-ink-faint mb-1.5 block">Category</label>
          <select
            value={form.category_id}
            onChange={(e) => field('category_id', e.target.value)}
            className="w-full p-2.5 rounded-lg bg-surface-raised border border-border outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors duration-150 text-sm"
          >
            <option value="">Select…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={onSave}
          disabled={busy}
          className="px-5 py-2.5 rounded-xl bg-brand-gradient text-white font-semibold text-sm disabled:opacity-50 flex items-center gap-2 transition-transform duration-150 active:scale-[0.98] hover:brightness-110"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : editingId ? <Save size={14} /> : <Plus size={14} />}
          {editingId ? 'Save Changes' : 'Add Item'}
        </button>
        {editingId && (
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl bg-surface-raised border border-border text-ink-muted font-medium text-sm hover:text-ink transition-colors duration-150"
          >
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}
