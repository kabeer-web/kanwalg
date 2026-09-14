import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { formatMoney } from '../../lib/pricing';
import { useShift } from '../../context/ShiftContext';
import Modal from '../ui/Modal';

export default function ShiftModal({ open, onClose }) {
  const { shift, openShift, closeShift } = useShift();
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async () => {
    setSubmitting(true);
    if (shift) {
      const closed = await closeShift(Number(amount) || 0);
      if (closed) setResult(closed);
    } else {
      const opened = await openShift(Number(amount) || 0);
      if (opened) { setAmount(''); onClose(); }
    }
    setSubmitting(false);
  };

  const reset = () => { setAmount(''); setResult(null); onClose(); };

  return (
    <Modal open={open} onClose={reset} title={shift ? 'Close Shift' : 'Open Shift'}>
      {result ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">Expected Cash</span>
            <span className="font-ticket text-ink">{formatMoney(result.expected_cash)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">Actual Cash</span>
            <span className="font-ticket text-ink">{formatMoney(result.closing_cash)}</span>
          </div>
          <div className="flex items-center justify-between text-sm border-t border-border pt-3">
            <span className="text-ink-muted">Difference</span>
            <span className={`font-ticket font-bold ${result.difference === 0 ? 'text-success' : result.difference < 0 ? 'text-danger' : 'text-warning'}`}>
              {result.difference > 0 ? '+' : ''}{formatMoney(result.difference)}
            </span>
          </div>
          <button onClick={reset} className="w-full py-3 rounded-xl bg-brand-gradient text-white font-bold mt-2">
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
              {shift ? 'Actual Cash Counted' : 'Opening Cash Float'}
            </span>
            <input
              type="number"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-xl bg-surface-raised border border-border px-4 py-3 text-lg font-ticket text-ink outline-none focus:border-accent transition-colors"
            />
          </label>
          {shift && (
            <p className="text-ink-faint text-xs">
              Opened {new Date(shift.opened_at).toLocaleTimeString()} with {formatMoney(shift.opening_cash)} float.
            </p>
          )}
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-brand-gradient text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : shift ? 'Close Shift' : 'Open Shift'}
          </button>
        </div>
      )}
    </Modal>
  );
}
