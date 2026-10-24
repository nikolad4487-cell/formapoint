# Povezivanje Stripea s FormaPointom

FormaPoint koristi Stripe Checkout: korisnik karticu upisuje na Stripeovoj stranici. Aplikacija izračunava iznos u EUR, a potvrdu uplate prima preko webhooka. Ključevi se postavljaju u Supabase, ne u Vercel frontend.

## 1. Odaberite javnu adresu aplikacije

U ovim uputama koristi se `https://formapoint.online`. Ako koristite `https://www.formapoint.online`, zamijenite adresu svugdje i postavite drugu domenu da preusmjerava na odabranu. `APP_URL` mora točno odgovarati domeni otvorenoj u pregledniku jer funkcije provjeravaju Origin. Nemojte dodati završnu kosu crtu u `APP_URL`.

## 2. Pripremite testni Stripe račun

Prijavite se u Stripe Dashboard i odaberite testni način rada / sandbox. U odjeljku API keys kopirajte **Secret key** koji počinje s `sk_test_`. Za stvarne naplate naknadno treba aktivirati Stripe poslovni račun i dovršiti tražene podatke za isplate.

## 3. Objavite postojeće Supabase funkcije

Kod se već nalazi u repozitoriju. Iz njegova korijena, nakon instalacije Node.js, možete koristiti:

```sh
npx supabase login
npx supabase functions deploy checkout --project-ref heseilggogbtmqeuwlku --use-api
npx supabase functions deploy stripe-webhook --project-ref heseilggogbtmqeuwlku --use-api
```

Ako sve radite online, otvorite repozitorij u GitHub Codespacesu. U njegovu terminalu osvježite kod i pokrenite pripremljenu objavu:

```sh
git pull --ff-only
npm run deploy:stripe
```

Ako CLI još nije prijavljen, prvo pokrenite `npx supabase login` i otvorite prikazanu poveznicu. Skripta objavljuje samo `checkout` i `stripe-webhook` s opcijom `--use-api`. Njome se pakiranje odvija preko Supabase Management API-ja, pa se izbjegava lokalno Docker preuzimanje ovisnosti koje u Codespacesu može završiti s `Temporary failure in name resolution` na `_shared/http.ts`. Zastavica je podržana u Supabase CLI-u; ne mijenja se TLS provjera ni izvorni kod SDK-a. Sama promjena u GitHubu ne ponavlja ranije neuspjelu objavu funkcije.

Kod mora uključivati i `supabase/functions/_shared`, a `supabase/config.toml` postavlja provjeru JWT-a na gatewayu na false za ove dvije funkcije. To je namjerno: `checkout` sam potvrđuje prijavljenog korisnika kroz Supabase Auth, dok `stripe-webhook` provjerava Stripeov potpis. Sam GitHub/Vercel deploy ne objavljuje Supabase funkcije.

## 4. Napravite webhook u istom Stripe sandboxu

U **Workbench / Developers → Webhooks** dodajte standardno odredište za događaje svojeg računa (snapshot webhook), s adresom:

```text
https://heseilggogbtmqeuwlku.supabase.co/functions/v1/stripe-webhook
```

Odaberite ovih pet događaja:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
charge.refunded
```

Nakon spremanja otvorite **Signing secret / Reveal** i kopirajte vrijednost `whsec_…` za upravo ovo odredište. Potpisni ključ lokalnog Stripe CLI-a ne zamjenjuje ključ javnog webhook odredišta.

## 5. Spremite tajne u Supabase

Otvorite svoj projekt → **Edge Functions → Secrets** i dodajte:

| Naziv                   | Vrijednost u testnom načinu            |
| ----------------------- | -------------------------------------- |
| `STRIPE_SECRET_KEY`     | testni Secret key `sk_test_…`          |
| `STRIPE_WEBHOOK_SECRET` | Signing secret ovog webhooka `whsec_…` |
| `APP_URL`               | `https://formapoint.online`            |
| `STRIPE_LIVE_ENABLED`   | `false`                                |

Supabase već osigurava standardne `SUPABASE_URL`, `SUPABASE_ANON_KEY` i `SUPABASE_SERVICE_ROLE_KEY`. Tajne ne stavljajte u `VITE_` varijable, SQL datoteke, GitHub ili poruke u razgovoru. Ako ste funkcije upravo prvi put objavili bez Stripe tajni, nakon spremanja potvrdite u Supabase nadzornoj ploči da su obje funkcije objavljene i dostupne.

## 6. Uključite testnu naplatu i provjerite je

U FormaPointu otvorite **Administracija → Postavke → Uplate i pravila**. Kad su testni ključ i webhook spremljeni, označite **Stripe je konfiguriran i provjeren**, isključite **Način pripreme — online naplata isključena** i spremite. Naplata mora biti uključena za provođenje testa; tijekom ove faze koristi samo testni Stripe ključ i probne narudžbe. Za vrijeme testiranja ne usmjeravajte stvarne kupce na naplatu.

Napravite novu probnu narudžbu s cijenom i otvorite plaćanje iz narudžbe ili stranice plaćanja. U Stripeovu testnom obrascu koristite:

- broj kartice `4242 4242 4242 4242`;
- budući datum isteka;
- CVC `123` i ostale podatke koje testni obrazac zatraži.

U Stripe webhook evidenciji provjerite da je stvarni `checkout.session.completed` događaj za tu uplatu dobio odgovor **2xx**. U FormaPointu nakon osvježavanja mora biti evidentirana potvrđena uplata i odgovarajući status narudžbe. Povratak korisnika sa Stripe stranice sam ne potvrđuje uplatu. Generički „Send test event” može sadržavati izmišljeni payment ID koji ne postoji u vašoj bazi; za potpunu provjeru napravite stvarnu testnu narudžbu kroz aplikaciju.

Provjerite i obje rate za uslugu s 50/50 modelom, zatvaranje checkouta bez plaćanja, neuspješno plaćanje te povrat iz Stripe Dashboarda. Prva rata treba otključati početak rada, a druga otključati završnu isporuku. Ponovljeni webhook ne smije udvostručiti iznos. Nakon završetka testiranja vratite način pripreme dok ne prelazite na stvarne naplate.

## 7. Prelazak na stvarne naplate

Aktivirajte Stripe račun. U live načinu napravite webhook s istim URL-om i događajima te kopirajte njegov novi `whsec_…`. U Supabase Secrets zamijenite `STRIPE_SECRET_KEY` s live `sk_live_…`, `STRIPE_WEBHOOK_SECRET` s live signing secretom i postavite `STRIPE_LIVE_ENABLED=true`. Testni i live ključ moraju pripadati istom načinu rada kao njihovo webhook odredište.

Uključite Stripe i isključite način pripreme u aplikaciji. Prije otvaranja kupcima potvrdite jednu stvarnu malu uplatu te primitak webhooka i povrat kroz Stripe. To je stvarna novčana transakcija s mogućim naknadama. Ikone plaćanja služe prikazu; njihovo učitavanje ne aktivira Apple Pay, Google Pay, KEKS Pay ili Aircash.

## Ako naplata ne radi

- „Online plaćanje nije aktivirano”: provjerite spremljena dva prekidača u FormaPoint postavkama.
- Checkout daje pogrešku: provjerite objavu `checkout`, zapis funkcije, Stripe Secret key i točno podudaranje `APP_URL` s domenom preglednika.
- Stripe je naplatio, a narudžba čeka uplatu: provjerite dostavu webhooka i njegov Signing secret. Ispravite uzrok pa u Stripeu ponovite dostavu istog stvarnog događaja. Ne naplaćujte kupcu ponovno.
- Live ključ ne radi: provjerite `STRIPE_LIVE_ENABLED=true` i pripadnost live webhook odredišta.

## Google Pay, Apple Pay i prikaz metoda u aplikaciji

U Stripe Dashboardu otvorite **Settings → Payment methods** i konfiguraciju koja se koristi za Checkout. Provjerite dostupnost Apple Paya i Google Paya za svoj račun te ih uključite ako su ponuđeni. Ne treba vam osobni Google Pay novčanik da biste kao trgovac prihvaćali takvu uplatu. Kupac koristi vlastiti novčanik. Stripe Checkout odlučuje hoće li prikazati gumb prema računu trgovca, uređaju, pregledniku i kartici kupca; provjeru napravite na podržanom uređaju s pripremljenim novčanikom.

FormaPoint otvara Stripeovu hostanu Checkout stranicu s kartičnim plaćanjem. Apple Pay i Google Pay su novčanici kroz tu integraciju. Njihovo dodavanje u FormaPoint popis ne mijenja Stripe račun. U adminu nakon SQL nadogradnje 008 dodajte metodu i za prikaz kupcima potvrdite da ste je uključili i provjerili na Stripeu. Visa i Mastercard su oznake kartičnih mreža; skrivanje oznake ne blokira tu mrežu u Stripeu. Glavno uključivanje kartične naplate i dalje kontroliraju Stripe prekidač i način pripreme.

KEKS Pay nije povezan s postojećom Stripe naplatom. U popis možete dodati njegov naziv i ikonu za pripremu, ali ostaje skriven kupcima dok se ne implementira stvarna integracija s tim pružateljem. Početni popis sadrži samo Visa i Mastercard. Postavke se otvaraju na [Stripe Dashboardu](https://dashboard.stripe.com/settings/payment_methods).
