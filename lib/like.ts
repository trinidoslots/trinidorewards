/**
 * A value for ilike() that matches itself and nothing else, case aside.
 *
 * Usernames were passed to ilike() as they are, and in a LIKE pattern "_"
 * means "any one character". Kick names are full of underscores, so
 * "john_doe" also matched "johnXdoe": one person's notifications and wins
 * could show up for another, and a lookup by name could land on the wrong
 * account. Escaping %, _ and \ makes the pattern literal.
 */
export function likeExact(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}
