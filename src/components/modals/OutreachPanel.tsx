import React, { useState } from 'react';
import { api, type OutreachChannel, type OutreachContent } from '../../lib/api';

const CHANNEL_LABEL: Record<OutreachChannel, string> = {
  website: 'Website article',
  x: 'X / Twitter',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
};

/** Generates website + social media copy for an archive record (server-side templates). */
export const OutreachPanel: React.FC<{ itemId: string }> = ({ itemId }) => {
  const [content, setContent] = useState<OutreachContent[] | null>(null);
  const [active, setActive] = useState<OutreachChannel>('website');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.generateOutreach(itemId);
      setContent(res.content);
      setActive(res.content[0]?.channel ?? 'website');
    } catch (err: any) {
      setError(err?.message || 'Could not generate content.');
    } finally {
      setLoading(false);
    }
  };

  const current = content?.find((c) => c.channel === active);

  const copy = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Clipboard is not available in this browser.');
    }
  };

  if (!content) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-['Space_Grotesk'] font-bold text-xs uppercase tracking-wider text-slate-500 block">
            Outreach & Media Dissemination
          </span>
          <span className="font-['Inter'] text-xs text-slate-500">
            Draft a website article and social posts (X, LinkedIn, Instagram) from this record.
          </span>
          {error && <span className="block font-['Inter'] text-xs text-red-600 mt-1">{error}</span>}
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-60 text-white font-['JetBrains_Mono'] text-xs font-bold flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">campaign</span>
          {loading ? 'Generating…' : 'Generate posts'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 p-1.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        {content.map((c) => (
          <button
            key={c.channel}
            onClick={() => setActive(c.channel)}
            className={`px-2.5 py-1 rounded-lg font-['JetBrains_Mono'] text-[11px] font-bold transition-colors ${
              active === c.channel
                ? 'bg-[#00677d] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {CHANNEL_LABEL[c.channel]}
          </button>
        ))}
      </div>
      {current && (
        <div className="p-3 space-y-2">
          {current.metaDescription && (
            <p className="font-['JetBrains_Mono'] text-[11px] text-slate-500">
              slug: /{current.slug} • meta: {current.metaDescription}
            </p>
          )}
          <pre className="whitespace-pre-wrap max-h-56 overflow-y-auto p-3 rounded-lg bg-slate-900 text-slate-100 font-['Inter'] text-xs leading-relaxed">
            {current.text}
          </pre>
          <div className="flex items-center justify-between font-['JetBrains_Mono'] text-[11px]">
            <span className={current.limit && current.characters > current.limit ? 'text-red-600' : 'text-slate-500'}>
              {current.characters}
              {current.limit ? ` / ${current.limit}` : ''} characters
            </span>
            <button onClick={copy} className="px-2.5 py-1 rounded-lg bg-[#00b4d8] hover:bg-[#0077b6] text-white font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {error && <p className="font-['Inter'] text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
};
