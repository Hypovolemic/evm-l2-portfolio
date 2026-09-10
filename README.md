# evm-l2-portfolio

Twelve build artefacts from a 12-week programme in Ethereum smart contract development,
each one harder than the last. Every week ends with something a stranger can open and use.

**Live site:** https://hypovolemic.github.io/evm-l2-portfolio/

| Wk | Deliverable | Type | Status |
| --- | --- | --- | --- |
| 1 | [Toy blockchain with browser visualiser](https://hypovolemic.github.io/evm-l2-portfolio/w01/) | Live URL + repo | ✅ |
| 2 | Transaction decoder CLI and anatomy write-up | Repo + post | — |
| 3 | Four verified contracts, published gallery | Live URL + Etherscan | — |
| 4 | Foundry suite with CI, plus "A bug my tests found" | Repo + post | — |
| 5 | Token suite (ERC-20, 721, 4626) | Deployed + post | — |
| 6 | Staking protocol and "Draining my own contract" | Deployed + post | — |
| 7 | Live staking dApp | Live URL + video | — |
| 8 | dApp with oracle, indexer, allowlist | Live URL + post | — |
| 9 | AMM with swap interface on L2 | Live URL + post | — |
| 10 | Security write-up series | Post series + repo | — |
| 11 | Capstone specification and threat model | Docs + deployed | — |
| 12 | Complete capstone with audit report | Live URL + report + video | — |

---

## Week 1: A blockchain you can break

**[Open the live demo →](https://hypovolemic.github.io/evm-l2-portfolio/w01/)**

A blockchain implemented from scratch in TypeScript, with a browser interface that lets
you mine blocks, sign and submit transactions, and then **edit a block that has already
been mined** and watch every block after it stop being valid.

What it implements:

- **SHA-256 hash chaining** — each block commits to the hash of the one before it
- **Proof of work** with adjustable difficulty (leading hex zeros in the block hash)
- **secp256k1 ECDSA signatures** — transactions are signed, and invalid signatures are rejected
- **Merkle roots** over each block's transactions, with inclusion proofs and verification
- **A mempool** of pending transactions, drained into the next mined block
- **Balances derived by replay**, never stored — overspends and replayed nonces are rejected
- **`validate()`** — recomputes every hash, checks every link, every signature, every balance

```
packages/toychain/          the chain itself, 55 unit tests
apps/w01-chain-visualiser/  the browser interface, 10 DOM tests
```

### Running it

```bash
pnpm install
pnpm test          # 65 tests across both packages
pnpm dev:w01       # http://localhost:5173
```

### The thing worth trying

Mine three blocks, then change an amount inside block 1. The block turns red: the
signature no longer covers that amount, and the proof of work no longer holds. Every
later block turns red with it.

Now press **Re-mine** on the block you edited. It goes green — and the chain is *still*
broken, because block 2 still points at the hash block 1 used to have. You have to redo
the work for block 2, then block 3, then every block to the tip. That is the entire
security argument, and it is more convincing after you have clicked the button.

---

## What this does not do

This is a teaching artefact. It demonstrates the mechanics of hashing, signing, and
chaining, and it deliberately omits almost everything that makes a real blockchain hard.

**Networking — there isn't any.**
Everything runs in one browser tab. There is no peer discovery, no gossip protocol, no
transaction propagation, no block relay, and no handling of the fact that in a real
network every participant sees a slightly different, slightly stale picture of the world.
Nearly all of distributed systems engineering lives in the gap this omits.

**Consensus among many nodes — there is only one node.**
With a single node there is no disagreement to resolve. There are no forks, no
reorganisations, no fork-choice rule, no orphaned blocks, and no notion of finality,
probabilistic or otherwise. The chain here is valid or invalid; a real chain is one
candidate history among several that participants are still converging on. This is why
"the transaction confirmed" means something weaker on a real chain than it looks like it
means here.

**Economic incentives**
Proof of work is only a security mechanism because the electricity is real and the reward
is worth more than the cost of behaving honestly. Here, mining costs a few milliseconds of
somebody's laptop. There is no fee market, no difficulty retargeting as hash power
changes, no halving schedule, no block size limit, and no reason for a miner to prefer one
transaction over another. Nothing here would resist an attacker who simply cared.

**Cryptography and encoding shortcuts.**
Addresses are raw compressed public keys rather than hashes of them, so there is no
protection against a future break in the elliptic curve and no address checksum. Signature
malleability is not handled. The Merkle tree duplicates its last node on odd levels, which
is the construction behind Bitcoin's CVE-2012-2459. Serialisation is sorted JSON rather
than a compact binary encoding.

**State and scale.**
Balances are recomputed by replaying the entire chain on every single validation. That is
O(chain length) per check and would be unusable past a few thousand blocks; real clients
keep an incrementally updated state trie. There is no state root in the block header, so a
light client could not verify a balance without the full chain.

**Persistence.**
The chain lives in memory and resets on refresh. Only the keypair is kept, in
`localStorage`.

---

## Repository layout

```
apps/          deployable frontends (the "live URL" artefacts)
packages/      libraries and CLIs
docs/          write-ups, weekly defences, and the published site index
contracts/     Foundry project (from Week 4)
security/      exploits and static-analysis triage (Week 10)
capstone/      Weeks 11-12
```

See [CLAUDE.md](./CLAUDE.md) for the full plan, conventions, and per-week structure.

## Licence

MIT — see [LICENSE](./LICENSE).
