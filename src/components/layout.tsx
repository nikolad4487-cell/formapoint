import { HelpPanel } from './help-panel';
import { useSiteSettings } from '../hooks/use-site-settings';
import { DiscountBanner } from './discount-banner';
import { SupportCard } from './brand';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  ArrowUpRight,
  ArrowRight,
  LayoutDashboard,
  Plus,
  ClipboardList,
  ShoppingBag,
  CreditCard,
  Files,
  MessageSquare,
  Bell,
  User,
  Settings,
  LifeBuoy,
  LogOut,
  Shield,
  Users,
  Tags,
  BookOpen,
  Activity,
  Layers,
  Search,
  ChevronDown,
} from 'lucide-react';
import { Logo, LoadingSkeleton, Unavailable } from './common';
import { Button } from './ui/button';
import { useAuth } from '../hooks/use-auth';
import { db, configured } from '../lib/supabase';
import { toast } from 'sonner';
export function PublicHeader() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DiscountBanner />
      <header className="public-header">
        <div className="container header-inner">
          <Logo />
          <nav className={open ? 'public-nav open' : 'public-nav'} aria-label="Glavna navigacija">
            {[
              ['/', 'Početna'],
              ['/usluge', 'Usluge'],
              ['/kako-funkcionira', 'Kako funkcionira'],
              ['/cjenik', 'Cjenik'],
              ['/kontakt', 'Kontakt'],
            ].map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <Link to="/app/kosarica" aria-label="Košarica">
              <ShoppingBag size={20} />
            </Link>
            <Link className="login-link" to="/prijava">
              Prijava <ArrowUpRight size={15} />
            </Link>
            <Button asChild size="sm">
              <Link to="/registracija">
                Registracija <ArrowRight size={15} />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label={open ? 'Zatvori izbornik' : 'Otvori izbornik'}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}
export function PublicFooter() {
  const { data: site } = useSiteSettings();
  return (
    <footer className="public-footer">
      <div className="container footer-grid">
        <div>
          <Logo />
          <p>
            Vaš pouzdan partner za
            <br />
            svakodnevne digitalne zadatke.
          </p>
          <span className="footer-tag">Manje obaveza. Više mogućnosti.</span>
        </div>
        <div>
          <h4>Platforma</h4>
          <Link to="/usluge">Naše usluge</Link>
          <Link to="/kako-funkcionira">Kako funkcionira</Link>
          <Link to="/cjenik">Cjenik</Link>
          <Link to="/faq">Česta pitanja</Link>
          <Link to="/portfolio">Portfolio radova</Link>
        </div>
        <div>
          <h4>FormaPoint</h4>
          <Link to="/o-nama">O nama</Link>
          <Link to="/kontakt">Kontakt</Link>
          <Link to="/app/podrska">Podrška</Link>
          <Link to="/prigovori">Prigovori</Link>
          {site?.public_contact_email && (
            <a href={`mailto:${site.public_contact_email}`}>{site.public_contact_email}</a>
          )}
          {site?.contact_phone && (
            <a href={`tel:${site.contact_phone.replace(/[^+0-9]/g, '')}`}>{site.contact_phone}</a>
          )}
          {(
            [
              ['Facebook', site?.facebook_url],
              ['Instagram', site?.instagram_url],
              ['LinkedIn', site?.linkedin_url],
            ] as const
          )
            .filter(([, url]) => url)
            .map(([label, url]) => (
              <a key={label} href={url!} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ))}
        </div>
        <div>
          <h4>Pravne informacije</h4>
          <Link to="/uvjeti-koristenja">Uvjeti korištenja</Link>
          <Link to="/pravila-privatnosti">Pravila privatnosti</Link>
          <Link to="/kolacici">Kolačići</Link>
          <Link to="/otkazivanje-i-povrati">Otkazivanje i povrati</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} FormaPoint</span>
        <span>Osmišljeno za jednostavnije poslovanje.</span>
      </div>
    </footer>
  );
}
export function AppShell() {
  const { pathname } = useLocation();
  const auth = [
    '/prijava',
    '/registracija',
    '/zaboravljena-lozinka',
    '/reset-lozinke',
    '/potvrda-emaila',
  ].includes(pathname);
  return (
    <div className={auth ? 'auth-shell' : 'public-shell'}>
      <a href="#sadrzaj" className="skip-link">
        Preskoči na sadržaj
      </a>
      <PublicHeader />
      <main id="sadrzaj">
        <Outlet />
      </main>
      <PublicFooter />
      <HelpPanel />
    </div>
  );
}
export function ProtectedRoute({ admin = false }: { admin?: boolean }) {
  const { session, role, loading, error } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="container section">
        <LoadingSkeleton />
      </div>
    );
  if (!configured)
    return (
      <div className="container section">
        <Unavailable />
        <Button asChild variant="outline">
          <Link to="/usluge">Pregledaj usluge</Link>
        </Button>
      </div>
    );
  if (error)
    return (
      <div className="container section">
        <Unavailable>{error}</Unavailable>
      </div>
    );
  if (!session) {
    const purchase =
      !admin &&
      ['/app/kosarica', '/app/checkout', '/app/nova-narudzba'].includes(location.pathname);
    return (
      <Navigate
        to={purchase ? '/kupnja-kao-gost' : '/prijava'}
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  }
  if (admin && role !== 'ADMIN') return <Navigate to="/app" replace />;
  return <Outlet />;
}
const customerLinks = [
  ['', 'Nadzorna ploča', LayoutDashboard],
  ['/nova-narudzba', 'Nova narudžba', Plus],
  ['/narudzbe', 'Moje narudžbe', ClipboardList],
  ['/kosarica', 'Košarica', ShoppingBag],
  ['/placanja', 'Plaćanja', CreditCard],
  ['/datoteke', 'Datoteke', Files],
  ['/poruke', 'Poruke', MessageSquare],
  ['/obavijesti', 'Obavijesti', Bell],
  ['/profil', 'Profil', User],
  ['/postavke', 'Postavke', Settings],
  ['/podrska', 'Podrška', LifeBuoy],
] as const;
const adminLinks = [
  ['', 'Pregled poslovanja', LayoutDashboard],
  ['/narudzbe', 'Narudžbe', ClipboardList],
  ['/usluge', 'Usluge', BookOpen],
  ['/kategorije', 'Kategorije', Tags],
  ['/ponude', 'Ponude', ClipboardList],
  ['/placanja', 'Plaćanja', CreditCard],
  ['/korisnici', 'Korisnici', Users],
  ['/poruke', 'Poruke', MessageSquare],
  ['/datoteke', 'Datoteke', Files],
  ['/podrska', 'Podrška', LifeBuoy],
  ['/kuponi', 'Popusti i kuponi', Tags],
  ['/upiti', 'Kontaktni upiti', MessageSquare],
  ['/stranice', 'Stranice', BookOpen],
  ['/portfolio', 'Radovi i portfolio', Files],
  ['/newsletter', 'Newsletter', Bell],
  ['/vizualni-identitet', 'Vizualni identitet', Layers],
  ['/izvjestaji', 'Izvještaji', Activity],
  ['/obavijesti', 'Obavijesti', Bell],
  ['/audit-log', 'Audit log', Shield],
  ['/postavke', 'Postavke', Settings],
  ['/dizajn-sustav', 'Dizajn-sustav', Layers],
] as const;
export function DashboardLayout({ admin = false }: { admin?: boolean }) {
  const { session, role } = useAuth();
  const [open, setOpen] = useState(false);
  const base = admin ? '/admin' : '/app';
  const navigate = useNavigate();
  const sidebar = useRef<HTMLElement>(null);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width:900px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width:900px)');
    const change = () => {
      setMobile(media.matches);
      if (!media.matches) setOpen(false);
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const selectors = 'a[href],button:not(:disabled),input:not(:disabled)';
    sidebar.current?.querySelector<HTMLElement>(selectors)?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === 'Tab') {
        const nodes = sidebar.current?.querySelectorAll<HTMLElement>(selectors);
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, mobile]);
  const location = useLocation();
  const name =
    [session?.user.user_metadata.first_name, session?.user.user_metadata.last_name]
      .filter(Boolean)
      .join(' ') || (session?.user.is_anonymous ? 'Gost' : 'Moj račun');
  return (
    <div className="dashboard">
      <a className="skip-link" href="#sadrzaj">
        Preskoči na sadržaj
      </a>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Zatvori navigaciju"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={sidebar}
        className={`sidebar ${open ? 'open' : ''}`}
        inert={mobile && !open}
        role={mobile ? 'dialog' : undefined}
        aria-modal={mobile && open ? true : undefined}
        aria-label="Navigacija radnog prostora"
      >
        {mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-close"
            aria-label="Zatvori navigaciju"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        )}
        <Logo />
        <span className="sidebar-label">{admin ? 'RADNI PROSTOR' : 'MOJ FORMAPOINT'}</span>
        <nav aria-label="Korisnička navigacija">
          {(admin ? adminLinks : customerLinks).map(([path, label, Icon]) => (
            <NavLink key={path} end={path === ''} to={base + path} onClick={() => setOpen(false)}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <SupportCard admin={admin} />
        <div className="sidebar-bottom">
          {role === 'ADMIN' && (
            <Link to={admin ? '/app' : '/admin'}>
              <Shield size={18} />
              {admin ? 'Korisnički prikaz' : 'Administracija'}
            </Link>
          )}
          <button
            onClick={async () => {
              if (
                session?.user.is_anonymous &&
                !window.confirm(
                  'Odjavom gubite pristup narudžbama gosta u ovom pregledniku. Želite li nastaviti?',
                )
              )
                return;
              const result = await db!.auth.signOut();
              if (result.error) toast.error('Odjava nije uspjela.');
            }}
          >
            <LogOut size={18} />
            Odjava
          </button>
        </div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-header">
          <Button
            className="mobile-menu"
            variant="ghost"
            size="icon"
            aria-label="Otvori navigaciju"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <Menu />
          </Button>
          <form
            className="header-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const value = String(new FormData(e.currentTarget).get('q') || '');
              navigate(`${base}/narudzbe?q=${encodeURIComponent(value)}`);
            }}
          >
            <Search size={21} />
            <label className="sr-only" htmlFor="workspace-search">
              Pretraži narudžbe
            </label>
            <input
              id="workspace-search"
              name="q"
              type="search"
              placeholder={
                admin ? 'Pretraži narudžbe po nazivu ili broju…' : 'Pretraži svoje narudžbe…'
              }
            />
          </form>
          <div>
            <Link aria-label="Obavijesti" to={`${base}/obavijesti`}>
              <Bell size={20} />
            </Link>
            <Link className="account-link" to={admin ? '/admin/postavke' : '/app/profil'}>
              <span className="avatar">
                {name === 'Moj račun'
                  ? session?.user.email?.slice(0, 1).toUpperCase()
                  : name
                      .split(' ')
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join('')}
              </span>
              <strong>{name}</strong>
              <ChevronDown size={16} />
            </Link>
          </div>
        </header>
        <main id="sadrzaj" key={location.pathname} className="dashboard-content">
          {session?.user.is_anonymous && (
            <section className="panel">
              <p>Kupujete kao gost. Narudžbe su dostupne u ovom pregledniku.</p>
              <Button asChild variant="outline">
                <Link to="/registracija">Spremi pristup izradom računa</Link>
              </Button>
            </section>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
