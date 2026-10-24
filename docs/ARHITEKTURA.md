# Arhitektura FormaPointa

React/TypeScript/Vite aplikacija s React Routerom i TanStack Queryjem. Tailwind 4 tokeni i zajedničke CSS komponente definirani su u `src/index.css`. shadcn obrazac za Button i Radix Dialog služe za zajedničke kontrole, uključujući prosljeđivanje fokusa i potvrde. Font Inter isporučuje se lokalno; hrvatski znakovi uključeni su u latin-ext podskup.

- `src/components`: zajednički layouti, kartice, statusi, prazna i pogrešna stanja, tražilica, gumbi i modal.
- `src/lib`: centralni tipovi, katalog za način rada bez baze, Supabase adapter, prikaz novca i vremena.
- `src/hooks`: sesija, provjera uloge i pristup podacima. Promjena računa briše prethodni query cache i nacrt.
- `src/pages`: javni dio, autentifikacija, korisnički tokovi i administracija.
- `supabase/migrations`: tablice, RLS, audit, transakcijske poslovne operacije, početni katalog bez izmišljenih cijena.
- `supabase/functions`: naplata, Stripe webhook, prijenos/preuzimanje, kontakt i red e-mail obavijesti.
- `tests`: novčana pravila, PostgreSQL izolacija i javni browser tokovi. Testni podaci nastaju samo unutar testova.

## Autoritet podataka

Preglednik šalje identifikatore i opis, a server računa cijenu iz zaključanog retka usluge. Individualna ponuda je verzionirana i prihvaća se samo zadnja važeća verzija. Iznos narudžbe i plan rata zaključavaju se pri kreiranju / prihvaćanju ponude. Promjena kataloga ne mijenja stare narudžbe.

Kupac nema izravna prava pisanja na narudžbe, poruke, uloge, ponude i transakcije. Usluge i postavke dostupne su administratoru uz RLS. RPC funkcije imaju eksplicitna EXECUTE prava i provjeru `auth.uid()`. `service_role` ostaje u Edge funkcijama.

Izrada i transakcije imaju odvojene statuse. `payment_installments` definira obvezu, a `payments` stvarne pokušaje. 50/50 dijeli neparan cent u korist prve rate. Jedan aktivan pokušaj po rati i Stripe idempotency ključ sprečavaju paralelno kreiranje naplate. Događaji se dedupliciraju u transakciji. Zakašnjeli neuspjeh ne poništava uspjeh, a zakašnjeli uspjeh ne briše povrat. Povrat dolazi iz Stripeova zapisa, bez ručnog proglašavanja kartične naplate uspješnom.

Funkcija za preuzimanje pri svakom zahtjevu provjerava korisnika, vlasnika, sigurnosni status i ukupnu uplatu. Storage nema javno ni izravno korisničko čitanje. URL traje 60 sekundi; već izdan URL može ostati važeći do isteka, uključujući nakon povrata.

## E-mail i privici

Outbox koristi zaključavanje `FOR UPDATE SKIP LOCKED`, najviše pet pokušaja, povrat zaglavljenih poslova i Resend idempotency ključ. Poruka ne sadrži dokumente ni tajne poveznice. Zakazivanje poziva i domena pošiljatelja moraju biti konfigurirani.

Prijenos provjerava dozvoljeni nastavak, veličinu i osnovni potpis formata. To nije potpuna provjera OOXML arhive ni antivirus. Datoteka ostaje u karanteni. Administrator može evidentirati rezultat stvarne provjere uz obrazloženje i audit. Automatski antivirus adapter još nije implementiran.

## Proširenja

Prva naplatna implementacija je Stripe Checkout. Banka i PayPal nisu aktivni adapteri. Podrška za nove pružatelje treba zadržati isto pravilo: samo verificiran serverski događaj mijenja potvrđeni plaćeni iznos. Ne dodavati klijentski prečac kojim se poziv API-ja ili success URL proglašava uplatom.
