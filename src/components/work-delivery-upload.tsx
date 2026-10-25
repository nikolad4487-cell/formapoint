import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { FilePicker } from '../pages/workspace';
import { requireDb, rpc } from '../lib/supabase';
import type { Order } from '../lib/domain';
async function upload(orderId: string, file: File, kind: string) {
  const form = new FormData();
  form.set('order_id', orderId);
  form.set('file', file);
  form.set('kind', kind);
  const { data, error } = await requireDb().functions.invoke('upload', { body: form });
  if (error || !data?.ok || !data.file_id)
    throw new Error(
      'Prijenos nije dovršen. Provjerite popis već prenesenih datoteka prije ponovnog pokušaja.',
    );
  return data.file_id as string;
}
async function requestFinalPayment(orderId: string) {
  const { data, error } = await requireDb().from('orders').select('*').eq('id', orderId).single();
  if (error) throw error;
  const order = data as Order;
  if (
    order.payment_model !== 'split' ||
    !order.total_cents ||
    order.paid_cents >= order.total_cents ||
    order.status === 'final_pending'
  )
    return;
  if (!['ready', 'in_progress', 'needs_info', 'work_done'].includes(order.status)) return;
  if (['ready', 'needs_info'].includes(order.status))
    await rpc('transition_order', { p_order: orderId, p_status: 'in_progress' });
  if (order.status !== 'work_done')
    await rpc('transition_order', { p_order: orderId, p_status: 'work_done' });
  await rpc('transition_order', { p_order: orderId, p_status: 'final_pending' });
}
export function WorkDeliveryUpload({ orderId }: { orderId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<File | null>(null);
  const [kind, setKind] = useState('final');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const cache = useQueryClient();
  return (
    <div className="work-delivery-upload">
      <label>
        Vrsta
        <select value={kind} disabled={busy} onChange={(e) => setKind(e.target.value)}>
          <option value="final">Završni rad i pregled za korisnika</option>
          <option value="preview">Samo pregled rada</option>
          <option value="attachment">Privitak</option>
        </select>
      </label>
      <FilePicker files={files} setFiles={setFiles} />
      {kind !== 'attachment' && (
        <>
          <p>
            PDF, PNG i JPG pretvaraju se u odvojene slike pregleda s vodenim žigom. Za Word, Excel
            ili PowerPoint priložite PDF ili sliku za pregled. Izvornik ostaje zaključan do potvrde
            cijele uplate i sigurnosne provjere.
          </p>
          {kind === 'final' && (
            <label>
              PDF ili slika za pregled Word/Excel/PowerPoint rada (ako je potrebno)
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                disabled={busy}
                onChange={(e) => setPreview(e.target.files?.[0] || null)}
              />
            </label>
          )}
          <p>
            Pri objavi završnog rada s modelom 50/50 narudžba prelazi na čekanje druge uplate.
            Jednokratno plaćanje nema drugu uplatu.
          </p>
        </>
      )}
      {progress && <p role="status">{progress}</p>}
      <Button
        type="button"
        variant="outline"
        disabled={busy || !files.length}
        onClick={async () => {
          setBusy(true);
          try {
            const prepared: File[] = [];
            if (kind !== 'attachment') {
              setProgress('Priprema pregleda s vodenim žigom…');
              const { createWorkPreviews, supportsWorkPreview } =
                await import('../lib/work-previews');
              const sources = files.filter(supportsWorkPreview);
              if (files.some((file) => !supportsWorkPreview(file)) && !preview)
                throw new Error('Za Word/Excel/PowerPoint priložite PDF ili sliku za pregled.');
              if (preview) sources.push(preview);
              for (const source of sources)
                for await (const page of createWorkPreviews(source)) {
                  prepared.push(page);
                  if (prepared.length > 64)
                    throw new Error(
                      'Odjednom možete objaviti najviše 64 stranice pregleda. Podijelite dulji rad u više prijenosa.',
                    );
                }
            }
            if (kind !== 'preview')
              for (let i = 0; i < files.length; i++) {
                setProgress(`Prijenos datoteke ${i + 1}/${files.length}…`);
                await upload(orderId, files[i], kind);
              }
            for (let i = 0; i < prepared.length; i++) {
              setProgress(`Objava pregleda ${i + 1}/${prepared.length}…`);
              const id = await upload(orderId, prepared[i], 'preview');
              await rpc('mark_file_scanned', {
                p_file: id,
                p_status: 'clean',
                p_reason:
                  'Administrator je objavio zaseban rasterizirani JPEG pregled, ponovno kodiran bez ugrađenog sadržaja i označen vodenim žigom.',
              });
            }
            let statusFailed = false;
            if (kind === 'final') {
              try {
                await requestFinalPayment(orderId);
              } catch {
                statusFailed = true;
                toast.error(
                  'Rad i pregled su preneseni, ali status nije promijenjen. U detaljima narudžbe postavite Rad dovršen pa Čeka završnu uplatu.',
                );
              }
            }
            setFiles([]);
            setPreview(null);
            if (!statusFailed)
              toast.success(
                kind === 'attachment'
                  ? 'Privici su preneseni i čekaju sigurnosnu provjeru.'
                  : 'Pregled je objavljen. Izvornici ostaju dostupni prema provjeri uplate i sigurnosnoj provjeri.',
              );
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Prijenos nije dovršen.');
          } finally {
            await cache.invalidateQueries();
            setBusy(false);
            setProgress('');
          }
        }}
      >
        {busy
          ? 'Prijenos…'
          : kind === 'final'
            ? 'Prenesi rad i objavi pregled'
            : kind === 'preview'
              ? 'Objavi pregled rada'
              : 'Prenesi privitke'}
      </Button>
    </div>
  );
}
