import { Eye, EyeOff } from 'lucide-react';
import Modal from '../ui/Modal';
import { getStockStatus, STATUS_META } from '../../lib/stockStatus';

export default function ViewItemModal({ item, categoryName, onClose, onToggleAvailable, busy }) {
  if (!item) return null;
  const status = getStockStatus(item.stock_qty);
  const meta = STATUS_META[status];

  const Row = ({ label, value }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0">
      <span className="text-ink-faint text-sm">{label}</span>
      <span className="text-ink text-sm font-medium">{value}</span>
    </div>
  );

  return (
    <Modal open={!!item} onClose={onClose} title={item.name}>
      <div className="space-y-0">
        <Row label="Category" value={categoryName} />
        <Row label="Price" value={`Rs. ${item.price}`} />
        <Row label="Stock Quantity" value={item.stock_qty === null ? 'Unlimited' : item.stock_qty} />
        <Row label="Status" value={
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${meta.bg} ${meta.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        } />
      </div>

      <button
        onClick={() => onToggleAvailable(item)}
        disabled={busy}
        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-raised border border-border text-ink-muted hover:text-ink transition-colors duration-150 text-sm font-medium disabled:opacity-50"
      >
        {item.is_available ? <EyeOff size={14} /> : <Eye size={14} />}
        {item.is_available ? 'Hide from menu' : 'Show on menu'}
      </button>
    </Modal>
  );
}
