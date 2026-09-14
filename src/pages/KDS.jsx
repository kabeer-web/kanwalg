import { motion, AnimatePresence } from 'framer-motion';
import { useOrders } from '../context/OrdersContext';
import { useEffect, useState } from 'react';

// Chef-facing screen — big touch targets, sorted oldest-first (FIFO),
// only shows orders the kitchen actually needs to act on. Border color
// escalates with wait time: 0–10min normal, 10–20 warning, 20+ critical —
// a chef should never have to read a timestamp to know what's urgent.
function urgency(ageMin) {
  if (ageMin >= 20) return { ring: 'border-danger bg-danger-soft', badge: 'text-danger', pulse: true };
  if (ageMin >= 10) return { ring: 'border-warning bg-warning-soft', badge: 'text-warning', pulse: false };
  return { ring: 'border-accent/40 bg-accent-soft', badge: 'text-accent', pulse: false };
}

function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function KDS() {
  const { orders, tables, updateStatus } = useOrders();
  const now = useNow();
  const kitchenOrders = orders.filter((o) => ['confirmed', 'preparing'].includes(o.status));

  return (
    <div className="p-6 bg-bg min-h-full">
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">Kitchen Display</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatePresence initial={false}>
          {kitchenOrders.map((o) => {
            const label = o.order_type === 'dine_in'
              ? `Table ${tables.find((t) => t.id === o.table_id)?.table_number ?? '?'}`
              : o.order_type === 'takeaway' ? 'Takeaway' : `Delivery — ${o.customer_name}`;
            const ageMin = Math.floor((now - new Date(o.created_at).getTime()) / 60000);
            const u = urgency(ageMin);
            return (
              <motion.div
                key={o.id}
                layout
                className={`animate-new-ticket rounded-2xl p-4 border-2 ${u.ring} ${u.pulse ? 'animate-pulse-ring' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-display font-bold text-lg text-ink">{label}</p>
                  <span className={`text-xs font-bold font-ticket ${u.badge}`}>{ageMin}m ago</span>
                </div>
                <ul className="space-y-1 mb-4">
                  {o.order_items.map((li) => (
                    <li key={li.id} className="text-sm text-ink">
                      <span className="font-bold">{li.qty}×</span> {li.item_name}
                      {li.notes && <span className="text-warning italic"> — {li.notes}</span>}
                    </li>
                  ))}
                </ul>
                {o.status === 'confirmed' ? (
                  <button onClick={() => updateStatus(o.id, 'preparing')}
                    className="w-full py-3 rounded-xl bg-accent text-white font-bold transition-transform active:scale-[0.98]">
                    Start Preparing
                  </button>
                ) : (
                  <button onClick={() => updateStatus(o.id, 'ready')}
                    className="w-full py-3 rounded-xl bg-success text-white font-bold transition-transform active:scale-[0.98]">
                    Mark Ready
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {kitchenOrders.length === 0 && <p className="text-ink-faint col-span-full">No orders in the kitchen right now.</p>}
      </div>
    </div>
  );
}
