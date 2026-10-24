import { z } from 'zod';
export interface SiteSettings {
  id: boolean;
  platform_name?: string;
  stripe_enabled: boolean;
  maintenance: boolean;
  contact_phone?: string | null;
  public_contact_email?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  linkedin_url?: string | null;
  payment_icons?: Record<string, string>;
  cancellation_days?: number | null;
  final_payment_days?: number | null;
  policies_approved?: boolean;
  created_at: string;
}
export interface BusinessSettings {
  id: boolean;
  legal_name: string | null;
  address: string | null;
  contact_email: string | null;
  tax_status: string | null;
  notification_email?: string | null;
  payment_recipient?: string | null;
  iban?: string | null;
  bank_name?: string | null;
  payment_phone?: string | null;
  created_at: string;
}
export interface ContentPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  published: boolean;
  is_legal: boolean;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  pdf_url: string | null;
  file_path: string | null;
  scan_status: string;
  publication_rights: boolean;
  published: boolean;
  created_at: string;
}
export interface NewsletterTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  image_url: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
}
export interface Subscriber {
  id: string;
  user_id: string;
  email: string;
  status: string;
  confirmed_at: string | null;
  created_at: string;
}
export interface Campaign {
  id: string;
  template_id: string | null;
  subject: string;
  html: string;
  status: string;
  created_at: string;
}
export interface AdminUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  roles: string[];
  created_at: string;
  order_count: number;
}
export const legalSlugs = [
  'uvjeti-koristenja',
  'pravila-privatnosti',
  'kolacici',
  'otkazivanje-i-povrati',
  'prigovori',
];
const https = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return u.protocol === 'https:' && Boolean(u.hostname) && !u.username && !u.password;
    } catch {
      return false;
    }
  }, 'Unesite valjanu https poveznicu.');
const email = z
  .string()
  .trim()
  .max(254)
  .refine((v) => !v || z.email().safeParse(v).success, 'Unesite ispravnu e-mail adresu.');
export const siteSchema = z.object({
  platform_name: z.string().trim().min(2, 'Naziv treba imati najmanje 2 znaka.').max(80),
  contact_phone: z.string().trim().max(40),
  public_contact_email: email,
  facebook_url: https,
  instagram_url: https,
  linkedin_url: https,
  cancellation_days: z.number().int().min(0).max(365).nullable(),
  final_payment_days: z.number().int().min(1).max(365).nullable(),
  policies_approved: z.boolean(),
  stripe_enabled: z.boolean(),
  maintenance: z.boolean(),
  payment_icons: z.partialRecord(
    z.enum(['visa', 'mastercard', 'apple_pay', 'google_pay', 'keks', 'aircash']),
    https,
  ),
});
export function validIban(input: string) {
  const iban = input.replace(/\s/g, '').toUpperCase();
  if (!iban) return true;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const chars = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of chars) {
    for (const digit of /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char)
      remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}
export const businessSchema = z.object({
  legal_name: z.string().trim().max(200),
  address: z.string().trim().max(300),
  contact_email: email,
  tax_status: z.string().trim().max(200),
  notification_email: email,
  payment_recipient: z.string().trim().max(200),
  iban: z
    .string()
    .trim()
    .max(40)
    .refine(validIban, 'Unesite valjan IBAN ili ostavite polje prazno.'),
  bank_name: z.string().trim().max(150),
  payment_phone: z.string().trim().max(40),
});
export const pageSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'Slug smije sadržavati mala slova, brojeve i crtice.')
    .max(100),
  title: z.string().trim().min(2).max(150),
  content: z.string().trim().min(10, 'Sadržaj treba imati najmanje 10 znakova.').max(100000),
});
export const portfolioSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(10000),
  pdf_url: https.refine(
    (v) => Boolean(v),
    'Dodajte javnu PDF poveznicu ili koristite prijenos datoteke.',
  ),
});
export function parsed<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new Error(
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '),
    );
  return result.data;
}
export function field(form: FormData, name: string) {
  return String(form.get(name) || '').trim();
}
export const nullable = (s: string) => s || null;
export function previewHtml(html: string) {
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><style>body{font:14px Arial,sans-serif;padding:20px;color:#10183f;overflow-wrap:anywhere}img{max-width:100%}</style>${html}`;
}
