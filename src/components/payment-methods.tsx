import { usePublicPaymentMethods } from '../hooks/use-payment-methods';
import { useSiteSettings } from '../hooks/use-site-settings';
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
  const site = useSiteSettings().data;
  const methods = usePublicPaymentMethods();
  const visible =
    methods.data === null
      ? ['visa', 'mastercard']
          .filter((code) => site?.payment_icons?.[code])
          .map((code) => ({
            id: code,
            code,
            name: code === 'visa' ? 'Visa' : 'Mastercard',
            icon_url: site!.payment_icons![code],
          }))
      : methods.data || [];
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
          {active && visible.some((m) => ['apple_pay', 'google_pay'].includes(m.code)) && (
            <p className="wallet-availability">
              Novčanici se prikazuju u Stripe Checkoutu kada ih podržavaju vaš uređaj i kartica.
            </p>
          )}
        </div>
        {active && (
          <>
            <span className="badge status-succeeded">Aktivno</span>
            <div className="custom-payment-icons">
              {visible.map((method) =>
                method.icon_url ? (
                  <img
                    key={method.id}
                    src={method.icon_url}
                    alt={method.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="custom-payment-label" key={method.id}>
                    {method.name}
                  </span>
                ),
              )}
            </div>
          </>
        )}
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
      {site?.bank_enabled && !site.maintenance && (
        <div className="payment-method-tile enabled">
          <span className="method-symbol">
            <CreditCard size={26} />
          </span>
          <div>
            <strong>IBAN uplata</strong>
            <p>
              Jednokratno ili 50/50 za artikle koji podržavaju dvije rate. Podaci za uplatu
              prikazuju se nakon potvrde narudžbe.
            </p>
          </div>
        </div>
      )}
      <span className="payment-disclaimer">
        <LockKeyhole size={13} />
        Prikazuju se samo aktivirane platne integracije.
      </span>
    </section>
  );
}
