import type { SupabaseClient } from '@supabase/supabase-js';

export function catalogError(error: unknown): string {
  const value = error as { code?: string; message?: string };
  if (value?.code === '23505') {
    if (value.message?.includes('services_slug_key'))
      return 'Za jednake oznake u različitim kategorijama primijenite SQL nadogradnju 013.';
    return 'Artikl s tom oznakom već postoji u odabranoj kategoriji. Odaberite drugu oznaku ili uredite postojeći artikl.';
  }
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
  const { error } = await db.from('services').insert({ ...fields, slug });
  if (error) throw error;
  return slug;
}
