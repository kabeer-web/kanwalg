import { motion, AnimatePresence } from 'framer-motion';
import { Printer, CheckCircle2 } from 'lucide-react';
import { useOrders } from '../context/OrdersContext';
import { formatMoney } from '../lib/pricing';

// Orders land here the moment the kitchen marks them "ready" — this screen
// generates the bill/slip and checks the order out.
export default function Billing() {
  const { orders, tables, updateStatus } = useOrders();
  const readyOrders = orders.filter((o) => o.status === 'ready');

  const printBill = (order) => {
    const label = order.order_type === 'dine_in'
      ? `Table ${tables.find((t) => t.id === order.table_id)?.table_number ?? '?'}`
      : order.order_type === 'takeaway' ? 'Takeaway' : `Delivery — ${order.customer_name}`;
    const win = window.open('', '_blank', 'width=380,height=600');
    if (!win) return;
    win.document.write(`
      <html><head><title>Bill</title>
      <style>body{font-family:monospace;padding:16px;} .row{display:flex;justify-content:space-between;} hr{border-top:1px dashed #000;}</style>
      </head><body>
      <h2>Restaurant Bill</h2>
      <p>${label}</p>
      <p>${new Date(order.created_at).toLocaleString()}</p>
      <hr/>
      ${order.order_items.map((li) => `<div class="row"><span>${li.qty}× ${li.item_name}</span><span>Rs. ${li.qty * li.price}</span></div>`).join('')}
      ${order.discount_amount ? `<div class="row"><span>Discount</span><span>-Rs. ${order.discount_amount}</span></div>` : ''}
      ${order.tax_amount ? `<div class="row"><span>Tax</span><span>Rs. ${order.tax_amount}</span></div>` : ''}
      ${order.service_charge_amount ? `<div class="row"><span>Service Charge</span><span>Rs. ${order.service_charge_amount}</span></div>` : ''}
      <hr/>
      <div class="row"><strong>Total</strong><strong>Rs. ${order.total}</strong></div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">Billing — Ready to Checkout</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence initial={false}>
          {readyOrders.map((o) => {
            const label = o.order_type === 'dine_in'
              ? `Table ${tables.find((t) => t.id === o.table_id)?.table_number ?? '?'}`
              : o.order_type === 'takeaway' ? 'Takeaway' : `Delivery — ${o.customer_name}`;
            return (
              <motion.div
                key={o.id}
                layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-surface rounded-2xl p-4 border border-success/30"
              >
                <p className="font-semibold text-ink mb-2">{label}</p>
                <ul className="text-sm text-ink-muted mb-2 space-y-0.5">
                  {o.order_items.map((li) => (
                    <li key={li.id} className="flex justify-between">
                      <span>{li.qty}× {li.item_name}</span>
                      <span className="font-ticket">{formatMoney(li.qty * li.price)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between font-ticket font-bold text-brand-end border-t border-border pt-2 mb-3">
                  <span className="font-display font-semibold text-ink not-italic">Total</span>
                  <span>{formatMoney(o.total)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => printBill(o)}
                    className="flex-1 py-2.5 rounded-xl bg-surface-raised border border-border text-ink-muted hover:text-ink transition-colors font-semibold text-sm flex items-center justify-center gap-1.5">
                    <Printer size={14} /> Print Bill
                  </button>
                  <button onClick={() => updateStatus(o.id, 'completed')}
                    className="flex-1 py-2.5 rounded-xl bg-success text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-transform active:scale-[0.98]">
                    <CheckCircle2 size={14} /> Mark Paid
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {readyOrders.length === 0 && <p className="text-ink-faint col-span-full">No orders ready for billing.</p>}
      </div>
    </div>
  );
}
