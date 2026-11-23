// Owner-approved price list from migration 020; display only, never checkout pricing.
export const priceList2027StartsAt = Date.parse('2027-01-01T00:00:00+01:00');
export const prices2027 = Object.freeze({
  '95d76eb9-11a1-4ab0-a1a7-a5cb133dc002': 8000,
  'e5bd9877-b653-4aaa-9b1d-9050a057db5f': 3000,
  'ee882470-25af-4711-85b9-1ad9070d84fa': 3000,
  'bcfb0551-2dcc-4078-9fac-03e318bed22d': 2000,
  'aa8920d3-5901-4b01-9cf0-f77dcaeb1486': 2000,
  '2fe7aa46-f1a2-4a1d-9b93-a0117c5d1d23': 2000,
  '7c96d11f-f001-4597-8f1b-d0982c77493e': 2000,
  '07350119-2724-463d-b241-40f674caccf0': 2000,
  '19223dab-a88d-4c35-a9a4-2bd1976bf3a2': 2000,
});
export function announcedPrice(service, now = Date.now()) {
  if (now >= priceList2027StartsAt || service.active === false || service.packages_enabled)
    return null;
  const price =
    prices2027[service.id] ??
    (service.slug === 'seminar' && service.category === 'Učenički radovi - osnovna i srednja škola'
      ? 3000
      : null);
  if (price === null) return null;
  const amount = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(
    price / 100,
  );
  return `Cijena od 1.1.2027. ${amount}`;
}
