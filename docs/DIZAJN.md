# Vizualno usklađenje s referencama

Dizajn je prilagođen osam korisnikovih prikaza iz ZIP arhive: početna stranica, prijava, nadzorna ploča, moje narudžbe, plaćanja, košarica, administracija i dizajn-sustav.

Zajednički sloj `src/reference.css` nadopunjuje osnovne tokene iz `src/index.css`: tamnoplavi naslovi, plavi gradijent gumba, svijetloplave i ljubičaste pozadinske plohe, bijele zaobljene kartice, obojene ikone usluga i ujednačene statusne oznake. Isti sloj vrijedi za javne, korisničke i administratorske stranice.

- Logo je ponovljiva vektorska komponenta s jedinstvenim gradient ID-jevima po instanci.
- Početna i prijava imaju CSS/SVG ilustraciju prijenosnika s uredničkim katalogom. Ilustracija je označena i ne sadrži tuđe račune ili demonstracijske narudžbe.
- Dashboard koristi zajednički pregled narudžbi, potvrđene faze izrade, stvarne poruke/datoteke i preporučene usluge. Administracija dodaje audit aktivnost i grafikone iz dohvaćenih zapisa.
- Narudžbe imaju proširive retke s detaljima, fazama i poveznicama na razgovor i datoteke. Header pretražuje narudžbe po nazivu/broju.
- Košarica ima kartice usluga, kontrole količine i zaseban sažetak; potvrda kreira narudžbe bez lažne uplate. Model 50/50 vrijedi samo kada ga podržavaju sve stavke.
- Plaćanja prikazuju potvrđene transakcije i iznose iz baze. PayPal, CorvusPay, spremljene kartice i neaktivne metode sa slika nisu predstavljeni kao aktivne integracije.
- `/admin/dizajn-sustav` je zaštićen pregled stvarnih komponenata. Interaktivni primjeri jasno su označeni kao lokalni; ne stvaraju narudžbe ili uplate.
- Mobilni izbornik ima zatvaranje tipkom Escape, ograničavanje fokusa, vraćanje fokusa na okidač i skrivanje zatvorene navigacije. Rasporedi se slažu u stupce na malim zaslonima; reduced-motion pravila ostaju aktivna.

Osobe, datumi, brojevi narudžbi, cijene, postoci napretka i procesorske naknade s referentnih slika nisu kopirani u poslovne podatke. Faze predstavljaju potvrđene statuse, ne izmišljeni postotak stvarne dovršenosti. Naknade se ne računaju prema ilustrativnih 5 % sa slike.

## Provjera prikaza

Playwright pokreće javni dio na portu 5174 bez Supabase konfiguracije. Privatni prikazi provjeravaju se na zasebnom portu 5175 s izoliranim fixtureom u `tests/fixtures/workspace.ts` i presretnutim HTTP zahtjevima. Testni računi i podaci postoje isključivo u testovima; aplikacija nema demo prijavu niti prečac koji zaobilazi zaštitu ruta.

Provjere obuhvaćaju desktop i mobilni prikaz, filtriranje i promjenu upita pretrage, otvaranje retka narudžbe, promjenu količine i uklanjanje iz košarice, onemogućenu naplatu, prazna stanja, pogrešku API-ja, zabranu administratorskog prikaza i fokus mobilne navigacije. To provjerava ponašanje sučelja; nije zamjena za integraciju sa stvarnim Supabaseom ili Stripeom.
