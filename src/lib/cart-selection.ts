// Carry only product identifiers and quantity; the server always supplies the price.
export interface CartSelection {
  service: string;
  quantity: number;
  package?: string;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readCartSelection(params: URLSearchParams): CartSelection | null {
  const service = params.get('service');
  const variant = params.get('package');
  const rawQuantity = params.get('quantity') || '1';
  const quantity = Number(rawQuantity);
  if (
    !service ||
    !uuid.test(service) ||
    (variant !== null && !uuid.test(variant)) ||
    !/^\d+$/.test(rawQuantity) ||
    quantity < 1 ||
    quantity > 100
  )
    return null;
  return { service, quantity, ...(variant ? { package: variant } : {}) };
}
export function cartSelectionSearch(selection: CartSelection | null) {
  if (!selection) return '';
  const params = new URLSearchParams({
    service: selection.service,
    quantity: String(selection.quantity),
  });
  if (selection.package) params.set('package', selection.package);
  return `?${params}`;
}
export function cartSelectionRequest(selection: CartSelection) {
  return {
    name: selection.package ? 'cart_add_variant' : 'cart_add',
    args: {
      p_service: selection.service,
      p_quantity: selection.quantity,
      ...(selection.package ? { p_variant: selection.package } : {}),
    },
  };
}
