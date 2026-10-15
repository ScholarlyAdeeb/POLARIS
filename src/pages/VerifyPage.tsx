import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type VerifyResult } from '../lib/api';
import { ErrorNote, Page, PageHeader } from '../components/ui';

const VERDICT: Record<VerifyResult['status'], { title: string; text: string; tone: string; icon: string }> = {
  genuine: {
    title: 'Genuine POLARIS post',
    text: 'This code belongs to a post that a named reviewer approved and POLARIS published.',
    tone: 'border-[#2e7d32] bg-[#e8f5e9] text-[#1b5e20]',
    icon: 'verified',
  },
  altered: {
    title: 'Altered copy',
    text: 'The code is genuine, but the text you pasted differs from the approved post. Compare it with the original below.',
    tone: 'border-[#e65100] bg-[#fff3e0] text-[#bf360c]',
    icon: 'report',
  },
  not_published: {
    title: 'Not approved',
    text: 'This code belongs to a draft that has not been approved and published. Do not treat it as an official post.',
    tone: 'border-[#e65100] bg-[#fff3e0] text-[#bf360c]',
    icon: 'pending',
  },
  no_match: {
    title: 'No match',
    text: 'No POLARIS post has this code. Check for typing mistakes; if the code is right, the post did not come from POLARIS.',
    tone: 'border-[#c62828] bg-[#ffebee] text-[#b71c1c]',
    icon: 'gpp_bad',
  },
};

export function VerifyPage() {
  const { code: param } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(param ?? '');
  const [text, setText] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async (c: string, t = text) => {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.verify(c.trim(), t.trim() || undefined));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (param) check(param, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  const v = result ? VERDICT[result.status] : null;
  return (
    <Page>
      <PageHeader title="Verify a post" text="Every published POLARIS post carries an 8-character code and a QR code. Check a copy you received before you share it." />
      <form
        className="sci-card p-4 flex flex-col gap-3 max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (param !== code.trim().toUpperCase()) navigate(`/verify/${code.trim().toUpperCase()}`, { replace: true });
          check(code);
        }}
      >
        <label className="text-xs sci-muted flex flex-col gap-1">
          Verification code
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} className="sci-input sci-mono tracking-widest text-lg" placeholder="e.g. 3F9A12C0" aria-label="Verification code" />
        </label>
        <label className="text-xs sci-muted flex flex-col gap-1">
          Text you received (optional, to catch edited copies)
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="sci-input text-sm" placeholder="Paste the post here" />
        </label>
        <button className="sci-btn self-start" disabled={busy || code.trim().length !== 8}>
          {busy ? 'Checking…' : 'Check'}
        </button>
      </form>
      <ErrorNote error={error} />
      {result && v && (
        <section className={`max-w-2xl mt-4 rounded-xl border-2 p-4 flex flex-col gap-3 ${v.tone}`} data-testid="verify-result" data-status={result.status}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[28px]">{v.icon}</span>
            <h2 className="font-semibold text-lg">{v.title}</h2>
            <span className="ml-auto sci-mono text-sm">{result.code}</span>
          </div>
          <p className="text-sm">{v.text}</p>
          {result.post && (
            <div className="bg-white/80 rounded-lg p-3 text-sm text-[#0b1c30] flex flex-col gap-2">
              <p className="whitespace-pre-line">{result.post.content}</p>
              <p className="text-xs sci-muted">
                {result.post.channel} post about{' '}
                <a className="underline" href={`/?record=${encodeURIComponent(result.post.itemId)}`}>
                  {result.post.itemTitle}
                </a>
                {result.post.author && (
                  <>
                    {' '}· credited to{' '}
                    <Link className="underline" to={`/contributors/${result.post.author.id}`}>
                      {result.post.author.name}
                    </Link>
                  </>
                )}
                {result.post.reviewer && <> · approved by {result.post.reviewer}</>}
                {result.post.publishedAt && <> · published {new Date(result.post.publishedAt).toLocaleDateString()}</>}
              </p>
            </div>
          )}
        </section>
      )}
    </Page>
  );
}
