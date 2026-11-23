import { monthlyPackageTerms } from '../../seo/package-prices-2027.mjs';
import { money } from '../lib/utils';
import { useEffect, useState } from 'react';
import {
  announcedPrice,
  announcedPackages,
  priceList2027StartsAt,
} from '../../seo/announced-prices.mjs';
import type { Service } from '../lib/domain';
export function AnnouncedPrice({ service }: { service: Service }) {
  const [now, setNow] = useState(() => Date.now());
  const label = announcedPrice(service, now);
  const packages = announcedPackages(service, now);
  const hasAnnouncement = Boolean(label || packages.length);
  useEffect(() => {
    if (!hasAnnouncement) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(priceList2027StartsAt - now, 86400000),
    );
    return () => window.clearTimeout(timer);
  }, [hasAnnouncement, now]);
  if (packages.length)
    return (
      <div className="announced-price">
        <p>Cijene paketa od 1.1.2027.</p>
        <ul>
          {packages.map((item) => (
            <li key={item.id}>
              {item.name} – {money(item.price_cents)}
            </li>
          ))}
        </ul>
        <p>{monthlyPackageTerms}</p>
      </div>
    );
  return label ? <p className="announced-price">{label}</p> : null;
}
