import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Banknote, CreditCard, Landmark, Smartphone, Check, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMoney, changeDue } from '../../lib/pricing';
import Modal from '../ui/Modal';

const METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'bank_transfer', label: 'Bank Transfer', icon: Landmark },
  { id: 'wallet', label: 'Digital Wallet', icon: Smartphone },
];

// order: the row returned by staff_place_order (id, total, ...)
// shiftId: current cashier's open shift, so cash reconciliation adds up
export default function PaymentModal({ open, order, shiftId, onClose, onPaid }) {
  const [method, setMethod] = useState('cash');
  const [received, setReceived] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const amountDue = order?.total ?? 0;
  const change = useMemo(() => changeDue(amountDue, received || 0), [amountDue, received]);
  const receivedNum = Number(received) || 0;
  const canConfirm = method !== 'cash' || receivedNum >= amountDue;

  const confirm = async () => {
    if (!order) return;
    setSubmitting(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('record_payment', {
      p_order_id: order.id,
      p_method: method,
      p_amount: amountDue,
      p_received_amount: method === 'cash' ? receivedNum : null,
      p_shift_id: shiftId,
    });
    setSubmitting(false);
    if (rpcError) { setError(rpcError.message); return; }
    setDone(true);
    setTimeout(() => {
      setDone(false);
      setMethod('cash');
      setReceived('');
      onPaid?.();
    }, 1100);
  };

  return (
    <Modal open={open} onClose={submitting ? () => {} : onClose} title={done ? undefined : `Charge ${formatMoney(amountDue)}`}>
      {done ? (
        <div className="flex flex-col items-center py-6 gap-3">
          <div className="w-16 h-16 rounded-full bg-success-soft flex items-center justify-center animate-success-check">
            <Check size={32} className="text-success" strokeWidth={3} />
          </div>
          <p className="font-display text-lg text-ink">Payment recorded</p>
          <p className="text-ink-muted text-sm">Order #{order?.id?.slice(0, 8)}</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => {
              const Icon = m.icon;
              const active = method === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`flex flex-col items-center gap-2 rounded-xl border py-4 px-2 transition-colors ${
                    active ? 'bg-accent-soft border-accent text-ink' : 'bg-surface-raised border-border text-ink-muted hover:border-ink-faint'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-xs font-semibold">{m.label}</span>
                </button>
              );
            })}
          </div>

          {method === 'cash' && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Amount Received</span>
                <input
                  type="number"
                  autoFocus
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  placeholder={String(amountDue)}
                  className="mt-1 w-full rounded-xl bg-surface-raised border border-border px-4 py-3 text-lg font-ticket text-ink outline-none focus:border-accent transition-colors"
                />
              </label>
              <div className="flex items-center justify-between rounded-xl bg-surface-raised px-4 py-3">
                <span className="text-ink-muted text-sm">Change</span>
                <motion.span
                  key={change}
                  initial={{ scale: 0.9, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="font-ticket font-bold text-success text-lg"
                >
                  {formatMoney(change)}
                </motion.span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-1 text-sm">
            <span className="text-ink-muted">Amount Due</span>
            <span className="font-ticket font-bold text-ink">{formatMoney(amountDue)}</span>
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <button
            onClick={confirm}
            disabled={!canConfirm || submitting}
            className="w-full py-3 rounded-xl bg-brand-gradient text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : `Confirm ${METHODS.find((m) => m.id === method).label} Payment`}
          </button>
        </div>
      )}
    </Modal>
  );
}
