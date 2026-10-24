import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { Logo, LoadingSkeleton, Unavailable } from './common';
import { Button } from './ui/button';
import { useAuth } from '../hooks/use-auth';
import { db, configured } from '../lib/supabase';
import { toast } from 'sonner';
export function PublicHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="public-header">
      <div className="container header-inner">
        <Logo />
        <nav className={open ? 'public-nav open' : 'public-nav'} aria-label="Glavna navigacija">
          {[
            ['/usluge', 'Usluge'],
            ['/kako-funkcionira', 'Kako funkcionira'],
            ['/cjenik', 'Cjenik'],
            ['/o-nama', 'O nama'],
            ['/kontakt', 'Kontakt'],
          ].map(([to, label]) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <Link className="login-link" to="/prijava">
            Prijava <ArrowUpRight size={15} />
          </Link>
          <Button asChild size="sm">
            <Link to="/app/nova-narudzba">
              Naruči uslugu <ArrowRight size={15} />
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
  );
}
export function PublicFooter() {
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
        </div>
        <div>
          <h4>FormaPoint</h4>
          <Link to="/o-nama">O nama</Link>
          <Link to="/kontakt">Kontakt</Link>
          <Link to="/app/podrska">Podrška</Link>
          <Link to="/prigovori">Prigovori</Link>
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
  return (
    <>
      <a href="#sadrzaj" className="skip-link">
        Preskoči na sadržaj
      </a>
      <PublicHeader />
      <main id="sadrzaj">
        <Outlet />
      </main>
      <PublicFooter />
    </>
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
  if (!session) return <Navigate to="/prijava" state={{ from: location.pathname }} replace />;
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
  ['/kuponi', 'Kuponi', Tags],
  ['/izvjestaji', 'Izvještaji', Activity],
  ['/obavijesti', 'Obavijesti', Bell],
  ['/audit-log', 'Audit log', Shield],
  ['/postavke', 'Postavke', Settings],
] as const;
export function DashboardLayout({ admin = false }: { admin?: boolean }) {
  const { session, role } = useAuth();
  const [open, setOpen] = useState(false);
  const base = admin ? '/admin' : '/app';
  const location = useLocation();
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
      <aside className={`sidebar ${open ? 'open' : ''}`}>
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
        <div className="sidebar-bottom">
          {role === 'ADMIN' && (
            <Link to={admin ? '/app' : '/admin'}>
              <Shield size={18} />
              {admin ? 'Korisnički prikaz' : 'Administracija'}
            </Link>
          )}
          <button
            onClick={async () => {
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
          <span>{admin ? 'Administracija' : 'Vaš digitalni radni prostor'}</span>
          <div>
            <Link aria-label="Obavijesti" to={`${base}/obavijesti`}>
              <Bell size={20} />
            </Link>
            <span className="avatar">{session?.user.email?.slice(0, 1).toUpperCase()}</span>
          </div>
        </header>
        <main id="sadrzaj" key={location.pathname} className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
