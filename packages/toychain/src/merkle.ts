import type { Transaction } from './types.js';
import { hashValue, hashString } from './hash.js';

const ZERO_ROOT = '0'.repeat(64);

/** The leaf hash of a transaction: its identity, independent of position. */
export function txHash(tx: Transaction): string {
  return hashValue(tx);
}

/**
 * Merkle root over a block's transactions.
 *
 * Pairs adjacent hashes and hashes them together, repeatedly, until one value
 * remains. An odd level duplicates its last element. That duplication is a real
 * flaw -- it is the root of Bitcoin's CVE-2012-2459 malleability bug -- and it is
 * kept here because it is the textbook construction and the failure is worth
 * being able to explain.
 *
 * The point of the root: it commits to every transaction in the block in 32 bytes,
 * so changing any one transaction changes the block hash, and a light client can
 * be shown that one transaction is in a block without downloading the other
 * thousand. See `merkleProof`.
 */
export function merkleRoot(transactions: Transaction[]): string {
  if (transactions.length === 0) return ZERO_ROOT;

  let level = transactions.map(txHash);
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(hashString(left + right));
    }
    level = next;
  }
  return level[0];
}

export interface MerkleProofStep {
  hash: string;
  position: 'left' | 'right';
}

/** The sibling hashes needed to walk one transaction up to the root. */
export function merkleProof(transactions: Transaction[], index: number): MerkleProofStep[] {
  if (index < 0 || index >= transactions.length) {
    throw new RangeError(`no transaction at index ${index}`);
  }

  const proof: MerkleProofStep[] = [];
  let level = transactions.map(txHash);
  let position = index;

  while (level.length > 1) {
    const isRightNode = position % 2 === 1;
    const siblingIndex = isRightNode ? position - 1 : position + 1;
    const sibling = siblingIndex < level.length ? level[siblingIndex] : level[position];

    proof.push({ hash: sibling, position: isRightNode ? 'left' : 'right' });

    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(hashString(left + right));
    }
    level = next;
    position = Math.floor(position / 2);
  }

  return proof;
}

/** Recompute the root from one leaf and its proof, and compare. */
export function verifyMerkleProof(leaf: string, proof: MerkleProofStep[], root: string): boolean {
  let computed = leaf;
  for (const step of proof) {
    computed = step.position === 'left'
      ? hashString(step.hash + computed)
      : hashString(computed + step.hash);
  }
  return computed === root;
}
