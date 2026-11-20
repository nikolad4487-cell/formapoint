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

Za vanjski e-mail adresa dobiva stabilan UUID sažetak radi izbjegavanja kolizija;
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
