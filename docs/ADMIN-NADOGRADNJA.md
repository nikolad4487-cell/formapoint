# Administratorske kartice i postavke

Nadogradnja dodaje sažetak korisnika, poruka i upita, katalog po kategorijama, CMS stranice, portfolio, newsletter, popuste za pojedine korisnike i glavni banner, pozivnice korisnicima, izvoz logotipa te proširene postavke. Prethodne snimke zaslona služe kao referenca za funkcije; njihovi osobni podaci, bankovni podaci i sadržaji nisu uneseni u bazu.

## Postojeća produkcijska baza

1. U Supabase SQL Editoru pokrenite cijelu [SQL nadogradnju](../public/migracije/202610240006_admin_tools.sql) **jednom**, kao vlasnik projekta. Datoteka je dostupna i kroz admin obavijest „Preuzmi SQL nadogradnju”. Koristite projekt koji je povezan s FormaPointom. Baza mora već sadržavati migracije 001–005.
2. Osvježite administraciju. Novi moduli i postavke sada koriste stvarnu bazu. Datoteka ne resetira shemu i ne dodjeljuje nove administratorske ovlasti. Sve promjene baze su unutar jedne transakcije; ponavljanje se zaustavlja jasnom porukom.
3. Za dodatne funkcije objavite Edge funkcije iz repozitorija, koristeći vlastitu Supabase CLI prijavu:

```sh
supabase functions deploy admin-tools --project-ref heseilggogbtmqeuwlku
supabase functions deploy portfolio-download --project-ref heseilggogbtmqeuwlku
```

`admin-tools` provjerava potpisanu Auth sesiju i ulogu ADMIN u bazi. `portfolio-download` dopušta javno preuzimanje samo objavljenih, odobrenih i provjerenih privatnih datoteka; administrator može preuzeti i karantenu radi provjere. Gateway JWT provjera je isključena u config.toml jer funkcije same provjeravaju pristup. Javni linkovi portfolija i ostali novi moduli rade odmah nakon SQL nadogradnje; privatni prijenos/preuzimanje PDF-a, pozivnice i slanje e-pošte zahtijevaju Edge objavu.

## E-pošta i pozivnice

U Supabase Edge Secrets postavite `APP_URL=https://www.formapoint.online`, `RESEND_API_KEY`, potvrđeni `EMAIL_FROM` i, za raspored, zaseban jaki `CRON_SECRET`. Standardni `SUPABASE_URL`, `SUPABASE_ANON_KEY` i `SUPABASE_SERVICE_ROLE_KEY` osigurava Supabase. Ako projekt koristi publishable/secret ključeve umjesto standardnih Edge varijabli, provjerite njihove server varijable prije objave. Tajne se nikada ne spremaju u javne postavke ili frontend.

U Supabase Auth postavite Site URL na javnu adresu i dopustite `/potvrda-emaila` i `/reset-lozinke`. Pozivnice koristi Supabase Auth, pa njegov SMTP treba zasebno konfigurirati. Postavke Resenda ne konfiguriraju Auth SMTP. Zoho SMTP može se postaviti u Auth nadzornoj ploči; zasebni SMTP adapter za newsletter nije implementiran.

U administraciji **Postavke → Obavijesti** spremite svoj primateljski e-mail i pošaljite probnu poruku. Adresa trenutačno služi za probnu administratorsku poruku; postojeće obavijesti o narudžbama i dalje se šalju korisnicima kroz `notify`. Automatsko preusmjeravanje svih obavijesti administratoru nije uključeno.

Newsletter prihvaća HTML predloške, vanjski URL slike i razdoblje valjanosti. Pregled HTML-a ima sandbox i CSP. Pretplatnici se dobivaju iz korisničke privole u profilu i potvrde Auth adrese. Nema automatskog uvoza tuđih adresa. Slanje se potvrđuje zasebno, zamrzava sadržaj kampanje, zaključava dostave i obrađuje do 20 poruka po pozivu. Uspjeh znači da je pružatelj prihvatio poruku, ne potvrdu da je završila u ulaznoj pošti. Potvrđena odjava ponovno se provjerava prije slanja. Ne šaljite probnu kampanju stvarnim pretplatnicima radi tehničke provjere.

Za nastavak većih kampanja ručno koristite **Obradi sljedeći paket** ili postavite raspored svake minute za POST na:

```text
https://heseilggogbtmqeuwlku.supabase.co/functions/v1/admin-tools
Authorization: Bearer <CRON_SECRET>
Content-Type: application/json

{"action":"process-newsletter"}
```

Tajnu čuvajte u upravitelju tajni rasporeda. Worker ponovno pokušava najviše pet puta s razmakom od najmanje pet minuta, koristi zaključavanje poslova i Resend idempotency ključ po dostavi. Raspored se ne stvara automatski objavom frontenda. Evidencije u adminu prikazuju najviše 200 posljednjih zapisa; agregatne kartice i adresar korisnika imaju zasebne serverske RPC upite.

## Sadržaj, portfolio i postavke

- **Stranice**: spremanje vraća sadržaj u nacrt. Objavljena stranica dostupna je na `/p/slug`. Poznati postojeći slugovi, poput `o-nama` i `uvjeti-koristenja`, zamjenjuju i postojeći javni tekst. Pravni slugovi traže izričitu potvrdu prije objave; izmjena poništava prethodno odobrenje. HTML se prikazuje kao običan tekst.
- **Radovi i portfolio**: javna HTTPS PDF poveznica ili privatni PDF do 20 MB. Za objavu su potrebna prava na sadržaj. Privatni prijenos ide u karantenu. Preuzmite ga kao administrator, stvarno provjerite odgovarajućim alatom i zabilježite rezultat/obrazloženje; gumb ne pokreće antivirus. Vanjske poveznice imaju zaseban status „Vanjska poveznica”, bez tvrdnje da su skenirane. Objavljeni radovi prikazuju se na `/portfolio`. Brisanje zapisa uklanja objavu; arhivske privatne datoteke treba obrađivati prema pravilima čuvanja.
- **Popusti**: kod, vrsta i vrijednost, rok, najviše korištenja, usluga i neobvezni ciljani korisnik. Jedno korištenje po korisniku i provjera na serveru. Odabir jednog glavnog bannera je transakcijski; korisnički popusti nisu otkriveni drugim posjetiteljima. Iskorišteni kod deaktivirajte umjesto brisanja.
- **Vizualni identitet**: stvarni PNG i SVG izvoz profilne oznake i punog logotipa, uz izbor prozirne pozadine.
- **Opće postavke**: naziv, javni e-mail/telefon i društvene mreže prikazuju se u javnom sučelju. Prazna polja se skrivaju.
- **Poslovni podaci i uplate**: privatni podaci, uključujući IBAN s provjerom kontrolnog broja. Spremanje ne aktivira bankovnu naplatu, KEKS Pay, Aircash ili novčanik. Vlastite Visa/Mastercard ikone prikazuju se tek uz aktiviran Stripe; ostale ikone čuvaju se za buduće povezivanje metoda.
- **Rokovi**: samo pravno odobreni rokovi postaju dio novih narudžbi. Ranije narudžbe zadržavaju svoje uvjete. Ovo ne provodi automatsko otkazivanje narudžbi i ne zamjenjuje zakonska prava kupca.
- **Pomoć**: pristupačan panel s čestim pitanjima i kontaktom. Ne predstavlja se kao AI razgovor.

## Provjera prije objave

`npm test`, `npm run build`, `npm run db:test`, `npm run test:e2e`, `npm run check:edge` i `npm run test:edge`. SQL testovi koriste stvarni PostgreSQL s minimalnim Auth/Storage adapterima; browser testovi koriste označene API fixture podatke. Produkcijske poruke, newsletteri i pozivnice nisu poslani u testovima. Javni deploy frontend koda ne primjenjuje SQL niti objavljuje Supabase Edge funkcije.

Izvor migracije je `supabase/migrations/202610240006_admin_tools.sql`. Nakon izmjene pokrenite `node scripts/build-admin-upgrade.mjs`; build provjerava da je SQL datoteka za preuzimanje ažurna.
