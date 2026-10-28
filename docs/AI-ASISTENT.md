# FormaPoint AI asistent

Plutajući razgovor dostupan je na svim javnim stranicama, pri kupnji te u korisničkom i administratorskom prostoru. Globalna komponenta ostaje otvorena pri navigaciji. Razgovor se čuva u sessionStorage tijekom posjeta, zasebno po korisniku; gumb Novi razgovor ga briše. Asistent ima pozdrav, predložena pitanja, pokazatelj pisanja i poveznice na FAQ i podršku. Radi i bez prijave.

Odgovore generira Google Gemini preko Supabase Edge funkcije `ai-assistant`. Ključ se koristi isključivo na poslužitelju. Upotrebljava se službeni REST API pa nema nove SDK ovisnosti u pregledniku. Zadani model je `gemini-3-flash-preview`; može se promijeniti tajnom `GEMINI_MODEL` na model dostupan vašem Google projektu.

## Uključivanje u produkciji (sve se radi online)

1. Na [Google AI Studio](https://aistudio.google.com/api-keys) izradite Gemini API ključ.
2. Otvorite [Supabase Edge Function Secrets](https://supabase.com/dashboard/project/heseilggogbtmqeuwlku/functions/secrets) i dodajte:
   - `GEMINI_API_KEY` = vaš Gemini API ključ.
   - `APP_URL` = `https://www.formapoint.online` (postojeću ispravnu vrijednost ne treba mijenjati).
3. U Codespaces terminalu pokrenite:

   ```sh
   git pull --ff-only
   npm run deploy:ai
   ```

   Ako CLI javi da nema access token, prvo pokrenite `npx supabase login` i dovršite prijavu, zatim ponovite objavu.

4. Pričekajte Vercelovu automatsku objavu i osvježite stranicu. Otvorite ikonu poruke u donjem desnom kutu i postavite pitanje.

Nije potrebna SQL nadogradnja ni nova tablica. Za ograničavanje poziva koristi se postojeća funkcija `rate_limit`. Vercel varijabla `VITE_GEMINI_API_KEY` nije potrebna i ne smije se dodavati. Ključ nemojte spremati u GitHub datoteke ili poslati u razgovor.

## Znanje i granice

Poslužitelj pri svakom pitanju dohvaća aktivni javni katalog, odabrane javne postavke platforme i aktualnu ponudu iz javnog bannera. Ponudu dohvaća funkcijom `discount_banner` s anonimnim javnim ključem, bez prosljeđivanja korisničke sesije. Tako zna javni kod, iznos, rok valjanosti i uvjet prve narudžbe, ali ne dobiva osobne kodove. Kod se ne upisuje u prompt unaprijed; administrativna promjena javne ponude vidi se već u sljedećem pitanju. Konačnu primjenjivost provjerava košarica, a asistent ne tvrdi da zna povijest kupnje posjetitelja. Ako ponude nema ili je provjera nedostupna, razlikuje ta stanja i ne tvrdi da platforma uopće nema kupone. Aktualni podaci imaju prednost pred ranijim pogrešnim odgovorima u istom razgovoru. Cijene u internim centima prikazuju se u EUR. Upute objašnjavaju košaricu, kupnju kao gost, jednokratno i 50/50 plaćanje, Stripe, mogućnost Google/Apple Paya, IBAN potvrdu i zaključavanje izvornih datoteka do pune uplate. Asistent ne smije izmišljati cijene, popuste ili naknade.

Ne dohvaća narudžbe, profile, datoteke, privatne poruke niti podatke o stvarnim uplatama. Ne kreira narudžbe i ne potvrđuje plaćanje. Za osobne zahtjeve upućuje korisnika na narudžbe i podršku.

Googleu se šalju korisnikovo pitanje, ograničena povijest razgovora i javni podaci kataloga/postavki i javnog promotivnog bannera. Widget to navodi korisniku. Povijest se ne sprema u bazu. Odgovori su običan tekst; HTML odgovora se ne izvršava. Pravila poslovanja postavlja samo poslužitelj.

## Ograničenja i dostupnost

Zadano je najviše 10 zahtjeva u minuti po adresi i 300 ukupno u razdoblju od 24 sata. Neobvezni `AI_DAILY_LIMIT` mijenja ukupnu granicu (1–10000). Broj izlaznih tokena ograničen je na 2048, a zahtjev prema Googleu na 25 sekundi. To ograničava upotrebu; stvarnu potrošnju pratite i u Google projektu.

Bez ključa, pri potrošenoj kvoti ili nedostupnosti modela prikazuje se poruka nedostupnosti i kontakt podrške. Ne prikazuju se lažni AI odgovori. Pri poteškoćama provjerite objavu funkcije, tajne, dostupnost modela i kvotu Google projekta. Sadržaj razgovora i ključevi ne ispisuju se u aplikacijske logove.

Provjere uključuju Deno testove validacije, javnog konteksta, kvota i grešaka pružatelja te Playwright provjere globalnog razgovora, povijesti i sigurnog prikaza teksta na računalu i mobitelu. Pozivi Googleu u automatiziranim testovima su zamijenjeni lokalnim adapterom i ne troše stvarnu kvotu.
