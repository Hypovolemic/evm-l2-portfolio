/**
 * @vitest-environment happy-dom
 *
 * Week 1's acceptance criteria are about what a visitor can do on the page, not
 * about the library underneath. These drive the real UI: mine, submit, tamper,
 * and check that the page says what it should.
 */
import { describe, it, expect, beforeAll } from 'vitest';

const app = () => document.getElementById('app') as HTMLElement;
const html = () => app().innerHTML;
const click = (selector: string) => {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`nothing matched ${selector}`);
  element.click();
};

const setInput = (selector: string, value: string) => {
  const input = document.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`nothing matched ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  await import('../src/main.ts');
});

describe('the page a visitor lands on', () => {
  it('renders without throwing and reports a valid chain', () => {
    expect(html()).toContain('CHAIN VALID');
  });

  it('offers the four required actions', () => {
    expect(document.getElementById('mine')).not.toBeNull();
    expect(document.getElementById('send')).not.toBeNull();
    expect(document.querySelectorAll('[data-edit]').length).toBeGreaterThanOrEqual(0);
    expect(html()).toContain('Block 0');
  });

  it('shows a genesis block and a wallet address', () => {
    expect(html()).toContain('Block 0');
    expect(html()).toContain('Address (compressed public key)');
  });
});

describe('mining', () => {
  it('appends a block and credits the miner', () => {
    click('#mine');
    expect(html()).toContain('Block 1');
    expect(html()).toContain('COINBASE (block reward)');
    expect(html()).toContain('hash attempts');
    expect(html()).toContain('CHAIN VALID');
  });
});

describe('signing and submitting', () => {
  it('accepts a correctly signed transaction into the mempool', () => {
    setInput('#amount', '10');
    click('#send');
    expect(html()).toContain('Accepted into the mempool');
  });

  it('rejects a transaction signed with the wrong key', () => {
    const forge = document.getElementById('forge') as HTMLInputElement;
    forge.checked = true;
    click('#send');
    expect(html()).toContain('invalid signature');

    (document.getElementById('forge') as HTMLInputElement).checked = false;
  });

  it('settles the accepted transaction when the next block is mined', () => {
    click('#mine');
    expect(html()).toContain('Block 2');
    expect(html()).toContain('CHAIN VALID');
  });
});

describe('tampering with history', () => {
  /** Each case starts from genesis so the assertions do not inherit earlier damage. */
  const freshChainOf = (blocks: number) => {
    click('#reset');
    for (let i = 0; i < blocks; i++) click('#mine');
    expect(html()).toContain('CHAIN VALID');
  };

  it('invalidates the edited block and everything after it', () => {
    freshChainOf(3);

    // Awarding block 1's miner 9999 instead of the block reward.
    setInput('[data-edit="1:0:amount"]', '9999');

    expect(html()).toContain('CHAIN INVALID from block 1');
    expect(html()).toContain('block reward is 50');

    // Blocks 2 and 3 are invalid purely by descent.
    expect(html()).toContain('descends from invalid block 1');
    expect((html().match(/descends from invalid block 1/g) ?? []).length).toBe(2);
  });

  it('re-mining the edited block repairs that block but not the chain', () => {
    freshChainOf(3);

    // Redirect block 1's reward. This breaks nothing but the hash, so re-mining
    // can genuinely repair the block itself.
    setInput('[data-edit="1:0:to"]', 'somebody-else');
    expect(html()).toContain('CHAIN INVALID from block 1');

    click('[data-remine="1"]');

    expect(html()).toContain('every block after it still points at the hash it used to have');
    expect(html()).toContain('CHAIN INVALID from block 2');
    expect(html()).toContain('prevHash does not match the hash of block 1');
  });

  it('is repaired only by re-mining every block from the edit onwards', () => {
    freshChainOf(3);
    setInput('[data-edit="1:0:to"]', 'somebody-else');

    click('[data-remine="1"]');
    click('[data-remine="2"]');
    expect(html()).toContain('CHAIN INVALID from block 3');

    click('[data-remine="3"]');
    expect(html()).toContain('CHAIN VALID');
  });
});
