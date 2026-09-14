import { Coffee, Cookie, Soup, IceCream, Tag, Sparkles } from 'lucide-react';

// Deterministic icon + accent color per category name. No DB field for
// this, so it's inferred from the name with a stable fallback — same
// category always renders the same way, and an unrecognized name still
// gets a distinct (hashed) color rather than looking broken.
const PALETTE = ['#8B5CF6', '#22C55E', '#F59E0B', '#38BDF8', '#F472B6', '#FB923C', '#34D399'];

export function iconFor(name = '') {
  const n = name.toLowerCase();
  if (n.includes('beverage') || n.includes('drink')) return Coffee;
  if (n.includes('snack')) return Cookie;
  if (n.includes('meal') || n.includes('karahi') || n.includes('bbq') || n.includes('rice')) return Soup;
  if (n.includes('dessert') || n.includes('sweet')) return IceCream;
  return Tag;
}

export function colorFor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export const AllItemsIcon = Sparkles;
