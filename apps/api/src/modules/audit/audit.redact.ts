/**
 * Pure, framework-free redaction for audit-log payloads — plan.md §11.1's
 * audit log stores real request/response bodies, so this is the one thing
 * standing between "genuinely useful diff viewer" and "plaintext password
 * dump in a database collection several roles can read." Applied to BOTH
 * `requestBody` (a login/register/password-change payload) and
 * `responseBody` (defense in depth — no admin-mutation response in this
 * codebase currently echoes a secret back, but a future one might).
 *
 * **Word-aware, not a blind substring match** — an earlier version tested
 * `/card/i.test(key)` and redacted `Discount.showOnProductCard` (a real,
 * useful boolean merchandising flag, found live against this repo's
 * actual `pricing` module during integration testing) purely because
 * "Card" appears inside "ProductCard". Every key is split into
 * camelCase/snake_case/kebab-case words first, and only a whole word (or
 * a whole two-word phrase, for "card number"/"credit card") is checked
 * against the secret vocabulary — so "showOnProductCard" (words: show,
 * on, product, card — "card" not followed by "number") stays visible,
 * while "cardNumber"/"card_number"/"newPassword"/"refreshToken"/
 * "otpCode" are all still redacted.
 */

const SECRET_WORDS = new Set(['password', 'passphrase', 'token', 'secret', 'otp', 'cvv', 'cvc', 'pin', 'authorization', 'apikey', 'privatekey']);
const SECRET_BIGRAMS: ReadonlyArray<readonly [string, string]> = [
  ['card', 'number'],
  ['credit', 'card'],
];

const REDACTED = '[REDACTED]';

/** Recursion/array-size caps — this runs on every mutating admin request,
 *  so it must stay bounded regardless of how deep/large a payload is. */
const MAX_DEPTH = 8;
const MAX_ARRAY_ITEMS = 200;

function keyWords(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase -> spaced
    .split(/[^a-zA-Z0-9]+/) // snake_case / kebab-case / spaces
    .filter((w) => w.length > 0)
    .map((w) => w.toLowerCase());
}

function isSecretKey(key: string): boolean {
  const words = keyWords(key);
  if (words.some((w) => SECRET_WORDS.has(w))) return true;
  return SECRET_BIGRAMS.some(([a, b]) => words.some((w, i) => w === a && words[i + 1] === b));
}

export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[TRUNCATED]';

  // `Date` has no own enumerable properties (`Object.entries(new Date())`
  // is `[]`), so the generic object branch below would silently collapse
  // every `createdAt`/`updatedAt` — real fields on essentially every
  // admin-mutation response DTO in this codebase — into `{}`. Found live
  // against a real response body during integration testing, not
  // hypothetically: pass it through untouched instead.
  if (value instanceof Date) return value;

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactSecrets(item, depth + 1));
  }

  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSecretKey(key) ? REDACTED : redactSecrets(v, depth + 1);
    }
    return out;
  }

  return value;
}
