/**
 * The sentinel `from` address for a block reward. A coinbase transaction is the
 * only kind that creates value out of nothing, and the only kind that carries no
 * signature -- there is no private key that could have produced one.
 */
export const COINBASE = 'COINBASE' as const;

/**
 * An address here is the compressed secp256k1 public key, hex-encoded (66 chars).
 *
 * Real chains do not do this. Ethereum stores the last 20 bytes of the keccak-256
 * hash of the *uncompressed* public key, and recovers the public key from the
 * signature itself rather than carrying it in the transaction. Carrying the full
 * public key as the address makes verification self-contained, which is the only
 * reason it is done that way here.
 */
export type Address = string;

export interface Transaction {
  from: Address | typeof COINBASE;
  to: Address;
  amount: number;
  /**
   * Per-sender counter. Two otherwise identical transactions differ by nonce, so
   * a signed transaction cannot be copied off the chain and replayed. Ethereum's
   * account nonce does exactly this job.
   */
  nonce: number;
  /** Compact ECDSA signature, hex (128 chars). Absent on coinbase transactions. */
  signature?: string;
}

export interface Block {
  index: number;
  timestamp: number;
  transactions: Transaction[];
  /** The hash of block index-1. This is the "chain" in blockchain. */
  prevHash: string;
  /** Number of leading hex zeros the block hash must have. */
  difficulty: number;
  /** The only field a miner is free to change while searching for a valid hash. */
  nonce: number;
}

export interface Wallet {
  privateKey: string;
  address: Address;
}

/** Why a single block failed validation. Empty means the block is sound. */
export interface BlockValidation {
  index: number;
  hash: string;
  ok: boolean;
  issues: string[];
}

export interface ChainValidation {
  valid: boolean;
  blocks: BlockValidation[];
  /** Index of the earliest broken block, or null if the chain is sound. */
  firstInvalidIndex: number | null;
  /** Balances after replaying every valid block. Empty if the chain is broken. */
  balances: Record<Address, number>;
}
