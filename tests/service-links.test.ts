import { describe, it, expect } from 'vitest';
import { catalog } from '../src/lib/catalog';
import { servicePath, serviceReference } from '../src/lib/service-links';
const presentation = {
  ...catalog[0],
  id: 'presentation-id',
  slug: 'izrada',
  category: 'Prezentacije',
  category_slug: 'prezentacije',
};
const finalWork = {
  ...catalog[0],
  id: 'final-id',
  slug: 'izrada',
  category: 'Završni rad',
  category_slug: 'zavrsni-rad',
};
describe('Iste oznake artikala u različitim kategorijama', () => {
  it('gradi različite javne putanje uz očuvanje sluga artikla', () => {
    expect(servicePath(presentation)).toBe('/prezentacije/izrada');
    expect(servicePath(finalWork)).toBe('/zavrsni-rad/izrada');
  });
  it('za naručivanje razrješava ID umjesto proizvoljnog prvog istog sluga', () => {
    expect(serviceReference([presentation, finalWork], 'final-id')).toBe(finalWork);
    expect(serviceReference([presentation, finalWork], 'presentation-id')).toBe(presentation);
    expect(serviceReference([presentation, finalWork], 'izrada')).toBeUndefined();
  });
  it('podržava stare reference samo kada jednoznačno određuju artikl', () => {
    expect(serviceReference([presentation], 'izrada')).toBe(presentation);
  });
});
