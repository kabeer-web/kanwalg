import { useEffect, useState } from 'react';
import { History as HistoryIcon, Loader2, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function History() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('audit_logs')
        .select('*, staff_profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (err) setError(err.message);
      setLogs(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = logs.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (l.action || '').toLowerCase().includes(q) ||
      (l.entity || '').toLowerCase().includes(q) ||
      (l.staff_profiles?.full_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-full">
      <div className="border-b border-border bg-surface/40">
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-semibold text-ink tracking-tight">History</h1>
          <p className="text-sm text-ink-muted mt-1">Audit trail of important actions across the restaurant.</p>
        </div>
      </div>
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto">
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        <div className="relative mb-5 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actions…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-border text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          {loading ? (
            <div className="p-10 flex justify-center text-ink-faint gap-2 text-sm">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <HistoryIcon size={28} className="mx-auto text-ink-faint mb-3" />
              <p className="text-sm text-ink-muted">No history yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((log) => (
                <li key={log.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{log.action}</p>
                    <p className="text-xs text-ink-faint mt-0.5">
                      {log.entity}
                      {log.entity_id ? ` · ${String(log.entity_id).slice(0, 8)}…` : ''}
                      {log.staff_profiles?.full_name ? ` · ${log.staff_profiles.full_name}` : ''}
                    </p>
                  </div>
                  <time className="text-xs text-ink-faint tabular-nums whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
