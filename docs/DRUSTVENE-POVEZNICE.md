# Facebook, Instagram i WhatsApp zajednica

U **Administracija → Postavke → Opće postavke → Društvene mreže** unesite Facebook i Instagram poveznice te pozivnu poveznicu WhatsApp zajednice (primjer oblika: `https://chat.whatsapp.com/…`). Spremite opće postavke. U podnožju javnih stranica prikazuju se ikone spremljenih profila i gumb **Pridruži se WhatsApp zajednici**. LinkedIn poveznica također ostaje podržana.

Prazno polje znači da ikona odnosno gumb nije prikazan. Za isključivanje obrišite poveznicu i spremite postavke. Poveznice moraju koristiti HTTPS; otvaraju se u novoj kartici. Spremanje postavki plaćanja čuva društvene poveznice.

Za postojeću bazu pokrenite cijeli `public/migracije/202611120018_social_links.sql` u Supabase SQL Editoru pa osvježite aplikaciju. Skripta zahtijeva nadogradnju 006, može se sigurno ponoviti i dodaje neobvezno prazno polje za WhatsApp zajednicu. Ne dodaje javne poveznice umjesto vlasnika. Bez 018 Facebook i Instagram rade kao prije, dok WhatsApp polje prikazuje poveznicu na nadogradnju. Nije potrebna objava Edge funkcija.
