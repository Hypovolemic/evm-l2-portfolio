import './style.css';
import {
  Blockchain,
  createWallet,
  signTransaction,
  shortAddress,
  merkleRoot,
  BLOCK_REWARD,
  COINBASE,
  type Transaction,
  type Wallet,
  type ChainValidation,
} from '@portfolio/toychain';

const STORAGE_KEY = 'toychain.wallets.v1';

interface Message {
  kind: 'ok' | 'bad';
  text: string;
}

let chain = new Blockchain(3);
let message: Message | null = null;
let lastMineAttempts: number | null = null;

/**
 * Wallets live in localStorage so a refresh does not hand you a new identity.
 * The chain itself is deliberately not persisted: every visitor should start
 * from genesis and watch it grow.
 */
function loadWallets(): { me: Wallet; peer: Wallet } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as { me: Wallet; peer: Wallet };
  } catch {
    // Private browsing, blocked storage, corrupted value -- fall through.
  }
  const wallets = { me: createWallet(), peer: createWallet() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
  } catch {
    // Storage unavailable. The page still works, the identity just will not survive a reload.
  }
  return wallets;
}

const { me, peer } = loadWallets();

// ---------------------------------------------------------------- helpers

const escape = (value: unknown): string =>
  String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

/** Renders the leading zeros in a different colour so the target is visible. */
function hashHtml(hash: string, difficulty: number): string {
  const zeros = '0'.repeat(difficulty);
  return hash.startsWith(zeros)
    ? `<span class="zeros">${zeros}</span>${escape(hash.slice(difficulty))}`
    : escape(hash);
}

// ---------------------------------------------------------------- render

function render(): void {
  const result = chain.validate();
  const app = document.getElementById('app');
  if (!app) return;

  const active = document.activeElement as HTMLInputElement | null;
  const focusKey = active?.dataset.edit ?? null;
  const caret = active?.selectionStart ?? null;

  app.innerHTML = [
    header(result),
    hint(),
    `<div class="grid">${walletPanel()}${sendPanel()}${mempoolPanel(result)}</div>`,
    chainSection(result),
    footer(),
  ].join('');

  wire();

  if (focusKey) {
    const restored = app.querySelector<HTMLInputElement>(`[data-edit="${focusKey}"]`);
    if (restored) {
      restored.focus();
      if (caret !== null) {
        try {
          restored.setSelectionRange(caret, caret);
        } catch {
          // Number inputs do not support selection ranges in every browser.
        }
      }
    }
  }
}

function header(result: ChainValidation): string {
  const status = result.valid
    ? '<span class="status valid">CHAIN VALID</span>'
    : `<span class="status invalid">CHAIN INVALID from block ${result.firstInvalidIndex}</span>`;

  return `
    <header class="top">
      <div>
        <h1>A blockchain you can break</h1>
        <p class="lede">
          Mine a block, sign a transaction, then edit something that already happened
          and watch every block after it stop being valid. Nothing here is on a real
          network &mdash; it all runs in this tab.
        </p>
      </div>
      ${status}
    </header>`;
}

function hint(): string {
  return `<div class="hint">
    <strong>Try this:</strong> mine two or three blocks, then change an amount inside
    block 1. The block turns red because the signature no longer covers that amount and
    the proof of work no longer holds &mdash; and every later block turns red with it.
    Press <em>Re-mine</em> on the block you edited: it goes green again, and the chain
    is still broken.
  </div>`;
}

function walletPanel(): string {
  const difficulties = [1, 2, 3, 4]
    .map((d) => `<option value="${d}"${d === chain.difficulty ? ' selected' : ''}>${d}</option>`)
    .join('');

  return `
    <section class="panel">
      <h2>Your wallet</h2>
      <div class="spread">
        <span class="stat">${chain.balanceOf(me.address)}</span>
        <span class="muted">coins confirmed</span>
      </div>
      <div class="field">
        <div class="field-label">Address (compressed public key)</div>
        <div class="mono" title="${escape(me.address)}">${escape(shortAddress(me.address))}</div>
      </div>
      <div class="field">
        <div class="field-label">Next nonce</div>
        <div class="mono">${chain.nextNonce(me.address)}</div>
      </div>
      <label for="difficulty">Difficulty (leading hex zeros required)</label>
      <select id="difficulty">${difficulties}</select>
      <p class="muted" style="font-size:12px;margin:8px 0 0">
        Each extra zero makes mining about 16&times; harder. Applies to the next block mined.
      </p>
      <button id="reset" class="ghost small" style="margin-top:12px">Reset chain to genesis</button>
    </section>`;
}

function sendPanel(): string {
  const spendable = chain.spendableBalance(me.address);
  return `
    <section class="panel">
      <h2>Send a transaction</h2>
      <label for="to">To</label>
      <input id="to" class="mono" value="${escape(peer.address)}" />
      <label for="amount">Amount (spendable: ${spendable})</label>
      <input id="amount" type="number" min="1" step="1" value="10" />
      <div class="checkline">
        <input type="checkbox" id="forge" />
        <label for="forge" style="margin:0">Sign with the wrong key (demo)</label>
      </div>
      <button id="send">Sign and submit</button>
      ${message ? `<div class="msg ${message.kind}">${escape(message.text)}</div>` : ''}
    </section>`;
}

function mempoolPanel(result: ChainValidation): string {
  const pending = chain.mempool.length
    ? chain.mempool
        .map(
          (tx, i) => `<div class="pending">
            <span class="mono">#${i}</span>
            ${escape(shortAddress(tx.from))} &rarr; ${escape(shortAddress(tx.to))}
            <strong>${escape(tx.amount)}</strong>
            <span class="muted mono">nonce ${escape(tx.nonce)}</span>
          </div>`,
        )
        .join('')
    : '<p class="muted">Empty. A block can still be mined &mdash; it will just carry the reward alone.</p>';

  return `
    <section class="panel">
      <h2>Mempool (${chain.mempool.length} pending)</h2>
      ${pending}
      <button id="mine" style="margin-top:12px">Mine a block (+${BLOCK_REWARD} to you)</button>
      ${
        lastMineAttempts !== null
          ? `<p class="muted" style="font-size:12px;margin-top:9px">
               Last block took <strong>${lastMineAttempts.toLocaleString()}</strong> hash attempts.
             </p>`
          : ''
      }
      ${
        !result.valid
          ? '<p class="msg bad" style="margin-top:10px">The chain is invalid. New blocks will build on a broken history.</p>'
          : ''
      }
    </section>`;
}

function chainSection(result: ChainValidation): string {
  const cards = chain.blocks.map((block, i) => {
    const validation = result.blocks[i];
    const isDownstream = !validation.ok && validation.issues[0]?.startsWith('descends from');

    const txs = block.transactions
      .map((tx, j) => txCard(tx, i, j))
      .join('');

    const issues = validation.issues.length
      ? `<ul class="issues">${validation.issues.map((issue) => `<li>${escape(issue)}</li>`).join('')}</ul>`
      : '';

    return `
      <article class="block ${validation.ok ? '' : 'bad'} ${isDownstream ? 'downstream' : ''}">
        <div class="block-head">
          <span class="block-index">Block ${block.index}</span>
          <span class="badge ${validation.ok ? 'ok' : 'bad'}">${validation.ok ? 'VALID' : 'INVALID'}</span>
        </div>

        <div class="field">
          <div class="field-label">Hash</div>
          <div class="hash">${hashHtml(validation.hash, block.difficulty)}</div>
        </div>
        <div class="field">
          <div class="field-label">Previous hash</div>
          <div class="hash">${escape(block.prevHash)}</div>
        </div>
        <div class="field">
          <div class="field-label">Merkle root</div>
          <div class="hash">${escape(merkleRoot(block.transactions))}</div>
        </div>
        <div class="row" style="margin:8px 0">
          <span class="muted mono">nonce ${escape(block.nonce)}</span>
          <span class="muted mono">difficulty ${escape(block.difficulty)}</span>
        </div>

        ${txs || '<p class="muted" style="font-size:12px">No transactions (genesis).</p>'}
        ${issues}

        ${
          block.index > 0
            ? `<button class="ghost small" data-remine="${i}" style="margin-top:10px">Re-mine this block</button>`
            : ''
        }
      </article>`;
  });

  return `<h2>The chain</h2><div class="chain">${cards.join('')}</div>`;
}

function txCard(tx: Transaction, blockIndex: number, txIndex: number): string {
  const isCoinbase = tx.from === COINBASE;
  return `
    <div class="tx">
      <div class="tx-head">
        <span>${isCoinbase ? 'COINBASE (block reward)' : `from ${escape(shortAddress(tx.from))}`}</span>
        <span class="mono">nonce ${escape(tx.nonce)}</span>
      </div>
      <div class="tx-grid">
        <input
          class="mono"
          value="${escape(tx.to)}"
          data-edit="${blockIndex}:${txIndex}:to"
          title="Recipient. Change it and the signature stops matching."
        />
        <input
          type="number"
          value="${escape(tx.amount)}"
          data-edit="${blockIndex}:${txIndex}:amount"
          title="Amount. This is signed over, so editing it forges the transaction."
        />
      </div>
    </div>`;
}

function footer(): string {
  return `
    <footer>
      Week 1 of the EVM Developer Programme &middot;
      <a href="https://github.com/Hypovolemic/evm-l2-portfolio" target="_blank" rel="noopener">source on GitHub</a>
      &middot; SHA-256 hashing, secp256k1 signatures, proof of work, Merkle roots.
      Read <em>What this does not do</em> in the README before believing anything here
      resembles a real network.
    </footer>`;
}

// ---------------------------------------------------------------- events

function wire(): void {
  document.getElementById('send')?.addEventListener('click', onSend);
  document.getElementById('mine')?.addEventListener('click', onMine);

  document.getElementById('difficulty')?.addEventListener('change', (event) => {
    chain.difficulty = Number((event.target as HTMLSelectElement).value);
    render();
  });

  document.getElementById('reset')?.addEventListener('click', () => {
    chain = new Blockchain(chain.difficulty);
    lastMineAttempts = null;
    message = null;
    render();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-remine]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.remine);
      lastMineAttempts = chain.remineBlock(index).attempts;
      message = {
        kind: 'ok',
        text: `Re-mined block ${index}. Its own proof of work is valid again -- but every block after it still points at the hash it used to have.`,
      };
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>('[data-edit]').forEach((input) => {
    input.addEventListener('input', () => {
      const [blockIndex, txIndex, field] = (input.dataset.edit ?? '').split(':');
      const tx = chain.blocks[Number(blockIndex)]?.transactions[Number(txIndex)];
      if (!tx) return;

      if (field === 'amount') tx.amount = Number(input.value);
      else if (field === 'to') tx.to = input.value;

      message = null;
      render();
    });
  });
}

function onSend(): void {
  const to = (document.getElementById('to') as HTMLInputElement).value.trim();
  const amount = Number((document.getElementById('amount') as HTMLInputElement).value);
  const forge = (document.getElementById('forge') as HTMLInputElement).checked;

  const unsigned: Transaction = {
    from: me.address,
    to,
    amount,
    nonce: chain.nextNonce(me.address),
  };

  // Signing with the peer's key while still claiming to be `me` is exactly the
  // forgery the signature check exists to catch.
  const signed = signTransaction(unsigned, forge ? peer.privateKey : me.privateKey);
  const result = chain.addTransaction(signed);

  message = result.ok
    ? { kind: 'ok', text: 'Accepted into the mempool. Mine a block to settle it.' }
    : { kind: 'bad', text: `Rejected -- ${result.error}` };

  render();
}

function onMine(): void {
  lastMineAttempts = chain.mine(me.address).attempts;
  message = null;
  render();
}

// ---------------------------------------------------------------- start

render();
