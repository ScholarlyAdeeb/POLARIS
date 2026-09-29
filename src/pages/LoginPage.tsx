import React, { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useT } from '../lib/i18n';
import { ErrorNote, Page, PageHeader } from '../components/ui';

export function LoginPage() {
  const { user, login, register } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/workspace';
  const [mode, setMode] = useState<'signin' | 'register'>(params.get('mode') === 'register' ? 'register' : 'signin');
  const [form, setForm] = useState({ name: '', email: '', password: '', institution: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={next} replace />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') await login(form.email, form.password);
      else await register(form);
      navigate(next, { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader title={t('auth.title')} text={t('auth.text')} />
      <div className="sci-card p-6 max-w-md">
        <div className="flex rounded-lg sci-well p-1 mb-5 text-sm" role="tablist">
          {(['signin', 'register'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-md ${mode === m ? 'bg-white font-semibold shadow-sm' : 'sci-muted'}`}
            >
              {m === 'signin' ? t('auth.signIn') : t('auth.register')}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === 'register' && (
            <>
              <label className="text-xs sci-muted flex flex-col gap-1">
                {t('auth.name')}
                <input required value={form.name} onChange={set('name')} className="sci-input" autoComplete="name" />
              </label>
              <label className="text-xs sci-muted flex flex-col gap-1">
                {t('auth.institution')}
                <input value={form.institution} onChange={set('institution')} className="sci-input" placeholder="e.g. NCPOR, Goa" autoComplete="organization" />
              </label>
            </>
          )}
          <label className="text-xs sci-muted flex flex-col gap-1">
            {t('auth.email')}
            <input required type="email" value={form.email} onChange={set('email')} className="sci-input" autoComplete="email" />
          </label>
          <label className="text-xs sci-muted flex flex-col gap-1">
            {t('auth.password')}
            <input
              required
              type="password"
              minLength={mode === 'register' ? 8 : undefined}
              value={form.password}
              onChange={set('password')}
              className="sci-input"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
            {mode === 'register' && <span className="text-[11px]">{t('auth.passwordHint')}</span>}
          </label>
          <button className="sci-btn mt-1" disabled={busy}>
            {busy ? t('common.loading') : mode === 'signin' ? t('auth.signIn') : t('auth.register')}
          </button>
          <ErrorNote error={error} />
        </form>
        <p className="text-xs sci-muted mt-4">
          New accounts are contributors. An admin can make you a reviewer from the Admin page.
        </p>
      </div>
    </Page>
  );
}
