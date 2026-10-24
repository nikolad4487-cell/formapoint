import { describe, it, expect } from 'vitest';
import { businessSchema, siteSchema, validIban, previewHtml } from '../src/lib/admin-tools';
const site = {
  platform_name: 'FormaPoint',
  contact_phone: '',
  public_contact_email: '',
  facebook_url: '',
  instagram_url: '',
  linkedin_url: '',
  cancellation_days: null,
  final_payment_days: null,
  policies_approved: false,
  stripe_enabled: false,
  maintenance: true,
  payment_icons: {},
};
describe('administratorske postavke', () => {
  it('provjerava i normalizirane i neispravne IBAN brojeve', () => {
    expect(validIban('HR12 1001 0051 8630 0016 0')).toBe(true);
    expect(validIban('HR1210010051863000161')).toBe(false);
    expect(validIban('')).toBe(true);
  });
  it('ne baca iznimku pri neispravnom URL-u i odbija protokole i vjerodajnice', () => {
    for (const url of [
      'https://[',
      'javascript:alert(1)',
      'http://example.invalid',
      'https://user:password@example.invalid',
    ])
      expect(siteSchema.safeParse({ ...site, instagram_url: url }).success).toBe(false);
    expect(
      siteSchema.safeParse({ ...site, instagram_url: 'https://example.invalid/profil' }).success,
    ).toBe(true);
  });
  it('dopušta brisanje neobveznih kontakata i ograničava ikone na poznate metode', () => {
    expect(siteSchema.safeParse(site).success).toBe(true);
    expect(
      siteSchema.safeParse({
        ...site,
        payment_icons: { unknown: 'https://example.invalid/icon.svg' },
      }).success,
    ).toBe(false);
    expect(
      businessSchema.safeParse({
        legal_name: '',
        address: '',
        contact_email: '',
        tax_status: '',
        notification_email: '',
        payment_recipient: '',
        iban: '',
        bank_name: '',
        payment_phone: '',
      }).success,
    ).toBe(true);
  });
  it('pregled HTML-a zabranjuje skripte, navigaciju i mrežne zahtjeve osim slika', () => {
    const result = previewHtml('<h1>Primjer</h1>');
    expect(result).toContain("default-src 'none'");
    expect(result).toContain("form-action 'none'");
    expect(result).toContain("base-uri 'none'");
    expect(result).toContain('<h1>Primjer</h1>');
  });
});
