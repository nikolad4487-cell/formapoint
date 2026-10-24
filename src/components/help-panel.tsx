import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, ArrowRight } from 'lucide-react';
import { ConfirmationDialog } from './ui/dialog';
import { useAuth } from '../hooks/use-auth';
export function HelpPanel() {
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  return (
    <>
      <button className="help-toggle" aria-label="Otvori pomoć" onClick={() => setOpen(true)}>
        <LifeBuoy size={23} />
        <span>Pomoć</span>
      </button>
      <ConfirmationDialog open={open} onOpenChange={setOpen} title="Kako vam možemo pomoći?">
        <p>Pronađite odgovor ili nam pošaljite poruku.</p>
        <div className="help-links">
          {[
            ['/faq', 'Česta pitanja'],
            ['/kako-funkcionira', 'Naručivanje i plaćanje'],
            [session ? '/app/podrska' : '/kontakt', 'Kontaktirajte podršku'],
          ].map(([to, label]) => (
            <Link key={to} to={to} onClick={() => setOpen(false)}>
              {label}
              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
      </ConfirmationDialog>
    </>
  );
}
