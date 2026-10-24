import { useQuery } from '@tanstack/react-query';
import { CreditCard, Gift, LockKeyhole, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { configured, requireDb } from '../lib/supabase';
export function usePaymentAvailability() {
  return useQuery({
    queryKey: ['payment-availability'],
    enabled: configured,
    queryFn: async () => {
      const { data, error } = await requireDb()
        .from('site_settings')
        .select('stripe_enabled,maintenance')
        .single();
      if (error) throw error;
      return Boolean(data.stripe_enabled && !data.maintenance);
    },
  });
}
export function PaymentMethods({ compact = false }: { compact?: boolean }) {
  const q = usePaymentAvailability();
  const active = configured && q.data === true;
  return (
    <section
      className={`payment-methods ${compact ? 'compact' : ''}`}
      aria-label="Dostupnost plaćanja"
    >
      <div>
        <span className="eyebrow">FLEKSIBILNO PLAĆANJE</span>
        <h2>
          Jasan dogovor.
          <br /> Sigurna naplata.
        </h2>
        <p>Uvjeti su poznati prije početka rada.</p>
      </div>
      <div className={`payment-method-tile ${active ? 'enabled' : ''}`}>
        <span className="method-symbol">
          <CreditCard size={26} />
        </span>
        <div>
          <strong>Stripe Checkout</strong>
          <p>
            {active
              ? 'Kartično plaćanje na sigurnoj stranici pružatelja.'
              : q.isFetching
                ? 'Provjera dostupnosti…'
                : q.isError
                  ? 'Dostupnost plaćanja nije moguće provjeriti.'
                  : 'Online plaćanje trenutačno nije aktivirano.'}
          </p>
          {q.isError && (
            <button className="text-link" onClick={() => void q.refetch()}>
              Ponovi provjeru
            </button>
          )}
        </div>
        {active && <span className="badge status-succeeded">Aktivno</span>}
      </div>
      <Link className="payment-method-tile split-method" to="/kako-funkcionira">
        <span className="method-symbol">
          <Gift size={30} />
        </span>
        <div>
          <strong>Moguće je i plaćanje 50/50</strong>
          <p>Za odabrane usluge i prihvaćene ponude.</p>
          <span className="text-link">
            Saznaj više <ArrowRight size={14} />
          </span>
        </div>
      </Link>
      <span className="payment-disclaimer">
        <LockKeyhole size={13} />
        Prikazuju se samo aktivirane platne integracije.
      </span>
    </section>
  );
}
