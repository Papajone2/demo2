import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { WEBSITE_LINKS } from './external-links.ts';
import { withWalletCleanup } from '../locales/wallet-cleanup.ts';
import { withExchangeHelp } from '../locales/exchange-help.ts';
import { CHANGENOW_KYC_SOURCE, EXCHANGES } from './community-nodes.ts';

test('website destinations avoid the nonexistent about route', () => {
  assert.equal(WEBSITE_LINKS.about, WEBSITE_LINKS.home);
  assert.equal(new URL(WEBSITE_LINKS.support).pathname, '/support');
  for (const url of Object.values(WEBSITE_LINKS)) assert.equal(new URL(url).protocol, 'https:');
});

test('forgotten-lock copy is translated without calling native wallets a sandbox', () => {
  const body = readFileSync(new URL('../components/erase-sheet.tsx', import.meta.url), 'utf8').match(/const BODY = msg\('([^']+)'\)/)[1];
  assert.doesNotMatch(body, /sandbox|test wallet|test funds|stagenet|testnet/i);
  for (const language of ['es','de','fr','pt','ru','zh-Hans','ja','ko','tr','hi']) {
    const catalog = withWalletCleanup(language, {});
    assert.ok(catalog[body]);
    assert.equal(Object.keys(catalog).length, 6);
  }
});

test('exchange logos are bundled and gray controls retain the non-affiliation notice', () => {
  const guide = readFileSync(new URL('../components/exchange-guide.tsx', import.meta.url), 'utf8');
  assert.match(guide, /assets\/brands\/changenow\.png/);
  assert.match(guide, /assets\/brands\/simpleswap\.png/);
  assert.match(guide, /backgroundColor: pressed \? '#333333' : '#242424'/);
  assert.match(guide, /We are not affiliated with these services/);
  assert.match(guide, /not as an endorsement/);
  for (const name of ['changenow','simpleswap']) {
    const bytes = readFileSync(new URL(`../assets/brands/${name}.png`, import.meta.url));
    assert.deepEqual([...bytes.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
  }
});

test('BTC to XMR preset contains no address or referral data and policy copy is translated', () => {
  assert.equal(EXCHANGES[0].url, 'https://changenow.io/?from=btc&to=xmr');
  assert.equal(CHANGENOW_KYC_SOURCE, 'https://changenow.io/terms-of-use/aml-kyc');
  for (const language of ['es','de','fr','pt','ru','zh-Hans','ja','ko','tr','hi']) {
    const catalog = withExchangeHelp(language, {});
    assert.equal(Object.keys(catalog).length, 12);
    assert.ok(catalog['How a swap works']);
    assert.ok(catalog['Accounts and identity checks']);
    assert.ok(Object.keys(catalog).find(key => key.includes('not a guarantee of no KYC')));
  }
});
