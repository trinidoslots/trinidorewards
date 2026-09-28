import crypto from "node:crypto"

/**
 * Discord signs every interaction with Ed25519. An endpoint that does not
 * check it is refused when you save the URL in the developer portal, and
 * Discord keeps probing it with bad signatures afterwards.
 *
 * Node takes Ed25519 keys as SPKI, so the raw 32-byte key from the portal gets
 * the fixed DER header prepended.
 */
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex")

export function verifyDiscordRequest(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  publicKeyHex: string,
): boolean {
  if (!signature || !timestamp) return false
  try {
    const key = crypto.createPublicKey({
      key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]),
      format: "der",
      type: "spki",
    })
    return crypto.verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signature, "hex"))
  } catch {
    return false
  }
}
