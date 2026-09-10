# Week 1 defence — Blockchain mechanics

**Artefact:** [Toy blockchain with browser visualiser](https://hypovolemic.github.io/evm-l2-portfolio/w01/)
**Code:** `packages/toychain`, `apps/w01-chain-visualiser`
**Recorded:** _(link the 5–10 minute walkthrough here)_

The rule for the recording: screen and voice, no assistant open, walk the code, answer
the self-check aloud, and name two things I got wrong first.

---

## 1. The self-check, answered

> Explain to someone non-technical why a past block cannot be quietly edited, without
> using the word "immutable".

Every block carries a fingerprint of the block before it. Change anything in an old
block — one number in one payment — and that block's own fingerprint changes, because the
fingerprint is calculated from the contents. The next block is now holding a fingerprint
that matches nothing. So is every block after that.

To cover it up you would have to redo the fingerprint for the block you edited, then the
one after it, and so on to the present. That would be easy, except that a valid
fingerprint is deliberately hard to find: the system only accepts fingerprints that
start with a run of zeros, and the only way to find one is to try over and over until
you get lucky. That is the cost. And while you are grinding through the whole history,
everyone else is still adding new blocks to the front, so the gap you are trying to close
keeps getting wider.

So it is not that editing is forbidden. It is that editing is *loud* — anyone can check
in a fraction of a second — and catching up is a race against everyone else combined.

**The version to use if they push back:** the demo makes this concrete. Edit a block,
press Re-mine, and watch it go green while the chain stays broken. That is the moment
the argument stops being abstract.

---

## 2. What I should be able to explain without notes

### Cryptographic hashing

A hash function takes any input and returns a fixed-size fingerprint — SHA-256 returns 32
bytes, written as 64 hex characters. The properties that matter here:

- **Deterministic** — same input, same output, every time and on every machine.
- **Avalanche** — change one character and the output is completely different, not
  slightly different. There's a test asserting this (`crypto.test.ts`): two inputs one
  character apart share fewer than 8 hex characters of prefix.
- **One-way** — given a hash there is no way to work backwards to the input other than
  guessing. This is what makes mining work at all.
- **Collision-resistant** — nobody can find two inputs with the same hash.

*Why the code sorts JSON keys before hashing:* `{a:1,b:2}` and `{b:2,a:1}` are the same
value but different strings, and would hash differently. Hashing is only useful if the
same logical value always produces the same bytes. Real chains use a fixed binary
encoding — RLP on Ethereum — for the same reason.

### Digital signatures (ECDSA / secp256k1)

A private key is 32 random bytes. That's the entire account-creation ceremony — no
registration, nobody is told the account exists. The public key is derived from it, and
the signature proves the holder of the private key approved *these exact bytes* without
ever revealing the key.

What gets signed here is a digest of `{from, to, amount, nonce}` — everything except the
signature itself. That's what makes the signature a commitment to *this* transfer: change
the amount by one after signing and the digest no longer matches. There are tests for
each field (`crypto.test.ts`).

Two failure modes worth naming because they're distinct: a valid signature from the wrong
key, and a valid key over the wrong digest. Both are rejected, and the demo has a
checkbox that produces the first one deliberately.

*The nonce* is a per-sender counter. Without it, two identical payments would be
byte-identical, so a signed transaction could be copied off the chain and replayed.
Ethereum's account nonce does exactly this job.

### Hash chaining and Merkle trees

Each block stores `prevHash`. The block's own hash is computed over the header only —
index, timestamp, Merkle root, prevHash, difficulty, nonce — not over the transaction list
directly. The transactions enter through the Merkle root.

*Why that matters:* the header stays a fixed small size no matter how many transactions
the block carries, while still committing to every one of them. And it lets a light client
be shown that one transaction is in a block without downloading the other thousand — that
is the inclusion proof, implemented in `merkle.ts` and tested for every leaf position
across block sizes 1 to 9.

*The flaw I left in on purpose:* an odd level duplicates its last element. That is the
textbook construction and it is also the root of Bitcoin's CVE-2012-2459. It's noted in
the code comment.

### Proof of work

The block hash must start with `difficulty` hex zeros. There is no way to work backwards
from a target hash to the input that produces it, so the only strategy is to change the
nonce and try again. At difficulty *d* the expected number of attempts is 16^*d*.

That is the whole of proof of work: it converts "rewriting history" from a computation
into a cost. The visualiser prints the attempt count for each block so the cost is visible
rather than asserted.

### Why balances aren't stored

There is no balance field anywhere. Balances are derived by replaying every transaction
from genesis. This is deliberate and it's the reason tampering is detectable at all: to
give yourself money you have to alter a transaction, and altering a transaction breaks its
signature *and* the block hash that commits to it.

*The cost:* it's O(chain length) on every validation and would be unusable past a few
thousand blocks. Real clients keep an incrementally updated state trie and put its root in
the block header.

### Why every block after a break is also invalid

This is the design decision I most expect to be questioned on, because it looks like a
display trick and isn't.

A chain is only as trustworthy as its ancestry. A block descending from a broken one is
not part of a valid chain regardless of how well-formed it is on its own. So `validate()`
marks the first genuine break, then reports every later block as `descends from invalid
block N`. That is a truthful statement about the chain, not a UI convenience.

### Account model vs UTXO

This implementation uses an **account model**: balances per address, derived by replay.
Bitcoin uses **UTXO** — a transaction spends specific previous outputs, and your "balance"
is the sum of outputs you can spend. Ethereum uses accounts, which is simpler for contracts
(a contract needs a persistent balance and storage) at the cost of needing an explicit
nonce for replay protection, which UTXO gets for free because an output can only be spent
once.

---

## 3. The questions I expect, and my answers

**"What stops me mining a block that pays me 9999 instead of 50?"**
Nothing stops you *building* it — the consensus rule rejects it. `validate()` checks the
coinbase amount against `BLOCK_REWARD`. Try it in the demo: edit block 1's reward and it
goes red with `coinbase pays 9999, block reward is 50`. Re-mining doesn't help, because
re-mining fixes proof of work and this is a different rule.

**"Why is randomness hard on a blockchain?"**
Every node must compute the same result from the same inputs or they'd disagree about the
state. So there is no source of local entropy available — no `Math.random()`, no clock you
can trust. Anything derivable from the block header is also known to, or influenceable by,
the miner producing that block. This is why Week 8 needs Chainlink VRF.

**"Why is storage expensive on Ethereum?"**
Every node stores the state forever, and you pay once. It's the one resource where the
cost is borne by everyone in perpetuity. Week 1 makes the shape of this visible: balances
are recomputed from the whole chain because there is no state trie.

**"What's a reorg and could it happen here?"**
Not here — one node, so no competing chains. On a real network two miners can find blocks
at nearly the same time and different participants briefly accept different tips; the
shorter branch is discarded and its transactions return to the mempool. This is why
"confirmed" is probabilistic and why exchanges wait for several blocks.

**"Is this secure?"**
No, and it isn't trying to be. See *What this does not do* in the README — no networking,
no multi-node consensus, no economic incentives. Mining costs milliseconds, so any
attacker who actually cared could rewrite the entire chain.

---

## 4. Two things I got wrong first

**1. I wrote a test asserting that re-mining an edited block moves the break to the next
block, and it failed.** I had edited the coinbase *amount*, which violates the block-reward
consensus rule — and re-mining only redoes proof of work, so the block stayed invalid for a
reason mining can't fix. The fix was to understand that these are two independent classes
of invalidity: a broken hash (re-mineable) and a broken rule (not). Editing the coinbase
*recipient* breaks only the hash, and that's the case that demonstrates the cascade.

**2. My first `remineBlock` didn't relink `prevHash`, so clicking Re-mine could never
repair the chain at all.** That made the demo's central lesson impossible to reach. Real
attackers relink as they go — that's what rewriting history *means* — so `remineBlock` now
relinks to its parent's current hash and then mines. The lesson survived and got sharper:
you can repair it, block by block, and the cost is one full re-mine per block from the edit
to the tip.

There was also a **1-in-4096 flake** in a test that assumed changing a block's contents
would always break proof of work. A fresh hash still clears the target 1 time in
16^difficulty. The test now nudges the input until the hash genuinely misses, rather than
leaving the assertion to chance.

---

## 5. Honest gaps

- I did not build the stretch goal (two nodes gossiping over websockets, fork resolution
  by longest chain). It needs a server and the acceptance criterion is a static URL. This
  means **I have no hands-on feel for fork choice** — the weakest part of my Week 1
  understanding, and the part Week 2's reorg discussion will land on.
- I have read the Bitcoin whitepaper but have not implemented difficulty retargeting, so
  my understanding of how a network holds a 10-minute block time is theoretical.
- The elliptic curve maths under ECDSA is a black box to me. I can explain what a
  signature proves and what breaks it; I cannot explain *why* secp256k1 works.
