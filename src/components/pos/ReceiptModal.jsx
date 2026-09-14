import { formatMoney } from '../../lib/money';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

export default function ReceiptModal({ open, onClose, order }) {
  if (!order) return null;

  return (
    <Modal open={open} onClose={onClose} title="Receipt" width="max-w-sm">
      <div id="receipt-print" className="bg-white text-black rounded-lg p-5 font-mono text-sm mb-4">
        <div className="text-center mb-3">
          <p className="font-black text-base">YOUR RESTAURANT</p>
          <p className="text-xs">123 Main Street, Karachi</p>
          <p className="text-xs">Tel: 0300-0000000</p>
        </div>
        <div className="border-t border-dashed border-black my-2" />
        <div className="flex justify-between text-xs">
          <span>Order #{order.order_no}</span>
          <span>{new Date(order.created_at).toLocaleString()}</span>
        </div>
        <p className="text-xs">{order.tableLabel ? `Table ${order.tableLabel}` : 'Takeaway'}</p>
        <div className="border-t border-dashed border-black my-2" />
        {order.items.map((li) => (
          <div key={li.id} className="flex justify-between mb-1">
            <span>{li.qty}× {li.name}</span>
            <span>{formatMoney(li.priceMinor * li.qty)}</span>
          </div>
        ))}
        <div className="border-t border-dashed border-black my-2" />
        <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(order.totals.subtotalMinor)}</span></div>
        {order.totals.discountMinor > 0 && (
          <div className="flex justify-between"><span>Discount</span><span>-{formatMoney(order.totals.discountMinor)}</span></div>
        )}
        {order.totals.taxMinor > 0 && (
          <div className="flex justify-between"><span>Tax</span><span>{formatMoney(order.totals.taxMinor)}</span></div>
        )}
        {order.totals.serviceChargeMinor > 0 && (
          <div className="flex justify-between"><span>Service Charge</span><span>{formatMoney(order.totals.serviceChargeMinor)}</span></div>
        )}
        <div className="border-t border-dashed border-black my-2" />
        <div className="flex justify-between font-black text-base"><span>TOTAL</span><span>{formatMoney(order.totals.grandTotalMinor)}</span></div>
        <div className="flex justify-between text-xs mt-1"><span>Paid ({order.paymentMethod})</span><span>{formatMoney(order.amountPaidMinor)}</span></div>
        {order.changeMinor > 0 && (
          <div className="flex justify-between text-xs"><span>Change</span><span>{formatMoney(order.changeMinor)}</span></div>
        )}
        <div className="text-center text-xs mt-3">Thank you for dining with us!</div>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => window.print()}>Print</Button>
        <Button variant="success" className="flex-1" onClick={onClose}>New Order</Button>
      </div>
    </Modal>
  );
}
