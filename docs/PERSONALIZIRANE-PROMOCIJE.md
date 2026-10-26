# Osobni popusti i prigodne promocije

U **Administracija → Popusti i kuponi → Nova promocija** odaberite Božić, Uskrs ili posebnu promociju. Za rođendane postoji zasebno godišnje pravilo. Odaberite postotak ili fiksni iznos u eurima, sve korisnike ili odabrane primatelje, uredite poruku i pogledajte primjer e-maila prije izrade.

Svaki odabrani korisnik dobiva zaseban nasumični kod vezan uz njegov račun, s jednim korištenjem. Ako datume ostavite praznima, kod vrijedi odmah do točno 30 dana od početka valjanosti na poslužitelju. Datumi od/do mogu se zadati ručno. Budući kod čeka početni datum i vrijeme: tek tada se šalje e-mail i kod se može iskoristiti. Zadani završetak je 30 dana od tog početka.

## Rođendani — automatski, prema korisniku

U **Popusti i kuponi → Postavke rođendanske promocije** postavite naziv, popust, poruku, sliku i broj dana valjanosti (zadano 30). Uključite godišnje rođendanske poruke. Isti obrazac dobiva se izborom prigode **Rođendan** u novoj promociji. Nema zajedničkih datuma od/do niti ručnog popisa slavljenika. Ponovno spremanje uređuje jedno postojeće pravilo, ne stvara drugo.

Korisnik u **Moj profil** neobvezno upisuje dan i mjesec rođenja; godina se ne prikuplja. Polja može naknadno urediti ili oba isprazniti. Za promotivni e-mail mora zasebno uključiti novosti i ponude, uz potvrđenu adresu. Postavljanje rođendana ne uključuje privolu.

Postojeći worker svake minute provjerava današnji datum u Hrvatskoj. Na korisnikov rođendan stvara poseban jednokratni kod, vezan uz taj račun, i šalje personalizirani e-mail. Kod vrijedi od početka tog rođendanskog dana do početka dana nakon zadanog broja kalendarskih dana u zoni Europe/Zagreb. Za 29. veljače koristi se 28. veljače u neprijestupnim godinama. Kod se ne izrađuje unaprijed svim korisnicima.

Svaki korisnik može dobiti najviše jedan automatski rođendanski kod u kalendarskoj godini, čak i nakon izmjene rođendana, uređivanja pravila, isključivanja/uključivanja ili brisanja kupona. Godišnja evidencija dopušta novi poklon sljedeće godine. Isključivanje pravila zaustavlja nove kodove i još neposlane poruke; već poslani kodovi vrijede do svojeg isteka. Ne šalje se retroaktivno za propuštene rođendane ako sustav cijeli taj dan nije radio. Uključivanje pravila ili upis rođendana tijekom dana omogućuje slanje slavljenicima toga dana.

Rođendanske kampanje po danima i njihove isporuke vide se u postojećem popisu promocija. Resend potvrda, ponovni pokušaji i odjava rade kao kod ostalih promocija.

## Aktivacija — online, kroz Supabase i Codespaces

1. U Supabase SQL Editoru pokrenite cijelu datoteku `public/migracije/202610260014_personal_promotions.sql`, nakon nadogradnje 012. Zatim pokrenite `public/migracije/202610260015_scheduled_promotions.sql` za raspored slanja od početka valjanosti, pa `public/migracije/202610260016_birthday_promotions.sql` za godišnje rođendane. Ako su 014 i 015 već primijenjene, pokrenite samo 016. Nadogradnja 016 može se sigurno ponoviti i ne uključuje rođendanske poruke automatski. Ako je 014 već primijenjena, najprije objavite ažurirane funkcije naredbom iz koraka 2, zatim pokrenite 015 ako još nedostaje i 016. Nadogradnju 013 za kategorijske slugove zadržite ako je već primijenjena. Ne pokrećite početnu shemu ponovno.
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

Nadogradnja 014 na Supabaseu pokušava uključiti `pg_cron` i `pg_net` te zakazati obradu svake minute. Tako se neslane poruke nastavljaju obrađivati i nakon zatvaranja preglednika. Ključ tog workera generira se u bazi, ostaje zaštićen od korisničkog API-ja i ne upisuje se ručno. Worker obrađuje isporuke i, uz nadogradnju 016, izrađuje dnevne rođendanske kampanje iz pravila koje je prethodno spremio administrator. Ne može sam mijenjati to pravilo niti stvarati proizvoljne promocije.

Ako su ekstenzije nedostupne ili nisu dopuštene, modul jasno prikazuje da pozadinska obrada nije uključena. Tada omogućite ekstenzije u Supabaseu i pokrenite `public/migracije/personal_promotions_worker.sql`. Raspored ima stalni naziv pa ponavljanje te pomoćne skripte ažurira postojeći posao. Ne mijenjaju se drugi cron poslovi. Kao dodatna mogućnost, postojeći `notify` cron također obrađuje neslane promocije.

## Primatelji i privole

Kod obične prigodne promocije izrađuje se svakom odabranom korisniku s kontaktnim e-mailom. Automatski rođendanski kod izrađuje se samo slavljenicima s važećom privolom i potvrđenom adresom. Promotivna poruka šalje se samo korisnicima s uključenom marketinškom privolom i potvrđenom, pretplaćenom adresom. Ostalima kod ostaje kreiran, a slanje je označeno kao preskočeno. Privola, odjava, aktualna adresa i aktivnost kupona ponovno se provjeravaju prije svakog slanja. Gostujuća neprovjerena kontaktna adresa ne prima marketinšku poruku.

Svaka poruka sadrži odjavu koja koristi postojeće newsletter postavke. Ne uključuju se privole umjesto korisnika.

## Slike i personalizacija

Pripremljene su tri ilustracije u plavo-ljubičastom identitetu FormaPointa. Možete učitati vlastiti PNG/JPG/WebP do 2 MB; preglednik ga ponovno pretvara u PNG prije spremanja u javni bucket `promotion-images`. SVG i HTML datoteke nisu dopušteni. Za zadane slike poslužitelj koristi javni `APP_URL`, pa mail ne ovisi o privatnoj Codespaces adresi.

U naslovu i poruci podržane su oznake `{ime}`, `{kod}`, `{popust}`, `{od}` i `{do}`. Ime dolazi iz korisničkog profila, iznos se formatira u eurima ili postocima, a datumi se prikazuju u vremenu Europe/Zagreb. Tekst se HTML-escapira; korisnički HTML ne izvršava se.

## Evidencija, ponovni pokušaji i ograničenja

Kampanja prikazuje broj kodova te statuse poslano, čeka, neuspjelo i preskočeno. **Kodovi i isporuke** prikazuju osobne kodove i konkretan status svake isporuke. Potvrda slanja znači da je Resend prihvatio poruku, ne jamči prikaz u primateljevoj ulaznoj pošti.

Kreiranje koristi stabilni identifikator zahtjeva i otisak sadržaja: mrežni ponovni pokušaj ne stvara dodatne kupone. Worker rezervira poslove zaključavanjem i tokenom rezervacije. Slanje koristi stalni Resend idempotency ključ po isporuci; poslane i preskočene poruke ne šalju se ponovno. Automatski neuspjeli pokušaji imaju minutni odmak i najviše tri pokušaja. Gumb Obradi neslane dopušta izričit administratorski ponovni pokušaj unutar izvornog 23-satnog prozora, bez promjene kodova ili identifikatora isporuke. Automatsko ponavljanje ograničeno je na 23 sata od prvog pokušaja kako se ne bi oslanjalo na isteklo razdoblje Resend idempotencije. Nakon tog roka provjerite status isporuke prije ručnog kreiranja nove kampanje.

Jedna kampanja podržava najviše 1000 primatelja. Slanje buduće kampanje ne troši pokušaje isporuke niti pokreće prozor ponovnog slanja prije početnog datuma. Predlošci nisu sami po sebi kampanje i nikakav e-mail ne šalje se učitavanjem stranice ili primjenom SQL-a.

Provjere baze testiraju osobno vlasništvo, 30-dnevni rok, buduće datume, idempotenciju, privole i rezervacije isporuka. Edge testovi zamjenjuju Resend lokalnim adapterom; Playwright provjerava pregled i kreiranje na računalu i mobitelu. Automatizirani testovi ne šalju stvarne poruke.
