import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/** QR code + short code for a published post. Scanning opens /verify/<code>, which says whether the copy is genuine. */
export function VerifyBadge({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const url = `${location.origin}/verify/${code}`;
  useEffect(() => {
    let alive = true;
    import('qrcode')
      .then((q) => q.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0b1c30', light: '#ffffff00' } }))
      .then((s) => alive && setSvg(s))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <Link to={`/verify/${code}`} className="flex items-center gap-2 text-xs sci-well px-2 py-1.5 rounded-lg hover:shadow" title="Scan or open to check this post is genuine" data-testid="verify-badge">
      {svg ? <span className="w-10 h-10 shrink-0 [&>svg]:w-full [&>svg]:h-full" aria-hidden dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="w-10 h-10" />}
      <span className="leading-tight">
        <span className="block sci-muted">Verify this post</span>
        <span className="sci-mono font-semibold tracking-wider">{code}</span>
      </span>
    </Link>
  );
}
