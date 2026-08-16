/**
 * `@lulwah/ui`'s `Input` (and this app's `LabeledSelect`) declare
 * `errorMessage?: string` — optional, but not explicitly `| undefined`.
 * React Hook Form's `errors.field?.message` is typed `string | undefined`.
 * Under `exactOptionalPropertyTypes`, assigning that straight to an
 * `errorMessage={...}` prop is a type error: an *absent* key and a key
 * *present with value `undefined`* are distinct. Spreading this helper's
 * result (`{...errorMessageProp(errors.field?.message)}`) omits the key
 * entirely when there's no error, instead of setting it to `undefined`.
 */
export function errorMessageProp(message: string | undefined): { errorMessage: string } | Record<string, never> {
  return message === undefined ? {} : { errorMessage: message };
}
