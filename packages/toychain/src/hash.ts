import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

/**
 * Deterministic serialisation.
 *
 * Hashing is only useful here if the same logical value always produces the same
 * bytes. `JSON.stringify` preserves insertion order, so `{a:1,b:2}` and `{b:2,a:1}`
 * would hash differently despite being the same value. Sorting keys removes that
 * ambiguity. Real chains use a fixed binary encoding (RLP on Ethereum, SSZ on the
 * beacon chain) for the same reason, and for the compactness this gives up.
 */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
}

/** SHA-256 of a UTF-8 string, hex-encoded. */
export function hashString(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)));
}

/** SHA-256 of the canonical serialisation of any value, hex-encoded. */
export function hashValue(value: unknown): string {
  return hashString(canonical(value));
}

/** Raw SHA-256 digest bytes, for signing. */
export function digestBytes(input: string): Uint8Array {
  return sha256(utf8ToBytes(input));
}
