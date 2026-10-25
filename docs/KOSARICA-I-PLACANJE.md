# Košarica i načini plaćanja

## Aktivacija

1. Jednom u Supabase SQL Editoru pokrenite cijelu datoteku
   [202610250010_cart_checkout.sql](../public/migracije/202610250010_cart_checkout.sql).
   Potrebne su nadogradnje 006–009. Ne ponavljajte početnu instalaciju baze.
2. Pričekajte automatsku Vercel objavu iz GitHuba i osvježite aplikaciju.
3. Za IBAN u administraciji otvorite **Postavke → Uplate i pravila**.
   Spremite primatelja, valjani IBAN i banku, zatim uključite **Omogući IBAN plaćanje**
   i spremite postavke. Način pripreme mora biti isključen.
4. Kartica koristi postojeću Stripe integraciju. Za Google Pay i Apple Pay uključite
   novčanike na Stripe računu te dodajte i potvrdite odgovarajuću metodu u
   administratorskom upravljanju načinima plaćanja. Ikona sama ne aktivira novčanik.

Ova promjena ne zahtijeva novu objavu Edge Functions. Stripe `checkout` i webhook
nastavljaju koristiti isti ID narudžbe i uplate; nova provjera u bazi odbija Stripe
rezervaciju za IBAN narudžbu. Postojeće narudžbe i uplate ostaju sačuvane.

## Kupnja

**Nova narudžba** sada prikazuje artikle. Dodavanje u košaricu ne kreira narudžbu
niti pokreće naplatu. Ponovljeno dodavanje povećava količinu, do najviše 100.
Artikli se mogu dodati i iz javnog kataloga ili detalja usluge nakon prijave.
Usluge bez definirane cijene ostaju individualni zahtjevi za ponudu; ne naplaćuju se
bez prihvaćene ponude.

Tijek završetka kupnje:

1. **Košarica** — količine, uklanjanje, pražnjenje i kupon provjeren na poslužitelju.
2. **Podaci i datoteke** — naslov/tema, predmet/područje, budući rok, upute, prilozi
   i neobvezni podaci naslovnice (škola, mentor, učenik/student, razred, mjesto).
3. **Plaćanje** — pregled podataka i datoteka, odabir modela (100% ili 50/50),
   zatim kartice, Google Paya, Apple Paya ili IBAN-a. Sažetak prikazuje popust,
   ukupan iznos, iznos za uplatu sada i drugu ratu kada je odabrana.

50/50 je dostupno ako ga svi artikli u košarici podržavaju i ispunjavaju postavljeni
minimalni iznos za rate. Te postavke mijenjate u uređivanju artikla. Prva rata je
50 % prije izrade, druga nakon izrade, prije isporuke završnih datoteka. Kod
neparnog iznosa u centima prva rata sadrži dodatnih 0,01 €.

Google Pay i Apple Pay prikazuju se na Stripe Checkout stranici kada ih podržavaju
kupčev uređaj, preglednik i kartica. Odabir u aplikaciji ne može prisiliti Stripe
da prikaže nepodržan novčanik; kupac može upotrijebiti karticu. Ti su odabiri
jednokratni. Kartična opcija 50/50 koristi dvije odvojene Checkout uplate i ne
predstavlja bankovne obročne rate ili pretplatu.

Potvrdom nastaje **jedna narudžba sa svim artiklima** i jednom naplatom po rati.
Poslužitelj ponovno provjerava cijene, dostupnost, kupon i način plaćanja.
Popust za prvu narudžbu primjenjuje se jednom na cijelu košaricu. Kupon za pojedini
artikl računa popust samo na taj artikl. Ponovljena potvrda istog zahtjeva vraća
istu narudžbu. Ako Stripe trenutačno nije dostupan, narudžba ostaje u detaljima,
odakle se može ponoviti samo naplata.

Podaci obrasca čuvaju se u sesiji preglednika, a košarica u korisničkom računu.
Odabrane datoteke nisu trajni nacrt: nakon zatvaranja ili osvježavanja stranice
potrebno ih je ponovno odabrati. Prenose se u privatnu pohranu tek nakon potvrde.
Neuspjeli prijenos ne poništava već spremljenu narudžbu; prilozi se mogu dodati
naknadno u njezinim detaljima.

## IBAN uplate

Kupac u detaljima vidi primatelja, IBAN, iznos trenutačne rate i opis plaćanja s
brojem narudžbe. Podaci za uplatu čuvaju se uz narudžbu, pa kasnija promjena IBAN-a
u postavkama ne mijenja ranije izdane upute.

Administrator nakon stvarnog primitka novca otvara narudžbu i odabire
**Evidentiraj primljenu IBAN uplatu**. Unosi točan iznos trenutačne rate u eurima
i jedinstvenu referencu bankovne transakcije s izvoda. Prva uplata otključava
izradu; druga uplata, nakon dovršene izrade i prelaska na **Čeka završnu uplatu**,
otključava isporuku. Kupac ne može sam potvrditi uplatu. Ista bankovna transakcija
ne može se dvaput evidentirati; svaka potvrda ima audit zapis.

Automatska sinkronizacija s bankom i bankovni povrati nisu dodani. Djelomične
IBAN uplate treba uskladiti prije potvrde cijelog iznosa rate. Ne potvrđujte
uplatu samo na temelju kupčeve poruke ili slike potvrde.

Prije prve uplate kupac može promijeniti način plaćanja u detaljima narudžbe,
uključujući prihvaćene individualne ponude. Nakon pokretanja Stripe naplate ili
potvrđene prve rate način se zaključava za tu narudžbu.

## Provjera

`npm run db:test` provjerava stvarni PostgreSQL: više artikala, izračun kupona,
prvu narudžbu, obje rate, IBAN potvrde, ovlasti i idempotentnost. Playwright testovi
koriste isključivo lokalne API adaptere; ne šalju novac ni stvarne Stripe zahtjeve.

## Povezivanje ranije dodane IBAN ikone

Ako IBAN u popisu metoda piše da nije povezan, bio je dodan kao prilagođena oznaka.
Nakon nadogradnje 010 jednom pokrenite cijelu
[SQL nadogradnju 011](../public/migracije/202610250011_bank_method.sql).
Ona pretvara raniju IBAN oznaku u bankovnu metodu i zadržava ID i učitanu ikonu.
Ne uključuje isključenu bankovnu naplatu niti mijenja ranije narudžbe ili uplate.

Spremite primatelja i valjani IBAN, zatim na IBAN kartici odaberite **Prikaži kupcima**.
To uključuje istu glavnu postavku **Omogući IBAN plaćanje**. Skrivanje ili uklanjanje
IBAN kartice isključuje bankovnu uplatu za nove narudžbe, a postojeće upute ostaju.
Nova IBAN kartica dodaje se odabirom **IBAN — bankovna uplata**, a ne kroz drugog pružatelja.
Ikona se prikazuje uz IBAN u odabiru plaćanja i javnom pregledu metoda.
Ako je uključen način pripreme, kupci i dalje ne mogu pokrenuti novu naplatu.

PayPal i druge prilagođene oznake ostaju u pripremi dok se ne implementira njihova
stvarna naplata. Učitavanje PayPal logotipa ne povezuje PayPal račun.

## Pregled rada prije završne uplate

Jednokratna IBAN uplata sada ima opis **jednokratna uplata**, bez brojeva rata.
Oznake **IBAN 1. uplata** i **IBAN 2. uplata** vrijede samo za ugovoreni model 50/50.
Nedostupni model 50/50 skriven je u odabiru modela, uključujući ponude koje ne
zadovoljavaju najmanji iznos za dvije rate.

Za ovu promjenu **nije potreban novi SQL**, ali objavite postojeće funkcije za
datoteke iz Codespaces terminala:

```bash
git pull --ff-only
npm install
npm run deploy:files
```

Ako Supabase CLI traži prijavu, pokrenite `npx supabase login`, zatim ponovite
`npm run deploy:files`. Nisu potrebni novi ključevi ili Stripe postavke.
Frontend se i dalje objavljuje automatski kroz Vercel. Nakon objave osvježite
aplikaciju da se učita novi prikaz i novi dio za datoteke.

U detaljima administratorske narudžbe odaberite **Završni rad i pregled za korisnika**
pa **Prenesi rad i objavi pregled**. Za PDF, PNG i JPG automatski nastaju zasebne
JPEG stranice s vodenim žigom. Za Word/Excel/PowerPoint u dodatno polje priložite
PDF ili sliku za pregled. Izvornik se sprema odvojeno u privatnu pohranu i zadržava
postojeću sigurnosnu provjeru. Pregledi se ponovno kodiraju u raster bez ugrađenog
sadržaja te se ta obrada evidentira kao odobrenje pregleda.

PDF mora imati najviše 64 stranice; odjednom je moguće pripremiti najviše 64
stranice pregleda i svaka izvorna datoteka smije imati do 20 MB. Dulji rad podijelite
na više datoteka/prijenosa. Fontovi i PDF resursi dolaze s iste domene aplikacije,
a vlasnikov rad ne šalje se vanjskom servisu za konverziju.

Za narudžbu 50/50 s potvrđenom prvom uplatom objava završnog rada i pregleda označava
rad dovršenim te postavlja status **Čeka završnu uplatu**. Kupcu se prikazuju druga
rata i pregled rada. Za čistu jednokratnu narudžbu ne stvara se druga uplata.
Kupac pregledava stranice jednim gumbom **Pregledaj rad** i navigacijom među stranicama.
Izvorni završni PDF/Word/Excel/PowerPoint nije dostupan tim putem.

Poslužitelj izdaje poveznicu na završni original tek nakon potvrde cijele uplate
i sigurnosne provjere izvornika. To vrijedi i za izravni API zahtjev; `preview`
parametar i stari `download_override` ne zaobilaze provjeru uplate. Administrator
zadržava pristup sigurnosno provjerenim izvornicima radi vođenja narudžbe.
Privitke koristite za korisničke upute i slične materijale, a završni original
uvijek označite kao **Završni rad**.

Korisnikov otvoreni detalj narudžbe provjerava nove datoteke i status uplate svakih
15 sekundi dok je kartica vidljiva i narudžba nije završena ili otkazana. Nakon
potvrde druge uplate završni se rad otključava ako je prošao sigurnosnu provjeru.
