import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useT } from '../lib/i18n';
import { ErrorNote, Page, PageHeader } from '../components/ui';

export function LoginPage() {
  const { user, login, register } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Only same-site paths: "//host" or "https://..." would send the user off-site after sign-in.
  const rawNext = params.get('next') || '';
  const next = /^\/(?![/\\])/.test(rawNext) ? rawNext : '/workspace';
  const [mode, setMode] = useState<'signin' | 'register'>(params.get('mode') === 'register' ? 'register' : 'signin');
  const [form, setForm] = useState({ name: '', email: '', password: '', institution: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState<{ username: string; password: string; role: string }[]>([]);
  useEffect(() => {
    api.auth.config().then((c) => setDemo(c.demoAccounts)).catch(() => undefined);
  }, []);

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
            {mode === 'signin' ? t('auth.login') : t('auth.email')}
            <input
              required
              type={mode === 'signin' ? 'text' : 'email'}
              value={form.email}
              onChange={set('email')}
              className="sci-input"
              autoComplete={mode === 'signin' ? 'username' : 'email'}
              autoCapitalize="none"
            />
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
        {mode === 'signin' && demo.length > 0 && (
          <div className="sci-well p-3 mt-4 text-xs flex flex-col gap-2" data-testid="demo-accounts">
            <p className="font-semibold">Demo accounts</p>
            {demo.map((d) => (
              <button
                key={d.username}
                type="button"
                className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 text-left hover:shadow"
                onClick={() => setForm({ ...form, email: d.username, password: d.password })}
              >
                <span>
                  <span className="sci-mono font-semibold">{d.username}</span> / <span className="sci-mono">{d.password}</span>
                </span>
                <span className="capitalize sci-muted">{d.role}</span>
              </button>
            ))}
            <p className="sci-muted">Tap one to fill the form. Demo logins are for presentations only.</p>
          </div>
        )}
        <p className="text-xs sci-muted mt-4">
          New accounts are contributors. An admin can make you a reviewer from the Admin page.
        </p>
      </div>
    </Page>
  );
}
