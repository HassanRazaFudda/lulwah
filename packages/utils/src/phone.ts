/** A UAE mobile subscriber number: 9 digits, starting with 5 (e.g. `501234567`). */
const UAE_MOBILE_REGEX = /^5\d{8}$/;

/**
 * Strips everything but digits, then normalises a leading `971` country
 * code or a local trunk `0` down to the bare 9-digit subscriber number.
 * Returns `null` if what's left isn't a valid UAE mobile number.
 */
function toSubscriberNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const withoutPrefix = digits.startsWith('971') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  return UAE_MOBILE_REGEX.test(withoutPrefix) ? withoutPrefix : null;
}

/** True if `raw` is a valid UAE mobile number in any common input form
 *  (`0501234567`, `971501234567`, `+971 50 123 4567`, ...). */
export function isValidUaePhone(raw: string): boolean {
  return toSubscriberNumber(raw) !== null;
}

/** Formats any valid UAE mobile input into the canonical `+971 5X XXX XXXX` mask. */
export function formatUaePhone(raw: string): string {
  const subscriber = toSubscriberNumber(raw);
  if (!subscriber) {
    throw new RangeError(`formatUaePhone: "${raw}" is not a valid UAE mobile number`);
  }
  return `+971 ${subscriber.slice(0, 2)} ${subscriber.slice(2, 5)} ${subscriber.slice(5)}`;
}

/** Splits a UAE mobile number into the `{ countryCode, number }` shape the
 *  `users`/`addresses` schemas store (plan.md §7.1). */
export function toUaePhoneParts(raw: string): { countryCode: '+971'; number: string } {
  const subscriber = toSubscriberNumber(raw);
  if (!subscriber) {
    throw new RangeError(`toUaePhoneParts: "${raw}" is not a valid UAE mobile number`);
  }
  return { countryCode: '+971', number: subscriber };
}
