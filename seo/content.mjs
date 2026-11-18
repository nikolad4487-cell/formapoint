export const faqs = [
  [
    'Kako mogu naručiti uslugu?',
    'Odaberite uslugu, opišite zadatak i priložite potrebne datoteke. Artikle s fiksnom cijenom dodajte u košaricu; za individualni zadatak najprije dobivate ponudu s cijenom i rokom. Kupovati možete kao gost ili uz korisnički račun.',
  ],
  [
    'Mogu li platiti u dva dijela?',
    'Model 50/50 prikazuje se samo kada svi artikli i iznos košarice zadovoljavaju uvjete. Prvu polovicu plaćate prije početka rada, a ostatak nakon predaje rada, prije preuzimanja završnih datoteka. Rok druge uplate prikazan je uz narudžbu.',
  ],
  [
    'Jesu li moji dokumenti sigurni?',
    'Datoteke se pohranjuju privatno. Pristup imaju samo vlasnik narudžbe i ovlaštene osobe, uz provjeru prava na poslužitelju.',
  ],
  [
    'Što ako ne znam koju uslugu odabrati?',
    'Pošaljite upit s opisom zadatka i željenim rokom. Opseg i cijena dogovaraju se prije početka rada.',
  ],
  [
    'Mogu li zatražiti izmjene?',
    'Broj uključenih revizija naveden je uz uslugu ili u ponudi. Dodatne izmjene dogovaraju se prije nastavka rada.',
  ],
  [
    'Mogu li kupovati bez registracije?',
    'Da. Kupnja kao gost traži ime, prezime i kontaktni e-mail, bez lozinke. Gost pristupa narudžbama iz istog preglednika, a naknadno može dodati podatke za račun i sačuvati narudžbe.',
  ],
  [
    'Gdje upisujem kod za popust?',
    'Važeći kod unesite u polje za kupon u košarici. Primjenjivost ovisi o uvjetima koda, artiklima i načinu plaćanja; konačan iznos provjerava sustav prije naplate.',
  ],
];
export const buySteps = [
  [
    'Odaberite uslugu',
    'Pregledajte opseg usluge i dostupne pakete. Dodajte odabrani artikal u košaricu ili zatražite individualnu ponudu.',
  ],
  [
    'Pošaljite upute',
    'Unesite temu, potrebne podatke i željeni rok te priložite materijale. Možete kupovati kao gost ili uz račun.',
  ],
  [
    'Potvrdite cijenu i plaćanje',
    'Pregledajte sažetak i dostupne metode. Kartice se naplaćuju putem Stripe Checkouta, a IBAN uplata evidentira se nakon provjere bankovnog izvoda.',
  ],
  [
    'Pratite izradu i preuzmite rezultat',
    'Status i komunikacija dostupni su uz narudžbu. Kod 50/50 možete pregledati predani rad prije druge uplate, a izvorne završne datoteke preuzeti nakon potvrde cijele uplate.',
  ],
];
export const publicPages = {
  '/': {
    title: 'Dokumenti, prezentacije i digitalna administracija | FormaPoint',
    heading: 'Digitalne usluge na jednom mjestu',
    description:
      'Naručite izradu i uređivanje dokumenata, PowerPoint prezentacije i digitalnu administraciju na FormaPointu. Pregledajte usluge, cijene i pakete.',
  },
  '/usluge': {
    title: 'Digitalne i administrativne usluge online | FormaPoint',
    heading: 'Naše usluge',
    description:
      'Pregledajte FormaPoint usluge za dokumente, prezentacije i online administraciju. Odaberite artikal ili paket i pošaljite upute za narudžbu.',
  },
  '/cjenik': {
    title: 'Cjenik dokumenata, prezentacija i administracije | FormaPoint',
    heading: 'Cjenik usluga',
    description:
      'Aktualne cijene FormaPoint usluga i paketa u eurima. Za zadatke bez fiksne cijene zatražite individualnu ponudu prije početka rada.',
  },
  '/kako-funkcionira': {
    title: 'Kako naručiti uslugu i platiti online | FormaPoint',
    heading: 'Kako funkcionira naručivanje',
    description:
      'Odabir usluge, slanje uputa, potvrda cijene, plaćanje i preuzimanje rezultata. Saznajte kako naručiti na FormaPointu kao gost ili uz račun.',
  },
  '/o-nama': {
    title: 'O FormaPointu – podrška za digitalne zadatke',
    heading: 'O FormaPointu',
    description:
      'FormaPoint omogućuje naručivanje digitalnih i administrativnih usluga, komunikaciju i isporuku kroz jedan pregledan radni prostor.',
  },
  '/faq': {
    title: 'Česta pitanja o naručivanju i plaćanju | FormaPoint',
    heading: 'Česta pitanja',
    description:
      'Odgovori o kupnji kao gost, odabiru usluge, slanju datoteka, plaćanju 50/50 i preuzimanju završnih dokumenata na FormaPointu.',
  },
  '/kontakt': {
    title: 'Kontakt i upiti za digitalne usluge | FormaPoint',
    heading: 'Kontaktirajte FormaPoint',
    description:
      'Pošaljite pitanje o dokumentima, prezentacijama ili digitalnoj administraciji. Za dogovor pripremite opis zadatka, materijale i željeni rok.',
  },
  '/portfolio': {
    title: 'Primjeri radova i portfolio | FormaPoint',
    heading: 'Portfolio',
    description:
      'Objavljeni primjeri oblikovanja, organizacije i digitalnih rješenja na FormaPointu.',
  },
};
export const legalSlugs = [
  'uvjeti-koristenja',
  'pravila-privatnosti',
  'kolacici',
  'otkazivanje-i-povrati',
  'prigovori',
];
export function servicePreparation(service) {
  const text = `${service.name} ${service.category}`.toLocaleLowerCase('hr');
  if (text.includes('prezentacij'))
    return [
      'Tema, publika i namjena prezentacije.',
      'Željeni broj slajdova, postojeći tekst i dostupne slike.',
      'Upute za izgled, format isporuke i željeni rok.',
    ];
  if (text.includes('administracij') || text.includes('pošt'))
    return [
      'Opis zadataka i opseg posla za odabrani paket.',
      'Upute za organizaciju podataka, dokumentacije ili komunikacije.',
      'Željeno razdoblje rada, rok te dogovor o načinu suradnje i potrebnim ovlastima.',
    ];
  return [
    'Izvorni dokument ili materijali kojima raspolažete.',
    'Upute za sadržaj, oblikovanje i format isporuke.',
    'Željeni rok i posebni zahtjevi koje treba provjeriti prije početka.',
  ];
}
