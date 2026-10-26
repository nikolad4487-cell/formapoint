# Kupnja kao gost i registracija bez potvrde e-maila

Gost unosi ime, prezime, kontaktni e-mail i prihvaća uvjete, bez lozinke ili registracije. Dobiva privatnu anonimnu Supabase sesiju. Košarica, narudžbe, prilozi, Stripe/IBAN, dvije rate i zaštićeni pregled/preuzimanje koriste ista prava vlasnika kao registrirani kupci. Kontakt nije dokaz vlasništva: upisivanje tuđeg e-maila ne otvara njegove narudžbe.

Gost se vraća narudžbama u istom pregledniku. Brisanje podataka preglednika, privatnog prozora ili odjava uklanja njegov pristup. U sučelju je to navedeno prije nastavka i prije odjave. Gost može na `/registracija` dodati e-mail i lozinku svojoj postojećoj sesiji; koristi se ažuriranje tog korisnika, čime se čuvaju njegove narudžbe. E-mail koji pripada postojećem računu ne spaja se automatski.

## Uključivanje na postojećem Supabase projektu

1. U SQL Editoru pokrenite cijelu datoteku `public/migracije/202610260012_guest_checkout.sql`, nakon nadogradnje 011. Ne pokrećite ponovno početnu shemu.
2. U **Authentication → Sign In / Providers** uključite **Allow anonymous sign-ins / Anonymous Sign-Ins**.
3. U postavkama registracije/e-mail prijave isključite **Confirm email**. **Allow new users to sign up** i prijava e-mailom moraju ostati uključeni.
4. U postavkama e-mail/lozinka postavite **Minimum password length = 8**. Ako postoji dodatno pravilo sastava lozinke, prilagodite ga željenoj politici; aplikacija traži najmanje osam znakova.
5. U Codespaces terminalu pokrenite:

   ```sh
   git pull --ff-only
   npm install
   npx supabase functions deploy notify --project-ref heseilggogbtmqeuwlku --use-api
   ```

   Posljednja naredba omogućuje slanje postojećih obavijesti i na kontaktni e-mail gosta. Koristi postojeći Resend/cron raspored, bez izmjene plaćanja.

`supabase/config.toml` sadrži istu politiku za lokalni razvoj. Izmjene te datoteke i Vercel objava ne mijenjaju automatski Auth postavke udaljenog projekta. Nemojte pokretati `config push` s lokalnim Site URL-om na produkciji.

Registracija s potvrdom isključenom odmah vraća sesiju i otvara `/app`; ne prikazuje stranicu za potvrdu. Reset zaboravljene lozinke i dalje sigurno koristi poveznicu poslanu e-poštom.

Migracija sprema kontaktni e-mail zasebno od Auth identiteta, čuva kontakt uz narudžbu, prikazuje ga administraciji i sprječava ponovno korištenje istog kupona / popusta za prvu kupnju kroz nove gostujuće sesije s istim e-mailom. Svaka sesija i dalje vidi samo svoje narudžbe. Bez provjere e-maila nije moguće dokazati da dva različita e-maila pripadaju istoj osobi.
