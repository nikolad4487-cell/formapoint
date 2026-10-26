import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/use-auth';
import { rpc } from '../lib/supabase';
import type { Service } from '../lib/domain';
import { Button } from './ui/button';
export function AddToCartButton({
  service,
  quantity = 1,
}: {
  service: Service;
  quantity?: number;
}) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (service.price_cents === null)
    return (
      <Button asChild variant="outline">
        <Link to={`/app/nova-narudzba?usluga=${service.slug}&ponuda=1`}>Zatraži ponudu</Link>
      </Button>
    );
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        if (!session) {
          navigate(
            `/kupnja-kao-gost?service=${encodeURIComponent(service.id)}&quantity=${quantity}`,
          );
          return;
        }
        setBusy(true);
        try {
          await rpc('cart_add', { p_service: service.id, p_quantity: quantity });
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
