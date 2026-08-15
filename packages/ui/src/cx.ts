/** Minimal `clsx`-alike: joins truthy class strings with a space. Kept as
 *  three lines instead of a dependency — this is all Button/Input need. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
