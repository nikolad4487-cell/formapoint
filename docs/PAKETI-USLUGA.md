# Više paketa jedne usluge

U **Administracija → Usluge** uz spremljenu uslugu kliknite **Paketi**. Odaberite **Dodaj paket**, unesite naziv, opis/opseg i cijenu u eurima te razdoblje usluge. Uključite **Kupac bira između paketa ove usluge** i spremite. Za novu uslugu najprije spremite osnovne podatke, zatim dodajte pakete.

Odobreni paketi od **1.1.2027.**:

| Usluga                        | Paket                                        | Cijena  |
| ----------------------------- | -------------------------------------------- | ------- |
| Upravljanje i vođenje e-pošte | Jednokratno, do 4 sata                       | 70 €    |
| Upravljanje i vođenje e-pošte | Tjedno, 3 sata dnevno, 5 dana                | 90 €    |
| Upravljanje i vođenje e-pošte | Mjesečno, 4 sata dnevno, ponedjeljak – petak | 350 €   |
| Online administracija         | Tjedno, 4 sata dnevno, 5 dana (20 sati)      | 300 €   |
| Online administracija         | Mjesečno, 4 sata dnevno, ponedjeljak – petak | 1.300 € |

Mjesečni paketi imaju fiksnu cijenu neovisno o broju radnih dana u mjesecu. Blagdani i drugi neradni dani uređuju se prema dogovoru. Svaki paket naplaćuje se jednom za opisani opseg i razdoblje, bez automatske obnove.

Ove buduće cijene aktiviraju se putem SQL nadogradnje 021 nakon 020; ne unositi ih kao današnje aktivne pakete prije početka valjanosti. [Upute za cjenik i aktivaciju](CIJENE-OD-2027.md).

Kupac na stranici usluge vidi aktivne pakete i dodaje konkretan paket u košaricu. Različiti paketi iste usluge zasebne su stavke; ponovljeno dodavanje istog paketa povećava njegovu količinu. Kupnja kao gost zadržava odabrani paket. Cijena se uvijek provjerava u bazi, a kupon za uslugu vrijedi na njezine odabrane pakete. Pravila 50/50 nasljeđuju se iz usluge i provjeravaju za svaku stavku. POPUST10 i dalje vrijedi samo za prvu narudžbu uz jednokratno kartično plaćanje.

Dok su paketi uključeni, osnovna cijena usluge ne koristi se za kupnju. Isključivanjem paketa vraća se osnovna cijena odnosno individualna ponuda. Aktivna usluga s uključenim paketima mora imati barem jedan aktivan paket. Uklanjanje paketa arhivira ga; stare narudžbe zadržavaju naziv, opis, razdoblje i ugovorenu cijenu. U staroj košarici uklonjeni paket treba ukloniti ili odabrati drugi, a ne zamijeniti ga osnovnom cijenom. Brisanje cijele usluge također zadržava snimke naručenih paketa.

## Aktivacija u postojećoj aplikaciji

1. U Supabase SQL Editoru pokrenite cijelu datoteku `public/migracije/202611120019_service_packages.sql`, nakon nadogradnje 017. Nadogradnja 018 nije preduvjet. Skripta se može sigurno ponoviti; ne uključuje pakete na postojećim uslugama niti mijenja postojeće cijene.
2. Pričekajte automatsku Vercel objavu s GitHuba i osvježite aplikaciju.
3. Za aktualne informacije o paketima u AI asistentu u Codespaces terminalu pokrenite:

   ```sh
   git pull --ff-only
   npm run deploy:ai
   ```

Nisu potrebni novi ključevi niti objava Stripe funkcija. Prije SQL nadogradnje postojeće usluge i košarica nastavljaju raditi, a gumb Paketi nudi poveznicu na SQL 019.

## Nacrti i potvrda spremanja

Izmjene paketa automatski se čuvaju kao nespremljeni nacrt u `sessionStorage`, zasebno po administratorskom računu i usluzi. Ponovno otvaranje prozora ili osvježavanje iste kartice vraća unos. To ne objavljuje cijene kupcima: potrebno je kliknuti **Spremi pakete** i pričekati potvrdu uspješnog spremanja. Nacrt se uklanja tek nakon uspješnog odgovora baze ili pritiskom na **Odbaci nacrt**, koji vraća spremljene vrijednosti. Neuspješan zahtjev ostavlja prozor otvoren, prikazuje pogrešku i zadržava unos.

Nacrt traje tijekom sesije te kartice preglednika; ne zamjenjuje spremanje u bazu niti može vratiti podatke izgubljene prije uvođenja ove zaštite. Ako preglednik ne dopušta lokalnu pohranu, obrazac to jasno prikazuje.

## Odabir paketa, prijava i košarica

U radnom prostoru **Nova narudžba** aktivni paketi prikazuju se unutar samog kataloga. Dodavanje konkretnog paketa ostaje na toj stranici; košarica se otvara postojećom poveznicom. Javno zaglavlje prijavljenom korisniku pokazuje **Moj račun**, a gostu **Moje narudžbe**, umjesto prikaza koji sugerira odjavu.

Gumb za dodavanje čeka završetak početne obnove prijave i dodatno provjerava SDK sesiju prije odluke o gostujućoj kupnji. Gumbi imaju `type="button"`, pa ne šalju okolni obrazac. Ako API odbije zahtjev zbog istekle prijave (401), prijava se otvara uz očuvani identifikator usluge, paketa i količinu.

Odabir se prenosi poveznicama između kupnje kao gost, prijave i registracije, uključujući poveznice u zaglavlju, i preživljava osvježavanje tih stranica. Nakon uspješne prijave ili registracije odabrani paket dodaje se u korisnikovu košaricu, zatim se otvara košarica. Cijena se nikada ne prenosi URL-om; provjerava se u bazi. Neispravni identifikatori ili količine ne zamjenjuju paket osnovnim artiklom.

Neuspjelo dodavanje nakon uspješne prijave prikazuje zasebnu pogrešku i omogućuje ponovni pokušaj bez ponovnog unosa lozinke. Ovo ne zahtijeva novu SQL nadogradnju. Postojeće gostujuće narudžbe i košarica ostaju vezane uz istu sesiju preglednika; registracija gosta i dalje nadograđuje njegov postojeći račun.
