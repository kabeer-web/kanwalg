import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, TrendingUp, ShoppingBag, AlertTriangle, UtensilsCrossed,
  Clock, Wallet, ChefHat, CheckCircle2, ArrowRight,
} from 'lucide-react';
import { useOrders } from '../context/OrdersContext';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/pricing';
import { Link } from 'react-router-dom';

const STATUS_LABEL = {
  pending_confirmation: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
};
const STATUS_CLASS = {
  pending_confirmation: 'bg-warning-soft text-warning border-warning/30',
  confirmed: 'bg-accent-soft text-accent border-accent/30',
  preparing: 'bg-brand-end/10 text-brand-end border-brand-end/30',
  ready: 'bg-success-soft text-success border-success/30',
};
const TABLE_CLASS = {
  available: 'bg-success-soft border-success/30 text-success',
  occupied: 'bg-danger-soft border-danger/30 text-danger',
  waiting_for_bill: 'bg-warning-soft border-warning/30 text-warning',
  needs_bill: 'bg-warning-soft border-warning/30 text-warning',
  cleaning: 'bg-warning-soft border-warning/30 text-warning',
  inactive: 'bg-surface-hover border-border text-ink-faint',
};

export default function Dashboard() {
  const { orders, tables, loading, confirmOrder, updateStatus } = useOrders();
  const [lowStock, setLowStock] = useState([]);
  const [todaySales, setTodaySales] = useState(0);
  const [todayOrderCount, setTodayOrderCount] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);

  useEffect(() => {
    (async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const [{ data: inv }, { data: dayOrders }] = await Promise.all([
        supabase.from('inventory_items').select('id,name,current_stock,low_stock_threshold,unit').eq('is_active', true),
        supabase.from('orders').select('id,total,status,created_at').gte('created_at', start.toISOString()).neq('status', 'cancelled'),
      ]);
      const low = (inv || []).filter((i) => Number(i.current_stock) <= Number(i.low_stock_threshold));
      setLowStock(low);
      const list = dayOrders || [];
      setTodayOrderCount(list.length);
      setTodaySales(list.reduce((s, o) => s + Number(o.total || 0), 0));
      setCompletedToday(list.filter((o) => o.status === 'completed').length);
    })();
  }, [orders]);

  const pending = useMemo(() => orders.filter((o) => o.status === 'pending_confirmation'), [orders]);
  const active = useMemo(() => orders.filter((o) => ['confirmed', 'preparing', 'ready'].includes(o.status)), [orders]);
  const kitchenCount = orders.filter((o) => ['confirmed', 'preparing'].includes(o.status)).length;
  const readyCount = orders.filter((o) => o.status === 'ready').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-ink-faint gap-2">
        <Loader2 className="animate-spin" size={20} /> Loading dashboard…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="text-ink-muted text-sm mt-0.5">Kanwal G Restaurant — live operations</p>
      </div>

      {/* Sales strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-surface p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-accent/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-2 text-ink-muted text-xs font-medium mb-2">
            <Wallet size={14} className="text-accent" /> Today sales
          </div>
          <p className="text-2xl font-semibold text-ink font-mono tabular-nums">{formatMoney(todaySales)}</p>
          <p className="text-[11px] text-ink-faint mt-1">{completedToday} completed</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-ink-muted text-xs font-medium mb-2">
            <ShoppingBag size={14} /> Orders today
          </div>
          <p className="text-2xl font-semibold text-ink tabular-nums">{todayOrderCount}</p>
          <p className="text-[11px] text-ink-faint mt-1">{active.length} active now</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-ink-muted text-xs font-medium mb-2">
            <ChefHat size={14} className="text-warning" /> Kitchen
          </div>
          <p className="text-2xl font-semibold text-ink tabular-nums">{kitchenCount}</p>
          <Link to="/kds" className="text-[11px] text-accent mt-1 inline-flex items-center gap-0.5 hover:underline">
            Open KDS <ArrowRight size={10} />
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-ink-muted text-xs font-medium mb-2">
            <CheckCircle2 size={14} className="text-success" /> Ready to bill
          </div>
          <p className="text-2xl font-semibold text-ink tabular-nums">{readyCount}</p>
          <Link to="/billing" className="text-[11px] text-accent mt-1 inline-flex items-center gap-0.5 hover:underline">
            Billing <ArrowRight size={10} />
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Pending website orders */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Clock size={14} className="text-warning" /> Needs attention
          </h2>
          {pending.length === 0 && active.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-ink-faint text-sm">
              No active orders — waiting for website or POS
            </div>
          )}
          <AnimatePresence initial={false}>
            {pending.map((o) => (
              <motion.div key={o.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-warning/30 bg-warning-soft/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-ink text-sm">
                      Website order {o.order_no ? `#${o.order_no}` : ''} — {o.customer_name || 'Guest'}
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5">{o.customer_phone} {o.delivery_address ? `· ${o.delivery_address}` : ''}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CLASS[o.status]}`}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
                <ul className="text-xs text-ink-muted space-y-0.5 mb-3">
                  {(o.order_items || []).map((li) => (
                    <li key={li.id}>{li.qty}× {li.item_name}{li.variant_name ? ` (${li.variant_name})` : ''}</li>
                  ))}
                </ul>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-sm text-ink">{formatMoney(o.total)}</span>
                  <button onClick={() => confirmOrder(o.id)}
                    className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:brightness-110">
                    Confirm → Kitchen
                  </button>
                </div>
              </motion.div>
            ))}
            {active.map((o) => (
              <motion.div key={o.id} layout className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-ink text-sm">
                      {o.order_type === 'dine_in'
                        ? `Table ${tables.find((t) => t.id === o.table_id)?.table_number ?? '?'}`
                        : `${o.order_type} — ${o.customer_name || 'Guest'}`}
                      {o.order_no ? ` #${o.order_no}` : ''}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CLASS[o.status] || ''}`}>
                    {STATUS_LABEL[o.status] || o.status}
                  </span>
                </div>
                <ul className="text-xs text-ink-muted space-y-0.5 mb-2">
                  {(o.order_items || []).slice(0, 4).map((li) => (
                    <li key={li.id}>{li.qty}× {li.item_name}{li.variant_name ? ` (${li.variant_name})` : ''}</li>
                  ))}
                </ul>
                <p className="font-mono text-sm font-semibold text-ink">{formatMoney(o.total)}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Side: tables + low stock */}
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2">
              <UtensilsCrossed size={14} /> Tables
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {(tables || []).slice(0, 9).map((t) => (
                <div key={t.id}
                  className={`rounded-xl border p-2 text-center text-xs font-semibold ${TABLE_CLASS[t.status] || TABLE_CLASS.available}`}>
                  T{t.table_number}
                  <p className="text-[9px] font-normal opacity-80 mt-0.5 capitalize">{(t.status || 'available').replace(/_/g, ' ')}</p>
                </div>
              ))}
              {(!tables || tables.length === 0) && (
                <p className="col-span-3 text-xs text-ink-faint">No tables — add from Tables QR</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2">
              <AlertTriangle size={14} className="text-warning" /> Low stock
            </h2>
            {lowStock.length === 0 ? (
              <p className="text-xs text-ink-faint rounded-xl border border-border p-3">All ingredients OK</p>
            ) : (
              <ul className="space-y-1.5">
                {lowStock.slice(0, 6).map((i) => (
                  <li key={i.id} className="rounded-xl border border-warning/20 bg-warning-soft/20 px-3 py-2 text-xs flex justify-between">
                    <span className="text-ink font-medium">{i.name}</span>
                    <span className="text-warning font-mono">{i.current_stock} {i.unit}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/ingredients" className="text-[11px] text-accent mt-2 inline-block hover:underline">Manage ingredients →</Link>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-ink-muted text-xs mb-2">
              <TrendingUp size={14} className="text-success" /> Quick links
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/pos" className="text-xs px-3 py-1.5 rounded-lg bg-accent/15 text-accent font-medium">POS</Link>
              <Link to="/menu-admin" className="text-xs px-3 py-1.5 rounded-lg bg-surface-hover text-ink-muted font-medium">Menu</Link>
              <Link to="/kds" className="text-xs px-3 py-1.5 rounded-lg bg-surface-hover text-ink-muted font-medium">Kitchen</Link>
              <Link to="/billing" className="text-xs px-3 py-1.5 rounded-lg bg-surface-hover text-ink-muted font-medium">Billing</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
