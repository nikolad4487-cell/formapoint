import { centsToEuroInput } from '../lib/currency';
export function EuroInput({
  name,
  defaultCents,
  required = false,
}: {
  name: string;
  defaultCents?: number | null;
  required?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      name={name}
      required={required}
      pattern="[0-9]+([.,][0-9]{1,2})?"
      maxLength={15}
      placeholder="25,50"
      defaultValue={centsToEuroInput(defaultCents)}
    />
  );
}
