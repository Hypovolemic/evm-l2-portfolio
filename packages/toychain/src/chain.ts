import type { Address, Block, BlockValidation, ChainValidation, Transaction } from './types.js';
import { COINBASE } from './types.js';
import { hashBlock, meetsDifficulty, mineBlock, createGenesisBlock, type MineResult } from './block.js';
import { verifyTransaction } from './wallet.js';

export const BLOCK_REWARD = 50;
export const DEFAULT_DIFFICULTY = 3;
const ZERO_HASH = '0'.repeat(64);

export type SubmitResult = { ok: true } | { ok: false; error: string };

export class Blockchain {
  blocks: Block[];
  mempool: Transaction[] = [];
  difficulty: number;

  constructor(difficulty: number = DEFAULT_DIFFICULTY) {
    this.difficulty = difficulty;
    this.blocks = [createGenesisBlock(difficulty)];
  }

  get latestBlock(): Block {
    return this.blocks[this.blocks.length - 1];
  }

  get height(): number {
    return this.blocks.length;
  }

  /**
   * Balances are not stored anywhere. They are derived by replaying every
   * transaction in every block from genesis.
   *
   * This is the whole reason tampering is detectable: there is no balance field
   * to edit. To give yourself money you have to alter a transaction, and altering
   * a transaction breaks its signature and the block hash that commits to it.
   */
  balances(upToIndex = this.blocks.length - 1): Record<Address, number> {
    const balances: Record<Address, number> = {};
    for (let i = 0; i <= upToIndex && i < this.blocks.length; i++) {
      for (const tx of this.blocks[i].transactions) {
        if (tx.from !== COINBASE) {
          balances[tx.from] = (balances[tx.from] ?? 0) - tx.amount;
        }
        balances[tx.to] = (balances[tx.to] ?? 0) + tx.amount;
      }
    }
    return balances;
  }

  balanceOf(address: Address): number {
    return this.balances()[address] ?? 0;
  }

  /** Confirmed balance minus everything this address has already queued. */
  spendableBalance(address: Address): number {
    const pending = this.mempool
      .filter((tx) => tx.from === address)
      .reduce((sum, tx) => sum + tx.amount, 0);
    return this.balanceOf(address) - pending;
  }

  /** The nonce the next transaction from this address must carry. */
  nextNonce(address: Address): number {
    let count = 0;
    for (const block of this.blocks) {
      for (const tx of block.transactions) {
        if (tx.from === address) count++;
      }
    }
    return count + this.mempool.filter((tx) => tx.from === address).length;
  }

  /**
   * Mempool admission. Every check here is repeated during chain validation --
   * this is a fast path to reject junk, never the thing that makes the chain safe.
   */
  addTransaction(tx: Transaction): SubmitResult {
    if (tx.from === COINBASE) {
      return { ok: false, error: 'coinbase transactions are created by mining, not submitted' };
    }
    if (!Number.isFinite(tx.amount) || tx.amount <= 0) {
      return { ok: false, error: 'amount must be a positive number' };
    }
    if (!verifyTransaction(tx)) {
      return { ok: false, error: 'invalid signature: this transaction was not signed by the sender' };
    }

    const expectedNonce = this.nextNonce(tx.from);
    if (tx.nonce !== expectedNonce) {
      return { ok: false, error: `wrong nonce: expected ${expectedNonce}, got ${tx.nonce}` };
    }

    const spendable = this.spendableBalance(tx.from);
    if (tx.amount > spendable) {
      return { ok: false, error: `insufficient funds: spendable ${spendable}, tried to send ${tx.amount}` };
    }

    this.mempool.push(tx);
    return { ok: true };
  }

  /** Drain the mempool into a freshly mined block paying the reward to `miner`. */
  mine(miner: Address): MineResult {
    const coinbase: Transaction = { from: COINBASE, to: miner, amount: BLOCK_REWARD, nonce: 0 };
    const result = mineBlock({
      index: this.blocks.length,
      timestamp: Date.now(),
      transactions: [coinbase, ...this.mempool],
      prevHash: hashBlock(this.latestBlock),
      difficulty: this.difficulty,
      nonce: 0,
    });

    this.blocks.push(result.block);
    this.mempool = [];
    return result;
  }

  /**
   * Redo the work for one block: relink it to its parent's current hash, then
   * search for a nonce that satisfies the target again.
   *
   * This is the attacker's move, and running it is the cheapest way to feel why
   * rewriting history does not scale. Repairing one block leaves the next one
   * pointing at a hash that no longer exists, so the attacker has to redo this
   * for every block from the edit to the tip -- while honest miners keep
   * extending the tip they are trying to catch.
   */
  remineBlock(index: number): MineResult {
    const block = this.blocks[index];
    if (!block) throw new RangeError(`no block at index ${index}`);

    const relinked: Block =
      index === 0 ? block : { ...block, prevHash: hashBlock(this.blocks[index - 1]) };

    const result = mineBlock(relinked);
    this.blocks[index] = result.block;
    return result;
  }

  /**
   * Validate every block, in order.
   *
   * Once a block fails, every block after it is reported invalid too. That is not
   * a display convenience -- a block is only as trustworthy as its ancestry, so a
   * block descending from a broken one is not part of a valid chain regardless of
   * how well formed it is on its own.
   */
  validate(): ChainValidation {
    const results: BlockValidation[] = [];
    const runningBalances: Record<Address, number> = {};
    const nonceSeen: Record<Address, number> = {};
    let firstInvalidIndex: number | null = null;

    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i];
      const hash = hashBlock(block);

      if (firstInvalidIndex !== null) {
        results.push({
          index: i,
          hash,
          ok: false,
          issues: [`descends from invalid block ${firstInvalidIndex}`],
        });
        continue;
      }

      const issues: string[] = [];

      if (block.index !== i) {
        issues.push(`block claims index ${block.index} but sits at position ${i}`);
      }

      if (i === 0) {
        if (block.prevHash !== ZERO_HASH) {
          issues.push('genesis block must point at the zero hash');
        }
      } else if (block.prevHash !== hashBlock(this.blocks[i - 1])) {
        issues.push(`prevHash does not match the hash of block ${i - 1}`);
      }

      if (!meetsDifficulty(hash, block.difficulty)) {
        issues.push(`proof of work not satisfied: hash needs ${block.difficulty} leading zeros`);
      }

      const coinbases = block.transactions.filter((tx) => tx.from === COINBASE);
      if (coinbases.length > 1) {
        issues.push('more than one coinbase transaction');
      }
      if (coinbases.length === 1) {
        if (block.transactions[0].from !== COINBASE) {
          issues.push('coinbase transaction must come first');
        }
        if (coinbases[0].amount !== BLOCK_REWARD) {
          issues.push(`coinbase pays ${coinbases[0].amount}, block reward is ${BLOCK_REWARD}`);
        }
      }

      for (const [position, tx] of block.transactions.entries()) {
        if (!verifyTransaction(tx)) {
          issues.push(`transaction ${position} has an invalid signature`);
          continue;
        }

        if (tx.from === COINBASE) {
          runningBalances[tx.to] = (runningBalances[tx.to] ?? 0) + tx.amount;
          continue;
        }

        const expectedNonce = nonceSeen[tx.from] ?? 0;
        if (tx.nonce !== expectedNonce) {
          issues.push(`transaction ${position} has nonce ${tx.nonce}, expected ${expectedNonce}`);
        }

        const available = runningBalances[tx.from] ?? 0;
        if (tx.amount > available) {
          issues.push(`transaction ${position} overspends: balance ${available}, sending ${tx.amount}`);
        }

        runningBalances[tx.from] = available - tx.amount;
        runningBalances[tx.to] = (runningBalances[tx.to] ?? 0) + tx.amount;
        nonceSeen[tx.from] = expectedNonce + 1;
      }

      const ok = issues.length === 0;
      if (!ok) firstInvalidIndex = i;
      results.push({ index: i, hash, ok, issues });
    }

    return {
      valid: firstInvalidIndex === null,
      blocks: results,
      firstInvalidIndex,
      balances: firstInvalidIndex === null ? runningBalances : {},
    };
  }

  toJSON(): { blocks: Block[]; mempool: Transaction[]; difficulty: number } {
    return { blocks: this.blocks, mempool: this.mempool, difficulty: this.difficulty };
  }

  static fromJSON(data: { blocks: Block[]; mempool: Transaction[]; difficulty: number }): Blockchain {
    const chain = new Blockchain(data.difficulty);
    chain.blocks = data.blocks;
    chain.mempool = data.mempool;
    return chain;
  }
}
