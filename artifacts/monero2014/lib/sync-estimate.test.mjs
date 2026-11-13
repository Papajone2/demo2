import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observeScan, planningRange } from './sync-estimate.ts';
import { COMMUNITY_NODES, ONION_NODES, EXCHANGES } from './community-nodes.ts';
import { requireUnlockedSession } from './session-policy.ts';
import { withWalletRefinements } from '../locales/wallet-refinements.ts';

test('scan estimate ignores initial fast-forward and waits for a measured window', () => {
  let result = observeScan(null, 'a', 0, 1000000, false, 1000);
  result = observeScan(result.window, 'a', 900000, 1000000, false, 4000);
  assert.equal(result.state, 'measuring');
  result = observeScan(result.window, 'a', 900100, 1000000, false, 21000);
  assert.equal(result.state, 'measuring');
});
test('scan estimates include stalls, reset by wallet/node and clear after completion', () => {
  let result = observeScan(null, 'a|node1', 100, 10000, false, 1000);
  for (let time = 21000; time <= 121000; time += 10000) result = observeScan(result.window, 'a|node1', 100 + time / 100, 10000, false, time);
  assert.equal(result.state, 'tracking');
  assert.ok(result.low < result.seconds && result.high > result.seconds);
  assert.ok(result.calibrated);
  const stalled = observeScan(result.window, 'a|node1', result.window.height, 10000, false, 181000);
  assert.equal(stalled.state, 'stalled'); assert.equal(stalled.seconds, 0);
  assert.equal(observeScan(result.window, 'b|node1', 100, 10000, false, 191000).state, 'measuring');
  assert.equal(observeScan(result.window, 'a|node2', 100, 10000, false, 191000).state, 'measuring');
  assert.equal(observeScan(result.window, 'a|node1', 10000, 10000, true, 191000).seconds, 0);
});
test('older restores have longer planning ranges; measured device speed changes the range', () => {
  assert.ok(planningRange(500000).high > planningRange(50000).high);
  assert.ok(planningRange(500000, 200).high < planningRange(500000, 20).high);
  assert.equal(planningRange(500000, NaN).measured, false);
});
test('community presets keep HTTPS/onion boundaries and exchange URLs have no tracking data', () => {
  for (const node of COMMUNITY_NODES) assert.equal(new URL(node.url).protocol, 'https:');
  for (const node of ONION_NODES) assert.match(new URL(node.url).hostname, /^[a-z2-7]{56}\.onion$/);
  for (const exchange of EXCHANGES) {
    const url = new URL(exchange.url);
    assert.equal(url.protocol, 'https:');
    assert.deepEqual([...url.searchParams], exchange.name === 'ChangeNOW' ? [['from', 'btc'], ['to', 'xmr']] : []);
  }
});
test('wallet switching requires an active unlocked session, not another PIN', () => {
  assert.doesNotThrow(() => requireUnlockedSession('unlocked'));
  for (const state of ['loading', 'locked', 'needsSetup', 'error']) assert.throws(() => requireUnlockedSession(state));
  assert.throws(() => requireUnlockedSession('unlocked', false));
});
test('time ranges and the session guard are translated in all wallet languages', () => {
  for (const language of ['es','de','fr','pt','ru','zh-Hans','ja','ko','tr','hi']) {
    const catalog = withWalletRefinements(language, {});
    for (const key of ['{n} min', '{n} h', 'Unlock your wallet first.']) assert.ok(catalog[key]);
  }
});
