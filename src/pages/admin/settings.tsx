import { PaymentMethodManager } from '../../components/payment-method-manager';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2, Mail, Globe, CreditCard, User, ShieldCheck, Save, Send } from 'lucide-react';
import { useRows } from '../../hooks/use-data';
import { useAuth } from '../../hooks/use-auth';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/common';
import { AdminData, UpgradeNotice } from '../../components/admin-data';
import { action, ProfilePage, SettingsPage } from '../workspace';
import { requireDb, invoke } from '../../lib/supabase';
import {
  businessSchema,
  siteSchema,
  parsed,
  field,
  nullable,
  type SiteSettings,
  type BusinessSettings,
} from '../../lib/admin-tools';
const tabs = [
  ['general', 'Opće postavke', Globe],
  ['business', 'Poslovni podaci', Building2],
  ['payments', 'Uplate i pravila', CreditCard],
  ['email', 'Obavijesti', Mail],
  ['profile', 'Osobni podaci', User],
  ['system', 'Sustav', ShieldCheck],
] as const;
export function PlatformSettings() {
  const [tab, setTab] = useState('general');
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  const q = useRows<SiteSettings>('site_settings');
  const b = useRows<BusinessSettings>('business_settings');
  const site = q.data?.[0],
    business = b.data?.[0];
  const expanded = site?.platform_name !== undefined && business?.notification_email !== undefined;
  const checkoutReady = useQuery({
    queryKey: ['admin-checkout-ready'],
    enabled: tab === 'payments',
    retry: false,
    queryFn: async () => {
      const { error } = await requireDb().rpc('checkout_options');
      if (error?.code === 'PGRST202' || error?.code === '42883') return false;
      if (error) throw new Error(error.message);
      return true;
    },
  });
  const health = useQuery({
    queryKey: ['admin-tools-health'],
    retry: false,
    queryFn: () =>
      invoke<{ email_configured: boolean; invites_available: boolean }>('admin-tools', {
        action: 'health',
      }),
  });
  const { session } = useAuth();
  async function save(form: HTMLFormElement, kind: 'site' | 'business') {
    setBusy(true);
    const data = new FormData(form);
    const ok = await action(async () => {
      if (kind === 'site') {
        const values = parsed(siteSchema, {
          platform_name: data.has('platform_name')
            ? field(data, 'platform_name')
            : site?.platform_name || 'FormaPoint',
          contact_phone: data.has('contact_phone')
            ? field(data, 'contact_phone')
            : site?.contact_phone || '',
          public_contact_email: data.has('public_contact_email')
            ? field(data, 'public_contact_email')
            : site?.public_contact_email || '',
          facebook_url: field(data, 'facebook_url'),
          instagram_url: field(data, 'instagram_url'),
          linkedin_url: field(data, 'linkedin_url'),
          stripe_enabled:
            tab === 'payments'
              ? data.get('stripe_enabled') === 'on'
              : site?.stripe_enabled || false,
          maintenance:
            tab === 'payments' ? data.get('maintenance') === 'on' : (site?.maintenance ?? true),
          cancellation_days:
            tab === 'payments'
              ? field(data, 'cancellation_days')
                ? Number(field(data, 'cancellation_days'))
                : null
              : (site?.cancellation_days ?? null),
          final_payment_days:
            tab === 'payments'
              ? field(data, 'final_payment_days')
                ? Number(field(data, 'final_payment_days'))
                : null
              : (site?.final_payment_days ?? null),
          policies_approved:
            tab === 'payments'
              ? data.get('policies_approved') === 'on'
              : site?.policies_approved || false,
          payment_icons: site?.payment_icons || {},
        });
        if (tab === 'payments') {
          values.facebook_url = site?.facebook_url || '';
          values.instagram_url = site?.instagram_url || '';
          values.linkedin_url = site?.linkedin_url || '';
        }
        const payload: Record<string, unknown> = { ...values };
        delete payload.payment_icons;
        if (tab === 'payments' && checkoutReady.data === true)
          payload.bank_enabled = data.get('bank_enabled') === 'on';
        const { error } = await requireDb().from('site_settings').update(payload).eq('id', true);
        if (error) throw error;
      } else {
        const values = parsed(businessSchema, {
          legal_name: data.has('legal_name')
            ? field(data, 'legal_name')
            : business?.legal_name || '',
          address: data.has('address') ? field(data, 'address') : business?.address || '',
          contact_email: data.has('contact_email')
            ? field(data, 'contact_email')
            : business?.contact_email || '',
          tax_status: data.has('tax_status')
            ? field(data, 'tax_status')
            : business?.tax_status || '',
          notification_email:
            tab === 'email'
              ? field(data, 'notification_email')
              : business?.notification_email || '',
          payment_recipient:
            tab === 'payments'
              ? field(data, 'payment_recipient')
              : business?.payment_recipient || '',
          iban: tab === 'payments' ? field(data, 'iban') : business?.iban || '',
          bank_name: tab === 'payments' ? field(data, 'bank_name') : business?.bank_name || '',
          payment_phone:
            tab === 'payments' ? field(data, 'payment_phone') : business?.payment_phone || '',
        });
        const payload = Object.fromEntries(
          Object.entries(values).map(([k, v]) => [k, nullable(v)]),
        );
        const { error } = await requireDb()
          .from('business_settings')
          .update(payload)
          .eq('id', true);
        if (error) throw error;
      }
      await cache.invalidateQueries();
    });
    setBusy(false);
    return ok;
  }
  return (
    <>
      <PageHeader
        title="Postavke aplikacije"
        description="Uredite identitet, kontakt, obavijesti, podatke za uplatu i svoja pravila poslovanja."
      />
      <nav className="settings-tabs" aria-label="Odjeljci postavki">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
      <AdminData query={q}>
        <AdminData query={b}>
          {!expanded && <UpgradeNotice />}
          {site && business && (
            <div key={tab}>
              {tab === 'general' && (
                <form
                  className="panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save(e.currentTarget, 'site');
                  }}
                >
                  <h2>Identitet i javni kontakt</h2>
                  <div className="form-row">
                    <label>
                      Naziv platforme
                      <input
                        name="platform_name"
                        required
                        minLength={2}
                        maxLength={80}
                        defaultValue={site.platform_name || 'FormaPoint'}
                      />
                    </label>
                    <label>
                      Javni kontakt e-mail
                      <input
                        name="public_contact_email"
                        type="email"
                        defaultValue={site.public_contact_email || ''}
                      />
                    </label>
                  </div>
                  <label>
                    Javni telefon
                    <input
                      name="contact_phone"
                      type="tel"
                      maxLength={40}
                      defaultValue={site.contact_phone || ''}
                    />
                  </label>
                  <h3>Društvene mreže</h3>
                  {[
                    ['facebook_url', 'Facebook URL'],
                    ['instagram_url', 'Instagram URL'],
                    ['linkedin_url', 'LinkedIn URL'],
                  ].map(([name, label]) => (
                    <label key={name}>
                      {label}
                      <input
                        name={name}
                        type="url"
                        placeholder="https://…"
                        defaultValue={String(site[name as keyof SiteSettings] || '')}
                      />
                    </label>
                  ))}
                  <p>
                    Prazna polja ne prikazuju se posjetiteljima. Za izvoz logotipa otvorite{' '}
                    <Link className="text-link" to="/admin/vizualni-identitet">
                      vizualni identitet
                    </Link>
                    .
                  </p>
                  <Button disabled={busy || !expanded}>
                    <Save size={16} />
                    Spremi opće postavke
                  </Button>
                </form>
              )}
              {tab === 'business' && (
                <form
                  className="panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save(e.currentTarget, 'business');
                  }}
                >
                  <h2>Podaci o pružatelju usluga</h2>
                  {[
                    ['legal_name', 'Naziv tvrtke ili obrta'],
                    ['address', 'Adresa'],
                    ['contact_email', 'Poslovni e-mail'],
                    ['tax_status', 'Porezni status'],
                  ].map(([name, label]) => (
                    <label key={name}>
                      {label}
                      <input
                        name={name}
                        type={name === 'contact_email' ? 'email' : 'text'}
                        maxLength={name === 'address' ? 300 : 200}
                        defaultValue={String(business[name as keyof BusinessSettings] || '')}
                      />
                    </label>
                  ))}
                  <p>
                    Poslovni podaci su interni. Pravne tekstove pregledajte i odobrite u modulu
                    Stranice.
                  </p>
                  <Button disabled={busy || !expanded}>
                    <Save size={16} />
                    Spremi poslovne podatke
                  </Button>
                </form>
              )}
              {tab === 'payments' && (
                <div className="settings-columns">
                  <form
                    className="panel"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(e.currentTarget, 'business');
                    }}
                  >
                    <h2>Podaci za uplatu</h2>
                    {[
                      ['payment_recipient', 'Primatelj (naziv tvrtke ili obrta)'],
                      ['iban', 'IBAN'],
                      ['bank_name', 'Banka'],
                      ['payment_phone', 'Kontakt za uplatu (neobvezno)'],
                    ].map(([name, label]) => (
                      <label key={name}>
                        {label}
                        <input
                          name={name}
                          defaultValue={String(business[name as keyof BusinessSettings] || '')}
                          maxLength={name === 'iban' ? 40 : 200}
                        />
                      </label>
                    ))}
                    <p>
                      Primatelj, IBAN i banka prikazuju se kupcu koji odabere IBAN uplatu. Nakon
                      spremanja podataka uključite IBAN plaćanje u susjednom obrascu.
                    </p>
                    <Button disabled={busy || !expanded}>Spremi podatke za uplatu</Button>
                  </form>
                  <div className="payment-settings-stack">
                    <form
                      className="panel"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void save(e.currentTarget, 'site');
                      }}
                    >
                      <h2>Plaćanje i rokovi</h2>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          name="bank_enabled"
                          key={String(site.bank_enabled)}
                          defaultChecked={site.bank_enabled}
                          disabled={checkoutReady.data !== true}
                        />
                        Omogući IBAN plaćanje (jednokratno i 50/50)
                      </label>
                      {checkoutReady.data === false && (
                        <p>
                          Za košaricu i IBAN primijenite{' '}
                          <a
                            className="text-link"
                            href="/migracije/202610250010_cart_checkout.sql"
                            download
                          >
                            SQL nadogradnju 010
                          </a>
                          .
                        </p>
                      )}
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          name="stripe_enabled"
                          defaultChecked={site.stripe_enabled}
                        />
                        Stripe je konfiguriran i provjeren
                      </label>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          name="maintenance"
                          defaultChecked={site.maintenance}
                        />
                        Način pripreme — svi načini plaćanja isključeni
                      </label>
                      <div className="form-row">
                        <label>
                          Rok za zahtjev za otkazivanje (dani)
                          <input
                            name="cancellation_days"
                            type="number"
                            min={0}
                            max={365}
                            defaultValue={site.cancellation_days ?? ''}
                          />
                        </label>
                        <label>
                          Rok za završnu uplatu (dani)
                          <input
                            name="final_payment_days"
                            type="number"
                            min={1}
                            max={365}
                            defaultValue={site.final_payment_days ?? ''}
                          />
                        </label>
                      </div>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          name="policies_approved"
                          defaultChecked={site.policies_approved}
                        />
                        Pravila su pravno provjerena i odobrena za nove narudžbe
                      </label>
                      <p>
                        Rokovi se zaključavaju na novoj narudžbi. Ne mijenjaju ranije ugovorene
                        uvjete i ne otkazuju automatski narudžbe.
                      </p>
                      <Button disabled={busy || !expanded}>Spremi plaćanje i pravila</Button>
                    </form>
                    <div className="panel">
                      <PaymentMethodManager />
                    </div>
                  </div>
                </div>
              )}
              {tab === 'email' && (
                <div className="settings-columns">
                  <form
                    className="panel"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(e.currentTarget, 'business');
                    }}
                  >
                    <h2>Obavijesti sustava</h2>
                    <label>
                      E-mail za obavijesti (primatelj)
                      <input
                        type="email"
                        name="notification_email"
                        defaultValue={business.notification_email || ''}
                      />
                    </label>
                    <p>
                      Primatelj probne administratorske poruke. Obavijesti o narudžbama šalju se
                      njihovim vlasnicima.
                    </p>
                    <div className="actions">
                      <Button disabled={busy || !expanded}>Spremi primatelja</Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!health.data?.email_configured || !business.notification_email}
                        onClick={() =>
                          void action(
                            () => invoke('admin-tools', { action: 'test-email' }),
                            'Probna poruka predana je pružatelju.',
                          )
                        }
                      >
                        <Send size={16} />
                        Pošalji probni e-mail
                      </Button>
                    </div>
                  </form>
                  <section className="panel">
                    <h2>Konfiguracija e-pošte</h2>
                    <p>
                      {health.isPending
                        ? 'Provjera integracije…'
                        : health.data?.email_configured
                          ? 'Resend je konfiguriran; isporuku potvrdite probnom porukom.'
                          : 'Slanje nije dostupno dok se ne objavi admin-tools funkcija i konfigurira pružatelj.'}
                    </p>
                    <div className="notice">
                      <Mail />
                      <p>
                        Resend ključevi i potvrđena adresa pošiljatelja postavljaju se u Supabase
                        Edge Secrets. Zoho/SMTP lozinke ne unose se u ovaj obrazac. Izravni SMTP
                        adapter još nije povezan.
                      </p>
                    </div>
                    <Link className="text-link" to="/admin/newsletter">
                      Newsletter predlošci i pretplatnici
                    </Link>
                  </section>
                </div>
              )}
              {tab === 'profile' && (
                <>
                  <ProfilePage embedded />
                  <SettingsPage embedded />
                </>
              )}
              {tab === 'system' && (
                <section className="panel">
                  <h2>Zdravlje i evidencije</h2>
                  <p>Baza podataka: veza potvrđena učitavanjem postavki.</p>
                  <p>Prijavljeni administrator: {session?.user.email}</p>
                  <p>
                    Online naplata:{' '}
                    {site.stripe_enabled && !site.maintenance
                      ? 'uključena u postavkama; provjeriti Stripe webhook'
                      : 'isključena'}
                  </p>
                  <p>
                    E-mail adapter:{' '}
                    {health.data?.email_configured ? 'konfiguriran' : 'nije dostupan'}
                  </p>
                  <div className="actions">
                    <Button variant="outline" onClick={() => void cache.invalidateQueries()}>
                      Osvježi provjere
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/admin/audit-log">Audit log</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/admin/dizajn-sustav">Dizajn-sustav</Link>
                    </Button>
                  </div>
                </section>
              )}
            </div>
          )}
        </AdminData>
      </AdminData>
    </>
  );
}
