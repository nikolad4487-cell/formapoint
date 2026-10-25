import { CartPage, CatalogOrderPage } from './pages/cart';
import { ContactInquiries } from './pages/admin/inquiries';
import { PlatformSettings } from './pages/admin/settings';
import { CatalogAdmin } from './pages/admin/catalog';
import { ContentPages, PortfolioAdmin } from './pages/admin/content';
import { NewsletterAdmin } from './pages/admin/newsletter';
import { AdminUsers } from './pages/admin/users';
import { VisualIdentity } from './pages/admin/identity';
import { DiscountsAdmin } from './pages/admin/discounts';
import { ContentPageView, PublicPortfolio, NewsletterUnsubscribe } from './pages/content';
import { DesignSystemPage } from './pages/design-system';
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './hooks/use-auth';
import { AppShell, DashboardLayout, ProtectedRoute } from './components/layout';
import { HomePage, ServicesPage, ServiceDetail, InfoPage, NotFound } from './pages/public';
import { AuthPage } from './pages/auth';
import {
  DashboardPage,
  OrdersPage,
  OrderDetailPage,
  PaymentsPage,
  FilesPage,
  MessagesPage,
  NotificationsPage,
  ProfilePage,
  SettingsPage,
  SupportPage,
  ContactPage,
} from './pages/workspace';
import {
  AdminServiceRoute,
  CategoriesPage,
  QuotesPage,
  AuditPage,
  ReportsPage,
  AdminSupport,
} from './pages/admin';
import './index.css';
import './reference.css';
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: true } },
});
function NavigationEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    const names: Record<string, string> = {
      '/': 'Digitalne usluge na jednom mjestu',
      '/usluge': 'Usluge',
      '/prijava': 'Prijava',
      '/registracija': 'Registracija',
      '/app': 'Moj radni prostor',
      '/admin': 'Administracija',
      '/kontakt': 'Kontakt',
      '/cjenik': 'Cjenik',
    };
    document.title = `${names[pathname] || 'Vaš digitalni partner'} | FormaPoint`;
  }, [pathname]);
  return null;
}
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="container section">
        <h1>Dogodila se pogreška.</h1>
        <p>Osvježite stranicu i pokušajte ponovno.</p>
        <button className="button button-primary" onClick={() => window.location.reload()}>
          Osvježi stranicu
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function App() {
  return (
    <>
      <NavigationEffects />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="usluge" element={<ServicesPage />} />
          <Route path="usluge/:slug" element={<ServiceDetail />} />
          {[
            'cjenik',
            'kako-funkcionira',
            'o-nama',
            'faq',
            'uvjeti-koristenja',
            'pravila-privatnosti',
            'kolacici',
            'otkazivanje-i-povrati',
            'prigovori',
          ].map((kind) => (
            <Route key={kind} path={kind} element={<InfoPage kind={kind} />} />
          ))}
          <Route path="portfolio" element={<PublicPortfolio />} />
          <Route path="p/:slug" element={<ContentPageView />} />
          <Route path="odjava-newslettera" element={<NewsletterUnsubscribe />} />
          <Route path="kontakt" element={<ContactPage />} />
          <Route path="prijava" element={<AuthPage />} />
          <Route path="registracija" element={<AuthPage mode="register" />} />
          <Route path="zaboravljena-lozinka" element={<AuthPage mode="forgot" />} />
          <Route path="reset-lozinke" element={<AuthPage mode="reset" />} />
          <Route path="potvrda-emaila" element={<AuthPage mode="confirm" />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="app" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="nova-narudzba" element={<CatalogOrderPage />} />
            <Route path="narudzbe" element={<OrdersPage />} />
            <Route path="narudzbe/:id" element={<OrderDetailPage />} />
            <Route path="kosarica" element={<CartPage />} />
            <Route path="checkout" element={<CartPage />} />
            <Route path="placanja" element={<PaymentsPage />} />
            <Route path="placanja/:id" element={<PaymentsPage />} />
            <Route path="datoteke" element={<FilesPage />} />
            <Route path="poruke" element={<MessagesPage />} />
            <Route path="poruke/:id" element={<MessagesPage />} />
            <Route path="obavijesti" element={<NotificationsPage />} />
            <Route path="profil" element={<ProfilePage />} />
            <Route path="postavke" element={<SettingsPage />} />
            <Route path="podrska" element={<SupportPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute admin />}>
          <Route path="admin" element={<DashboardLayout admin />}>
            <Route index element={<DashboardPage admin />} />
            <Route path="narudzbe" element={<OrdersPage admin />} />
            <Route path="narudzbe/:id" element={<OrderDetailPage admin />} />
            <Route path="usluge" element={<CatalogAdmin />} />
            <Route path="usluge/nova" element={<AdminServiceRoute />} />
            <Route path="usluge/:id" element={<AdminServiceRoute />} />
            <Route path="stranice" element={<ContentPages />} />
            <Route path="portfolio" element={<PortfolioAdmin />} />
            <Route path="newsletter" element={<NewsletterAdmin />} />
            <Route path="vizualni-identitet" element={<VisualIdentity />} />
            <Route path="upiti" element={<ContactInquiries />} />
            <Route path="kategorije" element={<CategoriesPage />} />
            <Route path="ponude" element={<QuotesPage />} />
            <Route path="placanja" element={<PaymentsPage admin />} />
            <Route path="korisnici" element={<AdminUsers />} />
            <Route path="korisnici/:id" element={<AdminUsers />} />
            <Route path="kuponi" element={<DiscountsAdmin />} />
            <Route path="audit-log" element={<AuditPage />} />
            <Route path="izvjestaji" element={<ReportsPage />} />
            <Route path="postavke" element={<PlatformSettings />} />
            <Route path="dizajn-sustav" element={<DesignSystemPage />} />
            <Route path="poruke" element={<MessagesPage admin />} />
            <Route path="poruke/:id" element={<MessagesPage admin />} />
            <Route path="datoteke" element={<FilesPage />} />
            <Route path="podrska" element={<AdminSupport />} />
            <Route path="obavijesti" element={<NotificationsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <Toaster position="bottom-right" richColors closeButton />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
