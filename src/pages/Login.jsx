import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UtensilsCrossed, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-ink p-6">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-surface rounded-2xl p-7 border border-border shadow-2xl"
      >
        <div className="w-11 h-11 rounded-xl bg-brand-gradient flex items-center justify-center mb-4">
          <UtensilsCrossed size={20} className="text-white" />
        </div>
        <h1 className="font-display text-xl font-semibold mb-1">Staff Login</h1>
        <p className="text-ink-muted text-sm mb-6">Sign in to access the POS and kitchen tools.</p>

        <label className="block mb-3">
          <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wide">Email</span>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 p-3 rounded-xl bg-surface-raised border border-border outline-none focus:border-accent transition-colors text-sm"
          />
        </label>
        <label className="block mb-4">
          <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wide">Password</span>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 p-3 rounded-xl bg-surface-raised border border-border outline-none focus:border-accent transition-colors text-sm"
          />
        </label>

        {error && <p className="text-danger text-sm mb-4">{error}</p>}

        <button
          disabled={loading}
          className="w-full py-3 rounded-xl bg-brand-gradient text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Sign In'}
        </button>
      </motion.form>
    </div>
  );
}
