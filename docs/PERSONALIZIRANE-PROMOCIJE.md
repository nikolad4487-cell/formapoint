# Osobni popusti i prigodne promocije

U **Administracija → Popusti i kuponi → Nova promocija** odaberite Božić, rođendan, Uskrs ili posebnu promociju. Odaberite postotak ili fiksni iznos u eurima, sve korisnike ili odabrane primatelje, uredite poruku i pogledajte primjer e-maila prije izrade.

Svaki odabrani korisnik dobiva zaseban nasumični kod vezan uz njegov račun, s jednim korištenjem. Ako datume ostavite praznima, kod vrijedi odmah do točno 30 dana od početka valjanosti na poslužitelju. Datumi od/do mogu se zadati ručno. Budući kod čeka početni datum i vrijeme: tek tada se šalje e-mail i kod se može iskoristiti. Zadani završetak je 30 dana od tog početka.

Rođendanska promocija izrađuje se odabirom slavljenika. Datumi rođenja ne prikupljaju se i nema automatskog godišnjeg rasporeda rođendana.

## Aktivacija — online, kroz Supabase i Codespaces

1. U Supabase SQL Editoru pokrenite cijelu datoteku `public/migracije/202610260014_personal_promotions.sql`, nakon nadogradnje 012. Zatim pokrenite `public/migracije/202610260015_scheduled_promotions.sql` za raspored slanja od početka valjanosti. Ako je 014 već primijenjena, najprije objavite ažurirane funkcije naredbom iz koraka 2, zatim pokrenite samo 015. Nadogradnju 013 za kategorijske slugove zadržite ako je već primijenjena. Ne pokrećite početnu shemu ponovno.
2. U Codespaces terminalu:

   ```sh
   git pull --ff-only
   npm run deploy:promotions
   ```

   Objavljuju se funkcije `promotions` i `notify`. Ako CLI traži pristup, prvo dovršite `npx supabase login`.
3. U Supabase Edge Function Secrets moraju postojati:
   - `RESEND_API_KEY` — ključ Resend projekta.
   - `EMAIL_FROM` — pošiljatelj s domene potvrđene u Resendu, primjerice `FormaPoint <info@formapoint.online>`.
   - `APP_URL` — `https://www.formapoint.online`.

   Postojeće ispravne vrijednosti ne treba mijenjati. Nijedan od ovih ključeva ne stavlja se u Vercel `VITE_*` varijable.
4. Pričekajte Vercelovu automatsku objavu, koja uključuje tri slike za e-mail predloške.

## Automatsko slanje i pozadinski worker

Pritisak na **Izradi kodove i pošalji e-mail**, odnosno **Izradi kodove i zakaži slanje** za budući početak, atomarno kreira kodove i evidenciju isporuka te pokreće slanje ako je početak valjanosti već nastupio. Za budući početak slanje čeka odabrani datum i vrijeme u vremenskoj zoni Europe/Zagreb. Otvorena administracija obrađuje i dodatne skupine primatelja.

Nadogradnja 014 na Supabaseu pokušava uključiti `pg_cron` i `pg_net` te zakazati obradu svake minute. Tako se neslane poruke nastavljaju obrađivati i nakon zatvaranja preglednika. Ključ tog workera generira se u bazi, ostaje zaštićen od korisničkog API-ja i ne upisuje se ručno. Worker može obrađivati isporuke, ali ne može kreirati kampanje.

Ako su ekstenzije nedostupne ili nisu dopuštene, modul jasno prikazuje da pozadinska obrada nije uključena. Tada omogućite ekstenzije u Supabaseu i pokrenite `public/migracije/personal_promotions_worker.sql`. Raspored ima stalni naziv pa ponavljanje te pomoćne skripte ažurira postojeći posao. Ne mijenjaju se drugi cron poslovi. Kao dodatna mogućnost, postojeći `notify` cron također obrađuje neslane promocije.

## Primatelji i privole

Kod se izrađuje svakom odabranom korisniku s kontaktnim e-mailom. Promotivna poruka šalje se samo korisnicima s uključenom marketinškom privolom i potvrđenom, pretplaćenom adresom. Ostalima kod ostaje kreiran, a slanje je označeno kao preskočeno. Privola, odjava, aktualna adresa i aktivnost kupona ponovno se provjeravaju prije svakog slanja. Gostujuća neprovjerena kontaktna adresa ne prima marketinšku poruku.

Svaka poruka sadrži odjavu koja koristi postojeće newsletter postavke. Ne uključuju se privole umjesto korisnika.

## Slike i personalizacija

Pripremljene su tri ilustracije u plavo-ljubičastom identitetu FormaPointa. Možete učitati vlastiti PNG/JPG/WebP do 2 MB; preglednik ga ponovno pretvara u PNG prije spremanja u javni bucket `promotion-images`. SVG i HTML datoteke nisu dopušteni. Za zadane slike poslužitelj koristi javni `APP_URL`, pa mail ne ovisi o privatnoj Codespaces adresi.

U naslovu i poruci podržane su oznake `{ime}`, `{kod}`, `{popust}`, `{od}` i `{do}`. Ime dolazi iz korisničkog profila, iznos se formatira u eurima ili postocima, a datumi se prikazuju u vremenu Europe/Zagreb. Tekst se HTML-escapira; korisnički HTML ne izvršava se.

## Evidencija, ponovni pokušaji i ograničenja

Kampanja prikazuje broj kodova te statuse poslano, čeka, neuspjelo i preskočeno. **Kodovi i isporuke** prikazuju osobne kodove i konkretan status svake isporuke. Potvrda slanja znači da je Resend prihvatio poruku, ne jamči prikaz u primateljevoj ulaznoj pošti.

Kreiranje koristi stabilni identifikator zahtjeva i otisak sadržaja: mrežni ponovni pokušaj ne stvara dodatne kupone. Worker rezervira poslove zaključavanjem i tokenom rezervacije. Slanje koristi stalni Resend idempotency ključ po isporuci; poslane i preskočene poruke ne šalju se ponovno. Automatski neuspjeli pokušaji imaju minutni odmak i najviše tri pokušaja. Gumb Obradi neslane dopušta izričit administratorski ponovni pokušaj unutar izvornog 23-satnog prozora, bez promjene kodova ili identifikatora isporuke. Automatsko ponavljanje ograničeno je na 23 sata od prvog pokušaja kako se ne bi oslanjalo na isteklo razdoblje Resend idempotencije. Nakon tog roka provjerite status isporuke prije ručnog kreiranja nove kampanje.

Jedna kampanja podržava najviše 1000 primatelja. Slanje buduće kampanje ne troši pokušaje isporuke niti pokreće prozor ponovnog slanja prije početnog datuma. Predlošci nisu sami po sebi kampanje i nikakav e-mail ne šalje se učitavanjem stranice ili primjenom SQL-a.

Provjere baze testiraju osobno vlasništvo, 30-dnevni rok, buduće datume, idempotenciju, privole i rezervacije isporuka. Edge testovi zamjenjuju Resend lokalnim adapterom; Playwright provjerava pregled i kreiranje na računalu i mobitelu. Automatizirani testovi ne šalju stvarne poruke.
