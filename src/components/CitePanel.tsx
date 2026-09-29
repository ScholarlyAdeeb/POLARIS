import React, { useEffect, useState } from 'react';
import { api, download, downloadUrls } from '../lib/api';
import { useT } from '../lib/i18n';

type Format = 'apa' | 'bibtex' | 'ris';
const LABEL: Record<Format, string> = { apa: 'APA', bibtex: 'BibTeX', ris: 'RIS' };

/** Citation in APA / BibTeX / RIS for any record, with copy and download. */
export function CitePanel({ recordId }: { recordId: string }) {
  const { t } = useT();
  const [format, setFormat] = useState<Format>('apa');
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setText('');
    api
      .cite(recordId, format)
      .then((r) => setText(r.text))
      .catch(() => setText(''));
  }, [recordId, format]);

  if (!text) return null;
  return (
    <section className="flex flex-col gap-2" data-testid="cite-panel">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-sm font-semibold">{t('common.cite')}</h4>
        <div className="flex rounded-lg sci-well p-0.5 text-xs">
          {(Object.keys(LABEL) as Format[]).map((f) => (
            <button key={f} onClick={() => setFormat(f)} aria-pressed={format === f} className={`px-2 py-0.5 rounded ${format === f ? 'bg-white font-semibold' : 'sci-muted'}`}>
              {LABEL[f]}
            </button>
          ))}
        </div>
      </div>
      <pre className="sci-well p-2 text-[11px] sci-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">{text}</pre>
      <div className="flex gap-2">
        <button
          className="sci-btn-ghost text-xs py-1"
          onClick={() => {
            navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? t('common.copied') : t('common.copy')}
        </button>
        <button className="sci-btn-ghost text-xs py-1" onClick={() => download(downloadUrls.cite(recordId, format))}>
          {t('common.download')} .{format === 'bibtex' ? 'bib' : format === 'ris' ? 'ris' : 'txt'}
        </button>
      </div>
    </section>
  );
}
