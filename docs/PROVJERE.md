# Provjere u cloud okruženju

Provjereno 24. listopada 2026. na Node.js 24, Linuxu, Chromiumu i PostgreSQL-u 17 u privremenom Docker spremniku.

| Provjera                               | Rezultat                           | Što dokazuje                                                                                                                                                                                                  |
| -------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript i Vite produkcijski build   | Prošlo                             | Frontend se kompajlira; bundle je podijeljen na aplikaciju, vendor, Supabase, obrasce i datume                                                                                                                |
| Vitest                                 | 31 prošao test                     | 50/50 centi, popusti, pristup završnom radu te fallback, override, offline način i zabrana serverskog ključa u javnoj konfiguraciji                                                                           |
| PostgreSQL migracije                   | 5 uspješno primijenjenih           | Sintaktička i izvršna valjanost tablica, funkcija, politika, seed kataloga i hardeninga                                                                                                                       |
| PostgreSQL integracija                 | 43 prošle provjere                 | RLS, zabrana eskalacije uloge i upisa uplate, privatnost poruka, kupon, verzije ponuda, zaključana cijena, rate, ponovljeni i zakašnjeli događaji, neuspjele uplate i povrati                                 |
| Playwright javni dio                   | 9 prošlih, 1 očekivano preskočen   | Desktop/mobilni katalog i detalji, pretraživanje, FAQ tipkovnicom, glavne javne rute bez horizontalnog overflowa, stvarna nedostupnost prijave bez konfiguracije; mobilni test se preskače u desktop projektu |
| Stripe SDK lokalni potpisi             | 3 prošle provjere                  | Valjan potpis prihvaćen, izmijenjeno tijelo i prestara poruka odbijeni; bez vanjskog Stripe poziva                                                                                                            |
| Deno check                             | Svih 6 funkcija prošlo             | Tipovi checkouta, webhooka, uploada, downloada, kontakta i outbox workera; ne dokazuje pozive vanjskih servisa                                                                                                |
| Vizualni pregled                       | Proveden                           | Svih 8 rasporeda pregledano u Chromium screenshotovima prema priloženim referencama; privatni prikazi koriste eksplicitne testne fixture podatke                                                              |
| Puni lokalni Supabase / test:local     | Blokirano prije izvršavanja tokova | Zadani ECR registar je zabranjen; službeni Docker Hub put radi, ali raspakiravanje slike prijavilo je `failed to register layer: no space left on device` na VFS driveru                                      |
| Stvarni Stripe testni Checkout/webhook | Nije izvedeno                      | Nedostaju povezani račun i valjani testni ključevi; DB testovi koriste eksplicitne sintetičke događaje                                                                                                        |
| Resend / produkcijski SMTP / OAuth     | Nije izvedeno                      | Nema konfiguriranih računa, domena i tajni                                                                                                                                                                    |
| Produkcijska objava                    | Nije izvedeno                      | Nije napravljena niti potvrđena                                                                                                                                                                               |

PostgreSQL test koristi minimalne Auth/Storage testne sheme i stvarni PostgreSQL RLS. Ne potvrđuje Supabase Auth e-mail callback, Storage HTTP API ili Realtime u punom stacku. `scripts/test-local.mjs` pripremljen je za te provjere i mora se izvršiti nakon uspostave lokalnog Supabasea; nije označen kao prošao.

Na aktualnom stroju javni razvoj i build rade. Za puni backend potrebno je povećati dostupni Docker prostor (VFS ima veliku amplifikaciju slojeva) ili povezati zaseban Supabase razvojni projekt i izvršiti odgovarajuće testove. Nisu mijenjani Docker storage driver niti globalne postavke daemona. Ne ponavljati isto preuzimanje bez rješavanja prostora.

Neopasne build napomene dolaze iz Zod dependency komentara o tree-shakingu. Ne isključuju se provjere TLS-a, potpisa ni checksumova.

Nakon vizualnog usklađenja: Playwright ukupno 26 prošlih provjera i 2 očekivano preskočene (mobilni izbornici u desktop projektima). Od toga je 17 dodatnih provjera privatnih prikaza s izoliranim API fixtureom. To nije potvrda stvarne Auth/Storage/Stripe integracije. Više u [DIZAJN.md](DIZAJN.md).

## Ispravak konfiguracije objavljene aplikacije

Produkcijski build uspješno je izrađen i uz uklonjene `VITE_SUPABASE_*` varijable: koristi spremljeni javni URL i `anon` ključ projekta. Build provjera blokira serverske ključeve prije kompilacije i provjerava da serverski ključ i administratorska lozinka nisu ugrađeni u JavaScript izlaz.

Na lokalno posluženom produkcijskom buildu provjereni su omogućeni obrazac prijave, stvarna administratorska prijava, otvaranje `/admin` i odjava prema hostanom Supabase projektu. HTTP zahtjevi browser provjere proslijeđeni su stvarnom API-ju kroz postojeći TLS-verificirani curl/proxy transport zbog Chromiumove odvojene CA pohrane; nisu korišteni mock odgovori ni isključivanje TLS provjere. Ovo nije provjera isporuke novog deploya na `www.formapoint.online`.

Ranije je na hostanom projektu zasebno potvrđeno postojanje profila i uloge ADMIN, RPC provjera ovlasti te sedam aktivnih usluga. Stripe naplata, reset e-maila i objava Edge funkcija time nisu potvrđeni.
