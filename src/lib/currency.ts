/** Parse human EUR amounts without multiplying a floating-point decimal. */
export function eurosToCents(value: string, minimum = 0): number {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error('Unesite iznos u eurima s najviše dvije decimale, npr. 25,50.');
  const cents = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > 100000000)
    throw new Error('Najveći dopušteni iznos je 1.000.000,00 €.');
  if (cents < minimum)
    throw new Error(
      `Najmanji dopušteni iznos je ${(minimum / 100).toFixed(2).replace('.', ',')} €.`,
    );
  return cents;
}
export function centsToEuroInput(cents: number | null | undefined): string {
  return cents == null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}
