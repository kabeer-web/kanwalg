import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Minus, Plus, CheckCircle2, ShoppingBag, X, MapPin, Phone, User,
  Search, Clock, ChefHat, Star, UtensilsCrossed,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/pricing';

const RESTAURANT = {
  name: 'Kanwal G Restaurant',
  tagline: 'Taste of home. Crafted with love.',
  phone: '+92 300 1234567',
  address: 'Main Boulevard, Lahore',
  hours: '11:00 AM – 11:00 PM · Open daily',
};

export default function CustomerMenu() {
  const [searchParams] = useSearchParams();
  const tableToken = searchParams.get('table');

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [variantsByItem, setVariantsByItem] = useState({}); // menu_item_id -> variants[]
  const [tableInfo, setTableInfo] = useState(undefined);
  const [cart, setCart] = useState([]); // [{key, menu_item_id, variant_id, name, variant_name, price, qty}]
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '' });
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [error, setError] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [orderMode, setOrderMode] = useState('delivery');
  const [sizePicker, setSizePicker] = useState(null); // item when choosing size

  const loadMenu = useCallback(async () => {
    const [{ data: cats }, { data: menuItems }, { data: variants }] = await Promise.all([
      supabase.from('menu_categories').select('*').order('sort_order'),
      supabase.from('menu_items').select('*').eq('is_available', true).order('name'),
      supabase.from('menu_item_variants').select('*').eq('is_available', true).order('sort_order'),
    ]);
    const list = (menuItems || []).filter((i) => !i.archived_at);
    setCategories(cats || []);
    setItems(list);
    const map = {};
    for (const v of variants || []) {
      if (!map[v.menu_item_id]) map[v.menu_item_id] = [];
      map[v.menu_item_id].push(v);
    }
    setVariantsByItem(map);
  }, []);

  useEffect(() => {
    loadMenu();
    if (tableToken) {
      supabase.from('restaurant_tables').select('*').eq('qr_token', tableToken).maybeSingle()
        .then(({ data }) => setTableInfo(data));
    } else setTableInfo(null);
  }, [tableToken, loadMenu]);

  useEffect(() => {
    const ch = supabase
      .channel('kanwal_menu_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => loadMenu())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories' }, () => loadMenu())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_item_variants' }, () => loadMenu())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadMenu]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeCat !== 'all') list = list.filter((i) => i.category_id === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q));
    }
    return list;
  }, [items, activeCat, search]);

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const total = cart.reduce((s, l) => s + Number(l.price) * l.qty, 0);

  const addToCart = (item, variant = null) => {
    const key = variant ? `${item.id}_${variant.id}` : item.id;
    const price = variant ? Number(variant.price) : Number(item.price);
    const name = item.name;
    const variant_name = variant?.name || null;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, {
        key,
        menu_item_id: item.id,
        variant_id: variant?.id || null,
        name,
        variant_name,
        price,
        qty: 1,
      }];
    });
    setSizePicker(null);
  };

  const onAddClick = (item) => {
    const vars = variantsByItem[item.id] || [];
    if (vars.length > 0) {
      setSizePicker({ item, variants: vars });
    } else {
      addToCart(item);
    }
  };

  const setQty = (key, qty) => {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((l) => l.key !== key);
      return prev.map((l) => (l.key === key ? { ...l, qty } : l));
    });
  };

  const placeOrder = async () => {
    setError('');
    if (cart.length === 0) { setError('Add at least one item.'); return; }
    if (tableToken && !tableInfo) { setError('Invalid table QR.'); return; }
    if (!tableToken && (!customer.name?.trim() || !customer.phone?.trim())) {
      setError('Please enter name and phone.'); return;
    }
    if (!tableToken && orderMode === 'delivery' && !customer.address?.trim()) {
      setError('Please enter delivery address.'); return;
    }

    setPlacing(true);
    const payload = {
      p_order_type: tableToken ? 'dine_in' : 'delivery',
      p_table_qr_token: tableToken || null,
      p_customer_name: customer.name || (tableToken ? `Table ${tableInfo?.table_number}` : null),
      p_customer_phone: customer.phone || null,
      p_delivery_address: !tableToken && orderMode === 'delivery' ? customer.address : null,
      p_items: cart.map((l) => ({
        menu_item_id: l.menu_item_id,
        qty: l.qty,
        notes: null,
        variant_id: l.variant_id || null,
      })),
    };
    const { data, error: rpcError } = await supabase.rpc('place_order', payload);
    setPlacing(false);
    if (rpcError) { setError(rpcError.message); return; }
    setPlacedOrder(data);
    setCart([]);
    setCartOpen(false);
  };

  if (tableToken && tableInfo === undefined) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-stone-400">Loading…</div>;
  }
  if (tableToken && tableInfo === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0b] text-center p-6">
        <p className="text-red-400 font-semibold text-lg">Invalid table QR</p>
      </div>
    );
  }

  if (placedOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] p-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl border border-amber-900/40 bg-gradient-to-b from-[#1a1410] to-[#0f0c0a] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-semibold text-amber-50 mb-2">Order received!</h1>
          <p className="text-stone-400 text-sm">
            {tableToken ? `Table ${tableInfo?.table_number} — kitchen is preparing.` : 'We received your order. Staff will confirm shortly.'}
          </p>
          {placedOrder.order_no && <p className="text-amber-400 font-mono font-bold text-xl mt-4">#{placedOrder.order_no}</p>}
          <p className="text-amber-50 font-semibold mt-2 text-lg">{formatMoney(placedOrder.total)}</p>
          <button onClick={() => setPlacedOrder(null)}
            className="mt-8 w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold">
            Order more
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-100">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0a0a0b]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">KG</span>
            </div>
            <div className="min-w-0 hidden xs:block sm:block">
              <p className="font-semibold text-amber-50 text-sm truncate">{RESTAURANT.name}</p>
              <p className="text-[10px] text-stone-500 hidden sm:block">Delivery · Takeaway · Dine-in</p>
            </div>
          </div>
          <button onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 px-3.5 py-2 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold">
            <ShoppingBag size={16} />
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-amber-800 text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/30 via-[#0a0a0b] to-[#0a0a0b]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-14 sm:pb-20 text-center">
          {tableToken && tableInfo && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs font-medium mb-4">
              <MapPin size={12} /> Table {tableInfo.table_number}
            </div>
          )}
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-amber-50" style={{ fontFamily: 'Georgia, serif' }}>
            Kanwal G
            <span className="block text-amber-500 text-2xl sm:text-4xl mt-1 font-normal">Restaurant</span>
          </h1>
          <p className="mt-3 text-stone-400 max-w-md mx-auto text-sm sm:text-base">{RESTAURANT.tagline}</p>
          <a href="#menu" className="inline-block mt-6 px-6 py-3 rounded-full bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold text-sm shadow-lg shadow-amber-900/40">
            View menu & order
          </a>
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-[11px] sm:text-xs text-stone-500">
            <span className="flex items-center gap-1"><Star size={12} className="text-amber-500" /> Fresh daily</span>
            <span className="flex items-center gap-1"><Clock size={12} /> {RESTAURANT.hours}</span>
            <span className="flex items-center gap-1"><MapPin size={12} /> {RESTAURANT.address}</span>
          </div>
        </div>
      </section>

      <section id="menu" className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <p className="text-amber-500 text-[10px] font-semibold uppercase tracking-widest mb-1">Our menu</p>
            <h2 className="text-xl sm:text-2xl font-semibold text-amber-50" style={{ fontFamily: 'Georgia, serif' }}>Order online</h2>
          </div>
          {!tableToken && (
            <div className="flex gap-1 p-1 rounded-full bg-white/5 border border-white/10 w-fit">
              {['delivery', 'takeaway'].map((m) => (
                <button key={m} onClick={() => setOrderMode(m)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize ${orderMode === m ? 'bg-amber-600 text-white' : 'text-stone-400'}`}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative mb-4 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dishes…"
            className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-stone-600 outline-none focus:border-amber-600/50" />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-5 -mx-1 px-1">
          <button onClick={() => setActiveCat('all')}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium border ${activeCat === 'all' ? 'bg-amber-600/20 border-amber-500/40 text-amber-100' : 'bg-white/5 border-white/10 text-stone-400'}`}>
            All
          </button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium border ${activeCat === c.id ? 'bg-amber-600/20 border-amber-500/40 text-amber-100' : 'bg-white/5 border-white/10 text-stone-400'}`}>
              {c.name}
            </button>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-16 rounded-3xl border border-dashed border-white/10">
            <ChefHat size={36} className="mx-auto text-stone-600 mb-3" />
            <p className="text-stone-400 text-sm">Menu loading or empty — add items from dashboard</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredItems.map((item) => {
              const vars = variantsByItem[item.id] || [];
              const catName = categories.find((c) => c.id === item.category_id)?.name;
              const priceLabel = vars.length
                ? `from ${formatMoney(Math.min(...vars.map((v) => Number(v.price))))}`
                : formatMoney(item.price);
              return (
                <article key={item.id}
                  className="rounded-2xl border border-white/8 bg-gradient-to-b from-white/[0.06] to-transparent p-3 sm:p-4 flex gap-3 sm:block">
                  <div className="w-24 h-24 sm:w-full sm:h-36 rounded-xl bg-[#141110] border border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0 sm:mb-3">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <UtensilsCrossed size={24} className="text-stone-700" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    {catName && <p className="text-[10px] uppercase tracking-wider text-amber-600/80 mb-0.5">{catName}</p>}
                    <h3 className="font-semibold text-amber-50 text-sm sm:text-[15px] leading-snug">{item.name}</h3>
                    {item.description && <p className="text-[11px] sm:text-xs text-stone-500 mt-0.5 line-clamp-2">{item.description}</p>}
                    {vars.length > 0 && (
                      <p className="text-[10px] text-stone-500 mt-1">{vars.map((v) => v.name).join(' · ')}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-2 gap-2">
                      <p className="text-amber-400 font-semibold font-mono text-xs sm:text-sm">{priceLabel}</p>
                      <button onClick={() => onAddClick(item)}
                        className="px-3 py-1.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex-shrink-0">
                        {vars.length ? 'Choose size' : 'Add'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-stone-600 px-4">
        <p>© {new Date().getFullYear()} {RESTAURANT.name}</p>
        <p className="mt-1">{RESTAURANT.phone} · {RESTAURANT.address}</p>
      </footer>

      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-0 inset-x-0 z-20 p-3 sm:p-4 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/95 to-transparent pt-10">
          <button onClick={() => setCartOpen(true)}
            className="max-w-6xl mx-auto w-full flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold shadow-xl text-sm">
            <span className="flex items-center gap-2"><ShoppingBag size={18} /> {cartCount} item{cartCount > 1 ? 's' : ''}</span>
            <span className="font-mono">{formatMoney(total)}</span>
          </button>
        </div>
      )}

      {/* Size picker */}
      <AnimatePresence>
        {sizePicker && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSizePicker(null)} />
            <motion.div
              className="fixed bottom-0 inset-x-0 z-50 max-w-md mx-auto bg-[#12100e] border-t border-amber-900/30 rounded-t-3xl p-5"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-amber-50">{sizePicker.item.name}</h3>
                  <p className="text-xs text-stone-500 mt-0.5">Choose size</p>
                </div>
                <button onClick={() => setSizePicker(null)} className="text-stone-400"><X size={20} /></button>
              </div>
              <div className="space-y-2">
                {sizePicker.variants.map((v) => (
                  <button key={v.id} onClick={() => addToCart(sizePicker.item, v)}
                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:border-amber-600/50 hover:bg-amber-600/10 transition text-left">
                    <span className="font-medium text-amber-50">{v.name}</span>
                    <span className="font-mono text-amber-400 text-sm">{formatMoney(v.price)}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cart */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)} />
            <motion.div
              className="fixed bottom-0 inset-x-0 z-50 max-h-[90vh] bg-[#12100e] border-t border-amber-900/30 rounded-t-3xl flex flex-col max-w-lg mx-auto"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h2 className="font-semibold text-amber-50">Your order</h2>
                <button onClick={() => setCartOpen(false)} className="text-stone-400"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {cart.map((l) => (
                  <div key={l.key} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-50 truncate">{l.name}</p>
                      {l.variant_name && <p className="text-[11px] text-amber-600/80">{l.variant_name}</p>}
                      <p className="text-xs text-stone-500 font-mono">{formatMoney(l.price)}</p>
                    </div>
                    <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/10">
                      <button onClick={() => setQty(l.key, l.qty - 1)} className="w-8 h-8 flex items-center justify-center text-stone-300"><Minus size={14} /></button>
                      <span className="text-sm font-semibold w-5 text-center">{l.qty}</span>
                      <button onClick={() => setQty(l.key, l.qty + 1)} className="w-8 h-8 flex items-center justify-center text-stone-300"><Plus size={14} /></button>
                    </div>
                    <p className="text-sm font-medium text-amber-100 w-16 text-right font-mono">{formatMoney(l.price * l.qty)}</p>
                  </div>
                ))}
                {!tableToken && (
                  <div className="pt-4 border-t border-white/5 space-y-3">
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Your details</p>
                    <div className="relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                      <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Full name"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-amber-600/50" />
                    </div>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                      <input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="Phone"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-amber-600/50" />
                    </div>
                    {orderMode === 'delivery' && (
                      <div className="relative">
                        <MapPin size={14} className="absolute left-3 top-3 text-stone-500" />
                        <textarea value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="Delivery address" rows={2}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-amber-600/50 resize-none" />
                      </div>
                    )}
                  </div>
                )}
                {error && <p className="text-red-400 text-sm">{error}</p>}
              </div>
              <div className="px-5 py-4 border-t border-white/5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-400">Total</span>
                  <span className="font-semibold text-amber-50 font-mono">{formatMoney(total)}</span>
                </div>
                <button onClick={placeOrder} disabled={placing || cart.length === 0}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold disabled:opacity-50">
                  {placing ? 'Sending…' : tableToken ? 'Send to kitchen' : 'Place order'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
