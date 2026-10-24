import type { ReactNode } from 'react';
import { Database, Download } from 'lucide-react';
import { LoadingSkeleton, ErrorState } from './common';
import { Button } from './ui/button';
export function UpgradeNotice() {
  return (
    <div className="notice">
      <Database size={23} />
      <div>
        <strong>Potrebna je nadogradnja baze</strong>
        <p>
          U Supabase SQL Editoru jednom primijenite migraciju 202610240006_admin_tools.sql. Ona
          dodaje nove module i čuva postojeće narudžbe i korisnike.
        </p>
        <Button asChild size="sm" variant="outline">
          <a href="/migracije/202610240006_admin_tools.sql" download>
            <Download size={15} />
            Preuzmi SQL nadogradnju
          </a>
        </Button>
      </div>
    </div>
  );
}
export function AdminData({
  query,
  children,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  children: ReactNode;
}) {
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError) {
    const code = (query.error as { code?: string })?.code;
    return ['PGRST205', 'PGRST202', 'PGRST204', '42703', '42P01'].includes(code || '') ? (
      <UpgradeNotice />
    ) : (
      <ErrorState retry={() => void query.refetch()} />
    );
  }
  return <>{children}</>;
}
