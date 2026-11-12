# Više paketa jedne usluge

U **Administracija → Usluge** uz spremljenu uslugu kliknite **Paketi**. Odaberite **Dodaj paket**, unesite naziv, opis/opseg i cijenu u eurima te razdoblje usluge. Uključite **Kupac bira između paketa ove usluge** i spremite. Za novu uslugu najprije spremite osnovne podatke, zatim dodajte pakete.

Primjer za **Upravljanje i vođenje e-pošte**:

| Paket   | Opis                   | Razdoblje      | Cijena |
| ------- | ---------------------- | -------------- | ------ |
| Paket 1 | Jednokratno, 4h tjedno | Jednokratno    | 70 €   |
| Paket 2 | 5h tjedno              | Tjedni paket   | 90 €   |
| Paket 3 | Mjesečno upravljanje   | Mjesečni paket | 350 €  |

To su primjeri za unos, ne unaprijed upisani artikli ili cijene. Svaki paket naplaćuje se jednom za opisani opseg i razdoblje. Oznake „tjedni” i „mjesečni” ne uključuju pretplatu niti automatsku obnovu naplate.

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
