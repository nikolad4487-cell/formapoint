import type { Service } from './domain';
export function categorySlug(service: Service): string {
  return (
    service.category_slug ||
    service.category
      .toLowerCase()
      .replace(/đ/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}
export function servicePath(service: Service): string {
  return `/${encodeURIComponent(categorySlug(service))}/${encodeURIComponent(service.slug)}`;
}
export function serviceReference(
  services: Service[],
  reference: string | null,
): Service | undefined {
  if (!reference) return undefined;
  const id = services.find((service) => service.id === reference);
  if (id) return id;
  const matches = services.filter((service) => service.slug === reference);
  return matches.length === 1 ? matches[0] : undefined;
}
