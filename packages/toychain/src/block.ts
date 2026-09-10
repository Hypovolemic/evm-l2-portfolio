import type { Block, Transaction } from './types.js';
import { hashValue } from './hash.js';
import { merkleRoot } from './merkle.js';

/**
 * The block hash, computed from the header fields only.
 *
 * The transactions enter the hash through the Merkle root rather than directly,
 * which is exactly how a real header works: the header stays a fixed small size
 * no matter how many transactions the block carries, while still committing to
 * every one of them.
 *
 * The root is recomputed here rather than read from a stored field, so a stored
 * root can never drift out of sync with the transactions it claims to summarise.
 */
export function hashBlock(block: Block): string {
  return hashValue({
    index: block.index,
    timestamp: block.timestamp,
    merkleRoot: merkleRoot(block.transactions),
    prevHash: block.prevHash,
    difficulty: block.difficulty,
    nonce: block.nonce,
  });
}

/** The proof-of-work target: `difficulty` leading hex zeros. */
export function meetsDifficulty(hash: string, difficulty: number): boolean {
  return hash.startsWith('0'.repeat(difficulty));
}

export interface MineResult {
  block: Block;
  hash: string;
  /** How many hashes were tried. The honest measure of what the block cost. */
  attempts: number;
}

/**
 * Search for a nonce that puts the block hash under the target.
 *
 * There is no cleverness available: SHA-256 gives no way to work backwards from
 * a desired output, so the only strategy is to try nonces until one lands. That
 * is the whole of proof of work, and the reason a chain cannot be quietly
 * rewritten -- redoing this for one block means redoing it for every block after
 * it as well.
 *
 * At difficulty d the expected number of attempts is 16^d.
 */
export function mineBlock(block: Block, maxAttempts = 20_000_000): MineResult {
  const candidate: Block = { ...block, nonce: 0 };

  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const hash = hashBlock(candidate);
    if (meetsDifficulty(hash, candidate.difficulty)) {
      return { block: candidate, hash, attempts };
    }
    candidate.nonce++;
  }

  throw new Error(`no valid nonce found in ${maxAttempts} attempts at difficulty ${block.difficulty}`);
}

export function createGenesisBlock(difficulty: number, timestamp = 0): Block {
  return mineBlock({
    index: 0,
    timestamp,
    transactions: [] as Transaction[],
    prevHash: '0'.repeat(64),
    difficulty,
    nonce: 0,
  }).block;
}
