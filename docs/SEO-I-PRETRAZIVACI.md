# FormaPoint: pretraživači i AI vidljivost

Javne stranice sada imaju HTML sadržaj već u prvom odgovoru Vercelove Node funkcije `api/public.js`. Posjetitelji i roboti dobivaju isti sadržaj; React nakon učitavanja uključuje interaktivne funkcije. Naručivanje i korisnički prostor i dalje trebaju JavaScript.

## Što je ugrađeno

- Naslov, opis, canonical, Open Graph i Twitter metapodaci za svaku javnu adresu, uključujući usluge, kategorije i objavljene CMS stranice.
- Organization, WebSite i BreadcrumbList JSON-LD; usluge imaju Service i stvarne EUR ponude. Paketi imaju zasebne ponude, bez tvrdnje da su automatske pretplate. FAQPage se koristi samo uz odgovarajuća vidljiva pitanja i odgovore.
- Kategorije na adresama poput `/prezentacije`, s poveznicama iz kataloga. Artikli zadržavaju adrese poput `/prezentacije/izrada`.
- Cjenik iz baze, upute za pripremu narudžbe, pitanja i odgovori, opis kupnje kao gost, kontakt i poveznica na objavljene podatke pružatelja.
- `/sitemap.xml` dinamički sadrži aktivne usluge, kategorije i objavljene stranice. Neodobrene pravne stranice, nacrti, privatni prostor i prazan portfolio nisu uključeni. Stare jednoznačne adrese usluga imaju 308 preusmjeravanje.
- Privatne stranice imaju `noindex`, a pregledne Vercel objave također ostaju izvan indeksa. `robots.txt` navodi sitemap. To nije zamjena za provjeru pristupa; postojeće Supabase provjere ostaju odgovorne za privatnost.

Cijene se čitaju pri zahtjevu nakon poziva javne funkcije `refresh_service_prices`. Zakazane cijene primjenjuju se samo kada dospiju u bazi; nije potrebno ponovno objaviti stranicu zbog promjene cijene. SQL nadogradnja 020 i dalje mora biti primijenjena za zakazivanje cijena. Ako baza nije dostupna, javna HTML ruta vraća privremeni 503 i `noindex`, bez izmišljanja ili zastarjelih cijena.

Funkcija koristi isključivo javni Supabase ključ iz postojeće konfiguracije ili para Vercel varijabli `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY` (alternativno `VITE_SUPABASE_ANON_KEY`). Nikada ne upisivati service-role ključ u njih. Ne čita korisničke narudžbe, profile, privatne datoteke ili poslovne postavke. Javni podaci u HTML-u služe i za početno punjenje React Queryja.

## Google: potvrda priloženom HTML datotekom

Googleova datoteka `google009c75011ca535f8.html` dodana je u `public/` i pri izgradnji se kopira na korijen stranice. Nakon što Vercel objava dobije status **Ready**, otvori `https://www.formapoint.online/google009c75011ca535f8.html`. Mora prikazati točno `google-site-verification: google009c75011ca535f8.html`.

U Search Consoleu zadrži odabranu potvrdu **HTML datotekom** i klikni **Potvrdi**. Za ovu metodu ne treba postavljati `GOOGLE_SITE_VERIFICATION`. Datoteku zadržati i nakon potvrde jer Google može ponovno provjeravati vlasništvo. Nakon uspješne potvrde u odjeljku **Sitemaps** pošalji `sitemap.xml`.

## Google: potvrda vlasništva bez DNS-a i bez laptop projekta

1. Otvori [Google Search Console](https://search.google.com/search-console/welcome) i prijavi se svojim Google računom.
2. Odaberi **URL prefix / Prefiks URL-a**. Unesi točno **`https://www.formapoint.online/`**. Nemoj izabrati Domain ako želiš jednostavniju potvrdu putem HTML oznake.
3. U drugim načinima potvrde odaberi **HTML tag / HTML oznaka**. Dobit ćeš nešto poput:
   ```html
   <meta name="google-site-verification" content="TVOJ_JAVNI_KOD" />
   ```
4. U Vercelu otvori FormaPoint → **Settings → Environment Variables**. Dodaj `GOOGLE_SITE_VERIFICATION`, vrijednost je samo sadržaj između navodnika u `content`, bez cijele oznake. Označi **Production** i spremi. Ovo je javni dokaz vlasništva, nije lozinka ni API ključ.
5. Otvori **Deployments**, pa kod najnovije objave odaberi **Redeploy**. Pričekaj status **Ready**. Vercelova funkcija mora biti iz nove verzije koja sadrži `api/public.js`.
6. Vrati se u Search Console i klikni **Verify / Potvrdi**. Ako ne uspije, provjeri točan `www` prefiks i da oznaka postoji u izvornom HTML-u početne stranice.
7. U lijevom izborniku otvori **Sitemaps** i pošalji **`sitemap.xml`**. Puna adresa je `https://www.formapoint.online/sitemap.xml`.
8. U **URL Inspection / Pregled URL-a** unesi početnu stranicu i nekoliko važnih usluga. Pokreni provjeru uživo pa, ako je dostupno, **Request indexing / Zatraži indeksiranje**.

Druga mogućnost je poslati javnu HTML oznaku suradniku koji uređuje Vercel postavke. Ne slati pristupne tokene, lozinke ni tajne ključeve.

## Bing

Nakon Googleove potvrde otvori [Bing Webmaster Tools](https://www.bing.com/webmasters/), prijavi se i odaberi **Import from Google Search Console**. Uvezi FormaPoint i provjeri sitemap. Ako izabereš ručnu HTML potvrdu, vrijednost `content` iz oznake `msvalidate.01` dodaje se u Vercel kao `BING_SITE_VERIFICATION`, pa je potreban Redeploy i potvrda u Bingu.

Potvrdu vlasništva i slanje sitemapa mora dovršiti osoba prijavljena u svoj Google/Bing račun. Samo dodavanje koda u repozitorij ne potvrđuje vlasništvo.

## Nakon objave

- Provjeri da `https://www.formapoint.online/`, `/usluge`, `/cjenik`, jedna kategorija i jedan artikal vraćaju 200 te da izvor stranice sadrži tekst i cijenu prije pokretanja JavaScripta.
- Provjeri `/sitemap.xml` i jednu nepostojeću adresu (404). Očekivane cijene usporedi s administracijom.
- U [Google Rich Results Testu](https://search.google.com/test/rich-results) ili [Schema validatoru](https://validator.schema.org/) provjeri jednu uslugu. Valjani Service podaci ne jamče poseban prikaz u Googleu; nisu sve vrste označavanja podržane kao rich result.
- Provjeri da Vercelova objava odgovara najnovijem commitu i ima status Ready. Git push sam po sebi nije dokaz objave na domeni.

## Sadržaj i reputacija koji trebaju stvarne podatke

Dodaj stvarne primjere u **Administracija → Portfolio**, uz pravo javne objave i bez osobnih podataka naručitelja. Tek tada portfolio ulazi u sitemap. U CMS-u objavi činjeničan opis pružatelja, opseg usluga i kontakt. Recenzije, reference i ishode rada objavljuj samo ako su stvarni i imaš dopuštenje; sustav ih ne izmišlja.

Vanjske profile i poslovne imenike uređuje vlasnik svojim računima. Upis nije automatski učinjen ovim kodom. Nije moguće jamčiti da će ChatGPT spomenuti FormaPoint. Izvještaj Arbona od 18. 11. 2026. opisuje jedan uzorak od 20 upita; nakon indeksiranja ponovi usporediv test i prati stvarne posjete i upite u Search Consoleu.

## Provjere za održavanje

```bash
npm run test:seo
npm run test:seo:browser
npm test
npm run build
```

Prva provjera pokriva javni handler, anon pristup, sigurnost umetnutog teksta, sitemap, statusne kodove, cijene i pakete. Druga gradi aplikaciju i provjerava stvarni izgrađeni HTML/React na računalu i mobitelu, sa i bez JavaScripta, bez pozivanja vanjskih usluga. `npm run dev` i obični `vite preview` pokreću SPA; Vercelov javni handler provjerava se navedenim browser testom ili Vercel objavom.
