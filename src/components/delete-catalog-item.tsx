import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { ConfirmationDialog } from './ui/dialog';
import { requireDb } from '../lib/supabase';
import { action } from '../pages/workspace';

export function DeleteCatalogItem({
  id,
  name,
  category = false,
}: {
  id: string;
  name: string;
  category?: boolean;
}) {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Izbriši ${name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 size={16} /> Izbriši
      </Button>
      <ConfirmationDialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
        title={category ? 'Izbrisati kategoriju?' : 'Izbrisati artikl?'}
      >
        <p>
          <strong>{name}</strong>
        </p>
        <p>
          {category
            ? 'Kategoriju možete izbrisati kada iz nje izbrišete ili premjestite sve artikle.'
            : 'Artikl će se trajno ukloniti iz kataloga i košarica. Postojeće narudžbe, njihovi nazivi i iznosi ostaju sačuvani. Kuponi vezani uz ovaj artikl bit će deaktivirani.'}
        </p>
        {needsUpgrade && (
          <p role="alert">
            Najprije u Supabase SQL Editoru pokrenite cijelu{' '}
            <a className="text-link" href="/migracije/202610250009_catalog_deletion.sql" download>
              SQL nadogradnju 009
            </a>
            , zatim pokušajte ponovno.
          </p>
        )}
        <div className="actions">
          <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Odustani
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await action(async () => {
                const { error } = await requireDb().rpc(
                  category ? 'admin_delete_category' : 'admin_delete_service',
                  category ? { p_category: id } : { p_service: id },
                );
                if (error) {
                  if (error.code === 'PGRST202' || error.code === '42883') {
                    setNeedsUpgrade(true);
                    throw new Error('Za brisanje primijenite SQL nadogradnju 009.');
                  }
                  throw new Error(error.message);
                }
                setOpen(false);
                await cache.invalidateQueries();
              });
              setBusy(false);
              if (ok) setNeedsUpgrade(false);
            }}
          >
            {busy ? 'Brisanje…' : 'Trajno izbriši'}
          </Button>
        </div>
      </ConfirmationDialog>
    </>
  );
}
