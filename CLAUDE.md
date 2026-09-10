# CLAUDE.md

Project context for the **EVM Developer Programme** (v2.1, August 2026) — a 12-week self-directed
programme producing 12 public showcase artefacts and one audited capstone.

- Source document: `~/Documents/nus-blockchain/EVM-Developer-Programme.pdf`
- Repository: https://github.com/Hypovolemic/evm-l2-portfolio — **public**, as the programme requires
- Plan also published to Notion: [EVM Developer Programme — Build Plan](https://app.notion.com/p/3d77efe10a0b81d1a3edd6bb96bf4bd3)

The programme's governing principle: **every week ends with something that can be shown to another
person** — a deployed contract, a live URL, a published write-up, or a repo with passing tests. Not
notes, not a finished video course. Keep that standard when helping with any week's work.

---

## 1. Repository shape: one repo, not twelve

The weeks are not independent. Three threads run the length of the programme and each week hands its
output to a later one:

- **Contract thread** — Week 3's four contracts are *ported* into Foundry in Week 4; Week 5 supplies
  the token; Week 6 assembles them into a staking protocol; Week 9 adds an AMM.
- **Application thread** — Week 7 builds a frontend *for the Week 6 protocol*; Week 8 extends *that
  same application*; Week 9 adds a swap interface; Week 12 polishes it.
- **Security thread** — Week 10 attacks every contract written in Weeks 3, 5, 6 and 9.

Hence a single repo. Twelve repos would mean copying contracts between them and twelve READMEs each
telling a fragment. The root README indexes twelve live links and tells the whole story, which is the
standard the programme sets: *"you would show this repository to someone hiring for a junior Solidity
position."*

```
W1 ──▶ W2 ──▶ W3 ──▶ W4 ──▶ W5 ──▶ W6 ──┬─▶ W7 ──▶ W8 ──┐
        │            │                   │               ├─▶ W11 ──▶ W12
        └───────────▶┴─▶ W9 ─────────────┴─▶ W10 ────────┘
```

## 2. Target folder structure

Nothing here needs to exist on day one. The tree is the destination; section 4 says when each part
arrives.

```
evm-l2-portfolio/                 # public, one repo, pnpm workspace
├── README.md                     # portfolio index: the 12-row tracker with live links
├── CLAUDE.md                     # this file
├── pnpm-workspace.yaml
├── package.json
├── .env.example                  # committed. .env is not, and never will be
├── .gitignore
├── .gitmodules                   # forge deps (from W4)
├── .github/
│   └── workflows/
│       ├── web.yml               # build + deploy apps/*        (from W1)
│       ├── contracts.yml         # forge test / coverage / fmt  (from W4)
│       └── secrets-scan.yml      # gitleaks on every push       (from W4)
├── docs/
│   ├── defences/                 # week-01.md … week-12.md — the 12 recorded defences
│   ├── writeups/                 # the "post" artefacts (W2, W4, W5, W6, W8, W9, W10, W12)
│   └── decisions/                # short ADRs for choices you will be questioned on
├── apps/
│   ├── w01-chain-visualiser/     # W1 browser UI                → Live URL #1
│   ├── w03-contract-gallery/     # W3 verified-contract gallery → Live URL #2
│   └── dapp/                     # W7 → W8 → W9 → W12: one app that grows
├── packages/
│   ├── toychain/                 # W1 core: blocks, PoW, ECDSA, mempool, validateChain
│   ├── tx-decoder/               # W2 CLI                       → Repo + post
│   └── contracts-sdk/            # generated ABIs + addresses, imported by apps/*
├── contracts/                    # THE Foundry project — W3 sources land here, W4 wraps them
│   ├── foundry.toml
│   ├── src/                      # w03/ w05/ w06/ w09/
│   ├── test/                     # unit + fuzz + invariant, mirrors src/
│   ├── script/                   # deploy + verify, one command
│   └── lib/                      # forge-std, openzeppelin (git submodules)
├── security/                     # W10
│   ├── exploits/                 # working exploits, written as Foundry tests
│   └── triage/                   # slither / aderyn output + reasoned dismissals
└── capstone/                     # W11–W12, its own self-contained system
    ├── spec.md
    ├── threat-model.md
    ├── contracts/                # separate Foundry project
    ├── app/
    └── audit-report.md
```

### Why these choices

| Choice | Reason |
| --- | --- |
| One `contracts/` Foundry project, not one per week | Week 4 says *"port all four Week 3 contracts into a single Foundry project"*, and Weeks 5, 6 and 9 keep adding. One coverage number, one CI job, one gas baseline. |
| Week 3 sources go straight into `contracts/src/w03/` | Week 3 is written in Remix by instruction, but paste each finished contract into the repo as you go. Week 4 then runs `forge init --force` around code already there. |
| `apps/dapp/` is one app, not four | Weeks 7, 8, 9 and 12 all extend the *same* application. Four folders would misrepresent the work and quadruple frontend setup. |
| `capstone/` has its own Foundry project | Week 11 is *"a deployed multi-contract system of your own design"* — it must be auditable on its own, without earlier coursework in the same `src/`. |
| `packages/contracts-sdk/` | Generated ABIs and addresses in one place, so `apps/dapp` never hardcodes an address and W9's three-chain deployment is a config change. |
| `docs/defences/` in the repo | Week 12 requires *"All 12 weekly defences published"*. Writing them next to the code from Week 1 avoids reconstructing eleven of them in Week 12. |

## 3. Working conventions

### Branches

One branch per unit of work, namespaced by week:

```
week-01/toy-blockchain
week-01/browser-visualiser      # if splitting build from UI
week-04/foundry-port
week-04/ci-and-keystore
week-08/oracle
week-08/indexer
```

The `week-NN/` prefix groups in GitHub's branch list. It matters from Week 4 onward, where one week
needs several branches (Foundry port, CI, keystore migration are separable).

Open a PR into `main` even working alone, and squash merge. The PR diff is the review surface posted
to the Cyfrin Discord for the once-per-phase external review the programme requires, and a clean
squashed `main` is what a hiring reader scrolls.

### Tags

Tag the commit at which each artefact goes public: `w01-showcase`, `w02-showcase`, … Gives every
deliverable a permanent link even after later weeks change the code around it.

### Secrets — from day one, not from Week 4

Week 4 makes this a hard acceptance criterion (*"No private key or RPC secret appears anywhere in the
repository or its history"*), and history is the expensive half.

- `.env` and `.env.*` gitignored (already present in the repo)
- `.env.example` committed with keys but no values
- Never paste an Alchemy or Infura URL into a commit — the API key is in the path
- From Week 4: deployer key in an encrypted Foundry keystore via `cast wallet import`, never in `.env`
- From Week 4: `gitleaks` in CI, so a mistake fails the build rather than living in history
- The programme wallet is fresh, holds no real funds, seed phrase never typed into a website

### The weekly loop

1. Branch `week-NN/<slug>`
2. Study and reading blocks **first** — the programme is explicit that Solidity before the EVM
   produces developers repeatedly surprised by gas, storage semantics and reentrancy
3. Build to the week's task list
4. Walk the acceptance criteria as a literal checklist; every one is objectively checkable
5. Publish the artefact — live URL, verified contract, or post
6. Record the weekly defence into `docs/defences/week-NN.md`
7. PR, squash merge, tag, tick the row in the root README

## 4. The twelve artefacts and where each lands

| Wk | Showcase deliverable | Artefact type | Lands in |
| --- | --- | --- | --- |
| 1 | Toy blockchain with browser visualiser | Live URL + repo | `packages/toychain`, `apps/w01-chain-visualiser` |
| 2 | Transaction decoder CLI and anatomy write-up | Repo + post | `packages/tx-decoder`, `docs/writeups/` |
| 3 | Four verified contracts, published gallery | Live URL + Etherscan | `contracts/src/w03/`, `apps/w03-contract-gallery` |
| 4 | Foundry suite with CI, plus "A bug my tests found" | Repo + post | `contracts/` becomes a real Foundry project, `.github/workflows/` |
| 5 | Token suite (ERC-20, 721, 4626) + integration failure write-up | Deployed + post | `contracts/src/w05/` |
| 6 | Staking protocol and "Draining my own contract" | Deployed + post | `contracts/src/w06/` |
| 7 | Live staking dApp | Live URL + video | `apps/dapp` created here, `packages/contracts-sdk` |
| 8 | dApp with oracle, indexer, allowlist, plus limitations write-up | Live URL + post | `apps/dapp` extended |
| 9 | AMM with swap interface on L2, three-chain cost comparison | Live URL + post | `contracts/src/w09/`, `apps/dapp` |
| 10 | Security write-up series, six or more posts | Post series + repo | `security/`, `docs/writeups/` |
| 11 | Capstone specification, threat model, deployed contracts | Docs + deployed | `capstone/` |
| 12 | Complete capstone with audit report | Live URL + report + video | `capstone/`, all of `docs/defences/` |

## 5. Toolchain (fixed by the programme — do not substitute)

- **Foundry** primary; **Hardhat 3** secondary, introduced Week 7 for deployment scripting
- **viem** and **wagmi** — never web3.js or ethers v5
- **Sepolia** for testing, **L2 testnets** for deployment
- **Truffle, Ganache, Brownie, Goerli, Rinkeby do not appear.** Any tutorial starting with
  `truffle init` or containing `new Web3(window.ethereum)` is stale — close it.
- Solidity 0.8.36+ (July 2026). Pin the compiler version.

## 6. Environment status

Verified 2026-09-10:

| Tool | Status |
| --- | --- |
| Git 2.47.1 | ✅ installed (Windows) |
| Node v24.14.0 | ✅ installed (Windows), satisfies the "Node 20 or later" requirement |
| pnpm | ❌ not installed — `npm install -g pnpm` |
| Foundry 1.8.1 | ✅ installed in **WSL Ubuntu 24.04** — `forge`, `cast`, `anvil`, `chisel`, `solar` in `~/.foundry/bin`, attestation-verified, and `~/.foundry/bin` added to PATH via `~/.bashrc`. **Not** installed on the Windows side. |
| WSL | ✅ Ubuntu 24.04.1 + docker-desktop, both running |

**Open decision — where Foundry lives.** The repo is on the Windows filesystem
(`C:\Users\weife\evm-l2-portfolio`) but the Foundry install was started in WSL. Foundry supports Git
Bash and WSL on Windows; PowerShell and cmd are unsupported. Running WSL Foundry against `/mnt/c/...`
works but compiles noticeably slower across the filesystem boundary. Either move the repo into the WSL
filesystem (`~/evm-l2-portfolio`) or install Foundry natively under Git Bash. Decide before Week 4,
when `forge build` starts running constantly.

## 7. Week 1: Blockchain mechanics

**Budget:** 3 study, 6 build, 1 reading, 2 showcase — 12 hours.
**Branch:** `week-01/toy-blockchain`

### 7.1 Language decision

The programme says *"implement a blockchain in a language you already know."*

**Recommendation: TypeScript, running entirely in the browser.** A deliberate departure, because:

1. The acceptance criterion is *"public URL loads and is interactive without installation"*. A
   browser-only build is a static site — GitHub Pages, no server, nothing to keep alive for eleven
   more weeks.
2. The hard part of Week 1 is hashing, PoW, ECDSA and chain validation, not the language. The core is
   ~300 lines whatever it is written in.
3. Week 2 has a JS/TS ramp anyway, and the programme warns that students with no web background should
   expect Weeks 7 and 8 to be the hardest. Starting the ramp a week early is the cheapest mitigation.

Libraries: `@noble/hashes` (SHA-256) and `@noble/secp256k1` (ECDSA) — audited, dependency-free,
identical in Node and the browser.

**Fallback:** Python core in `packages/toychain-py` behind FastAPI, browser UI as a thin client.
Faithful to the letter, but there is now a backend to host; free tiers sleep and "interactive without
installation" gets fragile. Budget an extra hour.

**Avoid entirely:** writing the core twice, once in Python and once in TypeScript.

### 7.2 Block A — Study (3h)

- **(0.5h)** Anders Brownworth's [Blockchain Demo](https://andersbrownworth.com/blockchain/) — every
  tab. The programme says do this *before anything else in the week*.
- **(2h)** Cyfrin Updraft — **Blockchain Basics**. Primary resource.
- **(0.5h)** Close everything; write one page from memory answering the self-check. First draft of
  `docs/defences/week-01.md`.

### 7.3 Block B — Reading (1h)

- The [Bitcoin whitepaper](https://bitcoin.org/bitcoin.pdf). Nine pages, read properly.
- Michael Nielsen, *How the Bitcoin Protocol Actually Works*. Start here, finish across the week.

### 7.4 Block C — Build (6h) — `packages/toychain`

The programme's six required features, sequenced so each hour ends with something that runs.

**C1 (1.5h) — Chain and tamper detection** *(requirements 1, 4)*
- `Transaction` and `Block` types; `sha256` over a canonical block serialisation
- `Blockchain` with genesis; each block carries `prevHash`
- `validateChain()` — recompute every hash, check every link, return index of first invalid block
- Vitest: build a chain, mutate a historical block, assert `validateChain()` catches it

Write the test even though testing discipline formally starts Week 4 — tamper detection is what the
visualiser exists to demonstrate, and it should be proven before it is on screen.

**C2 (1.5h) — Proof of work and mempool** *(requirements 2, 5)*
- `mineBlock()` — nonce loop until the hash has `difficulty` leading zeros
- Difficulty adjustable at runtime, **tuned low enough to mine in under two seconds in a browser**
- Mempool: `addTransaction()`, pending list, drained into the block on mine

**C3 (1.5h) — Signatures and balances** *(requirements 3, 6)*
- Keypair generation; short address derived from the public key
- Sign the transaction digest with ECDSA; `verify()` on the way into the mempool
- Reject unsigned and badly-signed transactions, visibly
- Balances derived by replaying the chain, not stored; reject overspend
- A coinbase / block-reward transaction so balances start non-zero

**C4 (1.5h) — Browser interface** — `apps/w01-chain-visualiser`

The four things a visitor must be able to do:
- **Mine a block**
- **Submit a transaction** — keypair generated in-browser, held in `localStorage`
- **Edit the contents of a historical block** — inline editable field on any block
- **See the chain turn invalid downstream of the edit** — recompute on every render; the edited block
  and every block after it go red

That last point is the whole artefact. A visitor who edits block 3 and watches blocks 3–8 turn red has
understood the week's self-check without reading a word.

**Stretch (only if C1–C4 land early):** two nodes gossiping blocks over websockets, resolving a fork by
longest chain. Keep it *off* the deployed page — it needs a server, and the acceptance criterion is a
static URL. Put it in `packages/toychain-node`, run locally, record a clip for the README. Do not let
it endanger the deliverable.

**Worth 20 minutes if available:** a Merkle root over each block's transactions. It is in the week's
Topics list, costs almost nothing on top of what exists, and inclusion proofs recur later.

### 7.5 Block D — Showcase (2h)

**D1 (0.75h) — Deploy.** GitHub Pages via a `web.yml` Actions workflow building
`apps/w01-chain-visualiser`. Open the public URL on a phone, in a browser with no wallet extension, and
confirm it is interactive.

**D2 (0.75h) — README.** Requires a section titled **"What this does not do"**, covering networking,
consensus among many nodes, and economic incentives. Be specific:
- No peer discovery, no gossip, no mempool propagation
- One node, so no fork choice and no reorgs — the thing the chain is for is the thing this omits
- No difficulty retargeting, no halving, no fee market
- No finality, probabilistic or otherwise
- Proof of work here costs nothing real, so the security argument does not apply

**D3 (0.5h) — Weekly defence.** Record 5–10 minutes, screen and voice, **no assistant open**: walk the
code, answer the self-check aloud, name two things you got wrong first. Commit to
`docs/defences/week-01.md` with the recording linked.

### 7.6 Acceptance criteria

- [ ] Public URL loads and is interactive without installation
- [ ] Tampering with a historical block visibly invalidates all subsequent blocks
- [ ] Transactions are signed and invalid signatures are rejected
- [ ] Repository README explains the omissions
- [ ] Weekly defence recorded

### 7.7 Self-check

> Explain to someone non-technical why a past block cannot be quietly edited, without using the word
> "immutable".

Failure to answer from memory means repeating the week's build before continuing. The phases are
cumulative and Phase 4 is unforgiving of gaps in Phase 2.

## 8. Open items

| Item | Status |
| --- | --- |
| **AI use policy tiers.** Section 4 of the PDF says the policy has three tiers "which tighten and then loosen as competence builds", but the table does not extract from the file — likely a rendered graphic on page 7. It governs how much assistant help is permitted in Weeks 1–3. | Read in a PDF viewer before starting |
| **Weekly defence format.** Required every week and all twelve published, but the format is never specified. The 5–10 minute recorded walkthrough above is inferred from Section 7's "twenty minutes with no assistant open" rehearsal. | Assumption |
| **Sepolia's successor.** The programme's one decision with a live expiry. Check `ethereum.org/developers/docs/networks` before Week 2 and again before Week 9; if a successor has landed, substitute it and nothing else changes. | Check before W2 |
| **Where Foundry lives** — WSL vs Git Bash, and whether the repo moves into the WSL filesystem. See section 6. | Decide before W4 |
| **Start date and week boundaries.** Not set. Twelve hours a week is the design assumption. | To decide |
| **External review.** Once per phase, one artefact in front of someone who is not you — Cyfrin Discord or BuidlGuidl. Ask for criticism of a specific thing, not general approval. | First one at end of W3 |

## 9. Known failure modes to push back on

From the programme's own section 11. If the work starts drifting this way, say so:

- **Tutorial accumulation** — starting a fourth course because the third got hard at the point it got
  useful. A week is complete when the artefact is public, not when the videos end.
- **Learning Solidity before the EVM** — Weeks 1 and 2 exist to prevent this. Impatient students skip them.
- **Skipping tests** — the most visible gap between self-taught and professionally trained contract
  developers, and the easiest to close deliberately.
- **Accepting AI output uncritically** — an assistant produces a plausible ERC-4626 instantly, and also
  one vulnerable to share inflation. The weekly defence exists to surface this before an interviewer does.
- **Chasing new ecosystems** — the fundamentals transfer; the SDK of the month does not.
- **Building in silence** — the showcase requirement is partly pedagogical, partly social.
