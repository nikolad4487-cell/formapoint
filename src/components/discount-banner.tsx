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
        payment_restriction?: string;
      } | null;
    },
  });
  if (!q.data) return null;
  const offer = q.data;
  return (
    <div className="discount-banner">
      <span>
        {offer.code.toUpperCase() === 'POPUST10' && offer.kind === 'percent' ? (
          `Popust ${offer.value}% na prvu narudžbu - vrijedi samo za jednokratno kartično plaćanje`
        ) : (
          <>
            {offer.name} · {offer.kind === 'percent' ? `${offer.value} %` : money(offer.value)}{' '}
            popusta
            {offer.first_order_only ? ' za prvu narudžbu' : ''}
            {offer.payment_restriction === 'card_full' &&
              ' - vrijedi samo za jednokratno kartično plaćanje'}
          </>
        )}
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
