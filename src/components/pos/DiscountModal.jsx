import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export default function DiscountModal({ open, onClose, onApply, current }) {
  const [type, setType] = useState(current?.type || 'percent');
  const [value, setValue] = useState(current?.value ?? '');

  const apply = () => {
    if (!value || Number(value) <= 0) { onApply(null); onClose(); return; }
    onApply({ type, value: Number(value) });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Apply Discount" width="max-w-xs">
      <div className="flex gap-2 mb-4">
        <button onClick={() => setType('percent')}
          className={`flex-1 py-2 rounded-md text-sm font-bold border ${type === 'percent' ? 'bg-accent border-accent text-white' : 'border-border text-text-secondary'}`}>
          Percent %
        </button>
        <button onClick={() => setType('fixed')}
          className={`flex-1 py-2 rounded-md text-sm font-bold border ${type === 'fixed' ? 'bg-accent border-accent text-white' : 'border-border text-text-secondary'}`}>
          Fixed Rs.
        </button>
      </div>
      <input
        autoFocus
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={type === 'percent' ? 'e.g. 10' : 'e.g. 200'}
        className="w-full p-3 rounded-md bg-surface border border-border-strong outline-none focus:border-accent text-lg font-bold mb-4"
      />
      <Button variant="success" className="w-full" onClick={apply}>Apply Discount</Button>
    </Modal>
  );
}
