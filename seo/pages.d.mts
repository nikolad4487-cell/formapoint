import type { Service } from '../src/lib/domain';
import type { SiteSettings, ContentPage, PortfolioItem } from '../src/lib/admin-tools';
export interface PublicSnapshot {
  version?: number;
  services: Service[];
  settings: Partial<SiteSettings>;
  pages: ContentPage[];
  portfolio: PortfolioItem[];
  methods?: unknown[] | null;
}
export interface SeoPage {
  status: number;
  indexable: boolean;
  canonical: string | null;
  title: string;
  heading: string;
  description: string;
  body: string;
  schema: Record<string, unknown>[];
  redirect?: string;
}
export const SITE_ORIGIN: string;
export function escapeHtml(value: unknown): string;
export function safeJson(value: unknown): string;
export function safeUrl(value: unknown): string | null;
export function categorySlug(service: Service): string;
export function servicePath(service: Service): string;
export function normaliseServices(rows: unknown[], packages?: unknown[]): Service[];
export function isPrivatePath(path: string): boolean;
export function cleanPath(path: string): string | null;
export function makePage(path: string, snapshot: Partial<PublicSnapshot>): SeoPage;
export function sitemap(snapshot: PublicSnapshot): string;
export function renderHtml(
  template: string,
  page: SeoPage,
  snapshot: PublicSnapshot,
  options?: { preview?: boolean; googleVerification?: string; bingVerification?: string },
): string;
