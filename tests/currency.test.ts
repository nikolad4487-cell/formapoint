import { describe, it, expect } from 'vitest';
import { eurosToCents, centsToEuroInput } from '../src/lib/currency';
describe('iznosi koje korisnik unosi u eurima', () => {
  it('prihvaća cijele eure, zarez i točku te čuva najmanje iznose', () => {
    expect(eurosToCents('25')).toBe(2500);
    expect(eurosToCents('25,50')).toBe(2550);
    expect(eurosToCents('25.50')).toBe(2550);
    expect(eurosToCents('0,29')).toBe(29);
    expect(eurosToCents(' 100,01 ')).toBe(10001);
  });
  it('ne zaokružuje dodatne decimale niti pogađa značenje zapisa', () => {
    for (const value of ['25,505', '1.000,00', '1e2', '-1', '', 'NaN', 'Infinity'])
      expect(() => eurosToCents(value)).toThrow();
  });
  it('provodi donju i gornju granicu prije slanja poslužitelju', () => {
    expect(() => eurosToCents('0,99', 100)).toThrow('1,00');
    expect(eurosToCents('1000000,00')).toBe(100000000);
    expect(() => eurosToCents('1000000,01')).toThrow();
  });
  it('prikazuje spremljene iznose u eurima bez ponovnog množenja i razlikuje nulu od ponude', () => {
    expect(centsToEuroInput(null)).toBe('');
    expect(centsToEuroInput(0)).toBe('0,00');
    expect(centsToEuroInput(2501)).toBe('25,01');
    for (const amount of [1, 3, 29, 99, 100, 101, 2501, 99999, 100000000])
      expect(eurosToCents(centsToEuroInput(amount))).toBe(amount);
  });
});
