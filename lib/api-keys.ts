import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_PREFIX = "loop_";

/** Generates a new API key. Only the hash and short prefix are stored. */
export function generateApiKey(): {
  key: string;
  prefix: string;
  hash: string;
} {
  const raw = randomBytes(24).toString("base64url");
  const key = `${KEY_PREFIX}${raw}`;

  return {
    key,
    prefix: key.slice(0, 12),
    hash: hashApiKey(key),
  };
}

/** SHA-256 hash used as the lookup/storage form of an API key. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Constant-time comparison for secret values. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
