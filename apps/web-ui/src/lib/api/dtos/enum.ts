/**
 * Build the runtime enum member list for a string union type.
 *
 * The record parameter must cover every member of `T`, so a member added to
 * the model union breaks the build until it is listed here. `Object.keys`
 * order is the literal order below, which keeps schema error messages stable.
 *
 * @param members every member of T mapped to true
 * @returns the member list, ready for `z.enum`
 */
export function enumValues<T extends string>(members: Record<T, true>): [T, ...T[]] {
  return Object.keys(members) as [T, ...T[]]
}
