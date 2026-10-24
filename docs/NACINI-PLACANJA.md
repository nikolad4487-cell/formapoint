# Dodavanje i uklanjanje načina plaćanja iz prikaza

U Supabase SQL Editoru jednom pokrenite [nadogradnju 008](../public/migracije/202610240008_payment_methods.sql), nakon 006 i 007. Ona dodaje administratorski popis `payment_methods`, prenosi prethodno spremljene Visa/Mastercard ikone i zatvara pristup neobjavljenim metodama. Ne mijenja postojeće narudžbe, uplate ili Stripe račun. Apple Pay, Google Pay, KEKS Pay i Aircash se ne dodaju automatski iz starih ikona.

U **Postavke → Uplate i pravila → Načini plaćanja i oznake** možete:

- dodati Visa/Mastercard oznaku ili Apple Pay/Google Pay novčanik kroz Stripe;
- učitati ili ukloniti ikonu iz datoteke kao i prije;
- sakriti metodu kupcima i ukloniti cijeli redak iz popisa;
- dodati proizvoljan naziv i ikonu nepovezane metode za pripremu; takva metoda je skrivena kupcima i ne može se označiti kao dostupna bez stvarne integracije.

Novi redak je skriven. Za novčanik se otvara zasebna potvrda da je administrator uključio i provjerio metodu na Stripe računu. To je evidencija vlasnikove potvrde, a ne automatska provjera Stripe API-ja. Stvarnu dostupnost u Checkoutu kontrolira Stripe i ona ovisi o podršci za račun i uređaj/karticu kupca. Postavke su dostupne iz poveznice u administraciji. Kartične oznake su informativne; njihovo skrivanje ne blokira odgovarajuću karticu u Stripeu. Za isključivanje svih naplata koristite glavni prekidač Stripe ili način pripreme.

Javna stranica koristi samo omogućene redove povezane sa Stripeom, a novčanike prikazuje samo uz potvrdu. Nepovezana metoda ne može postati dostupna ni izravnim upisom kroz javni API. RLS i ograničenja u bazi provode pravilo, a uklanjanje metode ne dira povijest narudžbi. Ako 008 još nije primijenjena, admin nudi preuzimanje datoteke, a javna stranica zadržava prethodne Visa/Mastercard ikone kao privremeni fallback. Nakon migracije prazan popis ostaje prazan.

Detaljne [Stripe i Codespaces upute](STRIPE-POSTAVLJANJE.md) uključuju objavu funkcija preko `--use-api` zbog greške pri lokalnom DNS razrješavanju. Upravljanje prikazom metoda i ikonama koristi Supabase bazu/Storage i ne zahtijeva novu Edge funkciju. Checkout i webhook ipak moraju biti objavljeni za stvarnu naplatu.
