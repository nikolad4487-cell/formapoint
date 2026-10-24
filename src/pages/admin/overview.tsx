import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, MessageSquare, Inbox, Palette, CreditCard } from 'lucide-react';
import { money } from '../../lib/utils';
import { StatCard } from '../../components/common';
import { AdminData } from '../../components/admin-data';
import { requireDb } from '../../lib/supabase';
export function AdminDashboardExtras() {
  const q = useQuery({
    queryKey: ['admin-summary'],
    queryFn: async () => {
      const { data, error } = await requireDb().rpc('admin_summary');
      if (error) throw error;
      return data as {
        users: number;
        messages_month: number;
        inquiries_week: number;
        revenue_month: number;
      };
    },
  });
  return (
    <AdminData query={q}>
      <div className="admin-extra-stats">
        <StatCard
          label="Korisnici"
          value={q.data?.users ?? '…'}
          icon={<Users />}
          description="Ukupno registriranih"
        />
        <StatCard
          label="Poruke ovog mjeseca"
          value={q.data?.messages_month ?? '…'}
          icon={<MessageSquare />}
          description="Korisničke poruke u narudžbama"
          tone="violet"
        />
        <StatCard
          label="Novi upiti"
          value={q.data?.inquiries_week ?? '…'}
          icon={<Inbox />}
          description="Kontakt i podrška, zadnjih 7 dana"
          tone="orange"
        />
        <StatCard
          label="Naplaćeno ovog mjeseca"
          value={q.data?.revenue_month === undefined ? '…' : money(q.data.revenue_month)}
          description="Potvrđene uplate, umanjene za povrate"
          icon={<CreditCard />}
          tone="green"
        />
        <Link className="panel brand-shortcut" to="/admin/vizualni-identitet">
          <Palette />
          <strong>Vizualni identitet</strong>
          <span>Preuzmite logotip u PNG ili SVG formatu →</span>
        </Link>
      </div>
    </AdminData>
  );
}
