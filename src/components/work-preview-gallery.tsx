import { useEffect, useState } from 'react';
import type { OrderFile } from '../lib/domain';
import { invoke } from '../lib/supabase';
import { Button } from './ui/button';
import { ConfirmationDialog } from './ui/dialog';
import { WorkPreview } from './work-preview';
export function WorkPreviewGallery({ files }: { files: OrderFile[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const pages = files
    .filter((file) => file.kind === 'preview' && file.scan_status === 'clean')
    .sort((a, b) => a.name.localeCompare(b.name, 'hr', { numeric: true }));
  const file = pages[index];
  useEffect(() => {
    let closed = false;
    setUrl('');
    setError('');
    if (open && file)
      void invoke<{ url: string }>('download', { file_id: file.id, action: 'preview' })
        .then((value) => {
          const address = new URL(value.url);
          if (
            address.protocol !== 'https:' &&
            !['localhost', '127.0.0.1'].includes(address.hostname)
          )
            throw new Error('Neispravna adresa pregleda.');
          if (!closed) setUrl(value.url);
        })
        .catch((error) => {
          if (!closed) setError(error instanceof Error ? error.message : 'Pregled nije dostupan.');
        });
    return () => {
      closed = true;
    };
  }, [open, file?.id]);
  if (!pages.length) return null;
  return (
    <>
      <div className="file-row">
        <div>
          <strong>Pregled rada</strong>
          <small>
            {pages.length} stranica pregleda s vodenim žigom. Završna datoteka preuzima se nakon
            cijele uplate.
          </small>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIndex(0);
            setOpen(true);
          }}
        >
          Pregledaj rad
        </Button>
      </div>
      <ConfirmationDialog open={open} onOpenChange={setOpen} title="Pregled rada">
        <div className="actions">
          <Button
            type="button"
            variant="outline"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            Prethodna
          </Button>
          <span>
            Stranica {index + 1} / {pages.length}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={index + 1 >= pages.length}
            onClick={() => setIndex(index + 1)}
          >
            Sljedeća
          </Button>
        </div>
        {error && <p role="alert">{error}</p>}
        {!url && !error && <p role="status">Otvaranje pregleda…</p>}
        {url && file && <WorkPreview url={url} file={file} />}
      </ConfirmationDialog>
    </>
  );
}
