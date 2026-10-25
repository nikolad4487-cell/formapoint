import { useEffect, useState } from 'react';
import type { OrderFile } from '../lib/domain';
export function WorkPreview({ url, file }: { url: string; file: OrderFile }) {
  const [pages, setPages] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const urls: string[] = [];
    let closed = false;
    setPages([]);
    setError('');
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok)
          throw new Error('Pregled nije moguće otvoriti. Zatvorite ga i pokušajte ponovno.');
        const source = new File([await response.blob()], file.name);
        if (/\.(png|jpe?g)$/i.test(file.name)) {
          if (closed) return;
          const objectUrl = URL.createObjectURL(source);
          urls.push(objectUrl);
          setPages([objectUrl]);
          return;
        }
        const { createWorkPreviews } = await import('../lib/work-previews');
        for await (const page of createWorkPreviews(source)) {
          if (closed) break;
          const objectUrl = URL.createObjectURL(page);
          urls.push(objectUrl);
          setPages([...urls]);
        }
      } catch (error) {
        if (!closed) setError(error instanceof Error ? error.message : 'Pregled nije dostupan.');
      }
    })();
    return () => {
      closed = true;
      controller.abort();
      for (const value of urls) URL.revokeObjectURL(value);
    };
  }, [url, file.name]);
  return (
    <div className="work-preview" onContextMenu={(e) => e.preventDefault()}>
      <p>
        Pregled rada s vodenim žigom. Završnu datoteku možete preuzeti nakon potvrde cijele uplate.
      </p>
      {error && <p role="alert">{error}</p>}
      {!pages.length && !error && <p role="status">Priprema pregleda…</p>}
      {pages.map((src, i) => (
        <img src={src} key={src} alt={`Pregled rada — stranica ${i + 1}`} draggable={false} />
      ))}
    </div>
  );
}
