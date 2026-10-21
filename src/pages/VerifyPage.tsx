import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type Certificate, type VerifyResult } from '../lib/api';
import { TracePanel } from '../components/RecordExtras';
import { ErrorNote, Page, PageHeader } from '../components/ui';

const VERDICT: Record<VerifyResult['status'], { title: string; text: string; tone: string; icon: string }> = {
  genuine: {
    title: 'Genuine HIMAKSHA post',
    text: 'This code belongs to a post that a named reviewer approved and HIMAKSHA published.',
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
    text: 'No HIMAKSHA post has this code. Check for typing mistakes; if the code is right, the post did not come from HIMAKSHA.',
    tone: 'border-[#c62828] bg-[#ffebee] text-[#b71c1c]',
    icon: 'gpp_bad',
  },
};

const isCertificate = (c: string) => /^C-[0-9A-F]{8}$/.test(c.trim().toUpperCase());

function CertificateResult({ code }: { code: string }) {
  const [c, setC] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setC(null);
    setError(null);
    api.certificate(code).then(setC).catch((e) => setError(e.status === 404 ? 'No certificate has this code. It was not issued by HIMAKSHA.' : e.message));
  }, [code]);
  if (error)
    return (
      <section className="max-w-2xl mt-4 rounded-xl border-2 p-4 border-rose-300 bg-rose-50 text-rose-900" data-testid="verify-result" data-status="no_match">
        <p className="font-semibold">Not a HIMAKSHA certificate</p>
        <p className="text-sm">{error}</p>
      </section>
    );
  if (!c) return <p className="text-sm sci-muted mt-4">Checking…</p>;
  return (
    <section className="max-w-2xl mt-4 rounded-xl border-2 p-4 border-emerald-300 bg-emerald-50 text-emerald-900" data-testid="verify-result" data-status="genuine">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[28px]">workspace_premium</span>
        <h2 className="font-semibold text-lg">Genuine certificate</h2>
        <span className="ml-auto sci-mono text-sm">{c.code}</span>
      </div>
      <p className="text-sm mt-2">
        Issued to <b>{c.name}</b> on {new Date(c.issued_at).toLocaleDateString('en-IN', { dateStyle: 'long' })} for {c.score} of {c.total} correct answers. The server
        graded the answers itself.
      </p>
    </section>
  );
}

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
    if (param && !isCertificate(param)) check(param, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  const v = result ? VERDICT[result.status] : null;
  return (
    <Page>
      <PageHeader title="Verify a post or certificate" text="Every published HIMAKSHA post carries an 8-character code and a QR code; learning certificates carry a code starting with C-. Check a copy you received before you share it." />
      <form
        className="sci-card p-4 flex flex-col gap-3 max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (param !== code.trim().toUpperCase()) navigate(`/verify/${code.trim().toUpperCase()}`, { replace: true });
          if (!isCertificate(code)) check(code);
        }}
      >
        <label className="text-xs sci-muted flex flex-col gap-1">
          Verification code
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={10} className="sci-input sci-mono tracking-widest text-lg" placeholder="e.g. 3F9A12C0 or C-1A2B3C4D" aria-label="Verification code" />
        </label>
        <label className="text-xs sci-muted flex flex-col gap-1">
          Text you received (optional, to catch edited copies)
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="sci-input text-sm" placeholder="Paste the post here" />
        </label>
        <button className="sci-btn self-start" disabled={busy || !(code.trim().length === 8 || isCertificate(code))}>
          {busy ? 'Checking…' : 'Check'}
        </button>
      </form>
      <ErrorNote error={error} />
      {param && isCertificate(param) && <CertificateResult code={param.toUpperCase()} />}
      {result && v && !(param && isCertificate(param)) && (
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
          {result.post && (
            <div className="bg-white/80 rounded-lg text-[#0b1c30]">
              <TracePanel recordId={result.post.itemId} onOpenRecord={(id) => window.location.assign(`/?record=${encodeURIComponent(id)}`)} />
            </div>
          )}
        </section>
      )}
    </Page>
  );
}
