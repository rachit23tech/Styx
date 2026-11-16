import React, { useState } from 'react';
import { AuthUser } from '../types';
import { login, register } from '../api/client';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => void;
}

const MIN_PASSWORD = 8;

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === 'register';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegister && password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const user = isRegister
        ? await register(email.trim(), password)
        : await login(email.trim(), password);
      onAuthenticated(user);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register');
    setError(null);
  };

  return (
    <div className="app-container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '64px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '28px' }}>
        <div className="navbar-brand" style={{ marginBottom: '20px' }}>
          <div className="navbar-logo">S</div>
          <div>
            <div className="navbar-brand-title">Styx</div>
            <div className="navbar-brand-sub">Expense Tracker</div>
          </div>
        </div>

        <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>
          {isRegister ? 'Create your account' : 'Log in'}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          {isRegister
            ? 'Your expenses and categories are private to your account.'
            : 'Log in to see your expenses.'}
        </p>

        {error && (
          <div
            role="alert"
            style={{ padding: '10px 14px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#f43f5e', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              className="form-control"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              className="form-control"
              placeholder={isRegister ? `At least ${MIN_PASSWORD} characters` : 'Your password'}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '10px 15px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Please wait...' : isRegister ? 'Create account' : 'Log in'}
          </button>
        </form>

        <div style={{ marginTop: '18px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          {isRegister ? 'Already have an account?' : 'New to Styx?'}{' '}
          <button
            type="button"
            onClick={switchMode}
            style={{ background: 'none', border: 'none', color: 'var(--primary-teal)', fontWeight: 600, cursor: 'pointer', fontSize: '13px', padding: 0 }}
          >
            {isRegister ? 'Log in' : 'Create an account'}
          </button>
        </div>
      </div>
    </div>
  );
};
