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

Postojeći artikli povezani su prema provjerenim identifikatorima, pa jednak slug u drugoj kategoriji ne preusmjerava promjenu. Online administracija, upravljanje e-poštom, njihovi paketi i dodatne stranice/slajdovi nisu dio ovog cjenika. Cijene koje su već na željenom iznosu svejedno dobivaju zapis u rasporedu.

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
