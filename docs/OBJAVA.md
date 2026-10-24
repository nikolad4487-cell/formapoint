# Priprema za objavu

1. Pročitati STATUS i provjere. Dovršiti zahtjeve potrebne za stvarno poslovanje; ova iteracija nije produkcijski odobrena.
2. Osigurati Supabase razvojni projekt i primijeniti migracije na ispravan cilj. Provjeriti dva korisnika i administratora, API privatnost, privatni Storage, karantenu i potpisane URL-ove. Produkcijsku bazu odvojiti od testnih podataka.
3. Postaviti javni frontend URL i Supabase publishable ključ u hosting build varijable. Service role, Stripe, Resend i cron tajne postaviti isključivo serverski.
4. Objaviti Edge funkcije, konfigurirati CORS/APP_URL, Auth redirects i SMTP. Testirati potvrdu e-maila i reset na stvarnoj odabranoj domeni.
5. Povezati Stripe testni način i webhook. Provjeriti iznose, valutu, 100 %, 50/50, idempotentnost i povrate. Zaključati preuzimanja dok zadnja uplata nije potvrđena. Uključiti nadzor neuspjelih webhookova i ručni postupak provjere spornih transakcija.
6. Konfigurirati antivirus i zadržavanje datoteka. Dok nije povezan, sve datoteke ostaju u karanteni do stvarne, auditirane provjere. Ne označavati upload automatski sigurnim.
7. Osigurati poslovne podatke, cijene, pravne tekstove, GDPR postupke, fiskalizaciju i službene račune putem usklađenog modula. Pravni predlošci i interna evidencija nisu dovršene poslovne isprave.
8. Postaviti statički hosting za `dist/`, SPA fallback, HTTPS i zaglavlja. Izraditi sitemap s odobrenom domenom, backup, monitoring, alarmiranje i plan povrata prethodne verzije. Provjeriti responzivnost i pristupačnost.
9. Provjeriti limite Supabasea, hosting plana, e-maila i procesora plaćanja. Postaviti upozorenja za trošak i pravila zadržavanja prije otvaranja javne registracije i naplate.

Objava u cloud onboarding sučelju sprema snapshot i konfiguraciju okruženja; ne objavljuje automatski produkcijsku web-aplikaciju ni Supabase funkcije.
