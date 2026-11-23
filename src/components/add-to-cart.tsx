import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/use-auth';
import { requireDb } from '../lib/supabase';
import { cartSelectionSearch } from '../lib/cart-selection';
import { servicePath } from '../lib/service-links';
import type { Service, ServicePackage } from '../lib/domain';
import { Button } from './ui/button';
export function AddToCartButton({
  service,
  quantity = 1,
  variant,
}: {
  service: Service;
  quantity?: number;
  variant?: ServicePackage;
}) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (service.packages_enabled && !variant)
    return (
      <Button asChild>
        <Link to={servicePath(service)}>Odaberi paket</Link>
      </Button>
    );
  if (service.price_cents === null && !variant)
    return (
      <Button asChild variant="outline">
        <Link to={`/app/nova-narudzba?usluga=${encodeURIComponent(service.id)}&ponuda=1`}>
          Zatraži ponudu
        </Link>
      </Button>
    );
  return (
    <Button
      type="button"
      disabled={busy || loading}
      aria-busy={busy || loading}
      onClick={async () => {
        if (busy || loading) return;
        setBusy(true);
        try {
          // Read the SDK's restored session before deciding that this is a guest.
          const current = await requireDb().auth.getSession();
          const selection = cartSelectionSearch({
            service: service.id,
            quantity,
            ...(variant ? { package: variant.id } : {}),
          });
          if (current.error) {
            navigate(`/prijava${selection}`, { state: { from: '/app/kosarica' } });
            return;
          }
          if (!current.data.session) {
            navigate(`${session ? '/prijava' : '/kupnja-kao-gost'}${selection}`, {
              state: { from: '/app/kosarica' },
            });
            return;
          }
          const result = await requireDb().rpc(variant ? 'cart_add_variant' : 'cart_add', {
            p_service: service.id,
            p_quantity: quantity,
            ...(variant ? { p_variant: variant.id } : {}),
          });
          if (result.error) {
            if (result.status === 401) {
              navigate(`/prijava${selection}`, { state: { from: '/app/kosarica' } });
              return;
            }
            throw new Error(result.error.message);
          }
          await cache.invalidateQueries({ queryKey: ['cart'] });
          toast.success('Artikl je dodan u košaricu.');
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Dodavanje nije uspjelo.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <ShoppingBag size={16} />
      {loading ? 'Provjera prijave…' : busy ? 'Dodavanje…' : 'Dodaj u košaricu'}
    </Button>
  );
}
