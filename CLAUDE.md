# CLAUDE.md

Project context for the **EVM Developer Programme** (v2.1, August 2026), a 12-week self-directed
programme that produces 12 public artefacts and one audited capstone.

- Source document: `~/Documents/nus-blockchain/EVM-Developer-Programme.pdf`
- Repository: https://github.com/Hypovolemic/evm-l2-portfolio, **public** because the programme requires it
- Plan also published to Notion: [EVM Developer Programme: Build Plan](https://app.notion.com/p/3d77efe10a0b81d1a3edd6bb96bf4bd3)

The programme's main rule is that **every week ends with something another person can look at**,
such as a deployed contract, a live URL, a published write-up, or a repo with passing tests. Notes
and finished video courses don't count. Keep to that standard when helping with any week's work.

---

## 1. Repository shape: one repo, not twelve

The weeks are not independent. Three threads run the length of the programme, and each week hands
its output to a later one:

- **Contract thread:** Week 3's four contracts are *ported* into Foundry in Week 4, Week 5 supplies
  the token, Week 6 assembles them into a staking protocol, and Week 9 adds an AMM.
- **Application thread:** Week 7 builds a frontend *for the Week 6 protocol*, Week 8 extends *that
  same application*, Week 9 adds a swap interface, and Week 12 polishes it.
- **Security thread:** Week 10 attacks every contract written in Weeks 3, 5, 6 and 9.

That is why everything lives in one repo. Twelve repos would mean copying contracts between them,
and each README would only describe part of the work. One root README can link all twelve
artefacts and explain how they connect. The programme also expects the repository to be something
you could show when applying for a junior Solidity role.

```
W1 ──▶ W2 ──▶ W3 ──▶ W4 ──▶ W5 ──▶ W6 ──┬─▶ W7 ──▶ W8 ──┐
        │            │                   │               ├─▶ W11 ──▶ W12
        └───────────▶┴─▶ W9 ─────────────┴─▶ W10 ────────┘
```

## 2. Target folder structure

Nothing here needs to exist on day one. The tree shows where the repo ends up, and section 4 says
when each part arrives.

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
│   ├── defences/                 # week-01.md to week-12.md, the 12 recorded defences
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
├── contracts/                    # the Foundry project: W3 sources land here, W4 wraps them
│   ├── foundry.toml
│   ├── src/                      # w03/ w05/ w06/ w09/
│   ├── test/                     # unit + fuzz + invariant, mirrors src/
│   ├── script/                   # deploy + verify, one command
│   └── lib/                      # forge-std, openzeppelin (git submodules)
├── security/                     # W10
│   ├── exploits/                 # working exploits, written as Foundry tests
│   └── triage/                   # slither / aderyn output + reasoned dismissals
└── capstone/                     # W11 and W12, its own self-contained system
    ├── spec.md
    ├── threat-model.md
    ├── contracts/                # separate Foundry project
    ├── app/
    └── audit-report.md
```

### Why these choices

| Choice | Reason |
| --- | --- |
| One `contracts/` Foundry project, not one per week | Week 4 says *"port all four Week 3 contracts into a single Foundry project"*, and Weeks 5, 6 and 9 keep adding to it. This gives one coverage number, one CI job and one gas baseline. |
| Week 3 sources go straight into `contracts/src/w03/` | Week 3 is written in Remix by instruction, but paste each finished contract into the repo as you go. Week 4 then runs `forge init --force` around code that is already there. |
| `apps/dapp/` is one app, not four | Weeks 7, 8, 9 and 12 all extend the *same* application. Four folders would misrepresent the work and repeat the frontend setup four times. |
| `capstone/` has its own Foundry project | Week 11 is *"a deployed multi-contract system of your own design"*, so it needs to be auditable on its own, without earlier coursework in the same `src/`. |
| `packages/contracts-sdk/` | Generated ABIs and addresses live in one place, so `apps/dapp` never hardcodes an address and W9's three-chain deployment is a config change. |
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

The `week-NN/` prefix groups branches together in GitHub's branch list. It matters from Week 4
onward, when one week needs several branches (the Foundry port, CI and the keystore migration can
each be done separately).

Open a PR into `main` even when working alone, and squash merge it. The PR diff is what gets
posted to the Cyfrin Discord for the once-per-phase external review the programme requires, and
squashing keeps `main` to one readable commit per piece of work.

### Tags

Tag the commit where each artefact goes public: `w01-showcase`, `w02-showcase`, and so on. That
gives every deliverable a permanent link, even after later weeks change the code around it.

### Secrets: from day one, not from Week 4

Week 4 makes this an acceptance criterion (*"No private key or RPC secret appears anywhere in the
repository or its history"*), and a secret in git history is much harder to remove than one in the
current files.

- `.env` and `.env.*` gitignored (already present in the repo)
- `.env.example` committed with keys but no values
- Never paste an Alchemy or Infura URL into a commit, because the API key is part of the path
- From Week 4: deployer key in an encrypted Foundry keystore via `cast wallet import`, never in `.env`
- From Week 4: `gitleaks` in CI, so a mistake fails the build rather than staying in history
- The programme wallet is fresh, holds no real funds, and its seed phrase is never typed into a website

### Writing

Applies to the docs, READMEs, PR descriptions, commit messages, Notion pages, the GitHub Pages site
and any text shown inside the apps:

- No em dashes. Use a full stop, comma, colon or parentheses instead. Write ranges as "5 to 10".
- Explain rather than sell. Describe what the thing does, how it works and why it was built that
  way, as you would to a classmate. Avoid slogans, punchlines and writing aimed at an imagined
  hiring manager.

### The weekly loop

1. Branch `week-NN/<slug>`
2. Do the study and reading blocks **first**. The programme warns that learning Solidity before the
   EVM leaves you repeatedly surprised by gas, storage semantics and reentrancy
3. Build to the week's task list
4. Walk the acceptance criteria as a literal checklist; every one can be checked objectively
5. Publish the artefact (a live URL, a verified contract, or a post)
6. Record the weekly defence into `docs/defences/week-NN.md`
7. PR, squash merge, tag, tick the row in the root README

## 4. The twelve artefacts and where each lands

| Wk | Deliverable | Artefact type | Lands in |
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

## 5. Toolchain (fixed by the programme, do not substitute)

- **Foundry** primary; **Hardhat 3** secondary, introduced in Week 7 for deployment scripting
- **viem** and **wagmi**, never web3.js or ethers v5
- **Sepolia** for testing, **L2 testnets** for deployment
- **Truffle, Ganache, Brownie, Goerli and Rinkeby are not used.** Any tutorial that starts with
  `truffle init` or contains `new Web3(window.ethereum)` is out of date and not worth following.
- Solidity 0.8.36+ (July 2026). Pin the compiler version.

## 6. Environment status

Verified 2026-10-16:

| Tool | Status |
| --- | --- |
| Git 2.47.1 | ✅ installed (Windows) |
| Node v24.14.0 | ✅ installed (Windows), satisfies the "Node 20 or later" requirement |
| pnpm 12.3.4 | ✅ installed (Windows) via `npm install -g pnpm`. Build scripts are allowlisted with `allowBuilds:` in `pnpm-workspace.yaml`, because pnpm 12 ignores `onlyBuiltDependencies` |
| Foundry 1.8.1 | ✅ installed in **WSL Ubuntu 24.04**: `forge`, `cast`, `anvil`, `chisel` and `solar` in `~/.foundry/bin`, attestation-verified, with `~/.foundry/bin` added to PATH via `~/.bashrc`. **Not** installed on the Windows side. The PATH line sits below `.bashrc`'s early return for non-interactive shells, so `wsl -- bash -lc 'forge …'` fails; use `bash -ic` or the full path `~/.foundry/bin/forge` |
| WSL | ✅ Ubuntu 24.04.1 + docker-desktop, both running |
| Poppler 25.07.0 | ✅ installed (Windows) via `winget install oschwartz10612.Poppler`. Provides `pdftoppm`, `pdftotext` and `pdfimages` for reading the programme PDF. On PATH in new shells |

**Open decision: where Foundry lives.** The repo is on the Windows filesystem
(`C:\Users\weife\evm-l2-portfolio`), but Foundry is installed in WSL. Foundry supports Git Bash and
WSL on Windows; PowerShell and cmd are unsupported. Running WSL Foundry against `/mnt/c/...` works,
but compiling across the filesystem boundary is noticeably slower. Either move the repo into the WSL
filesystem (`~/evm-l2-portfolio`) or install Foundry natively under Git Bash. Decide before Week 4,
when `forge build` starts running constantly.

## 7. Week 1: Blockchain mechanics

**Budget:** 12 hours (3 study, 6 build, 1 reading, 2 showcase).
**Branch:** `week-01/toy-blockchain`

### 7.1 Language decision

The programme says *"implement a blockchain in a language you already know."*

**Choice: TypeScript, running entirely in the browser.** This departs from the instruction on
purpose, for three reasons:

1. The acceptance criterion is *"public URL loads and is interactive without installation"*. A
   browser-only build is a static site on GitHub Pages, with no server to keep running for the next
   eleven weeks.
2. The hard part of Week 1 is hashing, proof of work, ECDSA and chain validation, not the language.
   The core is about 300 lines whatever it is written in.
3. Week 2 has a JS/TS ramp anyway, and the programme warns that students with no web background
   should expect Weeks 7 and 8 to be the hardest. Starting the ramp a week early makes those weeks
   easier.

Libraries: `@noble/hashes` (SHA-256) and `@noble/curves` (secp256k1 ECDSA). Both are audited, have
no dependencies, and behave the same in Node and the browser.

**Fallback (not used):** a Python core in `packages/toychain-py` behind FastAPI, with the browser UI
as a thin client. This follows the instruction more literally, but it adds a backend to host. Free
hosting tiers go to sleep, so "interactive without installation" becomes unreliable.

**Avoid:** writing the core twice, once in Python and once in TypeScript.

### 7.2 Block A: Study (3h)

- **(0.5h)** Anders Brownworth's [Blockchain Demo](https://andersbrownworth.com/blockchain/), every
  tab. The programme says to do this *before anything else in the week*.
- **(2h)** Cyfrin Updraft's **Blockchain Basics** course, the main resource for the week.
- **(0.5h)** Close everything and write one page from memory answering the self-check. This is the
  first draft of `docs/defences/week-01.md`.

### 7.3 Block B: Reading (1h)

- The [Bitcoin whitepaper](https://bitcoin.org/bitcoin.pdf). It is nine pages; read it properly.
- Michael Nielsen, *How the Bitcoin Protocol Actually Works*. Start it here and finish it across
  the week.

### 7.4 Block C: Build (6h), `packages/toychain`

The programme's six required features, in an order where each step ends with something that runs.

**C1 (1.5h): Chain and tamper detection** *(requirements 1, 4)*
- `Transaction` and `Block` types; `sha256` over a canonical block serialisation
- `Blockchain` with a genesis block; each block carries `prevHash`
- `validateChain()`: recompute every hash, check every link, return the index of the first invalid
  block
- Vitest: build a chain, mutate a historical block, assert that `validateChain()` catches it

Write the test even though testing formally starts in Week 4. Tamper detection is the thing the
visualiser demonstrates, so it should be proven before it is on screen.

**C2 (1.5h): Proof of work and mempool** *(requirements 2, 5)*
- `mineBlock()`: a nonce loop that runs until the hash has `difficulty` leading zeros
- Difficulty adjustable at runtime, **set low enough to mine in under two seconds in a browser**
- Mempool: `addTransaction()`, a pending list, drained into the block when it is mined

**C3 (1.5h): Signatures and balances** *(requirements 3, 6)*
- Keypair generation; a short address derived from the public key
- Sign the transaction digest with ECDSA; `verify()` on the way into the mempool
- Reject unsigned and badly signed transactions, and show the rejection
- Balances derived by replaying the chain, not stored; reject overspends
- A coinbase (block reward) transaction so balances start above zero

**C4 (1.5h): Browser interface** in `apps/w01-chain-visualiser`

The four things a visitor must be able to do:
- **Mine a block**
- **Submit a transaction**, with the keypair generated in the browser and kept in `localStorage`
- **Edit the contents of a historical block**, through an inline editable field on any block
- **See the chain turn invalid after the edit**: recompute on every render, so the edited block and
  every block after it go red

The last feature matters most, because it shows a visitor why editing an old block breaks every
block after it. Someone who edits block 3 and sees blocks 3 to 8 turn red has seen the answer to
the week's self-check.

**Stretch (not built):** two nodes gossiping blocks over websockets and resolving a fork by longest
chain. It would have to stay *off* the deployed page, because it needs a server and the acceptance
criterion is a static URL. The plan was to put it in `packages/toychain-node`, run it locally, and
record a clip for the README instead.

**Merkle roots (built):** a Merkle root over each block's transactions. It is in the week's Topics
list, it took little extra work on top of the rest, and inclusion proofs come up again later.

### 7.5 Block D: Showcase (2h)

**D1 (0.75h): Deploy.** GitHub Pages via a `web.yml` Actions workflow that builds
`apps/w01-chain-visualiser`. Open the public URL on a phone, in a browser with no wallet extension,
and confirm it is interactive.

**D2 (0.75h): README.** The programme requires a section titled **"What this does not do"**,
covering networking, consensus among many nodes, and economic incentives. Be specific:
- No peer discovery, no gossip, no mempool propagation
- One node, so no fork choice and no reorgs, even though resolving disagreement between nodes is
  what a real chain is for
- No difficulty retargeting, no halving, no fee market
- No finality, probabilistic or otherwise
- Proof of work here costs nothing real, so the security argument does not apply

**D3 (0.5h): Weekly defence.** Record 5 to 10 minutes of screen and voice with **no assistant
open**: walk through the code, answer the self-check aloud, and name two things you got wrong at
first. Commit it to `docs/defences/week-01.md` with the recording linked.

### 7.6 Acceptance criteria

- [x] Public URL loads and is interactive without installation (live since 2026-10-16, see section 8)
- [x] Tampering with a historical block visibly invalidates all subsequent blocks
- [x] Transactions are signed and invalid signatures are rejected
- [x] Repository README explains the omissions
- [ ] Weekly defence recorded

### 7.7 Self-check

> Explain to someone non-technical why a past block cannot be quietly edited, without using the word
> "immutable".

If you can't answer from memory, repeat the week's build before continuing. The phases build on each
other, and gaps from Phase 2 cause real problems in Phase 4.

## 8. Open items

| Item | Status |
| --- | --- |
| **Week 1 close-out.** PR #1 merged on 2026-09-10, but every deploy failed with `Get Pages site failed … Not Found` until Pages was enabled (Source: GitHub Actions) on 2026-10-16. The workflow cannot enable Pages by itself. The site is now live at `hypovolemic.github.io/evm-l2-portfolio/w01/`. Remaining: phone check, defence recording, `w01-showcase` tag. | Close out before W2 |
| **AI use policy tiers.** Section 4 of the PDF (page 7) says the policy has three tiers "which tighten and then loosen as competence builds", and then stops. The table is **missing from the file**, not an image that failed to extract: the page is blank where it should be, and the PDF contains no images at all (checked 2026-10-16). Only indirect evidence survives. Week 12's audit step 5 says "*now* the assistant is permitted as an attacker", and every defence is done with no assistant open. The sibling `Protocol-Research-Analyst-Programme.pdf` §5 has its policy intact (translator, then research assistant, then adversary and editor) and probably uses the same template, so it is a useful guide but not the rule. The tiers decide how much assistant help is allowed in Weeks 1 to 3. | Ask the club organiser for the table |
| **Weekly defence format.** Required every week, with all twelve published, but the format is never specified. The 5 to 10 minute recorded walkthrough above is inferred from Section 7's "twenty minutes with no assistant open" rehearsal. | Assumption |
| **Sepolia's successor.** The one decision in the programme that may go out of date. Check `ethereum.org/developers/docs/networks` before Week 2 and again before Week 9; if a successor has launched, switch to it and nothing else changes. | Check before W2 |
| **Where Foundry lives:** WSL or Git Bash, and whether the repo moves into the WSL filesystem. See section 6. | Decide before W4 |
| **Start date and week boundaries.** Not set. The programme assumes twelve hours a week. | To decide |
| **External review.** Once per phase, show one artefact to someone else, for example on the Cyfrin Discord or BuidlGuidl. Ask for criticism of something specific rather than general approval. | First one at end of W3 |

## 9. Known failure modes to push back on

These come from section 11 of the programme. If the work starts drifting this way, say so:

- **Tutorial accumulation:** starting a fourth course because the third got hard just as it got
  useful. A week is complete when the artefact is public, not when the videos end.
- **Learning Solidity before the EVM:** Weeks 1 and 2 exist to prevent this, and they are the weeks
  people are most tempted to skip.
- **Skipping tests:** the most visible gap between self-taught and professionally trained contract
  developers, and one of the easiest to close on purpose.
- **Accepting AI output uncritically:** an assistant can produce a plausible ERC-4626 vault
  instantly, and it can just as easily produce one that is vulnerable to share inflation. The
  weekly defence is there to catch this, by making sure every file can be explained without an
  assistant.
- **Chasing new ecosystems:** the fundamentals carry over between chains; a particular SDK usually
  doesn't.
- **Building in silence:** publishing each week is partly for learning and partly to get feedback
  from other people.
