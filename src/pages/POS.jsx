import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Minus, Trash2, Pause, PlayCircle, Users, ShoppingBag,
  StickyNote, X, Loader2, PackageX,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCartStore } from '../stores/cartStore';
import { useOrders } from '../context/OrdersContext';
import { useShift } from '../context/ShiftContext';
import { computeOrderTotals, formatMoney } from '../lib/pricing';
import PaymentModal from '../components/pos/PaymentModal';
import Modal from '../components/ui/Modal';

export default function POS() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [notesFor, setNotesFor] = useState(null); // lineId currently editing notes
  const [tablePicker, setTablePicker] = useState(false);
  const [heldPicker, setHeldPicker] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [activeOrder, setActiveOrder] = useState(null); // order just created, awaiting payment
  const searchRef = useRef(null);

  const { tables } = useOrders();
  const { shift } = useShift();

  const cart = useCartStore();
  const {
    orderType, tableId, tableLabel, lines, discountAmount, taxRate, serviceChargeRate, heldOrders,
    setOrderType, setTable, addItem, incrementLine, decrementLine, removeLine, setLineNotes,
    setDiscountAmount, setTaxRate, setServiceChargeRate, clearCart, holdOrder, resumeOrder, discardHeldOrder,
  } = cart;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: cats }, { data: menuItems }] = await Promise.all([
        supabase.from('menu_categories').select('*').order('sort_order'),
        supabase.from('menu_items').select('*').eq('is_available', true).order('name'),
      ]);
      setCategories(cats || []);
      setItems(menuItems || []);
      setActiveCategory(cats?.[0]?.id ?? null);
      setLoading(false);
    })();
  }, []);

  // Keyboard shortcuts: F3 hold, F5 pay, ESC close modals
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F3') { e.preventDefault(); if (lines.length) holdOrder(); }
      if (e.key === 'F5') { e.preventDefault(); if (lines.length && !activeOrder) handlePay(); }
      if (e.key === 'Escape') { setNotesFor(null); setTablePicker(false); setHeldPicker(false); }
      if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, activeOrder]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeCategory) list = list.filter((i) => i.category_id === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = items.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list;
  }, [items, activeCategory, search]);

  const totals = useMemo(
    () => computeOrderTotals({ lines, discountAmount, taxRate, serviceChargeRate }),
    [lines, discountAmount, taxRate, serviceChargeRate]
  );

  const availableTables = tables;

  const handlePay = useCallback(async () => {
    setPlaceError('');
    if (lines.length === 0) return;
    if (orderType === 'dine_in' && !tableId) { setTablePicker(true); return; }
    setPlacing(true);
    const { data, error } = await supabase.rpc('staff_place_order', {
      p_order_type: orderType,
      p_table_id: orderType === 'dine_in' ? tableId : null,
      p_items: lines.map((l) => ({ menu_item_id: l.menuItemId, qty: l.qty, notes: l.notes || null })),
      p_discount_amount: totals.discount,
      p_tax_amount: totals.tax,
      p_service_charge_amount: totals.serviceCharge,
      p_shift_id: shift?.id ?? null,
    });
    setPlacing(false);
    if (error) { setPlaceError(error.message); return; }
    setActiveOrder(data);
    clearCart();
  }, [lines, orderType, tableId, totals, shift, clearCart]);

  return (
    <div className="h-full flex">
      {/* Menu browser */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        <div className="p-4 border-b border-border space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu…  (F1)"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface-raised border border-border text-sm text-ink outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveCategory(c.id); setSearch(''); }}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  activeCategory === c.id && !search
                    ? 'bg-brand-gradient text-white border-transparent'
                    : 'bg-surface-raised text-ink-muted border-border hover:text-ink'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-surface-raised animate-pulse" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-ink-faint gap-2">
              <PackageX size={28} />
              <p className="text-sm">No items here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map((item) => {
                const outOfStock = item.stock_qty != null && item.stock_qty <= 0;
                return (
                  <motion.button
                    key={item.id}
                    whileTap={{ scale: outOfStock ? 1 : 0.96 }}
                    onClick={() => !outOfStock && addItem(item)}
                    disabled={outOfStock}
                    className={`relative text-left rounded-xl border p-3.5 transition-colors ${
                      outOfStock
                        ? 'bg-surface-raised/50 border-border opacity-50 cursor-not-allowed'
                        : 'bg-surface-raised border-border hover:border-accent hover:bg-surface-hover'
                    }`}
                  >
                    <p className="font-semibold text-ink text-sm leading-snug">{item.name}</p>
                    <p className="text-brand-end font-ticket font-bold mt-1.5">{formatMoney(item.price)}</p>
                    {item.stock_qty != null && item.stock_qty > 0 && item.stock_qty <= 5 && (
                      <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning-soft text-warning">
                        {item.stock_qty} left
                      </span>
                    )}
                    {outOfStock && (
                      <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-danger-soft text-danger">
                        Sold out
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-[380px] flex-shrink-0 flex flex-col bg-surface">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-ink">Current Order</h2>
            {heldOrders.length > 0 && (
              <button
                onClick={() => setHeldPicker(true)}
                className="flex items-center gap-1 text-xs font-semibold text-warning bg-warning-soft px-2.5 py-1 rounded-full"
              >
                <Pause size={12} /> {heldOrders.length} held
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setOrderType('takeaway')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border transition-colors ${
                orderType === 'takeaway' ? 'bg-accent-soft border-accent text-ink' : 'border-border text-ink-muted'
              }`}
            >
              <ShoppingBag size={13} /> Takeaway
            </button>
            <button
              onClick={() => setTablePicker(true)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border transition-colors ${
                orderType === 'dine_in' ? 'bg-accent-soft border-accent text-ink' : 'border-border text-ink-muted'
              }`}
            >
              <Users size={13} /> {orderType === 'dine_in' && tableLabel ? `Table ${tableLabel}` : 'Dine-In'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {lines.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-ink-faint gap-2 text-center">
              <ShoppingBag size={26} />
              <p className="text-sm">Tap a menu item to start an order.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.div
                  key={l.lineId}
                  layout
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="py-3 border-b border-border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-ink text-sm truncate">{l.name}</p>
                      <p className="text-ink-faint text-xs font-ticket">{formatMoney(l.price)} each</p>
                      {l.notes && <p className="text-accent text-xs mt-0.5 italic truncate">"{l.notes}"</p>}
                    </div>
                    <p className="font-ticket font-bold text-ink text-sm flex-shrink-0">{formatMoney(l.price * l.qty)}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1 bg-surface-raised rounded-lg border border-border">
                      <button onClick={() => decrementLine(l.lineId)} className="w-7 h-7 flex items-center justify-center text-ink-muted hover:text-ink">
                        <Minus size={13} />
                      </button>
                      <motion.span key={l.qty} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="w-6 text-center text-sm font-bold text-ink">
                        {l.qty}
                      </motion.span>
                      <button onClick={() => incrementLine(l.lineId)} className="w-7 h-7 flex items-center justify-center text-ink-muted hover:text-ink">
                        <Plus size={13} />
                      </button>
                    </div>
                    <button
                      onClick={() => setNotesFor(l.lineId)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-faint hover:text-accent hover:bg-surface-raised"
                    >
                      <StickyNote size={14} />
                    </button>
                    <button
                      onClick={() => removeLine(l.lineId)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-faint hover:text-danger hover:bg-danger-soft ml-auto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Discount / tax / service charge */}
        <div className="px-4 py-3 border-t border-border grid grid-cols-3 gap-2">
          <label className="block">
            <span className="text-[10px] font-semibold text-ink-faint uppercase">Discount Rs.</span>
            <input type="number" min="0" value={discountAmount || ''} onChange={(e) => setDiscountAmount(e.target.value)}
              placeholder="0" className="w-full mt-1 px-2 py-1.5 rounded-lg bg-surface-raised border border-border text-xs font-ticket text-ink outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold text-ink-faint uppercase">Tax %</span>
            <input type="number" min="0" value={taxRate || ''} onChange={(e) => setTaxRate(e.target.value)}
              placeholder="0" className="w-full mt-1 px-2 py-1.5 rounded-lg bg-surface-raised border border-border text-xs font-ticket text-ink outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold text-ink-faint uppercase">Service %</span>
            <input type="number" min="0" value={serviceChargeRate || ''} onChange={(e) => setServiceChargeRate(e.target.value)}
              placeholder="0" className="w-full mt-1 px-2 py-1.5 rounded-lg bg-surface-raised border border-border text-xs font-ticket text-ink outline-none focus:border-accent" />
          </label>
        </div>

        {/* Totals */}
        <div className="px-4 py-3 space-y-1.5 border-t border-border ticket-edge">
          <Row label="Subtotal" value={totals.subtotal} />
          {totals.discount > 0 && <Row label="Discount" value={-totals.discount} tone="success" />}
          {totals.tax > 0 && <Row label="Tax" value={totals.tax} />}
          {totals.serviceCharge > 0 && <Row label="Service Charge" value={totals.serviceCharge} />}
          <div className="flex items-center justify-between pt-2">
            <span className="font-display font-semibold text-ink">Total</span>
            <motion.span key={totals.total} initial={{ scale: 1.06 }} animate={{ scale: 1 }} className="font-ticket font-bold text-xl text-brand-end">
              {formatMoney(totals.total)}
            </motion.span>
          </div>
        </div>

        {placeError && <p className="px-4 text-danger text-xs pb-2">{placeError}</p>}

        {!shift && (
          <p className="px-4 pb-2 text-warning text-xs">Open a shift (top bar) before taking payments.</p>
        )}

        <div className="p-4 pt-1 grid grid-cols-3 gap-2">
          <button
            onClick={() => holdOrder()}
            disabled={lines.length === 0}
            className="py-3 rounded-xl bg-surface-raised border border-border text-ink-muted text-xs font-bold disabled:opacity-40 flex flex-col items-center gap-1"
          >
            <Pause size={15} /> HOLD
          </button>
          <button
            onClick={() => { if (lines.length && confirm('Clear the current order?')) clearCart(); }}
            disabled={lines.length === 0}
            className="py-3 rounded-xl bg-surface-raised border border-border text-danger text-xs font-bold disabled:opacity-40 flex flex-col items-center gap-1"
          >
            <X size={15} /> CLEAR
          </button>
          <button
            onClick={handlePay}
            disabled={lines.length === 0 || placing || !shift}
            className="py-3 rounded-xl bg-brand-gradient text-white text-xs font-bold disabled:opacity-40 flex flex-col items-center gap-1"
          >
            {placing ? <Loader2 size={15} className="animate-spin" /> : <ShoppingBag size={15} />}
            PAY (F5)
          </button>
        </div>
      </div>

      {/* Table picker */}
      <Modal open={tablePicker} onClose={() => setTablePicker(false)} title="Select Table">
        <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
          {availableTables.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTable(t.id, t.table_number); setTablePicker(false); }}
              className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 text-sm font-bold transition-colors ${
                t.status === 'available' ? 'border-success/40 bg-success-soft text-success' :
                t.status === 'occupied' ? 'border-danger/40 bg-danger-soft text-danger' :
                'border-warning/40 bg-warning-soft text-warning'
              }`}
            >
              <span>#{t.table_number}</span>
              <span className="text-[10px] font-normal capitalize">{t.status}</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Held orders */}
      <Modal open={heldPicker} onClose={() => setHeldPicker(false)} title="Held Orders">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {heldOrders.length === 0 && <p className="text-ink-faint text-sm">No held orders.</p>}
          {heldOrders.map((h) => (
            <div key={h.id} className="flex items-center justify-between rounded-xl border border-border bg-surface-raised p-3">
              <div>
                <p className="text-sm font-semibold text-ink">{h.label}</p>
                <p className="text-xs text-ink-faint">{h.snapshot.lines.length} item(s) · held {new Date(h.heldAt).toLocaleTimeString()}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { resumeOrder(h.id); setHeldPicker(false); }}
                  className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center"
                >
                  <PlayCircle size={16} />
                </button>
                <button
                  onClick={() => discardHeldOrder(h.id)}
                  className="w-8 h-8 rounded-lg bg-danger-soft text-danger flex items-center justify-center"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Line notes */}
      <Modal open={!!notesFor} onClose={() => setNotesFor(null)} title="Item Note">
        <textarea
          autoFocus
          rows={3}
          defaultValue={lines.find((l) => l.lineId === notesFor)?.notes || ''}
          onBlur={(e) => notesFor && setLineNotes(notesFor, e.target.value)}
          placeholder="e.g. No onions, extra spicy…"
          className="w-full rounded-xl bg-surface-raised border border-border p-3 text-sm text-ink outline-none focus:border-accent resize-none"
        />
        <button onClick={() => setNotesFor(null)} className="w-full mt-3 py-2.5 rounded-xl bg-brand-gradient text-white text-sm font-bold">
          Done
        </button>
      </Modal>

      <PaymentModal
        open={!!activeOrder}
        order={activeOrder}
        shiftId={shift?.id}
        onClose={() => setActiveOrder(null)}
        onPaid={() => setActiveOrder(null)}
      />
    </div>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className={`font-ticket ${tone === 'success' ? 'text-success' : 'text-ink'}`}>{formatMoney(value)}</span>
    </div>
  );
}
