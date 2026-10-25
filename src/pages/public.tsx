import { AddToCartButton } from '../components/add-to-cart';
import { usePublishedPage } from '../hooks/use-site-settings';
import { PublishedText } from './content';
import { WorkspaceIllustration, BrandBenefit } from '../components/brand';
import { PaymentMethods } from '../components/payment-methods';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Clock3,
  MessagesSquare,
  Layers,
  Sparkles,
  CheckCircle2,
  LockKeyhole,
  Plus,
  Minus,
  ArrowUpRight,
} from 'lucide-react';
import { useServices } from '../hooks/use-data';
import { Button } from '../components/ui/button';
import {
  Breadcrumbs,
  EmptyState,
  ErrorState,
  LinkButton,
  LoadingSkeleton,
  PageHeader,
  SearchInput,
  SectionTitle,
  ServiceCard,
  ServiceIcon,
} from '../components/common';
import { money } from '../lib/utils';
export const faqs = [
  [
    'Kako mogu naručiti uslugu?',
    'Odaberite uslugu, opišite zadatak i priložite potrebne datoteke. Za individualne zadatke prvo dobivate ponudu s cijenom i rokom.',
  ],
  [
    'Mogu li platiti u dva dijela?',
    'Model 50/50 dostupan je samo za usluge i ponude za koje je uključen. Prvu polovicu plaćate prije početka rada, a ostatak prije preuzimanja završnih datoteka.',
  ],
  [
    'Jesu li moji dokumenti sigurni?',
    'Datoteke se pohranjuju privatno. Pristup imaju samo vlasnik narudžbe i ovlaštene osobe, uz provjeru prava na poslužitelju.',
  ],
  [
    'Što ako ne znam koju uslugu odabrati?',
    'Pošaljite individualni zahtjev s opisom zadatka. Nakon procjene dobit ćete ponudu bez obveze trenutnog plaćanja.',
  ],
  [
    'Mogu li zatražiti izmjene?',
    'Broj uključenih revizija naveden je u ponudi. Dodatne izmjene dogovaraju se prije nastavka rada.',
  ],
];
export function FAQ({ short = false }: { short?: boolean }) {
  return (
    <div className="faq-list">
      {faqs.slice(0, short ? 4 : undefined).map(([q, a]) => (
        <details key={q}>
          <summary>
            {q}
            <Plus size={19} className="faq-plus" />
            <Minus size={19} className="faq-minus" />
          </summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}
export function HomePage() {
  const q = useServices();
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="hero-pill">
              <Sparkles size={15} />
              Vaš partner za digitalne i administrativne usluge
            </span>
            <h1>
              Digitalne usluge
              <br />
              <span>na jednom mjestu</span>
            </h1>
            <p>
              Profesionalna izrada i uređivanje dokumenata, prezentacija, obrazaca i
              administrativnih zadataka – jednostavno, brzo i online.
            </p>
            <div className="hero-actions">
              <LinkButton to="/app/nova-narudzba">Naruči uslugu</LinkButton>
              <Button variant="outline" asChild>
                <Link to="/usluge">
                  Pogledaj usluge <ArrowUpRight size={18} />
                </Link>
              </Button>
            </div>
            <div className="hero-benefits">
              <span>
                <CheckCircle2 />
                Individualan pristup
              </span>
              <span>
                <CheckCircle2 />
                Jasna cijena
              </span>
              <span>
                <CheckCircle2 />
                Sigurna komunikacija
              </span>
            </div>
          </div>
          <WorkspaceIllustration />
        </div>
      </section>
      <section className="section section-tinted home-services">
        <div className="container">
          <SectionTitle
            eyebrow="NAŠE USLUGE"
            title="Što možemo napraviti za vas?"
            description="Od prvog dokumenta do svakodnevne administracije."
            action={
              <Link to="/usluge">
                Sve usluge <ArrowRight size={16} />
              </Link>
            }
          />
          {q.isPending ? (
            <LoadingSkeleton />
          ) : q.isError ? (
            <ErrorState retry={() => void q.refetch()} />
          ) : (
            <div className="service-grid">
              {q.data
                .filter((s) => !['excel', 'individualni-zahtjev'].includes(s.slug))
                .slice(0, 5)
                .map((s) => (
                  <ServiceCard key={s.id} service={s} />
                ))}
            </div>
          )}
          <div className="individual-banner">
            <div>
              <Sparkles size={22} />
              <span>
                <strong>Niste pronašli što tražite?</strong> Opišite nam svoj zadatak i zatražite
                individualnu ponudu.
              </span>
            </div>
            <Link to="/usluge/individualni-zahtjev">
              Pošalji upit <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <div className="container">
        <PaymentMethods />
      </div>
      <section className="container reference-benefits section">
        <SectionTitle
          eyebrow="ZAŠTO ODABRATI FORMAPOINT"
          title="Vaše zadovoljstvo je na prvom mjestu"
        />
        <div className="reference-benefit-grid">
          <BrandBenefit icon={Clock3} title="Jasan rok izrade" color="violet">
            Dogovorite rok i opseg zadatka prije početka.
          </BrandBenefit>
          <BrandBenefit icon={ShieldCheck} title="Privatne datoteke" color="green">
            Kontroliran pristup vašim dokumentima.
          </BrandBenefit>
          <BrandBenefit icon={Layers} title="Praćenje narudžbe">
            Status izrade i dogovori na jednom mjestu.
          </BrandBenefit>
          <BrandBenefit icon={MessagesSquare} title="Podrška" color="violet">
            Tu smo za pitanja i dodatne zahtjeve.
          </BrandBenefit>
        </div>
      </section>{' '}
      <section className="container section">
        <SectionTitle
          eyebrow="JEDNOSTAVNO OD POČETKA DO KRAJA"
          title="Od zadatka do rješenja u 3 koraka."
        />
        <div className="steps-grid">
          {[
            ['01', 'Recite nam što trebate', 'Odaberite uslugu i podijelite upute i datoteke.'],
            [
              '02',
              'Potvrdite svoju narudžbu',
              'Pregledajte dogovorenu cijenu, rok i uvjete plaćanja.',
            ],
            ['03', 'Preuzmite gotov rad', 'Pratite izradu, komunicirajte i preuzmite rezultat.'],
          ].map(([n, t, d]) => (
            <article key={n}>
              <span className="step-number">{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="container">
        <div className="split-banner">
          <div>
            <span className="eyebrow">FLEKSIBILNIJI NAČIN PLAĆANJA</span>
            <h2>
              Pola na početku.
              <br />
              Ostatak kad je gotovo.
            </h2>
            <p>
              Za odabrane usluge možete ugovoriti plaćanje 50/50. Jasan dogovor prije početka,
              završna uplata prije preuzimanja.
            </p>
            <Button variant="outline" asChild>
              <Link to="/kako-funkcionira">
                Kako funkcionira <ArrowRight size={17} />
              </Link>
            </Button>
          </div>
          <div className="split-visual">
            <div>
              <span>01 · POČETAK IZRADE</span>
              <strong>
                50<small>%</small>
              </strong>
              <p>Prva uplata</p>
            </div>
            <Plus size={23} />
            <div>
              <span>02 · PRIJE PREUZIMANJA</span>
              <strong>
                50<small>%</small>
              </strong>
              <p>Završna uplata</p>
            </div>
            <span className="split-footnote">
              <LockKeyhole size={14} /> Dostupnost ovisi o uvjetima pojedine ponude.
            </span>
          </div>
        </div>
      </section>
      <section className="container section faq-section">
        <div>
          <span className="eyebrow">DOBRO JE ZNATI</span>
          <h2>
            Imate pitanja?
            <br />
            Tu smo za vas.
          </h2>
          <p>Odgovori na najčešća pitanja o uslugama i naručivanju.</p>
          <Link className="text-link" to="/faq">
            Sva pitanja i odgovori <ArrowRight size={17} />
          </Link>
        </div>
        <FAQ short />
      </section>
      <section className="container cta-wrap">
        <div className="cta">
          <span className="eyebrow">VAŠ SLJEDEĆI KORAK</span>
          <h2>
            Jedan zadatak manje.
            <br />
            Jedna briga manje.
          </h2>
          <p>Recite nam što trebate. Zajedno ćemo pronaći pravo rješenje.</p>
          <LinkButton to="/usluge">Pronađi svoju uslugu</LinkButton>
          <Link className="text-link" to="/kontakt">
            Ili nam se javite <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>
    </>
  );
}
export function ServicesPage() {
  const q = useServices();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Sve usluge');
  const [sort, setSort] = useState('default');
  const filtered = (q.data || [])
    .filter(
      (s) =>
        (category === 'Sve usluge' || s.category === category) &&
        `${s.name} ${s.description}`
          .toLocaleLowerCase('hr')
          .includes(search.toLocaleLowerCase('hr')),
    )
    .sort((a, b) =>
      sort === 'price'
        ? (a.price_cents ?? Infinity) - (b.price_cents ?? Infinity)
        : sort === 'name'
          ? a.name.localeCompare(b.name, 'hr')
          : 0,
    );
  return (
    <div className="container section">
      <Breadcrumbs current="Usluge" />
      <PageHeader
        eyebrow="KATALOG USLUGA"
        title="Što danas možemo učiniti za vas?"
        description="Pronađite podršku za svoje dokumente, podatke i svakodnevne digitalne zadatke."
      />
      <div className="filter-bar">
        <SearchInput value={search} onChange={setSearch} placeholder="Pretražite usluge…" />
        <label className="sort-label">
          Sortiraj
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="default">Preporučeno</option>
            <option value="name">Naziv A–Ž</option>
            <option value="price">Najniža cijena</option>
          </select>
        </label>
      </div>
      <div className="filter-tabs">
        {['Sve usluge', 'Dokumenti', 'Prezentacije', 'Tablice', 'Administracija', 'Ostalo'].map(
          (c) => (
            <button
              key={c}
              className={category === c ? 'active' : ''}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ),
        )}
      </div>
      {q.isPending ? (
        <LoadingSkeleton />
      ) : q.isError ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : filtered.length ? (
        <div className="service-grid">
          {filtered.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nema pronađenih usluga"
          description="Pokušajte drugi pojam ili kategoriju."
        />
      )}
    </div>
  );
}
export function ServiceDetail() {
  const { slug } = useParams();
  const q = useServices();
  if (q.isPending) return <LoadingSkeleton />;
  if (q.isError) return <ErrorState retry={() => void q.refetch()} />;
  const s = q.data?.find((x) => x.slug === slug);
  if (!s) return <NotFound />;
  return (
    <div className="container section">
      <Breadcrumbs current={s.name} />
      <div className="detail-grid">
        <div>
          <span className="service-icon large">
            <ServiceIcon name={s.icon} />
          </span>
          <PageHeader eyebrow={s.category} title={s.name} description={s.description} />
          <h2>Što je uključeno</h2>
          <ul className="check-list">
            {s.included.map((x) => (
              <li key={x}>
                <CheckCircle2 size={18} />
                {x}
              </li>
            ))}
          </ul>
          <h3>Granice usluge</h3>
          <ul className="muted-list">
            {s.excluded.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p>
            Upute, rok i konačni opseg potvrđujemo prije početka izrade. Za akademske radove nudimo
            dopuštenu tehničku podršku, formatiranje i lekturu.
          </p>
          <h2>Česta pitanja</h2>
          <FAQ short />
        </div>
        <aside className="price-card">
          <span className="eyebrow">VAŠ SLJEDEĆI PROJEKT</span>
          <h2>{s.price_cents === null ? 'Cijena prema ponudi' : money(s.price_cents)}</h2>
          <p>
            {s.price_cents === null
              ? 'Pošaljite opis zadatka i dobit ćete individualnu ponudu.'
              : 'Konačna cijena potvrđuje se na poslužitelju pri naručivanju.'}
          </p>
          <ul className="check-list">
            <li>
              <Check size={18} />
              {s.delivery_days ? `Okvirno ${s.delivery_days} radnih dana` : 'Rok prema dogovoru'}
            </li>
            <li>
              <Check size={18} />
              {s.revisions} uključena revizija
            </li>
            {s.split_enabled && (
              <li>
                <Check size={18} />
                50/50 od {money(s.split_min_cents)}
              </li>
            )}
          </ul>
          <AddToCartButton service={s} />
          <small>Bez naplate prije potvrde uvjeta.</small>
        </aside>
      </div>
    </div>
  );
}
const legal: Record<string, [string, string[]]> = {
  'uvjeti-koristenja': [
    'Uvjeti korištenja',
    [
      'Usluge pruža vlasnik platforme čije je podatke potrebno unijeti prije objave.',
      'Predmet, cijena, rok i broj revizija potvrđuju se ponudom. Početak izvršenja nastupa prema prihvaćenim uvjetima i potvrđenoj uplati.',
      'Prije objave definirajte pravila sklapanja ugovora na daljinu, početka izvršenja tijekom roka za jednostrani raskid, odgovornosti i prava potrošača.',
    ],
  ],
  'pravila-privatnosti': [
    'Pravila privatnosti',
    [
      'Prije objave navedite voditelja obrade, kontakt, svrhe, pravne osnove, rokove čuvanja i primatelje podataka.',
      'Platforma obrađuje podatke računa, narudžbi, komunikacije i dostavljenih datoteka radi pružanja usluge.',
      'Korisnik može podnijeti zahtjev za pristup, izvoz ili brisanje. Zakonske obveze čuvanja mogu ograničiti brisanje pojedinih evidencija.',
    ],
  ],
  kolacici: [
    'Kolačići i lokalna pohrana',
    [
      'Prijava koristi lokalnu pohranu za sesiju. Nacrt narudžbe privremeno se čuva u sesiji preglednika.',
      'Marketinška analitika i neobvezni kolačići nisu uključeni. Ako ih uvedete, implementirajte prethodnu privolu.',
    ],
  ],
  'otkazivanje-i-povrati': [
    'Otkazivanje i povrati',
    [
      'Prije objave potrebno je uskladiti prava na jednostrani raskid, iznimke, rokove i povrate s vrstama usluga i važećim propisima.',
      'Zahtjev za otkazivanje ili povrat podnosi se kroz podršku. Odluka i povrat moraju biti evidentirani.',
    ],
  ],
  prigovori: [
    'Prigovori',
    [
      'Prije objave unesite stvarni naziv i adresu pružatelja te e-mail za pisane prigovore.',
      'Definirajte postupak potvrde primitka i odgovor u zakonskom roku. Prigovor se ne smije uvjetovati korisničkim računom.',
    ],
  ],
};
export function InfoPage({ kind }: { kind: string }) {
  const published = usePublishedPage(kind);
  if (published.data) return <PublishedText page={published.data} />;
  if (kind === 'faq')
    return (
      <div className="container narrow section">
        <PageHeader
          eyebrow="PODRŠKA"
          title="Česta pitanja"
          description="Sve što trebate znati prije prve narudžbe."
        />
        <FAQ />
      </div>
    );
  if (kind === 'cjenik')
    return (
      <div className="container section">
        <PageHeader
          eyebrow="JASNO I TRANSPARENTNO"
          title="Cijena prilagođena vašem zadatku."
          description="Cijene ovise o opsegu, složenosti i roku. Za konkretan zadatak zatražite ponudu."
        />
        <LinkButton to="/usluge">Pregledaj katalog usluga</LinkButton>
        <div className="notice">
          <LockKeyhole />
          <p>
            Kupac plaća dogovorenu konačnu cijenu. Naknada platnog procesora ne dodaje se kao
            zasebna naknada.
          </p>
        </div>
      </div>
    );
  if (kind === 'kako-funkcionira')
    return (
      <div className="container narrow section">
        <PageHeader eyebrow="KORAK PO KORAK" title="Jednostavan put do gotovog rada." />
        {[
          ['Odaberite uslugu', 'Prijavite se i pošaljite opis zadatka i potrebne datoteke.'],
          ['Potvrdite ponudu', 'Provjerite opseg, rok, cijenu i model plaćanja.'],
          ['Pratite izradu', 'Nakon potvrđene početne uplate pratite status i šaljite poruke.'],
          [
            'Preuzmite rezultat',
            'Završne datoteke dostupne su nakon ukupne uplate. Ako iznos nije moguće podijeliti na dvije jednake rate, prva rata može biti veća za 0,01 €.',
          ],
        ].map(([t, d], i) => (
          <article className="how-step" key={t}>
            <span className="step-number">0{i + 1}</span>
            <div>
              <h2>{t}</h2>
              <p>{d}</p>
            </div>
          </article>
        ))}
        <LinkButton to="/usluge">Pregledaj usluge</LinkButton>
      </div>
    );
  if (kind === 'o-nama')
    return (
      <div className="container narrow section">
        <PageHeader
          eyebrow="O FORMAPOINTU"
          title="Više vremena za ono što je važno."
          description="FormaPoint povezuje naručivanje digitalnih i administrativnih usluga, komunikaciju i isporuku u jedan pregledan radni prostor."
        />
        <p>Naš je cilj učiniti naručivanje jasnim: od prvog upita do dogovorenog rezultata.</p>
        <div className="notice">
          <ShieldCheck />
          <p>
            Poslovni podaci pružatelja bit će objavljeni nakon provjere i konfiguracije. Platforma
            još nije otvorena za produkcijsko poslovanje.
          </p>
        </div>
        <LinkButton to="/usluge">Upoznajte usluge</LinkButton>
      </div>
    );
  const item = legal[kind];
  return (
    <div className="container narrow section">
      <PageHeader eyebrow="PRAVNE INFORMACIJE" title={item?.[0] || 'Informacije'} />
      <div className="notice">
        <ShieldCheck />
        <p>
          <strong>Predložak – nije odobren za objavu.</strong> Vlasnik mora dopuniti podatke i
          osigurati pravnu provjeru prije poslovanja.
        </p>
      </div>
      {item?.[1].map((p, i) => (
        <section key={p}>
          <h2>
            {i + 1}. {['Opće informacije', 'Postupak i uvjeti', 'Prava korisnika'][i]}
          </h2>
          <p>{p}</p>
        </section>
      ))}
    </div>
  );
}
export function NotFound() {
  return (
    <div className="container section empty-state">
      <span className="eyebrow">404 · STRANICA NIJE PRONAĐENA</span>
      <h1>Ovdje nema zadataka.</h1>
      <p>Stranica koju tražite nije dostupna ili je premještena.</p>
      <LinkButton to="/">Natrag na početnu</LinkButton>
    </div>
  );
}
