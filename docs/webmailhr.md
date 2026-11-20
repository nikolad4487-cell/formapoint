# Osobni WebmailHR sandučići

Potvrđeni FormaPoint korisnik pri prvoj aktivnoj sesiji dobiva osobni sandučić.
Priprema se odvija odvojeno od prijave: kvar poštanskog sustava ne blokira aplikaciju.
U **Moj profil** prikazuju se adresa, WebmailHR poveznica i ponovni pokušaj.
Gosti, nepotvrđeni i zabranjeni računi ne dobivaju sandučić.

Serverska Vercel funkcija `api/webmail-sync.js` provjerava JWT uživo preko izvornog
Supabase Auth `/user`, a zatim HMAC potpisom šalje samo provjereni UUID, potvrđeni
e-mail i prikazno ime WebmailHR-u. Korisnički payload ne može zadati tuđi identitet.
Privilegije se ne preuzimaju iz korisničkih metapodataka.

Production postavke (isključivo server, bez `VITE_` prefiksa):

- `SUPABASE_URL` i postojeći `SUPABASE_SERVICE_ROLE_KEY` ili `SUPABASE_SECRET_KEY`.
- `WEBMAILHR_SYNC_SECRET`: novi nasumični servisni ključ od najmanje 32 znaka,
  identičan WebmailHR postavci `FORMAPOINT_PROVISION_SECRET`.
- WebmailHR mora imati `FORMAPOINT_AUTO_MAILBOXES=1`, konfiguriran isti izvorni
  Supabase projekt i native domenu s primanjem/slanjem i Mailjet ključevima.

Operator bez pregledničkog Origin zaglavlja može poslati POST `/api/webmail-sync`
s Bearer `WEBMAILHR_SYNC_SECRET` i `{"mode":"setup"}`. To priprema domensku
politiku u WebmailHR-u, bez DNS promjene. Zatim `{"mode":"import","page":1}`
čita postojeće korisnike preko Supabase Admin API-ja, po 10, preskače goste,
nepotvrđene i zabranjene i vraća `nextPage`. Nastavite dok ne bude `null`.
Odgovor prijavljuje created/existing/conflicts/needsActivation; konflikti se ne prepisuju.
Pozivi običnih korisnika prihvaćaju samo `{}` i vraćaju isključivo njihov sandučić.

Za osobni e-mail adresa se dodjeljuje u obliku ime.prezime@formapoint.online,
bez kvačica. Zauzeta imena dobivaju broj odmah nakon prezimena: ime.prezime2,
ime.prezime3 itd. Bez imena i prezimena koristi se lokalni dio osobnog e-maila;
vlastita nezauzeta adresa na formapoint.online može ostati ista. Postojeći povezani
račun zadržava svoju adresu i neovisnu WebmailHR lozinku. Za novi račun koristi se
FormaPoint prijava; WebmailHR provjerava izvorni UUID. Postojeći IMAP sandučići
zahtijevaju odvojeno uključivanje i ne prenose se automatski.

Promjena MX-a sa Zohoa i Cloudflare Email Routing nisu dio ovog API-ja. Prije
prijelaza treba popisati postojeće poslovne Zoho adrese koje nisu FormaPoint računi,
sačuvati ih i odobriti prelazak cijele domene. Stare Zoho poruke ne uvoze se ovim putem.

Provjere: `npm run test:webmail`, `npm test`, `npm run build`. Serverski testovi
provjeravaju HMAC, granicu identiteta, potvrdu računa, privatnost grešaka i uvoz.
Webmail repo dodatno testira stvarnu PostgreSQL transakciju i prijavu izvornog UUID-a.

WebmailHR može uz `FORMAPOINT_WELCOME_EMAIL=1` poslati jednu obavijest na potvrđenu
osobnu adresu korištenu pri registraciji. Sadrži novu adresu i uputu da lozinka
ostaje ona za FormaPoint; lozinka se ne generira niti šalje. WebmailHR koristi
postojeći Mailjet i trajni red s provjerom ponavljanja. Kvar slanja ne blokira
registraciju. Uspješna predaja Mailjetu ne potvrđuje dostavu u Gmailov Inbox.

## Jedna lozinka na obje lokacije

U Moj profil nalazi se izravan obrazac Promjena lozinke, uz postojeći oporavak
putem e-pošte. Nova lozinka mora imati najmanje 8 znakova i sadržavati malo slovo, veliko slovo
i znamenku. Poseban znak nije obavezan. Helper provjerava aktualnog korisnika, ponovno potvrđuje trenutačnu
lozinku i ažurira vlastiti Supabase račun. Povezani WebmailHR uvijek provjerava
istu izvornu lozinku, pa promjena ovdje vrijedi i za mail. WebmailHR obrazac
mijenja isti izvorni račun uz provjeru UUID-a i vlastiti korisnički token, bez
administratorskog resetiranja. Zasebna lokalna lozinka za povezane račune ne
može se dodijeliti kroz WebmailHR administraciju.

`WEBMAILHR_PASSWORD_PROBE=1` dopušta jednokratnu build provjeru produkcijskih Auth
pravila na zasebnom privremenom example.invalid računu. Provjerava promjenu na
osam znakova s malim/velikim slovom i znamenkom, novu prijavu i odbijanje stare lozinke te briše probni račun u
finally bloku. Ne ispisuje tajne ni tokene. Postavku nakon provjere vratiti na 0;
inače je skripta isključena. Nema promjena lozinki postojećih korisnika.
