import { Loader2, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';

export default function DeleteConfirmModal({ item, onClose, onConfirm, busy }) {
  return (
    <Modal open={!!item} onClose={onClose} title="Delete this item?" maxWidth="max-w-sm">
      <p className="text-ink-muted text-sm">
        {item && <>This will permanently remove <span className="text-ink font-medium">{item.name}</span> from your menu. This cannot be undone.</>}
      </p>
      <div className="flex gap-2 mt-5">
        <button
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-danger text-white font-semibold text-sm hover:brightness-110 transition-colors duration-150 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Delete
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl bg-surface-raised border border-border text-ink-muted font-medium text-sm hover:text-ink transition-colors duration-150"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
