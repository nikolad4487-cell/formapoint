import { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '../../components/common';
import { Button } from '../../components/ui/button';
import { useSiteSettings } from '../../hooks/use-site-settings';
import { action } from '../workspace';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export function logoSvg(name: string, square: boolean, transparent: boolean) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${square ? 1024 : 1800}" height="${square ? 1024 : 560}" viewBox="0 0 ${square ? '1024 1024' : '1800 560'}">${transparent ? '' : `<rect width="100%" height="100%" rx="${square ? 180 : 60}" fill="#fff"/>`}<defs><linearGradient id="b"><stop stop-color="#0753ff"/><stop offset="1" stop-color="#399aff"/></linearGradient><linearGradient id="v"><stop stop-color="#6745f6"/><stop offset="1" stop-color="#b49aff"/></linearGradient></defs><g transform="${square ? 'translate(302 260) scale(10.5)' : 'translate(80 115) scale(6.6)'}"><path d="M4 14 27 1l10 6-23 13v26L4 40V14Z" fill="url(#b)"/><path d="m14 20 23-13v12L14 32V20Z" fill="url(#v)"/><path d="m14 32 14-8 9 5-23 13V32Z" fill="#8a63f7"/><path d="m4 14 10 6L37 7 27 1 4 14Z" fill="#2787ff"/><path d="m14 20 9-5v12l-9 5V20Z" fill="#193cf0" opacity=".6"/></g>${square ? '' : `<text x="380" y="330" fill="#10183f" font-family="Arial,sans-serif" font-weight="700" font-size="${Math.min(150, (1200 / Math.max(name.length, 1)) * 1.6)}">${esc(name)}</text>`}</svg>`;
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function VisualIdentity() {
  const q = useSiteSettings();
  const [transparent, setTransparent] = useState(false),
    [busy, setBusy] = useState(false);
  const name = q.data?.platform_name || 'FormaPoint';
  async function exportLogo(square: boolean, format: 'png' | 'svg') {
    setBusy(true);
    await action(async () => {
      const svg = logoSvg(name, square, transparent),
        blob = new Blob([svg], { type: 'image/svg+xml' }),
        filename = `formapoint-${square ? 'profil' : 'logotip'}.${format}`;
      if (format === 'svg') {
        download(blob, filename);
        return;
      }
      const url = URL.createObjectURL(blob);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = square ? 1024 : 1800;
        canvas.height = square ? 1024 : 560;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Izvoz nije podržan.');
        ctx.drawImage(img, 0, 0);
        const png = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Izvoz nije uspio.'))),
            'image/png',
          ),
        );
        download(png, filename);
      } finally {
        URL.revokeObjectURL(url);
      }
    }, 'Logotip je pripremljen za preuzimanje.');
    setBusy(false);
  }
  return (
    <>
      <PageHeader
        title="Vizualni identitet"
        description="Profilna oznaka i puni logotip FormaPointa spremni za preuzimanje."
      />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={transparent}
          onChange={(e) => setTransparent(e.target.checked)}
        />
        Prozirna pozadina pri izvozu
      </label>
      <div className="identity-grid">
        {[true, false].map((square) => (
          <section className="panel identity-card" key={String(square)}>
            <h2>{square ? 'Profilna oznaka' : 'Puni logotip'}</h2>
            <img
              alt={square ? 'Profilna oznaka FormaPoint' : 'Puni logotip FormaPoint'}
              src={`data:image/svg+xml,${encodeURIComponent(logoSvg(name, square, false))}`}
            />
            <p>{square ? '1024 × 1024 px' : '1800 × 560 px'}</p>
            <div className="actions">
              <Button disabled={busy} onClick={() => void exportLogo(square, 'png')}>
                <Download size={16} />
                Preuzmi PNG
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void exportLogo(square, 'svg')}
              >
                Preuzmi SVG
              </Button>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
