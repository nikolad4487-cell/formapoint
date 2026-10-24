import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { requireDb } from '../lib/supabase';
import { action } from '../pages/workspace';
const methods = [
  ['visa', 'Visa'],
  ['mastercard', 'Mastercard'],
  ['apple_pay', 'Apple Pay'],
  ['google_pay', 'Google Pay'],
  ['keks', 'KEKS Pay'],
  ['aircash', 'Aircash'],
] as const;
export async function preparePaymentIcon(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2097152)
    throw new Error('Odaberite PNG, JPG ili WebP sliku do 2 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth > 4096 ||
      image.naturalHeight > 4096
    )
      throw new Error('Slika smije imati najviše 4096 × 4096 piksela.');
    const ratio = Math.min(1, 512 / image.naturalWidth, 512 / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Preglednik ne podržava pripremu slike.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob && blob.size <= 2097152
            ? resolve(blob)
            : reject(new Error('Slika se ne može pripremiti.')),
        'image/png',
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function PaymentIconUpload({ icons }: { icons: Record<string, string> }) {
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(false);
  const cache = useQueryClient();
  async function upload(method: string, file: File) {
    setBusy(method);
    setError(false);
    const ok = await action(async () => {
      const png = await preparePaymentIcon(file),
        path = `${method}/${crypto.randomUUID()}.png`,
        db = requireDb();
      const { error: uploadError } = await db.storage
        .from('payment-icons')
        .upload(path, png, { contentType: 'image/png', upsert: false });
      if (uploadError)
        throw new Error(
          'Učitavanje nije uspjelo. Provjerite SQL nadogradnju za ikone i pokušajte ponovno.',
        );
      const { data } = db.storage.from('payment-icons').getPublicUrl(path);
      const { error: saveError } = await db.rpc('set_payment_icon', {
        p_method: method,
        p_url: data.publicUrl,
      });
      if (saveError) {
        await db.storage.from('payment-icons').remove([path]);
        throw saveError;
      }
      await cache.invalidateQueries({ queryKey: ['site_settings'] });
    }, 'Ikona je učitana i spremljena.');
    setError(!ok);
    setBusy('');
  }
  return (
    <div className="payment-icon-editor">
      <h3>Vlastite ikone plaćanja</h3>
      <p>
        Odaberite PNG, JPG ili WebP sliku do 2 MB. Ikona se automatski priprema i sprema; poveznicu
        ne trebate unositi.
      </p>
      {methods.map(([key, label]) => (
        <div className="payment-icon-row" key={key}>
          <div className="payment-icon-preview">
            {icons[key] ? (
              <img src={icons[key]} alt={`Ikona ${label}`} referrerPolicy="no-referrer" />
            ) : (
              <span>{label}</span>
            )}
          </div>
          <label className="icon-file-label">
            {label}
            <span>
              <Upload size={15} />
              {busy === key ? 'Učitavanje…' : 'Učitaj ikonu'}
            </span>
            <input
              type="file"
              aria-label={`Učitaj ikonu ${label}`}
              accept="image/png,image/jpeg,image/webp"
              disabled={Boolean(busy)}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void upload(key, file);
              }}
            />
          </label>
          {icons[key] && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Ukloni ikonu ${label}`}
              disabled={Boolean(busy)}
              onClick={() =>
                void action(async () => {
                  const { error } = await requireDb().rpc('set_payment_icon', {
                    p_method: key,
                    p_url: null,
                  });
                  if (error) throw error;
                  await cache.invalidateQueries({ queryKey: ['site_settings'] });
                }, 'Ikona je uklonjena.')
              }
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      ))}
      {error && (
        <p role="alert">
          Ako baza još nije nadograđena, jednom pokrenite{' '}
          <a className="text-link" href="/migracije/202610240007_icons_first_order.sql" download>
            SQL nadogradnju za ikone i nove korisnike
          </a>
          .
        </p>
      )}
    </div>
  );
}
