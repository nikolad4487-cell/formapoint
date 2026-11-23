import { describe, expect, it } from 'vitest';
import {
  readCartSelection,
  cartSelectionSearch,
  cartSelectionRequest,
} from '../src/lib/cart-selection';
const service = '958b7acd-8f18-4a93-a723-406c294cefa2';
const variant = '20270101-0007-4000-8000-000000000003';
describe('Odabir artikla kroz kupnju kao gost i prijavu', () => {
  it('čuva točan paket i količinu pri ponovnom čitanju poveznice, bez cijene iz URL-a', () => {
    const selected = readCartSelection(
      new URLSearchParams(
        `service=${service}&package=${variant}&quantity=3&price=1&redirect=https://example.invalid`,
      ),
    );
    expect(readCartSelection(new URLSearchParams(cartSelectionSearch(selected)))).toEqual({
      service,
      package: variant,
      quantity: 3,
    });
    expect(cartSelectionRequest(selected!)).toEqual({
      name: 'cart_add_variant',
      args: { p_service: service, p_variant: variant, p_quantity: 3 },
    });
    expect(cartSelectionSearch(selected)).not.toContain('price');
    expect(cartSelectionSearch(selected)).not.toContain('redirect');
  });
  it('običan artikal ostaje običan artikal i zadana količina je jedan', () => {
    const selected = readCartSelection(new URLSearchParams({ service }));
    expect(selected).toEqual({ service, quantity: 1 });
    expect(cartSelectionRequest(selected!)).toEqual({
      name: 'cart_add',
      args: { p_service: service, p_quantity: 1 },
    });
    expect(cartSelectionSearch(null)).toBe('');
  });
  it('ne zamjenjuje neispravan odabir paketa osnovnom uslugom', () => {
    expect(readCartSelection(new URLSearchParams({ service, package: 'wrong' }))).toBeNull();
    expect(
      readCartSelection(new URLSearchParams({ service: 'wrong', package: variant })),
    ).toBeNull();
    expect(readCartSelection(new URLSearchParams({ service, package: '' }))).toBeNull();
  });
  it('odbija neispravnu količinu umjesto pogrešnog dodavanja ili promjene košarice', () => {
    for (const quantity of ['0', '-1', '101', '1.5', 'NaN', '1e2'])
      expect(
        readCartSelection(new URLSearchParams({ service, package: variant, quantity })),
      ).toBeNull();
  });
});
