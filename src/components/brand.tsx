import {
  ArrowDownLeft,
  ArrowRight,
  Check,
  FileText,
  Folder,
  Headphones,
  LayoutDashboard,
  Mail,
  PanelLeft,
  Search,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { catalog } from '../lib/catalog';
import { ServiceIcon } from './common';
import { BrandMark } from './brand-mark';
export function WorkspaceIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`laptop-scene ${compact ? 'compact' : ''}`}
      role="img"
      aria-label="Ilustracija FormaPoint radnog prostora i kataloga usluga"
    >
      <div className="scene-blob blob-a" />
      <div className="scene-blob blob-b" />
      <div className="laptop">
        <div className="laptop-camera" />
        <div className="laptop-screen">
          <div className="screen-top">
            <span className="screen-brand">
              <BrandMark />
              Forma<span>Point</span>
            </span>
            <span className="screen-search">
              <Search size={9} />
              Pretraži usluge…
            </span>
            <span className="screen-avatar">
              <Sparkles size={10} />
            </span>
          </div>
          <div className="screen-layout">
            <div className="screen-sidebar">
              <span className="selected">
                <LayoutDashboard size={10} />
                Početna
              </span>
              <span>
                <Folder size={10} />
                Moje narudžbe
              </span>
              <span>
                <FileText size={10} />
                Usluge
              </span>
              <span>
                <Mail size={10} />
                Poruke
              </span>
              <span>
                <PanelLeft size={10} />
                Postavke
              </span>
            </div>
            <div className="screen-content">
              <strong>Dobro došli!</strong>
              <p>Vaši digitalni zadaci na jednom mjestu.</p>
              <div className="screen-services">
                {catalog.slice(0, 6).map((s) => (
                  <div key={s.id} className={`screen-service service-${s.icon}`}>
                    <span className="service-icon">
                      <ServiceIcon name={s.icon} />
                    </span>
                    <b>{s.name}</b>
                    <small>{s.description}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="laptop-base">
        <i />
      </div>
      <div className="scene-plant" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <span />
      </div>
      <span className="scene-note">
        Više vremena
        <br />
        za ono što je važno!
        <ArrowDownLeft />
      </span>
      <span className="illustration-caption">Ilustracija radnog prostora</span>
    </div>
  );
}
export function SupportCard({ admin = false }: { admin?: boolean }) {
  return (
    <div className="sidebar-support">
      <span className="support-icon">
        <Headphones size={24} />
      </span>
      <div>
        <strong>Trebate pomoć?</strong>
        <p>Tu smo za vaša pitanja i podršku.</p>
      </div>
      <Link to={`${admin ? '/admin' : '/app'}/podrska`}>
        Kontaktirajte nas <ArrowRight size={16} />
      </Link>
    </div>
  );
}
export function PageNote({ children }: { children: React.ReactNode }) {
  return (
    <span className="page-note">
      {children}
      <ArrowDownLeft size={34} />
    </span>
  );
}
export function BrandBenefit({
  icon: Icon,
  title,
  children,
  color = 'blue',
}: {
  icon: typeof Check;
  title: string;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div className={`brand-benefit tone-${color}`}>
      <span className="brand-benefit-icon">
        <Icon size={27} />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  );
}
