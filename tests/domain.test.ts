import { describe, it, expect } from 'vitest';
import { installments, discount, canDownloadFinal, transitions } from '../src/lib/domain';
import { money } from '../src/lib/utils';
describe('Iznosi u centima', () => {
  it.each([
    [2500, [1250, 1250]],
    [2501, [1251, 1250]],
    [101, [51, 50]],
    [99999999, [50000000, 49999999]],
  ])('50/50 za %i', (total, expected) =>
    expect(installments(total as number, true)).toEqual(expected),
  );
  it('puna uplata', () => expect(installments(2501, false)).toEqual([2501]));
  it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'odbija neispravan iznos %s',
    (value) => expect(() => installments(value, true)).toThrow(),
  );
  it('zbroj rata ostaje točan za svaki iznos do 10.000', () => {
    for (let n = 100; n < 10000; n++) {
      const [a, b] = installments(n, true);
      expect(a + b).toBe(n);
      expect(a - b).toBe(n % 2);
    }
  });
  it('postotni popust zaokružuje u centima', () =>
    expect(discount(2501, 'percent', 15)).toBe(2126));
  it('fiksni popust ne stvara negativan iznos', () => expect(discount(500, 'fixed', 1000)).toBe(0));
  it('odbija neispravan postotak', () => expect(() => discount(100, 'percent', 101)).toThrow());
  it('formatira EUR na hrvatskom', () => expect(money(2501)).toContain('25,01'));
});
describe('Pristup završnom radu', () => {
  it('zaključava prije završne uplate', () => expect(canDownloadFinal(2501, 1251)).toBe(false));
  it('otključava nakon obje rate', () => expect(canDownloadFinal(2501, 2501)).toBe(true));
  it('zaključava nakon djelomičnog povrata', () =>
    expect(canDownloadFinal(2501, 2500)).toBe(false));
  it('ne otključava narudžbu bez dogovorene cijene', () =>
    expect(canDownloadFinal(null, 0)).toBe(false));
  it('prihvaća eksplicitnu administratorsku iznimku', () =>
    expect(canDownloadFinal(2501, 0, true)).toBe(true));
  it('ne nudi ručno proglašavanje uplate potvrđenom', () => {
    expect(transitions.deposit_pending).not.toContain('ready');
    expect(transitions.final_pending).toEqual([]);
  });
});
