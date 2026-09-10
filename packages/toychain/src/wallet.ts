import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import type { Address, Transaction, Wallet } from './types.js';
import { COINBASE } from './types.js';
import { canonical, digestBytes } from './hash.js';

/**
 * A keypair. The private key is 32 random bytes -- that is the whole ceremony.
 * There is no registration step and nobody is told the account exists, which is
 * why an address can receive value before anyone has ever signed with it.
 */
export function createWallet(): Wallet {
  const privateKey = secp256k1.utils.randomSecretKey();
  return {
    privateKey: bytesToHex(privateKey),
    address: bytesToHex(secp256k1.getPublicKey(privateKey, true)),
  };
}

export function addressFromPrivateKey(privateKeyHex: string): Address {
  return bytesToHex(secp256k1.getPublicKey(hexToBytes(privateKeyHex), true));
}

/**
 * What actually gets signed.
 *
 * The signature itself is excluded, or signing would have to sign itself. Every
 * other field is included, which is what makes the signature a commitment to
 * *this* transfer: change the amount by one unit afterwards and the digest no
 * longer matches the signature.
 */
export function transactionDigest(tx: Transaction): Uint8Array {
  const { from, to, amount, nonce } = tx;
  return digestBytes(canonical({ from, to, amount, nonce }));
}

/** Returns a copy of the transaction with a signature attached. */
export function signTransaction(tx: Transaction, privateKeyHex: string): Transaction {
  const signature = secp256k1
    .sign(transactionDigest(tx), hexToBytes(privateKeyHex))
    .toCompactHex();
  return { ...tx, signature };
}

/**
 * A signature is valid only against the exact bytes that were signed and the
 * public key of the claimed sender. Both halves matter: a valid signature from
 * the wrong key, or a valid key over the wrong digest, both fail here.
 */
export function verifyTransaction(tx: Transaction): boolean {
  // Coinbase transactions are unsigned by construction. They are constrained by
  // the consensus rules in chain.ts instead -- one per block, fixed amount.
  if (tx.from === COINBASE) return tx.signature === undefined;
  if (!tx.signature) return false;

  try {
    return secp256k1.verify(hexToBytes(tx.signature), transactionDigest(tx), hexToBytes(tx.from));
  } catch {
    // Malformed signature or public key hex.
    return false;
  }
}

/** Short form for display. Never use a truncated address for anything else. */
export function shortAddress(address: string): string {
  if (address === COINBASE) return 'COINBASE';
  return address.length <= 14 ? address : `${address.slice(0, 8)}...${address.slice(-4)}`;
}
