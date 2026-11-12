import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/use-auth';
import { rpc } from '../lib/supabase';
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
  const { session } = useAuth();
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
      disabled={busy}
      onClick={async () => {
        if (!session) {
          navigate(
            `/kupnja-kao-gost?service=${encodeURIComponent(service.id)}&quantity=${quantity}${variant ? `&package=${encodeURIComponent(variant.id)}` : ''}`,
          );
          return;
        }
        setBusy(true);
        try {
          await rpc(variant ? 'cart_add_variant' : 'cart_add', {
            p_service: service.id,
            p_quantity: quantity,
            ...(variant ? { p_variant: variant.id } : {}),
          });
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
      {busy ? 'Dodavanje…' : 'Dodaj u košaricu'}
    </Button>
  );
}
