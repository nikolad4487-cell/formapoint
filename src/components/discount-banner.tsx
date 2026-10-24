import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { configured, requireDb } from '../lib/supabase';
import { money } from '../lib/utils';
export function DiscountBanner() {
  const q = useQuery({
    queryKey: ['discount-banner'],
    enabled: configured,
    retry: false,
    queryFn: async () => {
      const { data, error } = await requireDb().rpc('discount_banner');
      if (error) return null;
      return data as {
        name: string;
        code: string;
        kind: string;
        value: number;
        first_order_only?: boolean;
      } | null;
    },
  });
  if (!q.data) return null;
  const offer = q.data;
  return (
    <div className="discount-banner">
      <span>
        {offer.name} · {offer.kind === 'percent' ? `${offer.value} %` : money(offer.value)} popusta
        {offer.first_order_only ? ' za prvu narudžbu' : ''}
      </span>
      <button
        onClick={() =>
          void navigator.clipboard.writeText(offer.code).then(
            () => toast.success('Kod je kopiran.'),
            () => toast.error(`Kod: ${offer.code}`),
          )
        }
      >
        Kod: <strong>{offer.code}</strong> · Kopiraj
      </button>
    </div>
  );
}
