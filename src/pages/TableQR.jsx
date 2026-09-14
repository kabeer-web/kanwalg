import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, RefreshCw, X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Set this to your deployed domain, e.g. "https://yourrestaurant.vercel.app"
const SITE_URL = window.location.origin;

export default function TableQR() {
  const [tables, setTables] = useState([]);
  const [newTable, setNewTable] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const { data, error: loadErr } = await supabase.from('restaurant_tables').select('*').order('table_number');
    if (loadErr) setError(loadErr.message);
    setTables(data || []);
  };
  useEffect(() => { load(); }, []);

  const addTable = async () => {
    if (!newTable.trim()) return;
    setError('');
    const { error: insertErr } = await supabase.from('restaurant_tables').insert([{ table_number: newTable.trim() }]);
    if (insertErr) return setError(insertErr.message);
    setNewTable('');
    load();
  };

  // Regenerating the qr_token invalidates any printed QR for that table —
  // useful if a code gets shared/leaked.
  const regenerate = async (id) => {
    if (!confirm('This invalidates the current printed QR code for this table. Continue?')) return;
    setError('');
    const { error: updateErr } = await supabase.from('restaurant_tables')
      .update({ qr_token: crypto.randomUUID() }).eq('id', id);
    if (updateErr) return setError(updateErr.message);
    load();
  };

  const orderUrl = (token) => `${SITE_URL}/menu?table=${token}`;
  const qrImage = (token) => `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(orderUrl(token))}`;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">Table QR Codes</h1>

      {error && (
        <div className="mb-5 flex items-start gap-2 bg-danger-soft border border-danger/30 text-danger text-sm rounded-xl px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-danger/70 hover:text-danger"><X size={14} /></button>
        </div>
      )}

      <div className="flex gap-2 mb-8 max-w-sm">
        <input value={newTable} onChange={(e) => setNewTable(e.target.value)} placeholder="Table number, e.g. 6"
          className="flex-1 p-3 rounded-xl bg-surface-raised border border-border outline-none focus:border-accent transition-colors text-sm" />
        <button onClick={addTable}
          className="px-4 rounded-xl bg-brand-gradient text-white font-bold text-sm transition-transform active:scale-[0.98]">
          Add Table
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatePresence initial={false}>
          {tables.map((t) => (
            <motion.div
              key={t.id}
              layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-surface rounded-2xl p-4 border border-border text-center"
            >
              <p className="font-display font-bold text-lg text-ink mb-2">Table {t.table_number}</p>
              <img src={qrImage(t.qr_token)} alt={`QR for table ${t.table_number}`} className="mx-auto rounded-lg mb-2 bg-white p-2" />
              <p className="text-xs text-ink-faint break-all mb-3">{orderUrl(t.qr_token)}</p>
              <div className="flex gap-2">
                <button onClick={() => window.print()}
                  className="flex-1 py-2 rounded-lg bg-surface-raised border border-border text-ink-muted hover:text-ink transition-colors text-sm font-semibold flex items-center justify-center gap-1.5">
                  <Printer size={13} /> Print
                </button>
                <button onClick={() => regenerate(t.id)}
                  className="flex-1 py-2 rounded-lg bg-warning-soft text-warning hover:brightness-110 transition-all text-sm font-semibold flex items-center justify-center gap-1.5">
                  <RefreshCw size={13} /> Regenerate
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
