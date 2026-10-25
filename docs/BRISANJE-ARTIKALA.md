# Brisanje artikala i kategorija

U Supabase → SQL Editor jednom pokrenite cijelu datoteku
[202610250009_catalog_deletion.sql](../public/migracije/202610250009_catalog_deletion.sql).
Potrebne su osnovne migracije 001–005; ne ponavljajte početnu instalaciju baze.
Sama nadogradnja ne briše nijedan artikl.

U administraciji otvorite **Usluge**, pronađite artikl i kliknite **Izbriši**.
Potvrdite naziv u dijalogu i odaberite **Trajno izbriši**. To vrijedi za početne
artikle i za sve koje naknadno dodate, uključujući artikle s postojećim narudžbama.

Artikl nestaje iz kataloga i košarica. Brišu se njegove varijante i opcije.
Postojeće narudžbe, nazivi i cijene naručenih stavki, rate, uplate i povijest cijena
ostaju sačuvani. Kuponi ograničeni na taj artikl deaktiviraju se i odvajaju od
artikla. Nemojte ih ponovno aktivirati bez provjere opsega popusta.

Kategorije imaju vlastiti gumb **Izbriši**. Najprije izbrišite njihove artikle ili
im u uređivanju promijenite kategoriju; tada možete izbrisati praznu kategoriju.
Brisanje je dopušteno samo administratoru, a svako brisanje zapisuje se u auditu.

Za privremeno skrivanje artikla kroz **Uredi** isključite **Aktivna usluga**.
