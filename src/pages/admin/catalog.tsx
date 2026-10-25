import { DeleteCatalogItem } from '../../components/delete-catalog-item';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil } from 'lucide-react';
import { useRows } from '../../hooks/use-data';
import {
  PageHeader,
  EmptyState,
  SearchInput,
  ServiceIcon,
  StatusBadge,
} from '../../components/common';
import { Button } from '../../components/ui/button';
import { ConfirmationDialog } from '../../components/ui/dialog';
import { AdminData } from '../../components/admin-data';
import { ServiceEditor } from '../workspace';
import type { Service } from '../../lib/domain';
import { money } from '../../lib/utils';
export function CatalogAdmin() {
  const categories = useRows<{ id: string; name: string }>('service_categories');
  const services = useRows<Service>('services');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Service | undefined>();
  const [category, setCategory] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Upravljanje katalogom"
        description="Kategorije i usluge na jednom mjestu, s cijenama i aktivnim statusima."
        actions={
          <Button asChild>
            <Link to="/admin/kategorije">
              <Plus size={16} />
              Nova kategorija
            </Link>
          </Button>
        }
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Pretraži kategorije i usluge" />
      <AdminData query={categories}>
        <AdminData query={services}>
          {categories.data?.length ? (
            categories.data.map((c) => {
              const rows =
                services.data?.filter(
                  (s) =>
                    s.category === c.name &&
                    `${s.name} ${c.name}`.toLowerCase().includes(search.toLowerCase()),
                ) || [];
              if (search && !rows.length) return null;
              return (
                <section className="panel catalog-category" key={c.id}>
                  <div className="panel-heading">
                    <h2>{c.name}</h2>
                    <div className="actions table-actions">
                      <DeleteCatalogItem id={c.id} name={c.name} category />
                      <Link className="text-link" to="/admin/kategorije">
                        <Pencil size={15} />
                        Uredi kategoriju
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(undefined);
                          setCategory(c.name);
                          setOpen(true);
                        }}
                      >
                        <Plus size={15} />
                        Usluga
                      </Button>
                    </div>
                  </div>
                  {rows.length ? (
                    <div className="data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Naziv</th>
                            <th>Cijena</th>
                            <th>Model</th>
                            <th>Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((s) => (
                            <tr key={s.id}>
                              <td>
                                <span className="catalog-service-name">
                                  <span className={`service-${s.icon}`}>
                                    <span className="service-icon">
                                      <ServiceIcon name={s.icon} />
                                    </span>
                                  </span>
                                  {s.name}
                                </span>
                              </td>
                              <td>
                                {s.price_cents === null ? 'Prema ponudi' : money(s.price_cents)}
                              </td>
                              <td>{s.split_enabled ? '100 % ili 50/50' : '100 %'}</td>
                              <td>
                                <StatusBadge status={s.active ? 'active' : 'inactive'} />
                              </td>
                              <td>
                                <div className="actions table-actions">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditing(s);
                                      setCategory(c.name);
                                      setOpen(true);
                                    }}
                                  >
                                    Uredi
                                  </Button>
                                  <DeleteCatalogItem id={s.id} name={s.name} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState title="Kategorija još nema usluga" />
                  )}
                </section>
              );
            })
          ) : (
            <EmptyState title="Dodajte prvu kategoriju" />
          )}
        </AdminData>
      </AdminData>
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Uredi uslugu' : 'Nova usluga'}
      >
        <ServiceEditor service={editing} initialCategory={category} done={() => setOpen(false)} />
      </ConfirmationDialog>
    </>
  );
}
