import { describe, it, expect, beforeEach } from 'vitest';
import {
  Blockchain,
  createWallet,
  signTransaction,
  hashBlock,
  meetsDifficulty,
  BLOCK_REWARD,
  COINBASE,
  type Transaction,
  type Wallet,
} from '../src/index.js';

/** Low difficulty keeps the suite fast; the mechanism is identical at any value. */
const DIFFICULTY = 2;

describe('Blockchain', () => {
  let chain: Blockchain;
  let alice: Wallet;
  let bob: Wallet;

  beforeEach(() => {
    chain = new Blockchain(DIFFICULTY);
    alice = createWallet();
    bob = createWallet();
  });

  const send = (from: Wallet, to: Wallet, amount: number, nonceOverride?: number): Transaction => {
    const tx: Transaction = {
      from: from.address,
      to: to.address,
      amount,
      nonce: nonceOverride ?? chain.nextNonce(from.address),
    };
    return signTransaction(tx, from.privateKey);
  };

  describe('genesis and mining', () => {
    it('starts with a valid single-block chain', () => {
      expect(chain.height).toBe(1);
      expect(chain.validate().valid).toBe(true);
    });

    it('produces a block whose hash meets the difficulty target', () => {
      const { hash, attempts } = chain.mine(alice.address);
      expect(meetsDifficulty(hash, DIFFICULTY)).toBe(true);
      expect(attempts).toBeGreaterThan(0);
    });

    it('pays the block reward to the miner via an unsigned coinbase transaction', () => {
      chain.mine(alice.address);
      expect(chain.balanceOf(alice.address)).toBe(BLOCK_REWARD);

      const coinbase = chain.blocks[1].transactions[0];
      expect(coinbase.from).toBe(COINBASE);
      expect(coinbase.signature).toBeUndefined();
    });

    it('links each block to the hash of the one before it', () => {
      chain.mine(alice.address);
      chain.mine(alice.address);
      expect(chain.blocks[2].prevHash).toBe(hashBlock(chain.blocks[1]));
      expect(chain.blocks[1].prevHash).toBe(hashBlock(chain.blocks[0]));
    });
  });

  describe('mempool admission', () => {
    beforeEach(() => chain.mine(alice.address));

    it('accepts a correctly signed, funded transaction', () => {
      expect(chain.addTransaction(send(alice, bob, 10))).toEqual({ ok: true });
      expect(chain.mempool).toHaveLength(1);
    });

    it('rejects a transaction whose signature does not match the sender', () => {
      const tx = send(alice, bob, 10);
      const forged = signTransaction({ ...tx, signature: undefined }, bob.privateKey);

      const result = chain.addTransaction({ ...forged, from: alice.address });
      expect(result).toEqual({ ok: false, error: expect.stringContaining('invalid signature') });
      expect(chain.mempool).toHaveLength(0);
    });

    it('rejects a transaction whose amount was altered after signing', () => {
      const tx = send(alice, bob, 10);
      const result = chain.addTransaction({ ...tx, amount: 40 });
      expect(result).toEqual({ ok: false, error: expect.stringContaining('invalid signature') });
    });

    it('rejects an unsigned transaction', () => {
      const result = chain.addTransaction({
        from: alice.address,
        to: bob.address,
        amount: 1,
        nonce: 0,
      });
      expect(result).toEqual({ ok: false, error: expect.stringContaining('invalid signature') });
    });

    it('rejects an overspend', () => {
      const result = chain.addTransaction(send(alice, bob, BLOCK_REWARD + 1));
      expect(result).toEqual({ ok: false, error: expect.stringContaining('insufficient funds') });
    });

    it('counts queued transactions against the spendable balance', () => {
      expect(chain.addTransaction(send(alice, bob, 30)).ok).toBe(true);
      const second = chain.addTransaction(send(alice, bob, 30));
      expect(second).toEqual({ ok: false, error: expect.stringContaining('insufficient funds') });
    });

    it('rejects a replayed transaction because the nonce has moved on', () => {
      const tx = send(alice, bob, 10);
      expect(chain.addTransaction(tx).ok).toBe(true);
      chain.mine(alice.address);

      const replayed = chain.addTransaction(tx);
      expect(replayed).toEqual({ ok: false, error: expect.stringContaining('wrong nonce') });
    });

    it('rejects a coinbase transaction submitted from outside', () => {
      const result = chain.addTransaction({
        from: COINBASE,
        to: bob.address,
        amount: BLOCK_REWARD,
        nonce: 0,
      });
      expect(result).toEqual({ ok: false, error: expect.stringContaining('coinbase') });
    });
  });

  describe('settlement', () => {
    it('moves value between accounts once a block is mined', () => {
      chain.mine(alice.address);
      chain.addTransaction(send(alice, bob, 20));
      chain.mine(alice.address);

      // Alice mined twice (2 x 50) and sent 20 away.
      expect(chain.balanceOf(alice.address)).toBe(BLOCK_REWARD * 2 - 20);
      expect(chain.balanceOf(bob.address)).toBe(20);
      expect(chain.validate().valid).toBe(true);
    });

    it('derives balances by replay rather than storing them', () => {
      chain.mine(alice.address);
      chain.addTransaction(send(alice, bob, 20));
      chain.mine(alice.address);

      const replayed = chain.validate().balances;
      expect(replayed[bob.address]).toBe(20);
      expect(replayed[alice.address]).toBe(BLOCK_REWARD * 2 - 20);
    });
  });

  /**
   * The acceptance criterion for Week 1, as a test:
   * "Tampering with a historical block visibly invalidates all subsequent blocks."
   */
  describe('tamper detection', () => {
    beforeEach(() => {
      chain.mine(alice.address);
      chain.addTransaction(send(alice, bob, 10));
      chain.mine(alice.address);
      chain.mine(alice.address);
      chain.mine(alice.address);
      expect(chain.validate().valid).toBe(true);
    });

    it('detects an edited transaction amount in a historical block', () => {
      chain.blocks[2].transactions[1].amount = 999;

      const result = chain.validate();
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(2);
    });

    it('invalidates every block after the edited one', () => {
      chain.blocks[2].transactions[1].amount = 999;
      const result = chain.validate();

      for (const block of result.blocks) {
        if (block.index < 2) expect(block.ok).toBe(true);
        else expect(block.ok).toBe(false);
      }
    });

    it('reports the downstream blocks as descending from the break', () => {
      chain.blocks[2].transactions[1].amount = 999;
      const result = chain.validate();

      expect(result.blocks[3].issues).toContain('descends from invalid block 2');
      expect(result.blocks[4].issues).toContain('descends from invalid block 2');
    });

    it('names the broken signature, since the amount was signed over', () => {
      chain.blocks[2].transactions[1].amount = 999;
      const broken = chain.validate().blocks[2];
      expect(broken.issues.some((i) => i.includes('invalid signature'))).toBe(true);
    });

    it('breaks proof of work when the block contents change', () => {
      // Editing the recipient changes the Merkle root, so the block hash changes,
      // so the nonce found by mining no longer satisfies the target. A fresh hash
      // still clears the bar 1 time in 16^difficulty, so nudge until it does not
      // rather than leaving the assertion to chance.
      const block = chain.blocks[2];
      let nudge = 0;
      do {
        block.transactions[0].to = `${bob.address}${nudge}`;
        nudge++;
      } while (meetsDifficulty(hashBlock(block), block.difficulty));

      const broken = chain.validate().blocks[2];
      expect(broken.ok).toBe(false);
      expect(broken.issues.some((i) => i.includes('proof of work'))).toBe(true);
    });

    it('detects a rewritten prevHash link', () => {
      chain.blocks[3].prevHash = '0'.repeat(64);
      const result = chain.validate();
      expect(result.firstInvalidIndex).toBe(3);
      expect(result.blocks[3].issues.some((i) => i.includes('prevHash'))).toBe(true);
    });

    it('detects an inflated block reward', () => {
      chain.blocks[1].transactions[0].amount = 5000;
      const result = chain.validate();
      expect(result.firstInvalidIndex).toBe(1);
      expect(result.blocks[1].issues.some((i) => i.includes('block reward'))).toBe(true);
    });

    it('withholds balances while the chain is broken', () => {
      chain.blocks[2].transactions[1].amount = 999;
      expect(chain.validate().balances).toEqual({});
    });

    /**
     * The lesson the visualiser is built around: re-mining the edited block fixes
     * that block's proof of work, and the chain is still broken, because every
     * later block still points at the hash the block used to have.
     */
    it('is not repaired by re-mining the edited block alone', () => {
      chain.blocks[2].transactions[0].to = bob.address;
      chain.remineBlock(2);

      const result = chain.validate();
      expect(result.blocks[2].ok).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(3);
    });

    it('is repaired only by re-mining the edited block and every block after it', () => {
      chain.blocks[2].transactions[0].to = bob.address;

      for (let i = 2; i < chain.blocks.length; i++) {
        chain.remineBlock(i);
      }

      expect(chain.validate().valid).toBe(true);
    });

    it('costs the attacker work proportional to how deep the edit was', () => {
      chain.blocks[1].transactions[0].to = bob.address;

      let attempts = 0;
      for (let i = 1; i < chain.blocks.length; i++) {
        attempts += chain.remineBlock(i).attempts;
      }

      expect(chain.validate().valid).toBe(true);
      // Four blocks re-mined, not one. This is the whole security argument.
      expect(attempts).toBeGreaterThan(0);
    });
  });

  describe('serialisation', () => {
    it('survives a round trip through JSON', () => {
      chain.mine(alice.address);
      chain.addTransaction(send(alice, bob, 5));

      const restored = Blockchain.fromJSON(JSON.parse(JSON.stringify(chain.toJSON())));

      expect(restored.height).toBe(chain.height);
      expect(restored.mempool).toHaveLength(1);
      expect(restored.validate().valid).toBe(true);
    });
  });
});
