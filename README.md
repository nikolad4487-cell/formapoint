# FormaPoint

Platforma na hrvatskom jeziku za naručivanje digitalnih i administrativnih usluga. React 19, TypeScript, Vite 7, Tailwind 4, zajedničke shadcn/Radix kontrole, Supabase i Stripe Checkout.

**Status:** funkcionalna prva iteracija, s javnim stranicama i implementiranim backend tokovima. Nije spremna za stvarno poslovanje. [Pregled dovršenog i preostalog](docs/STATUS.md) navodi ograničenja po fazama; [izvorna specifikacija](docs/SPECIFIKACIJA.md) ostaje cilj projekta.

## Pokretanje javnog dijela

Potreban je Node.js 22.12 ili noviji (provjeren Node 24).

```bash
cd /workspace/formapoint
npm ci --cache /tmp/formapoint-npm
npm run dev
```

Bez Supabase varijabli radi javni katalog bez izmišljenih cijena. Prijava, privatni podaci, kontakt i naplata prikazuju stvarnu nedostupnost. Ne postoji lokalna lažna prijava ili simulirana produkcijska uplata.

## Lokalni Supabase

Potreban je Docker s dostupnim lokalnim daemonom, curl, tar i sha256sum. Skripta preuzima službeni Linux CLI 2.54.11 uz provjeru službenog SHA-256. Ta verzija koristi konfiguraciju ovog projekta; nije globalna instalacija.

```bash
npm run backend:start
npm run backend:functions
# U drugom terminalu:
npm run dev
```

`backend:start` koristi službene Docker Hub slike umjesto zadanog ECR registra, pokreće potrebne servise i sprema **lokalne javne** vrijednosti u ignorirani `.env.local`. Postojeća konfiguracija ostaje sačuvana. `.env.edge.local` sadrži javno podrijetlo frontend aplikacije i lokalni javni URL Storagea; tajne vanjskih servisa nisu generirane. Prvo preuzimanje slika može biti veliko i sporo na VFS driveru. Alatni direktorij je `/workspace/.tools/formapoint` (za preuzimanje se može postaviti `FORMAPOINT_TOOLS_DIR`; `SUPABASE_CLI` bira binarnu datoteku za Node skripte).

Ako je port 5173 zauzet, zaustavite samo vlastiti ranije pokrenuti Vite proces. Ako mijenjate port, uskladite `APP_URL`, Auth redirect URL-ove i testove. Lokalni SMTP hvata poruke u Mailpitu; to ne potvrđuje isporuku stvarnom vanjskom primatelju.

Servisi se ne mogu smatrati trajno pokrenutima nakon obnove cloud okruženja. Ponovno izvršite `backend:start`, zasebno pokrenite funkcije i Vite te provjerite odgovor kataloga i prijavu. Svaki cloud zadatak već je izoliran; koristite postojeći checkout i ne stvarajte Git worktree bez izričitog zahtjeva.

## Povezivanje vlastitog Supabase projekta

1. U sigurnim postavkama Supabase projekta odaberite PostgreSQL projekt, regiju i odgovarajući plan. Ne šaljite tajne ključeve u chat.
2. Kopirajte `.env.example` u lokalni ignorirani `.env.local`. Unesite `VITE_SUPABASE_URL` i **javni** publishable/anon ključ. Service role, Stripe i Resend tajne nikad ne smiju imati prefiks `VITE_`.
3. S provjerenim službenim Supabase CLI-jem povežite ispravan projekt i primijenite migracije: `supabase link --project-ref <referenca>` pa `supabase db push`. Prije udaljenih migracija provjerite cilj i backup. Testne bootstrap SQL datoteke nikad se ne primjenjuju na Supabase projekt.
4. Objavite Edge funkcije `checkout`, `stripe-webhook`, `upload`, `download`, `contact`, `notify` naredbom `supabase functions deploy <ime>`. JWT gateway je isključen jer zaštićene funkcije same validiraju bearer token preko `auth.getUser()`. Webhook validira Stripe potpis; contact ima validaciju, honeypot i rate limit; notify traži zaseban cron secret.
5. U Supabase Auth postavite stvarni Site URL, dopuštene callback putanje `/potvrda-emaila` i `/reset-lozinke`, obveznu potvrdu e-maila i najmanje 12 znakova lozinke. Za produkciju konfigurirajte SMTP, rate limite i CAPTCHA. Google OAuth ostaje isključen do stvarne implementacije.
6. `APP_URL` u Edge Secrets mora točno odgovarati podrijetlu frontend aplikacije. `PUBLIC_SUPABASE_URL` potreban je samo za lokalni Storage kada interni URL nije dostupan pregledniku.
7. Prvog administratora dodjeljuje vlasnik projekta nakon provjere identiteta: `insert into public.user_roles(user_id,role) values ('<stvarni UUID>','ADMIN');`. Nikad ne koristite korisnički metadata kao izvor administratorske uloge.

## Stripe i e-mail

- U Edge Secrets postavite stvarne `STRIPE_SECRET_KEY` (testni ključ), `STRIPE_WEBHOOK_SECRET` i `APP_URL`. Supabase ubrizgava svoje serverske ključeve; ne kopirajte ih u frontend.
- Endpoint je `<SUPABASE_URL>/functions/v1/stripe-webhook`. Pretplatite `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` i `charge.refunded`.
- U administratorskim postavkama uključite Stripe i isključite način pripreme **tek nakon** provjere ključeva i webhooka. U početnoj bazi naplata je onemogućena.
- Provjerite 100 %, obje 50/50 rate, ponovljene događaje, pogrešne potpise, istek, povrate i zabranu preuzimanja prije završne uplate. Povratak sa success URL-a ne potvrđuje uplatu. Kartični podaci ne ulaze u aplikaciju.
- Live ključ je dodatno blokiran dok serverski `STRIPE_LIVE_ENABLED=true` nije izričito postavljen. To nije zamjena za poslovnu, pravnu i sigurnosnu provjeru.
- Ako se Stripe sesija kreira, a spremanje ID-ja ili webhook zakaže, ponovni poziv koristi isti idempotency ključ i stabilne parametre. Ne stvarajte ručno zamjensku uplatu bez provjere postojeće sesije. Potpun reconciliation i admin retry UI još nisu implementirani.
- Refundaciju pokrećite u Stripe Dashboardu; aplikacija preuzima potvrđeni događaj i kumulativni iznos povrata. Ručno postavljanje Stripe uplate na uspješno nije dopušteno.
- Za obavijesti konfigurirajte `RESEND_API_KEY`, potvrđeni `EMAIL_FROM`, slučajni `CRON_SECRET` i zaštićen periodični POST prema `notify`. Secret ide u `Authorization: Bearer …`. Ne spremajte ga u javni SQL ili repozitorij. Potrebni su dopušteni domena pošiljatelja i izlaz prema `api.resend.com`.

## Testovi

```bash
npm run build            # TypeScript i produkcijski bundle
npm test                 # 22 testa novca i domenskih pravila
npm run db:test          # Docker PostgreSQL, migracije i 43 serverske provjere
npm run test:e2e          # javni desktop/mobilni tokovi; poseban port 5174
npm run check:edge       # Deno provjera svih 6 Edge funkcija
npm run test:edge        # 3 lokalne Stripe kriptografske provjere bez naplate
npm run test:local       # lokalni Supabase API, Storage i browser; zahtijeva pokrenute servise
```

Playwright koristi `/usr/bin/chromium` ako postoji ili `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Na drugom računalu instalirajte Chromium naredbom `npx playwright install chromium` uz dopušteno preuzimanje. `db:test` koristi privremeni spremnik bez mreže i bez objavljenog porta te ga uklanja. Minimalni Auth/Storage adapteri služe za SQL testove i nisu zamjena za puni Supabase test.

`test:local` odbija udaljeni Supabase URL, stvara nasumične testne korisnike, testira Auth, REST, RLS, upload/download i browser prijavu te uklanja testne zapise. Sintetički platni događaji u tom testu provjeravaju DB adapter; **ne dokazuju Stripe naplatu**. Ključevi, lozinke i sesije ne ispisuju se. [Rezultati provjera](docs/PROVJERE.md) razlikuju provedeno i neprovedeno.

## Objava i preduvjeti poslovanja

`npm run build` stvara `dist/`. Statički hosting mora preusmjeriti nepoznate putanje na `index.html`; uključen je Netlify `_redirects`. Na drugom hostingu postavite jednak SPA fallback i sigurnosna zaglavlja (CSP prilagođen stvarnom Supabase hostu, HSTS, nosniff, frame-ancestors). Vite razvojni server nije produkcijski hosting.

Frontend varijable postavljaju se pri buildu. Tajne ostaju u Supabase Secrets. U postavkama cloud okruženja dopustite točan Supabase hostname i, za serverske operacije, `api.stripe.com` i po potrebi `api.resend.com`. Nemojte isključivati TLS provjeru ili dodavati neograničen izlaz kao popravak.

Prije objave vlasnik mora unijeti stvarne poslovne podatke, cijene i pravila, odobriti pravne tekstove, postaviti rokove čuvanja/brisanja, backup i monitoring te povezati usklađeno izdavanje računa/fiskalizaciju. Interna evidencija nije službeni račun. Automatski antivirus, PayPal, bankovni workflow i CorvusPay nisu završeni; vidjeti STATUS.

Supabase, hosting, Stripe, e-mail, pohrana i promet imaju ograničenja i mogu stvarati troškove. Ne pretpostavlja se neograničen besplatan plan. Postavite upozorenja na potrošnju, limite veličine datoteka i politiku zadržavanja prije aktivacije.
