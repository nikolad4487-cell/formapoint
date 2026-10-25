import { useQuery } from '@tanstack/react-query';
import { configured, requireDb } from '../lib/supabase';
export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  provider: 'stripe' | 'bank' | 'unconnected';
  enabled: boolean;
  verified: boolean;
  icon_url: string | null;
  created_at: string;
}
export const stripeMethods = [
  ['visa', 'Visa'],
  ['mastercard', 'Mastercard'],
  ['apple_pay', 'Apple Pay'],
  ['google_pay', 'Google Pay'],
] as const;
export function usePublicPaymentMethods() {
  return useQuery({
    queryKey: ['payment_methods', 'public'],
    enabled: configured,
    queryFn: async () => {
      const { data, error } = await requireDb()
        .from('payment_methods')
        .select('*')
        .eq('enabled', true)
        .order('created_at');
      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') return null;
        throw error;
      }
      return (data as PaymentMethod[]).filter(
        (m) =>
          m.enabled &&
          ((m.provider === 'bank' && m.code === 'iban') ||
            (m.provider === 'stripe' &&
              stripeMethods.some(([code]) => code === m.code) &&
              (['visa', 'mastercard'].includes(m.code) || m.verified))),
      );
    },
  });
}
