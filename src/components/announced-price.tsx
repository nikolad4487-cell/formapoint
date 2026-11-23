import { useEffect, useState } from 'react';
import { announcedPrice, priceList2027StartsAt } from '../../seo/announced-prices.mjs';
import type { Service } from '../lib/domain';
export function AnnouncedPrice({ service }: { service: Service }) {
  const [now, setNow] = useState(() => Date.now());
  const label = announcedPrice(service, now);
  useEffect(() => {
    if (!label) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(priceList2027StartsAt - now, 86400000),
    );
    return () => window.clearTimeout(timer);
  }, [label, now]);
  return label ? <p className="announced-price">{label}</p> : null;
}
