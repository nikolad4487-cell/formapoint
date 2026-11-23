# Automatske cijene od 1. siječnja 2027.

Nadogradnja `public/migracije/202611120020_scheduled_prices.sql` priprema odobreni raspored. Početak je **1.1.2027. u 00:00 po Hrvatskoj**, odnosno `2026-12-31T23:00:00Z`.

| Postojeća usluga / nova usluga               | Cijena od 1.1.2027. |
| -------------------------------------------- | ------------------- |
| Završni rad - izrada                         | 80 €                |
| Uređenje završnog rada                       | 30 €                |
| Izrada PowerPoint prezentacije završnog rada | 30 €                |
| Izrada PowerPoint prezentacije               | 20 €                |
| Pisanje životopisa                           | 20 €                |
| Pisanje eseja                                | 20 €                |
| Pisanje referata                             | 20 €                |
| Prepisivanje bilješki u dokument             | 20 €                |
| Pisanje sastavka                             | 20 €                |
| Seminar — nova usluga                        | 30 €                |

Postojeći artikli povezani su prema provjerenim identifikatorima, pa jednak slug u drugoj kategoriji ne preusmjerava promjenu. Osnovna nadogradnja 020 ne mijenja administraciju, e-poštu, njihove pakete ni dodatne stranice/slajdove. Naknadno odobreni paketi administracije i e-pošte pripremaju se nadogradnjom 021 opisanom niže. Cijene koje su već na željenom iznosu svejedno dobivaju zapis u rasporedu.

Seminar se priprema kao neobjavljeni nacrt u kategoriji **Učenički radovi - osnovna i srednja škola**. Prije datuma nema novu fiksnu cijenu. Vlasnik treba dovršiti opis/opseg i rok te sam objaviti uslugu. Raspored mijenja njezinu cijenu na 30 €, ali ne uključuje javnu objavu umjesto vlasnika.

## Aktivacija — jednom sada, bez povratka 1. siječnja

1. Nakon nadogradnje 019 otvorite cijelu SQL datoteku 020 i pokrenite je u Supabase SQL Editoru. Na kraju se prikazuje broj zakazanih cijena; za ovaj katalog očekuje se **10**. Skripta ne mijenja današnje cijene.
2. Nakon automatske Vercel objave osvježite aplikaciju. U **Administracija → Usluge → Zakazane promjene cijena** provjerite artikle, iznose, početak i status. Uz svaku postojeću uslugu gumb **Zakaži cijenu** omogućuje novu buduću cijenu, a raspored omogućuje otkazivanje nepotrebne promjene.
3. Za ažuriranu provjeru cijena u AI asistentu u Codespaces terminalu pokrenite:

   ```sh
   git pull --ff-only
   npm run deploy:ai
   ```

Nema novih tajnih ključeva. Objavljivanje AI funkcije ne zamjenjuje pokretanje SQL nadogradnje.

## Primjena i zaštita narudžbi

SQL pokušava uključiti `pg_cron` i posao `formapoint-scheduled-prices` koji provjerava dospjele promjene svake minute. Posao radi bez otvorenog preglednika, e-mail postavki i Edge funkcija. Administracija pokazuje ako pozadinski posao nije aktivan.

Katalog i AI pri čitanju dodatno provjeravaju dospjele cijene, a provjera se radi i prije izračuna košarice te prije potvrde nove narudžbe. Baza određuje vrijeme; kupac ne šalje datum ili cijenu u javnu funkciju osvježavanja. Nakon eventualnog prekida sustav primjenjuje sve propuštene promjene redom. Otvoreni katalog osvježava podatke svake minute, a košarica svakih 30 sekundi, bez ponovnog učitavanja stranice. Neposredno prije potvrde kupac ponovno dobiva provjeru cijene; promijenjeni iznos traži novi pregled i potvrdu.

Stare narudžbe, ponude, stavke i uplate ne mijenjaju se. Primjena čuva prethodnu cijenu, vrijeme primjene, standardnu povijest cijena i audit. Ponovljeni posao ne stvara novu promjenu. Ponavljanje nadogradnje ne vraća namjerno izbrisane nacrte ili rasporede niti ponovno uključuje otkazane promjene.

Ako je usluga izbrisana ili je u međuvremenu prebačena na pakete, promjena dobiva status **Potrebna provjera**. Osnovni raspored ne prepisuje cijene paketa. Ovo je raspored cijena, bez automatske obnove usluga ili naplate postojećim kupcima.

## Javna najava cjenika

Kartice artikala, detalji usluge, katalog nove narudžbe i administracijski popis prikazuju crveno, lijevo ispod trenutačne cijene, primjerice **Cijena od 1.1.2027. 80,00 €**. Najava se prikazuje i u javnom HTML-u bez JavaScripta. U ponoć po Hrvatskoj se uklanja, uključujući već otvoreni interaktivni prikaz.

Ovo je najava konkretnog odobrenog cjenika za 2027. iz `seo/announced-prices.mjs`, a ne javni pristup privatnom administracijskom rasporedu. Test provjerava podudaranje iznosa za postojeće artikle s nadogradnjom 020. Ako se naknadno mijenja ili otkazuje taj odobreni cjenik, treba uskladiti i javnu najavu; proizvoljne nove zakazane promjene ne objavljuju se automatski. Administracija i e-pošta prikazuju naknadno odobrene pakete iz `seo/package-prices-2027.mjs`; dodatne stranice i drugi paketi nemaju izmišljene buduće cijene. Dodavanje najave ne zahtijeva novu SQL nadogradnju i ne mijenja iznose naplate ili postojećih narudžbi.

## Paketi administracije i e-pošte od 1.1.2027. — nadogradnja 021

Nakon 020 pokrenuti cijelu datoteku [202611230021_scheduled_package_prices.sql](../public/migracije/202611230021_scheduled_package_prices.sql) u Supabase SQL Editoru. Na kraju moraju biti prikazana dva rasporeda: e-pošta s tri paketa i administracija s dva, za početak **1.1.2027. u 00:00 Europe/Zagreb**. To nije već izvršeno na javnoj bazi samim Git pushom. Nadogradnja se može sigurno ponoviti; ne uključuje nove pakete prije roka.

| Usluga                        | Paket i opseg                                | Cijena  |
| ----------------------------- | -------------------------------------------- | ------- |
| Upravljanje i vođenje e-pošte | Jednokratno, do 4 sata                       | 70 €    |
| Upravljanje i vođenje e-pošte | Tjedno, 3 sata dnevno, 5 dana (15 sati)      | 90 €    |
| Upravljanje i vođenje e-pošte | Mjesečno, 4 sata dnevno, ponedjeljak – petak | 350 €   |
| Online administracija         | Tjedno, 4 sata dnevno, 5 dana (20 sati)      | 300 €   |
| Online administracija         | Mjesečno, 4 sata dnevno, ponedjeljak – petak | 1.300 € |

Mjesečni paketi imaju fiksnu cijenu neovisno o broju radnih dana u mjesecu. Blagdani i drugi neradni dani uređuju se prema dogovoru. Svaki paket kupuje se jednom za odabrano razdoblje; nema automatske obnove ili ponavljajuće naplate.

Prije roka postojeće usluge i paketi zadržavaju današnje iznose i način kupnje. Crvena javna najava prikazuje odobrene buduće pakete, uključujući uvjete mjesečne cijene. Kod paketa e-pošte novi jednokratni opseg je **do 4 sata**, a tjedni **3 sata dnevno, 5 dana**, prema zadnjoj uputi vlasnika.

U Administracija → Usluge → Zakazane promjene cijena prikazuje se svaki paket, opseg i iznos. Raspored se može otkazati postojećim gumbom; tada uskladiti i javnu najavu. Na početku valjanosti postojeći radnik `apply_due_service_prices`, javno osvježavanje kataloga i provjera prije naplate primjenjuju plan: kreiraju pet aktivnih paketa, uključuju paketni odabir na te dvije usluge i arhiviraju njihove prethodne pakete. Zadržavaju se postojeće narudžbe, cijene i snimke već kupljenih paketa. Stara košarica koja se više ne podudara s paketnim odabirom traži novi odabir; ne naplaćuje se zamjenska cijena.

Izvor odobrenih paketa je `seo/package-prices-2027.mjs`. `node scripts/build-package-prices-upgrade.mjs` iz njega ažurira SQL sjeme i datoteku za SQL Editor; build provjerava njihovo podudaranje. Baza primjenjuje raspored samo jednom. Neispravan plan označava se za provjeru, uz povrat svih djelomičnih izmjena, i ne blokira ostale dospjele cijene.
