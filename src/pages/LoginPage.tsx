import React, { useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { GraduationCap, Loader2, Eye, EyeOff, AlertTriangle } from 'lucide-react';

export function LoginPage() {
  const { user, isAdmin, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;

  if (user) {
    return <Navigate to={isAdmin ? '/dashboard' : '/data-entry'} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isSupabaseConfigured) {
      setError(
        'Supabase is not yet configured. Please create your Supabase project, execute the migration SQL, and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      );
      return;
    }

    setSubmitting(true);

    try {
      const { error: authError } = await signIn(email, password);
      if (authError) {
        setError(authError.message || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 rounded-2xl mb-4">
            <GraduationCap className="w-9 h-9 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Medersa Evaluation System</h1>
          <p className="text-slate-400 mt-1">Sign in to continue</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-400/30 rounded-xl text-amber-200 text-xs space-y-1.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4" /> Connect Supabase Project
            </div>
            <p>
              Supabase environment variables are missing or set to placeholder. Configure your <code>.env</code> file:
            </p>
            <div className="bg-slate-900/80 p-2 rounded text-emerald-400 font-mono text-[11px]">
              VITE_SUPABASE_URL=https://your-id.supabase.co<br />
              VITE_SUPABASE_ANON_KEY=eyJ...
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              placeholder="admin@medersa.org"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 text-slate-400" />
                ) : (
                  <Eye className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
