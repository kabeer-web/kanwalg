import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Loader2, ChefHat } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function ProductConfigure({ open, item, onClose }) {
  const [variants, setVariants] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipe, setRecipe] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [vName, setVName] = useState('');
  const [vPrice, setVPrice] = useState('');
  const [rIng, setRIng] = useState('');
  const [rQty, setRQty] = useState('');
  const [selectedVariant, setSelectedVariant] = useState(null);

  const load = async () => {
    if (!item) return;
    const [{ data: vars }, { data: ings }, { data: lines }] = await Promise.all([
      supabase.from('menu_item_variants').select('*').eq('menu_item_id', item.id).order('sort_order'),
      supabase.from('inventory_items').select('id,name,unit').eq('is_active', true).order('name'),
      supabase.from('recipe_lines').select('*, inventory_items(name,unit)').eq('menu_item_id', item.id),
    ]);
    setVariants(vars || []);
    setIngredients(ings || []);
    setRecipe(lines || []);
  };

  useEffect(() => {
    if (open && item) {
      setSelectedVariant(null);
      load();
    }
  }, [open, item?.id]);

  const loadVariantRecipe = async (variantId) => {
    setSelectedVariant(variantId);
    if (!variantId) {
      const { data } = await supabase.from('recipe_lines').select('*, inventory_items(name,unit)').eq('menu_item_id', item.id);
      setRecipe(data || []);
      return;
    }
    const { data } = await supabase.from('recipe_lines').select('*, inventory_items(name,unit)').eq('variant_id', variantId);
    setRecipe(data || []);
  };

  const addVariant = async () => {
    if (!vName.trim() || !vPrice) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.from('menu_item_variants').insert([{
      menu_item_id: item.id,
      name: vName.trim(),
      price: Number(vPrice),
      sort_order: variants.length,
    }]);
    if (!err) {
      await supabase.from('menu_items').update({ has_variants: true }).eq('id', item.id);
      setVName(''); setVPrice('');
      await load();
    } else setError(err.message);
    setBusy(false);
  };

  const deleteVariant = async (id) => {
    setBusy(true);
    await supabase.from('menu_item_variants').delete().eq('id', id);
    await load();
    if (selectedVariant === id) loadVariantRecipe(null);
    setBusy(false);
  };

  const addRecipeLine = async () => {
    if (!rIng || !rQty || Number(rQty) <= 0) return;
    setBusy(true);
    setError('');
    const payload = {
      ingredient_id: rIng,
      qty: Number(rQty),
      menu_item_id: selectedVariant ? null : item.id,
      variant_id: selectedVariant || null,
      modifier_id: null,
    };
    const { error: err } = await supabase.from('recipe_lines').insert([payload]);
    if (err) setError(err.message);
    else {
      setRIng(''); setRQty('');
      await loadVariantRecipe(selectedVariant);
    }
    setBusy(false);
  };

  const deleteRecipeLine = async (id) => {
    setBusy(true);
    await supabase.from('recipe_lines').delete().eq('id', id);
    await loadVariantRecipe(selectedVariant);
    setBusy(false);
  };

  if (!item) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-surface border-l border-border flex flex-col"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between px-6 h-16 border-b border-border">
              <div>
                <h2 className="font-semibold text-ink flex items-center gap-2"><ChefHat size={18} className="text-accent" /> Configure Product</h2>
                <p className="text-xs text-ink-faint">{item.name}</p>
              </div>
              <button onClick={onClose} className="text-ink-faint hover:text-ink"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {error && <p className="text-danger text-sm">{error}</p>}

              <section>
                <h3 className="text-sm font-semibold text-ink mb-3">Sizes / Variants</h3>
                <div className="space-y-2 mb-3">
                  {variants.map((v) => (
                    <div key={v.id} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${selectedVariant === v.id ? 'border-accent bg-accent/10' : 'border-border'}`}>
                      <button onClick={() => loadVariantRecipe(v.id)} className="text-left flex-1">
                        <span className="text-sm font-medium text-ink">{v.name}</span>
                        <span className="text-xs text-ink-muted ml-2">Rs. {Number(v.price).toLocaleString()}</span>
                      </button>
                      <button onClick={() => deleteVariant(v.id)} className="text-ink-faint hover:text-danger p-1"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {variants.length === 0 && <p className="text-xs text-ink-faint">No variants — uses base price. Add Small/Medium/Large if needed.</p>}
                </div>
                <div className="flex gap-2">
                  <input value={vName} onChange={(e) => setVName(e.target.value)} placeholder="Name (e.g. Large)"
                    className="flex-1 px-3 py-2 rounded-xl bg-bg border border-border text-sm outline-none focus:border-accent" />
                  <input type="number" value={vPrice} onChange={(e) => setVPrice(e.target.value)} placeholder="Price"
                    className="w-24 px-3 py-2 rounded-xl bg-bg border border-border text-sm outline-none focus:border-accent" />
                  <button onClick={addVariant} disabled={busy} className="px-3 py-2 rounded-xl bg-accent/15 text-accent text-sm font-medium hover:bg-accent/25">
                    <Plus size={16} />
                  </button>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-ink">Recipe / BOM</h3>
                  <button onClick={() => loadVariantRecipe(null)} className={`text-xs px-2 py-1 rounded-lg ${!selectedVariant ? 'bg-accent/15 text-accent' : 'text-ink-faint'}`}>
                    Product-level
                  </button>
                </div>
                {selectedVariant && (
                  <p className="text-xs text-accent mb-2">Recipe for: {variants.find((v) => v.id === selectedVariant)?.name}</p>
                )}
                <div className="space-y-1.5 mb-3">
                  {recipe.map((line) => (
                    <div key={line.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-bg border border-border text-sm">
                      <span className="text-ink">{line.inventory_items?.name || 'Ingredient'}</span>
                      <span className="text-ink-muted tabular-nums">{line.qty} {line.inventory_items?.unit}</span>
                      <button onClick={() => deleteRecipeLine(line.id)} className="text-ink-faint hover:text-danger ml-2"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {recipe.length === 0 && <p className="text-xs text-ink-faint">No recipe lines yet.</p>}
                </div>
                <div className="flex gap-2">
                  <select value={rIng} onChange={(e) => setRIng(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-bg border border-border text-sm outline-none focus:border-accent">
                    <option value="">Ingredient…</option>
                    {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                  </select>
                  <input type="number" value={rQty} onChange={(e) => setRQty(e.target.value)} placeholder="Qty"
                    className="w-20 px-3 py-2 rounded-xl bg-bg border border-border text-sm outline-none focus:border-accent" />
                  <button onClick={addRecipeLine} disabled={busy} className="px-3 py-2 rounded-xl bg-accent/15 text-accent text-sm font-medium">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  </button>
                </div>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
