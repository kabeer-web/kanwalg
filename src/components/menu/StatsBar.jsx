import { Package, PackageMinus, PackageX } from 'lucide-react';

const CARDS = [
  { key: 'total', label: 'Total Items', icon: Package, tone: 'accent' },
  { key: 'low', label: 'Low Stock Items', icon: PackageMinus, tone: 'warning' },
  { key: 'out', label: 'Out of Stock', icon: PackageX, tone: 'danger' },
];

const TONE_CLASSES = {
  accent: { bg: 'bg-accent-soft', text: 'text-accent' },
  warning: { bg: 'bg-warning-soft', text: 'text-warning' },
  danger: { bg: 'bg-danger-soft', text: 'text-danger' },
};

export default function StatsBar({ counts }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {CARDS.map(({ key, label, icon: Icon, tone }) => {
        const { bg, text } = TONE_CLASSES[tone];
        return (
          <div
            key={key}
            className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3"
          >
            <div className={`w-9 h-9 rounded-lg ${bg} ${text} flex items-center justify-center flex-shrink-0`}>
              <Icon size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-ink-faint text-xs">{label}</p>
              <p className="text-ink font-semibold text-lg leading-tight">{counts[key]}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
