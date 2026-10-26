import type { SupabaseClient } from '@supabase/supabase-js';

export function catalogError(error: unknown): string {
  const value = error as { code?: string; message?: string };
  if (value?.code === '23505')
    return 'Artikl s tom oznakom u URL-u već postoji. Unesite drugu oznaku.';
  if (value?.code === '42501')
    return 'Nemate ovlasti za spremanje artikla. Prijavite se administratorskim računom.';
  if (value?.code === '23503')
    return 'Odabrana kategorija više nije dostupna. Odaberite postojeću kategoriju.';
  if (value?.code === '23514') {
    if (value.message?.includes('split_min'))
      return 'Minimalni iznos za 50/50 mora biti najmanje 2,00 €.';
    if (value.message?.includes('price_cents'))
      return 'Cijena mora biti najmanje 1,00 € ili prazna za individualnu ponudu.';
    if (value.message?.includes('name')) return 'Naziv artikla mora imati između 2 i 150 znakova.';
    if (value.message?.includes('slug'))
      return 'Oznaka u URL-u smije sadržavati mala slova bez kvačica, brojeve i crtice.';
    return 'Provjerite naziv, cijenu, broj revizija i rok izrade artikla.';
  }
  return typeof value?.message === 'string'
    ? value.message
    : 'Artikl nije spremljen. Pokušajte ponovno.';
}

export async function saveCatalogService(
  db: SupabaseClient,
  fields: Record<string, unknown>,
  id?: string,
): Promise<string> {
  const slug = String(fields.slug).trim();
  if (id) {
    const { error } = await db
      .from('services')
      .update({ ...fields, slug })
      .eq('id', id);
    if (error) throw error;
    return slug;
  }
  const category =
    String(fields.category)
      .toLowerCase()
      .replace(/đ/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'artikl';
  const stem = `${slug}-${category}`;
  // Existing public URLs stay unchanged. A new article can share an ordinary
  // label such as "izrada" with another category while getting its own URL.
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? slug : attempt === 1 ? stem : `${stem}-${attempt}`;
    const existing = await db.from('services').select('id').eq('slug', candidate).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) continue;
    const { error } = await db.from('services').insert({ ...fields, slug: candidate });
    if (!error) return candidate;
    // Handle a simultaneous insert after our uniqueness check as well.
    if (error.code !== '23505') throw error;
  }
  throw new Error('Više artikala već koristi ovu oznaku. Unesite drugačiju oznaku u URL-u.');
}
