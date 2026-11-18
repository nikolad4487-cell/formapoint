import { Link } from 'react-router-dom';
import { servicePreparation } from '../../seo/content.mjs';
import type { Service } from '../lib/domain';
export function ServicePreparation({ service }: { service?: Service }) {
  return (
    <section className="service-preparation">
      <h2>Što pripremiti prije narudžbe?</h2>
      {service ? (
        <ul className="check-list">
          {servicePreparation(service).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>
          Opišite zadatak, priložite postojeće materijale i navedite željeni rok. Opseg i dostupnost
          potvrđuju se prije početka rada. Za usluge s paketima usporedite njihov sadržaj i cijenu.
        </p>
      )}
      <p>
        <Link className="text-link" to="/kako-funkcionira">
          Kako funkcionira naručivanje
        </Link>{' '}
        ·{' '}
        <Link className="text-link" to="/kontakt">
          Pošaljite upit za svoj zadatak
        </Link>
      </p>
    </section>
  );
}
