# Slugovi artikala unutar kategorija

Javna putanja koristi slug kategorije i slug artikla: `/prezentacije/izrada` ili `/zavrsni-rad/izrada`. Slug kategorije uređuje se u Administracija → Kategorije, a slug artikla u njegovu obrascu. Naziv kategorije i njezin slug mogu se razlikovati.

Isti slug artikla dopušten je u različitim kategorijama. Duplikat unutar iste kategorije baza odbija; ne dodaju se automatski nastavci. Košarica, ponude i narudžbe koriste stabilni ID artikla, pa se istoimene oznake ne miješaju.

## Aktivacija na postojećem Supabase projektu

U SQL Editoru pokrenite cijelu datoteku `public/migracije/202610260013_category_service_slugs.sql` jednom. Nadogradnja mijenja globalnu jedinstvenost `services.slug` u jedinstvenost `(category_id, slug)`. Postojeći ID-evi, slugovi, cijene, narudžbe i plaćanja ostaju sačuvani. Svaki artikl mora pripadati postojećoj kategoriji.

Bez te nadogradnje postojeća baza još odbija iste slugove između kategorija. Obrazac tada prikazuje uputu za nadogradnju 013. Nije potrebna objava nove Edge funkcije.

Poveznice `/usluge/slug` nastavljaju raditi: ako postoji samo jedan takav aktivni artikl, preusmjeravaju na njegovu kategorijsku putanju. Ako postoji više njih, posjetitelj odabire kategoriju. Ne otvara se proizvoljno prvi artikl.

Slug kategorije sadrži mala slova bez kvačica, brojeve i crtice. Prefiksi `app`, `admin`, `p` i `usluge` rezervirani su za postojeće putanje aplikacije.
