import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { computeTotals } from '../../lib/pricing';
import { formatMoney } from '../../lib/money';

export default function HeldOrdersModal({ open, onClose, heldOrders, onResume, onDiscard }) {
  return (
    <Modal open={open} onClose={onClose} title={`Held Orders (${heldOrders.length})`} width="max-w-md">
      {heldOrders.length === 0 ? (
        <p className="text-text-muted text-sm py-4 text-center">No held orders.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {heldOrders.map((h) => {
            const totals = computeTotals(h.items, { discount: h.discount });
            return (
              <div key={h.id} className="card-surface p-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{h.tableLabel ? `Table ${h.tableLabel}` : 'Takeaway'}</p>
                  <p className="text-text-secondary text-xs">{h.items.length} item(s) · {formatMoney(totals.grandTotalMinor)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => onDiscard(h.id)}>Discard</Button>
                  <Button size="sm" variant="primary" onClick={() => { onResume(h.id); onClose(); }}>Resume</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
