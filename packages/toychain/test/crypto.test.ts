import { describe, it, expect } from 'vitest';
import {
  canonical,
  hashValue,
  createWallet,
  addressFromPrivateKey,
  signTransaction,
  verifyTransaction,
  merkleRoot,
  merkleProof,
  verifyMerkleProof,
  txHash,
  COINBASE,
  type Transaction,
} from '../src/index.js';

describe('canonical serialisation', () => {
  it('is independent of key insertion order', () => {
    expect(canonical({ a: 1, b: 2 })).toBe(canonical({ b: 2, a: 1 }));
  });

  it('gives the same hash for the same logical value', () => {
    expect(hashValue({ to: 'x', amount: 1 })).toBe(hashValue({ amount: 1, to: 'x' }));
  });

  it('distinguishes values that differ', () => {
    expect(hashValue({ amount: 1 })).not.toBe(hashValue({ amount: 2 }));
  });

  it('preserves array order, which is meaningful', () => {
    expect(canonical([1, 2])).not.toBe(canonical([2, 1]));
  });

  it('drops undefined so an unsigned transaction hashes like an absent field', () => {
    expect(canonical({ a: 1, sig: undefined })).toBe(canonical({ a: 1 }));
  });
});

describe('hashing', () => {
  it('produces a 64-character hex digest', () => {
    expect(hashValue('anything')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes completely for a one-character input change (avalanche)', () => {
    const a = hashValue('hello');
    const b = hashValue('hellp');

    let sharedPrefix = 0;
    while (sharedPrefix < a.length && a[sharedPrefix] === b[sharedPrefix]) sharedPrefix++;

    expect(a).not.toBe(b);
    expect(sharedPrefix).toBeLessThan(8);
  });
});

describe('wallets and signatures', () => {
  it('derives a stable address from a private key', () => {
    const wallet = createWallet();
    expect(addressFromPrivateKey(wallet.privateKey)).toBe(wallet.address);
    expect(wallet.address).toMatch(/^0[23][0-9a-f]{64}$/);
  });

  it('generates a different keypair each time', () => {
    expect(createWallet().address).not.toBe(createWallet().address);
  });

  it('verifies a transaction signed by its sender', () => {
    const alice = createWallet();
    const bob = createWallet();
    const tx = signTransaction(
      { from: alice.address, to: bob.address, amount: 5, nonce: 0 },
      alice.privateKey,
    );
    expect(verifyTransaction(tx)).toBe(true);
  });

  it('rejects a signature produced by a different key', () => {
    const alice = createWallet();
    const bob = createWallet();
    const tx = signTransaction(
      { from: alice.address, to: bob.address, amount: 5, nonce: 0 },
      bob.privateKey,
    );
    expect(verifyTransaction(tx)).toBe(false);
  });

  it.each([
    ['amount', { amount: 6 }],
    ['recipient', { to: createWallet().address }],
    ['nonce', { nonce: 1 }],
  ])('rejects a transaction whose %s changed after signing', (_field, patch) => {
    const alice = createWallet();
    const bob = createWallet();
    const tx = signTransaction(
      { from: alice.address, to: bob.address, amount: 5, nonce: 0 },
      alice.privateKey,
    );
    expect(verifyTransaction({ ...tx, ...patch } as Transaction)).toBe(false);
  });

  it('rejects an unsigned transaction', () => {
    const alice = createWallet();
    expect(verifyTransaction({ from: alice.address, to: alice.address, amount: 1, nonce: 0 })).toBe(false);
  });

  it('rejects malformed signature hex without throwing', () => {
    const alice = createWallet();
    const tx: Transaction = {
      from: alice.address,
      to: alice.address,
      amount: 1,
      nonce: 0,
      signature: 'not-a-signature',
    };
    expect(verifyTransaction(tx)).toBe(false);
  });

  it('accepts an unsigned coinbase but rejects a signed one', () => {
    const alice = createWallet();
    const coinbase: Transaction = { from: COINBASE, to: alice.address, amount: 50, nonce: 0 };
    expect(verifyTransaction(coinbase)).toBe(true);
    expect(verifyTransaction({ ...coinbase, signature: 'ab'.repeat(64) })).toBe(false);
  });
});

describe('merkle tree', () => {
  const tx = (amount: number): Transaction => ({ from: 'a', to: 'b', amount, nonce: 0 });

  it('returns the zero root for an empty block', () => {
    expect(merkleRoot([])).toBe('0'.repeat(64));
  });

  it('changes when any transaction changes', () => {
    const before = merkleRoot([tx(1), tx(2), tx(3)]);
    const after = merkleRoot([tx(1), tx(99), tx(3)]);
    expect(before).not.toBe(after);
  });

  it('changes when transactions are reordered', () => {
    expect(merkleRoot([tx(1), tx(2)])).not.toBe(merkleRoot([tx(2), tx(1)]));
  });

  it.each([1, 2, 3, 4, 5, 8, 9])('proves inclusion of every leaf in a %i-transaction block', (size) => {
    const txs = Array.from({ length: size }, (_, i) => tx(i + 1));
    const root = merkleRoot(txs);

    for (let i = 0; i < size; i++) {
      expect(verifyMerkleProof(txHash(txs[i]), merkleProof(txs, i), root)).toBe(true);
    }
  });

  it('fails to prove a transaction that is not in the block', () => {
    const txs = [tx(1), tx(2), tx(3), tx(4)];
    const root = merkleRoot(txs);
    expect(verifyMerkleProof(txHash(tx(999)), merkleProof(txs, 0), root)).toBe(false);
  });

  it('rejects an out-of-range index', () => {
    expect(() => merkleProof([tx(1)], 5)).toThrow(RangeError);
  });
});
