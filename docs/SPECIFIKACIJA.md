# MASTER PROMPT ZA CODEX
## FormaPoint – profesionalna platforma za naručivanje digitalnih i administrativnih usluga

### 0. GLAVNA UPUTA

Želim da izradiš kompletnu, profesionalnu, modernu i funkcionalnu full-stack web-aplikaciju pod nazivom **FormaPoint**.

FormaPoint je digitalna platforma na kojoj korisnici mogu naručiti različite usluge: izradu i uređivanje Word dokumenata, PowerPoint prezentacija, Excel tablica, PDF obrazaca, vođenje e-pošte, upravljanje online aplikacijama, administrativne zadatke i druge digitalne poslove.

Projekt mora biti spreman za stvarno poslovanje nakon odgovarajuće pravne, porezne, sigurnosne i produkcijske konfiguracije.

**VAŽNO: Sve stranice moraju koristiti jedan potpuno identičan dizajn-sustav. Ne želim da početna stranica, registracija, korisnička nadzorna ploča, košarica ili administracija izgledaju kao različite aplikacije.**

Izradi stvarnu aplikaciju, ne samo demonstracijske stranice. Nemoj koristiti lažne funkcionalnosti, gumbe koji ništa ne rade ili simulacije stvarnih plaćanja u produkciji.

---

# 1. TEHNOLOGIJE

Koristi:

- React s TypeScriptom i Viteom
- Tailwind CSS
- shadcn/ui
- Lucide React ikone
- React Router
- React Hook Form i Zod
- TanStack Query
- Supabase PostgreSQL
- Supabase Authentication
- Supabase Storage
- Supabase Realtime gdje je koristan
- Supabase Edge Functions za serverske operacije
- Stripe Checkout i Stripe webhooks
- PayPal Orders API kao opcionalnu integraciju
- Resend ili zamjenjivi e-mail adapter za obavijesti
- date-fns s hrvatskom lokalizacijom
- Decimalno siguran prikaz novca i izračune u najmanjim valutnim jedinicama

Koristi modularnu arhitekturu, jasnu strukturu mapa, odvojene komponente, centralizirane tipove podataka i reusable hooks.

Sav korisnički tekst mora biti na hrvatskom jeziku.

Valuta: EUR.

Vremenska zona za poslovne prikaze: Europe/Zagreb.

Format datuma: hrvatski format.

Aplikacija mora raditi na mobitelima, tabletima i računalima.

---

# 2. JEDINSTVENI VIZUALNI IDENTITET

Izradi dizajn-sustav i koristi ga na SVAKOJ stranici.

## 2.1. Boje

Definiraj CSS varijable i Tailwind design tokens:

- Primary Blue: `#3155F6`
- Primary Hover: `#2444DA`
- Secondary Blue: `#5988FF`
- Violet Accent: `#8054F6`
- Dark Navy: `#10183F`
- Main Background: `#F7F9FF`
- Cards Background: `#FFFFFF`
- Border: `#E5EAF5`
- Muted Text: `#7180A3`
- Success: `#10B981`
- Warning: `#F59E0B`
- Error: `#EF4444`
- Info: `#3B82F6`

Glavni gumbi mogu koristiti plavo-ljubičasti gradijent.

Pozadine neka budu dominantno bijele, uz vrlo blage plave i ljubičaste dekorativne elemente.

## 2.2. Tipografija

Koristi Inter ili odgovarajući moderan font koji podržava hrvatske znakove.

Naslovi neka budu veliki, jasni, tamnoplavi i vizualno snažni.

Sekundarni tekst neka bude smireniji, ali dovoljno kontrastan.

## 2.3. Komponente

Sve stranice moraju koristiti iste komponente:

- AppShell
- PublicHeader
- PublicFooter
- DashboardSidebar
- DashboardHeader
- PageHeader
- PrimaryButton
- SecondaryButton
- OutlineButton
- GhostButton
- ServiceCard
- PricingCard
- StatCard
- OrderCard
- PaymentCard
- StatusBadge
- ProgressBar
- OrderTimeline
- NotificationDropdown
- DataTable
- SearchInput
- FilterBar
- FileUploader
- FilePreview
- EmptyState
- ErrorState
- LoadingSkeleton
- ConfirmationDialog
- FormField
- ToastNotification
- PaymentMethodSelector
- InstallmentCard
- ConversationPanel
- ActivityTimeline
- Pagination
- Breadcrumbs

Ne smiješ pojedinačno dizajnirati iste komponente drukčije na drugim stranicama.

## 2.4. Pravila dizajna

- Ujednačeni zaobljeni rubovi.
- Jedinstveni sustav razmaka.
- Blage sjene.
- Konzistentne ikone.
- Ujednačene kartice.
- Jasni hover i focus efekti.
- Smooth animacije bez pretjerivanja.
- Profesionalan SaaS izgled.
- Bez horizontalnog overflowa na mobitelu.
- Bez nečitljivih tablica.
- Podrška za reduced motion.
- WCAG pristupačnost za tipkovnicu, kontrast i oznake obrazaca.

## 2.5. Navigacija

Javni dio ima gornju navigaciju.

Prijavljeni korisnik ima bočni izbornik i gornju traku.

Administrator koristi isti dizajn-sustav, s dodatnim administratorskim navigacijskim stavkama.

Na mobitelu se bočni izbornik pretvara u drawer.

---

# 3. JAVNE STRANICE

Implementiraj sljedeće:

### 3.1. Početna stranica `/`

Hero sekcija:

Naslov: **Digitalne usluge na jednom mjestu**

Podnaslov: Profesionalna izrada i uređivanje dokumenata, prezentacija, obrazaca i administrativnih zadataka – jednostavno, brzo i online.

Gumbi:
- Naruči uslugu
- Pogledaj usluge

Sekcije:

1. Prednosti platforme.
2. Najpopularnije usluge.
3. Kako funkcionira.
4. Katalog usluga.
5. Opcije plaćanja.
6. Plaćanje 50/50.
7. Česta pitanja.
8. Kontakt.
9. Profesionalni footer.

Prikaz podržanih platnih metoda mora odražavati samo stvarno aktivirane integracije.

### 3.2. Usluge `/usluge`

Kartice svih aktivnih usluga.

Pretraživanje, filtriranje po kategorijama i sortiranje.

Svaka kartica:
- Ikona.
- Naziv.
- Opis.
- Početna cijena ili oznaka „Cijena prema ponudi”.
- Okvirni rok, ako je određen.
- Gumb „Saznaj više”.
- Gumb „Dodaj u košaricu” kada je usluga podobna.

### 3.3. Detalji usluge `/usluge/:slug`

Prikaži:

- Naziv i opis.
- Što je uključeno.
- Što nije uključeno.
- Primjere dopuštenih zadataka.
- Dostupne pakete.
- Opcionalne dodatke.
- Procijenjeni rok.
- Revizije.
- Početnu ili fiksnu cijenu.
- Mogućnost 50/50 plaćanja.
- FAQ.
- Narudžbeni obrazac.

### 3.4. Ostale javne stranice

- `/cjenik`
- `/kako-funkcionira`
- `/o-nama`
- `/kontakt`
- `/faq`
- `/uvjeti-koristenja`
- `/pravila-privatnosti`
- `/kolacici`
- `/otkazivanje-i-povrati`
- `/prigovori`
- Prilagođena 404 stranica.

Pravne tekstove izradi kao jasno označene predloške koje vlasnik mora provjeriti i odobriti prije objave.

---

# 4. KATALOG USLUGA

Administracija mora moći kreirati neograničen broj kategorija i usluga.

Početne kategorije:

## Word dokumenti

- Izrada poslovnih dokumenata.
- Formatiranje.
- Lektorski i tehnički ispravci prema ugovorenoj usluzi.
- Uređivanje sadržaja.
- Tablice.
- Zaglavlja i podnožja.
- Sadržaj dokumenta.
- Predlošci.
- Životopisi.
- Dopisi.
- Izvještaji.
- Tehničko uređivanje seminarskih i završnih radova.

Za akademske radove usluga mora biti ograničena na dopuštenu podršku, poput formatiranja, lekture i objašnjenja. Ne nuditi neovlašteno pisanje radova koji se predstavljaju kao tuđi samostalni rad.

## PowerPoint

- Izrada prezentacija.
- Dizajn slajdova.
- Poslovne prezentacije.
- Edukativne prezentacije.
- Uređivanje postojećih prezentacija.
- Animacije i prijelazi.

## Excel

- Izrada tablica.
- Formatiranje.
- Unos i organizacija podataka.
- Osnovne formule.
- Grafikoni.
- Jednostavni izvještaji.

## PDF

- Pretvorbe formata.
- Spajanje PDF dokumenata.
- Razdvajanje PDF dokumenata.
- Ispunjivi PDF obrasci.
- Priprema za ispis.
- Uređivanje dopuštenih dokumenata.

## Vođenje e-pošte

- Organizacija inboxa.
- Sortiranje poruka.
- Izrada predložaka.
- Priprema odgovora.
- Evidencija upita.
- Administrativna komunikacija.

Ne tražiti da korisnik unosi svoju lozinku. Buduće povezivanje e-mail računa mora koristiti ovlašteni OAuth pristup.

## Online administracija

- Unos podataka.
- Uređivanje sadržaja.
- Upravljanje dopuštenim online sustavima.
- Administrativni zadaci.
- Održavanje evidencija.
- Obrada korisničkih zahtjeva.

## Ostale usluge

Korisnik može poslati individualni zahtjev.

Administrator naknadno određuje cijenu i rok.

---

# 5. PRIJAVA I REGISTRACIJA

Stranice:

- `/prijava`
- `/registracija`
- `/zaboravljena-lozinka`
- `/reset-lozinke`
- `/potvrda-emaila`

## Registracija

Polja:

- Ime.
- Prezime.
- E-mail.
- Lozinka.
- Potvrda lozinke.
- Opcionalno telefon.
- Prihvaćanje uvjeta gdje je potrebno.
- Zasebna dobrovoljna privola za marketing.

Implementiraj:

- Supabase Auth.
- Provjeru e-mail adrese.
- Reset lozinke.
- Zaštitu od brute-force pokušaja.
- Prikaz i skrivanje lozinke.
- Validaciju.
- Poruke o pogreškama.
- Logout.
- Sigurno upravljanje sesijama.

Google prijava može biti opcionalna kada se konfigurira OAuth pružatelj.

Nemoj prikazivati Apple ili Microsoft prijavu kao funkcionalnu dok nije stvarno konfigurirana.

Korisničke uloge:

- CUSTOMER
- ADMIN

Sustav treba biti proširiv za SUPPORT i STAFF.

Uloge provjeravaj na serveru.

Korisnik si nikada ne smije moći sam dodijeliti administratorska prava.

---

# 6. KORISNIČKA NADZORNA PLOČA

Ruta: `/app`

Prikaz:

- Dobrodošlica korisniku.
- Aktivne narudžbe.
- Narudžbe koje čekaju plaćanje.
- Ukupno plaćeni iznos.
- Dostupne datoteke.
- Nedavne poruke.
- Obavijesti.
- Zadnje aktivnosti.
- Preporučene usluge.
- Brza nova narudžba.

Bočni izbornik:

- Nadzorna ploča.
- Nova narudžba.
- Moje narudžbe.
- Košarica.
- Plaćanja.
- Datoteke.
- Poruke.
- Obavijesti.
- Profil.
- Postavke.
- Podrška.
- Odjava.

Sve metrike moraju koristiti stvarne podatke iz baze.

---

# 7. NOVA NARUDŽBA

Ruta: `/app/nova-narudzba`

Koristi wizard s više koraka:

1. Odabir usluge.
2. Detalji zadatka.
3. Datoteke.
4. Rok izrade.
5. Dodatne opcije.
6. Pregled cijene.
7. Odabir modela plaćanja.
8. Potvrda narudžbe.

Korisnik može:

- Opisati zahtjev.
- Odabrati uslugu.
- Odabrati paket.
- Odabrati broj stranica ili jedinica gdje je primjenjivo.
- Dodati napomene.
- Učitati datoteke.
- Odabrati željeni rok.
- Odabrati 100 % ili 50/50 kada je dostupno.
- Pregledati konačnu cijenu.

Automatski izračunavaj cijenu samo kada postoji definiran cjenik.

Ako je zadatak složen, korisnik šalje upit bez obveze trenutnog plaćanja, administrator izrađuje ponudu, a korisnik je potom prihvaća ili odbija.

Za odobrenu ponudu kreiraj verziju ponude sa zaključanom cijenom, opisom, valutom i rokom valjanosti.

---

# 8. KOŠARICA

Ruta: `/app/kosarica`

Implementiraj stvarnu košaricu.

Mora omogućiti:

- Dodavanje usluge.
- Uklanjanje.
- Promjenu količine gdje ima smisla.
- Uređivanje konfiguracije.
- Prikaz cijene svake stavke.
- Prikaz ukupne cijene.
- Kupon ili promo kod.
- Prikaz popusta.
- Model plaćanja 100 % ili 50/50.
- Nastavak na checkout.

Košarica se mora čuvati u bazi prijavljenog korisnika.

Kod odjavljenog korisnika može se privremeno čuvati lokalno, uz sigurno spajanje nakon prijave.

Ako korisnik ima više poslova različitih uvjeta, implementiraj zasebne narudžbe unutar jednog checkout postupka ili jasno označi koje se stavke mogu zajedno naplatiti.

Ne dopuštaj zajednički 50/50 checkout ako neka stavka ne podržava takav model.

Provizije procesora ne dodavati automatski kao zasebnu naknadu kupcu.

---

# 9. MODELI PLAĆANJA

Ovo je jedna od najvažnijih funkcionalnosti.

## 9.1. Plaćanje 100 % unaprijed

Korisnik odmah plaća puni iznos.

Nakon uspješnog plaćanja narudžba postaje spremna za početak izrade.

## 9.2. Plaćanje 50/50

Korisnik plaća:

- 50 % prije početka izrade.
- Preostalih 50 % po dovršetku izrade, prije preuzimanja konačnog rada.

Primjer:

Cijena: 25,00 €.

Prva uplata: 12,50 €.

Druga uplata: 12,50 €.

Nakon prve potvrđene uplate može započeti izrada.

Kada administrator dovrši rad, označava „Rad dovršen – čeka završnu uplatu”.

Korisnik dobiva obavijest i gumb „Plati preostali iznos”.

Nakon potvrđene druge uplate preuzima konačne datoteke.

Prije završne uplate može se ponuditi ograničen pregled radova, ali bez mogućnosti neovlaštenog pristupa originalnim datotekama.

Ako iznos u centima nije djeljiv na dva jednaka dijela, prvi dio sadrži jedan cent više.

## 9.3. Administratorske postavke

Administrator može:

- Uključiti 50/50 po usluzi.
- Isključiti 50/50.
- Odrediti minimalnu cijenu za 50/50.
- Odrediti vrijedi li opcija za pojedinu ponudu.
- Postaviti dopuštene metode plaćanja.
- Prikazati uplaćeni i preostali iznos.
- Poslati podsjetnik na drugu uplatu.
- Ručno potvrditi bankovnu uplatu uz zapis tko je to učinio.
- Pregledati povrate sredstava.

Plaćanje druge rate ne smije se automatski naplatiti sa spremljene kartice bez zasebno valjane autorizacije i odgovarajućih uvjeta.

## 9.4. Statusi obročnog plaćanja

- NOT_STARTED
- DEPOSIT_PENDING
- DEPOSIT_PAID
- FINAL_PENDING
- FINAL_PAID
- PARTIALLY_REFUNDED
- REFUNDED
- PAYMENT_FAILED

Statusi plaćanja ne smiju se nekontrolirano miješati sa statusima izrade.

---

# 10. PRUŽATELJI PLAĆANJA

Predvidi integracijsku arhitekturu za:

1. Stripe.
2. PayPal.
3. Bankovnu uplatu.
4. CorvusPay kao buduću opciju.
5. Druge pružatelje koji se mogu naknadno dodati.

**Stripe mora biti primarna implementacija.**

Primjenjuj službeni Stripe Checkout i webhookove.

Kartice i digitalni novčanici trebaju se prikazivati samo ako su stvarno podržani i aktivirani.

PayPal implementiraj kao opcionalnog zasebnog pružatelja.

CorvusPay može ostati disabled dok nema ugovora i produkcijskih podataka.

## Naknade

Kupac plaća točno konačnu cijenu prikazanu prije naplate.

Procesor oduzima svoje naknade iz naplaćenog iznosa prema primjenjivim pravilima.

U administraciji evidentiraj:

- Bruto naplatu.
- Procijenjenu naknadu.
- Stvarnu naknadu.
- Neto iznos.
- Valutu.
- Procesora.
- Vrijeme transakcije.
- Status.
- Povrate.
- ID transakcije.

Ne pretpostavljaj da je provizija fiksno 1,5 %, 3 % ili 5 %.

Naknade ovise o pružatelju, kartici, državi, vrsti transakcije i ugovoru.

Kada je moguće, dohvati stvarnu naknadu iz procesorove evidencije.

Za 50/50 vodi dvije odvojene transakcije i njihove zasebne naknade.

## Sigurnosni uvjeti

- Sve cijene izračunavaj na serveru.
- Nikada ne vjeruj cijeni poslanom iz preglednika.
- Provjeravaj potpis webhookova.
- Spriječi dvostruku naplatu.
- Koristi idempotency keys.
- Evidentiraj događaje webhookova.
- Obradi zakašnjele događaje.
- Obradi neuspješne uplate.
- Obradi refundacije.
- Ne spremaj kartične podatke.
- Ne otključavaj rad samo zato što se korisnik vratio na success URL.
- Konačni status uplate određuje verificirani serverski događaj ili odgovarajuća provjera pružatelja plaćanja.

Osiguraj testni način rada prije produkcije.

---

# 11. MOJE NARUDŽBE

Ruta: `/app/narudzbe`

Implementiraj tablični i kartični prikaz.

Filteri:

- Sve.
- Nove.
- Čeka ponudu.
- Čeka plaćanje.
- U izradi.
- Čeka korisnika.
- Čeka završnu uplatu.
- Dovršeno.
- Otkazano.
- Refundirano.

Svaka narudžba ima:

- Jedinstveni broj, npr. FP-2026-000001.
- Uslugu.
- Opis.
- Datum.
- Cijenu.
- Rok.
- Status.
- Napredak.
- Model plaćanja.
- Podatke o uplatama.
- Poruke.
- Datoteke.
- Povijest aktivnosti.

Napredak može biti temeljen na definiranim fazama koje administrator potvrđuje. Ne izmišljati automatski postotak stvarne dovršenosti rada.

## Statusi izrade

- Zahtjev zaprimljen.
- Čeka ponudu.
- Ponuda poslana.
- Ponuda prihvaćena.
- Čeka predujam.
- Spremno za izradu.
- U izradi.
- Čeka dodatne informacije.
- Rad dovršen.
- Čeka završnu uplatu.
- Dostavljeno.
- Revizija.
- Završeno.
- Otkazano.

Dodaj jasnu vremensku crtu narudžbe.

Prijelazi statusa moraju se provjeravati na serveru.

---

# 12. DATOTEKE

Ruta: `/app/datoteke`

Podržani formati prema konfiguraciji:

- PDF
- DOC
- DOCX
- XLS
- XLSX
- PPT
- PPTX
- TXT
- JPG
- JPEG
- PNG

Funkcionalnosti:

- Učitavanje datoteka.
- Pregled popisa.
- Sigurno preuzimanje.
- Verzije datoteka.
- Razlikovanje korisnikovih privitaka od završnih datoteka.
- Označavanje datoteka kao nacrt, pregled ili završni rad.
- Kontrola pristupa.
- Ograničenja veličine.
- Validacija sadržaja i formata.
- Sigurno rukovanje nazivima datoteka.
- Zaštita od neovlaštenih preuzimanja.

Koristi privatne Supabase Storage buckete.

Koristi kratkotrajne potpisane URL-ove.

Završne datoteke za 50/50 narudžbu dostupne su samo kada je ostatak plaćen ili kada postoji dopuštena administratorska iznimka.

Preporučljivo je dodati provjeru prenesenih datoteka na zlonamjerni sadržaj prije obrade.

---

# 13. PORUKE I KOMUNIKACIJA

Ruta: `/app/poruke`

Svaka narudžba ima vlastiti razgovor između korisnika i administratora.

Omogući:

- Slanje poruka.
- Privitke.
- Povijest razgovora.
- Oznaku nepročitanih poruka.
- Obavijesti.
- Vrijeme slanja.
- Status pročitano kada je implementiran.
- Internu administratorsku bilješku koja nije vidljiva korisniku.

Po potrebi koristi Supabase Realtime.

Porukama mogu pristupiti samo ovlaštene osobe.

---

# 14. OBAVIJESTI

Implementiraj in-app i e-mail obavijesti.

Vrste:

- Registracija.
- Potvrda e-mail adrese.
- Nova narudžba.
- Nova ponuda.
- Ponuda prihvaćena.
- Prva uplata zaprimljena.
- Izrada započela.
- Zatraženi dodatni podaci.
- Nova poruka.
- Rad dovršen.
- Potrebna druga uplata.
- Druga uplata zaprimljena.
- Datoteke spremne.
- Narudžba završena.
- Narudžba otkazana.
- Povrat sredstava.
- Odgovor podrške.

Koristi profesionalne e-mail predloške istog FormaPoint identiteta.

E-mail obavijesti ne smiju sadržavati nepotrebne osobne podatke ili tajne poveznice.

Za produkciju implementiraj pouzdano redanje, slanje i evidenciju neuspješnih obavijesti.

---

# 15. KORISNIČKI PROFIL

Ruta: `/app/profil`

Omogući:

- Promjenu imena i prezimena.
- Promjenu kontaktnih podataka.
- Promjenu lozinke.
- Postavke obavijesti.
- Podatke za račun.
- Povijest narudžbi.
- Sigurno upravljanje prijavama.
- Zahtjev za izvoz osobnih podataka.
- Zahtjev za brisanje računa.

Ne spremaj nepotrebne osobne podatke.

Nemoj pohranjivati kompletne podatke kartica.

Ako se prikazuju spremljeni načini plaćanja, koristi samo dopuštene reference i maskirane podatke dobivene od platnog pružatelja.

---

# 16. ADMINISTRATORSKA NADZORNA PLOČA

Ruta: `/admin`

Administracija mora biti potpuno funkcionalna.

Koristi ISTI FormaPoint dizajn.

Početne statističke kartice:

- Nove narudžbe.
- Aktivne narudžbe.
- Čeka prvu uplatu.
- Čeka završnu uplatu.
- Prihod u razdoblju.
- Stvarno naplaćen bruto iznos.
- Neto iznos nakon evidentiranih platnih naknada.
- Broj korisnika.
- Novi upiti.
- Narudžbe s prekoračenim rokom.

Dodaj grafikone:

- Mjesečne naplate.
- Broj narudžbi.
- Najtraženije usluge.
- Omjer 100 % i 50/50.
- Transakcijske naknade po pružatelju.
- Nedovršene narudžbe.

Jasno razlikuj naplaćeni iznos, refundacije, naknade procesora i računovodstveni prihod. Ne predstavljaj procijenjene naknade kao konačne.

---

# 17. ADMINISTRACIJA NARUDŽBI

Ruta: `/admin/narudzbe`

Administrator može:

- Pregledati sve narudžbe.
- Pretraživati ih.
- Filtrirati po statusu.
- Filtrirati po roku.
- Filtrirati po korisniku.
- Pregledati datoteke.
- Poslati poruku.
- Zatražiti dodatne informacije.
- Poslati individualnu ponudu.
- Odobriti početak izrade.
- Promijeniti status kroz dopuštene prijelaze.
- Dodati završne datoteke.
- Zatražiti drugu uplatu.
- Odobriti reviziju.
- Završiti narudžbu.
- Otkazati narudžbu prema pravilima poslovanja.
- Pokrenuti odgovarajući postupak povrata.

Sve kritične administratorske radnje evidentiraj u audit log.

---

# 18. ADMINISTRACIJA USLUGA

Ruta: `/admin/usluge`

Puna CRUD funkcionalnost.

Za svaku uslugu administrator može postaviti:

- Naziv.
- Slug.
- Kategoriju.
- Opis.
- Ikonu.
- Aktivnost.
- Vidljivost.
- Vrstu cijene.
- Osnovnu cijenu.
- Cijenu po jedinici.
- Dodatne opcije.
- Trajanje.
- Rok isporuke.
- Broj revizija.
- Maksimalnu veličinu privitaka.
- Podršku za 50/50.
- Minimalnu vrijednost za 50/50.
- Redoslijed prikaza.
- Oznaku popularnosti.

Promjena cijene ne smije retroaktivno mijenjati prihvaćene ponude ili postojeće narudžbe.

---

# 19. ADMINISTRACIJA PLAĆANJA

Ruta: `/admin/placanja`

Prikaži:

- Sve transakcije.
- Pružatelja plaćanja.
- Korisnika.
- Narudžbu.
- Bruto iznos.
- Naknadu.
- Neto iznos.
- Status.
- Datum.
- Refundacije.
- Model 100 % ili 50/50.
- Prvu i drugu uplatu.

Dodaj filtere i izvoz CSV izvještaja.

Implementiraj ručno evidentiranje bankovne uplate s provjerom ovlasti i audit zapisom.

Nikada ne dopuštaj ručnu promjenu statusa Stripe transakcije u „uspješno” bez provjere stvarne uplate.

Za stvarne online uplate izvor istine mora biti odgovarajući platni sustav.

---

# 20. ADMINISTRACIJA KORISNIKA

Ruta: `/admin/korisnici`

Mogućnosti:

- Pregled korisnika.
- Pretraga.
- Profil.
- Broj narudžbi.
- Pregled povezanih narudžbi.
- Kontakt.
- Status.
- Interna bilješka.
- Sigurno ograničavanje pristupa u opravdanim slučajevima.

Ne izlaži lozinke, tokene, kompletne kartične podatke i druge tajne.

Promjena uloga treba biti dopuštena samo posebno ovlaštenom administratoru.

---

# 21. ADMINISTRATORSKE POSTAVKE

Ruta: `/admin/postavke`

Izradi podstranice:

### Opće postavke
- Naziv platforme.
- Logo.
- Kontakt e-mail.
- Kontakt telefon.
- Javna adresa.
- Podaci o pružatelju usluge.
- URL stranice.

### Plaćanja
- Stripe test/live konfiguracija.
- PayPal konfiguracija.
- Bankovna uplata.
- Aktivni pružatelji.
- 50/50 postavke.
- Minimalni iznos za obročni model.

### Usluge i cijene
- Kategorije.
- Cjenici.
- Rokovi.
- Dodatne opcije.

### Obavijesti
- E-mail predlošci.
- Vrste obavijesti.
- Administratorova e-mail adresa.

### Poslovni podaci
- Podaci potrebni za dokumentaciju.
- Porezni status.
- Pravila povrata.
- Uvjeti korištenja.
- Privatnost.

### Sustav
- Audit log.
- Zdravlje integracija.
- Pregled neuspjelih webhookova.
- Sigurno ponavljanje neuspjelih zadataka.
- Održavanje.

Tajne ključeve nikada ne prikazuj u običnom tekstu nakon spremanja.

Osjetljive konfiguracije pohranjuj u sigurnom server-side okruženju, a ne u javnim tablicama baze.

---

# 22. PODRŠKA KORISNICIMA

Ruta: `/app/podrska`

Korisnik može poslati upit.

Kategorije:

- Narudžbe.
- Plaćanja.
- Datoteke.
- Tehnički problem.
- Povrat novca.
- Ostalo.

Administracija ima `/admin/podrska`.

Omogući:

- Otvaranje zahtjeva.
- Dodjelu statusa.
- Odgovore.
- Privitke.
- Zatvaranje zahtjeva.
- Povijest komunikacije.

---

# 23. KUPONI I POPUSTI

Administrator može kreirati:

- Kod za popust u postotku.
- Fiksni popust.
- Vremenski ograničen kupon.
- Kupon s ograničenjem korištenja.
- Popust za određenu uslugu.
- Popust za odabrani paket.

Provjeri kupon na serveru.

Spriječi zloporabu kupona i negativne iznose.

Prikaži ispravnu konačnu cijenu prije plaćanja.

---

# 24. RAČUNI I POSLOVNI DOKUMENTI

Aplikacija mora imati evidenciju poslovnih dokumenata.

Predvidi:

- Ponude.
- Potvrde narudžbi.
- Potvrde o primitku uplate.
- Evidenciju predujmova.
- Evidenciju završnih uplata.
- Povrate.
- Izvoz financijskih podataka.

Nemoj generirati račun koji ne zadovoljava stvarne zakonske i fiskalne zahtjeve.

Za izdavanje stvarnih računa, fiskalizaciju i druge obveze predvidi zaseban, provjerljiv modul ili integraciju s odgovarajućim certificiranim/usklađenim pružateljem.

Dok takva integracija nije spremna, jasno označi da interni dokumenti nisu zamjena za službeni račun.

Podaci o pružatelju usluga moraju biti konfigurabilni, a ne izmišljeni.

---

# 25. STRUKTURA BAZE PODATAKA

Kreiraj normaliziranu PostgreSQL shemu s migracijama.

Predložene tablice:

- profiles
- user_roles
- service_categories
- services
- service_variants
- service_options
- service_option_values
- carts
- cart_items
- quotes
- quote_items
- orders
- order_items
- order_status_history
- order_files
- order_messages
- payments
- payment_installments
- payment_provider_events
- refunds
- notifications
- notification_preferences
- support_tickets
- support_messages
- promo_codes
- promo_code_uses
- invoices_metadata
- business_settings
- site_settings
- audit_logs

Osiguraj:

- Primarne ključeve.
- Strane ključeve.
- Indekse.
- Unique constraints.
- Check constraints.
- RLS politike.
- Server-side validaciju.
- Verzije prihvaćenih ponuda.
- Evidenciju promjena cijena.
- Sigurne statusne prijelaze.

Svi novčani iznosi u EUR trebaju biti spremljeni kao cijeli broj centi.

Definiraj jasne veze između narudžbe, ponude, plana plaćanja i stvarnih transakcija.

---

# 26. SIGURNOST I GDPR

Obavezno:

- Supabase Row Level Security.
- Serverska provjera ovlasti.
- Zaštita privatnih datoteka.
- Zaštita korisničkih poruka.
- Validacija obrazaca.
- Rate limiting.
- Sigurni session mehanizmi.
- Zaštita tokena.
- Provjera webhook potpisa.
- Audit log.
- Minimalni pristup podacima.
- Kontrola pristupa administratorskom dijelu.
- Sigurno rukovanje privicima.
- Zaštita od neovlaštenih poziva.
- Primjereno evidentiranje sigurnosnih događaja.

Uključi mogućnost zahtjeva za pristup, izvoz i brisanje osobnih podataka uz poštovanje zakonskih rokova čuvanja.

Nemoj spremati više podataka nego što je potrebno.

---

# 27. DODATNE FUNKCIONALNOSTI

Dodaj:

- Globalno pretraživanje.
- Filtre.
- Paginaciju.
- Sortiranje.
- Breadcrumbs.
- Toast poruke.
- Skeleton loading.
- Empty states.
- Prikaze pogrešaka.
- Sigurno ponovno pokušavanje neuspjelih zahtjeva.
- Potvrdu prije brisanja.
- Automatsko čuvanje nacrta narudžbe.
- Pregled prije potvrde.
- Status povezanih integracija.
- Prijateljske URL-ove.
- SEO metadata za javne stranice.
- Open Graph podatke.
- Sitemap.
- Robots.txt.
- Responzivne stranice.
- Osnovne analitičke događaje uz odgovarajuće postavke privatnosti.

Pripremi arhitekturu za kasniju višejezičnost, ali prva verzija neka bude isključivo na hrvatskom.

---

# 28. POTPUNI POPIS RUTA

Javne rute:

- `/`
- `/usluge`
- `/usluge/:slug`
- `/cjenik`
- `/kako-funkcionira`
- `/o-nama`
- `/kontakt`
- `/faq`
- `/prijava`
- `/registracija`
- `/zaboravljena-lozinka`
- `/reset-lozinke`
- `/potvrda-emaila`
- `/uvjeti-koristenja`
- `/pravila-privatnosti`
- `/kolacici`
- `/otkazivanje-i-povrati`
- `/prigovori`

Korisničke rute:

- `/app`
- `/app/nova-narudzba`
- `/app/kosarica`
- `/app/checkout`
- `/app/narudzbe`
- `/app/narudzbe/:id`
- `/app/placanja`
- `/app/placanja/:id`
- `/app/datoteke`
- `/app/poruke`
- `/app/poruke/:id`
- `/app/obavijesti`
- `/app/profil`
- `/app/postavke`
- `/app/podrska`

Administratorske rute:

- `/admin`
- `/admin/narudzbe`
- `/admin/narudzbe/:id`
- `/admin/korisnici`
- `/admin/korisnici/:id`
- `/admin/usluge`
- `/admin/usluge/nova`
- `/admin/usluge/:id`
- `/admin/kategorije`
- `/admin/placanja`
- `/admin/ponude`
- `/admin/poruke`
- `/admin/datoteke`
- `/admin/podrska`
- `/admin/kuponi`
- `/admin/izvjestaji`
- `/admin/obavijesti`
- `/admin/postavke`
- `/admin/audit-log`

Sve rute moraju koristiti pripadajući zajednički layout i zaštitu pristupa.

---

# 29. TESTIRANJE

Implementiraj unit i integracijske testove.

Testiraj:

- Registraciju i prijavu.
- Uloge.
- RLS pravila.
- Privatnost narudžbi.
- Dodavanje u košaricu.
- Izračun cijena.
- Kuponske popuste.
- Kreiranje ponude.
- Prihvaćanje ponude.
- 100 % plaćanje.
- 50/50 plaćanje.
- Zaokruživanje centi.
- Neuspjele uplate.
- Ponovljene webhookove.
- Refundacije.
- Statusne prijelaze.
- Zaključavanje završnih datoteka.
- Otključavanje nakon potvrde druge uplate.
- Izmjenu cijene postojeće usluge bez promjene postojećih narudžbi.
- Mobilni prikaz.

Dodaj end-to-end testove za najvažnije korisničke tokove.

---

# 30. RAZVOJNI I PRODUKCIJSKI NAČIN RADA

Aplikacija mora podržavati lokalni development.

Izradi `.env.example`.

Ne spremaj produkcijske tajne u repozitorij.

Koristi Stripe testni način rada dok se ne aktivira stvarno poslovanje.

Razdvoji razvojne i produkcijske konfiguracije.

Za usluge koje još nisu konfigurirane prikaži stvarno stanje „Nije dostupno” umjesto lažne funkcionalnosti.

Dodaj upute za povezivanje Supabase projekta i Stripe računa.

Omogući deployment na odgovarajući hosting za React/Vite i Supabase backend.

Nemoj pretpostaviti da svi besplatni planovi imaju neograničene resurse ili da će ostati besplatni. Dokumentiraj ograničenja i moguće buduće troškove.

---

# 31. FAZE IMPLEMENTACIJE

Izradi aplikaciju sljedećim redoslijedom:

### Faza 1 – Projekt i dizajn

- Postavljanje projekta.
- Struktura mapa.
- Tailwind.
- shadcn/ui.
- Tema.
- FormaPoint logo.
- Javni layout.
- Dashboard layout.
- Zajedničke komponente.
- Početna stranica.
- Stranice usluga.
- Login/register dizajn.

### Faza 2 – Baza i autentifikacija

- Supabase integracija.
- SQL migracije.
- RLS.
- Korisničke uloge.
- Registracija.
- Prijava.
- Zaštićene rute.

### Faza 3 – Narudžbe

- Katalog usluga.
- Cjenici.
- Nova narudžba.
- Košarica.
- Individualne ponude.
- Statusi.
- Datoteke.
- Poruke.

### Faza 4 – Plaćanja

- Stripe Checkout.
- Webhookovi.
- Plaćanje 100 %.
- Plaćanje 50/50.
- Evidencija naknada.
- Evidencija uplata.
- Zaključavanje završnih datoteka.
- Testiranje plaćanja.
- Opcionalni PayPal.

### Faza 5 – Korisnički panel

- Dashboard.
- Moje narudžbe.
- Moja plaćanja.
- Datoteke.
- Poruke.
- Profil.
- Obavijesti.

### Faza 6 – Administracija

- Admin dashboard.
- Upravljanje uslugama.
- Upravljanje narudžbama.
- Upravljanje ponudama.
- Plaćanja.
- Korisnici.
- Podrška.
- Statistika.
- Postavke.

### Faza 7 – Produkcijska priprema

- Sigurnosne provjere.
- Testovi.
- Optimizacija.
- Mobilni dizajn.
- Pravna i poslovna konfiguracija.
- E-mail integracija.
- Dokumentacija.
- Deployment.

---

# 32. OBAVEZNA PRAVILA ZA CODEX

1. Nemoj izrađivati različite stilove za različite stranice.
2. Nemoj koristiti generički admin template koji ne odgovara FormaPoint identitetu.
3. Nemoj mijenjati boje, fontove i stil komponenti bez potrebe.
4. Nemoj koristiti hardkodirane korisničke podatke u produkcijskim prikazima.
5. Nemoj prikazivati lažna stvarna plaćanja.
6. Nemoj dopuštati nezaštićen pristup korisničkim datotekama.
7. Nemoj čuvati lozinke vanjskih aplikacija u običnom tekstu.
8. Nemoj automatski dodavati procesorsku proviziju na cijenu kupcu.
9. Nemoj smatrati narudžbu plaćenom samo prema frontend događaju.
10. Nemoj omogućiti preuzimanje zaključanog završnog rada prije potvrde plaćanja, osim zakonski ili administrativno odobrene iznimke.
11. Nemoj automatski mijenjati dogovorenu cijenu postojeće narudžbe.
12. Svaka funkcija mora imati ispravno rukovanje pogreškama.
13. Za svaku značajnu komponentu koristi centralizirani dizajn-sustav.
14. Sve stranice moraju biti responzivne.
15. Sav prikazani tekst mora biti na hrvatskom.
16. Ne stvaraj lažne račune, fiskalizacijske oznake ili potvrde o plaćanju.
17. Ne stavljaj privatne API ključeve u frontend.
18. Prati troškove i nemoj uvoditi skupe servise bez stvarne potrebe.
19. Dokumentiraj što je implementirano, što radi u testnom načinu rada i što je potrebno za produkciju.
20. Ne označavaj nezavršene funkcionalnosti kao gotove.

---

# 33. ZAVRŠNI REZULTAT

Želim dobiti:

- Kompletan izvorni kod FormaPointa.
- Ujednačen dizajn svih stranica.
- Sve potrebne reusable komponente.
- Funkcionalan korisnički sustav.
- Administratorski sustav.
- Košaricu.
- Narudžbe.
- Ponude.
- Poruke.
- Datoteke.
- Sigurnu Stripe integraciju.
- Plaćanje 100 % i 50/50.
- Opcionalne druge pružatelje plaćanja.
- Administratorski cjenik.
- Izvještaje.
- Supabase SQL migracije.
- RLS pravila.
- Testove.
- `.env.example`.
- README s uputama na hrvatskom jeziku.
- Upute za konfiguraciju i objavu.

**Najvažnije: FormaPoint mora izgledati i funkcionirati kao jedan jedinstven, profesionalno razvijen digitalni proizvod.**

Nemoj se zaustaviti samo na vizualnom prototipu. Implementiraj stvarni sustav fazno, s provjerljivim rezultatima.

Prije početka analiziraj postojeći repozitorij i sve priložene referentne slike. Ako projekt već postoji, nastavi na postojećem kodu bez nepotrebnog rušenja funkcionalnih dijelova.

Priložene slike služe kao vizualni izvor istine za dizajn-sustav. Nemoj doslovno kopirati ilustrativne datume, osobe, cijene ili demonstracijske podatke sa slika.

Započni s postavljanjem arhitekture, zajedničkog dizajn-sustava, strukture aplikacije i prve funkcionalne faze. Nastavi kroz ostale faze kad god razvojno okruženje dopušta, uz dokumentiranje stvarno dovršenih funkcionalnosti i rezultata testiranja.
